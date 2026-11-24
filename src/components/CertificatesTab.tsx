import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  Award,
  Calendar,
  CheckCircle2,
  Download,
  Eye,
  FileCheck2,
  FileImage,
  Lock,
  Palette,
  Plus,
  Printer,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { biText } from '../i18n';
import { PORTAL_ACCENTS } from '../config/portalNavigation';
import {
  buildPayloadFromIssuedCertificate,
  CERTIFICATE_THEMES,
  computeCertificateMetrics,
  extractAssessmentDateIso,
  formatCompletionDate,
  type CertificateRenderPayload,
  type CertificateThemeId,
} from '../services/certificateGenerator';
import { isSuperAdminEmail } from '../services/seedData';
import {
  formatCefrLabel,
  type IssuedCertificate,
  type LangCode,
  type StudentAssessment,
  type StudentProfile,
  type UserProfile,
} from '../types';
import { ProfileAvatar } from './ProfileAvatar';

interface CertificatesTabProps {
  lang: LangCode;
  roleMode: 'admin' | 'parent' | 'student';
  currentUser?: UserProfile | null;
  students: StudentProfile[];
  assessments: StudentAssessment[];
  selectedStudentId?: string;
  onSelectStudentId?: (id: string) => void;
  isLoading?: boolean;
}

const DEFAULT_AWARD_TITLES = [
  {
    en: 'Certificate of Progress & Achievement',
    vi: 'Chứng Nhận Tiến Bộ & Thành Tích Học Tập',
  },
  {
    en: 'Cambridge CEFR Level Promotion Certificate',
    vi: 'Chứng Nhận Hoàn Thành & Thăng Cấp Cambridge CEFR',
  },
  {
    en: 'Be Whole Values & English Excellence Award',
    vi: 'Giải Thưởng Xuất Sắc Tiếng Anh & Giá Trị Sống Be Whole',
  },
];

function clip(val: string | undefined | null, maxLen: number): string {
  return (val || '').trim().slice(0, maxLen);
}

function clampScore(val: number): number {
  if (!Number.isFinite(val)) return 0;
  return Math.max(0, Math.min(100, Math.round(val)));
}

function getTimestampSeconds(val: unknown): number {
  if (!val || typeof val !== 'object') return 0;
  const maybe = val as { seconds?: number; toMillis?: () => number };
  if (typeof maybe.seconds === 'number') return maybe.seconds;
  if (typeof maybe.toMillis === 'function') return Math.floor(maybe.toMillis() / 1000);
  return 0;
}

export const CertificatesTab: React.FC<CertificatesTabProps> = ({
  lang,
  roleMode,
  currentUser,
  students,
  assessments,
  selectedStudentId,
  onSelectStudentId,
  isLoading = false,
}) => {
  const isAdminMode = roleMode === 'admin';
  const portalAccent = PORTAL_ACCENTS[roleMode === 'admin' ? 'admin' : roleMode === 'parent' ? 'parent' : 'student'];
  const resolvedEmail = (currentUser?.email || auth.currentUser?.email || '').toLowerCase();
  const resolvedUid = currentUser?.uid || auth.currentUser?.uid || '';
  const resolvedDisplayName = currentUser?.displayName || auth.currentUser?.displayName || resolvedEmail || 'LiLab Admin';
  const resolvedRole = currentUser?.role || (isAdminMode ? 'admin' : roleMode);

  // Firestore issued certificates collection
  const [issuedCertificates, setIssuedCertificates] = useState<IssuedCertificate[]>([]);
  const [certsLoaded, setCertsLoaded] = useState(false);

  // Student selection
  const [internalStudentId, setInternalStudentId] = useState<string>(
    selectedStudentId || students[0]?.id || ''
  );
  const [studentSearch, setStudentSearch] = useState('');

  // Selected certificate in the student's collection (for Parent/Student viewing, or Admin editing/viewing)
  const [selectedCertId, setSelectedCertId] = useState<string | null>(null);
  // In Admin mode: 'new' = drafting a fresh certificate to issue; 'existing' = inspecting/editing an issued certificate
  const [adminEditorMode, setAdminEditorMode] = useState<'new' | 'existing'>('new');

  // Admin-only draft / editor fields
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>('latest');
  const [theme, setTheme] = useState<CertificateThemeId>('royal_gold');
  const [certLang, setCertLang] = useState<LangCode>(lang);
  const [showScores, setShowScores] = useState(true);
  const [showStudentPhoto, setShowStudentPhoto] = useState(true);
  const [issueDate, setIssueDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [hasManualDateOverride, setHasManualDateOverride] = useState(false);
  const [awardTitleEn, setAwardTitleEn] = useState(DEFAULT_AWARD_TITLES[0].en);
  const [awardTitleVi, setAwardTitleVi] = useState(DEFAULT_AWARD_TITLES[0].vi);
  const [directorName, setDirectorName] = useState('LiLab Academic Board');
  const [customTeacherName, setCustomTeacherName] = useState('');
  const [customCitationEn, setCustomCitationEn] = useState('');
  const [customCitationVi, setCustomCitationVi] = useState('');
  const [showAdminCustomize, setShowAdminCustomize] = useState(true);

  // Shared preview & action states
  const [previewMode, setPreviewMode] = useState<'sheet' | 'canvas'>('sheet');
  const [canvasPreviewUrl, setCanvasPreviewUrl] = useState<string | null>(null);
  const [isRenderingCanvas, setIsRenderingCanvas] = useState(false);
  const [busyExport, setBusyExport] = useState<'pdf' | 'png' | null>(null);
  const [busyIssue, setBusyIssue] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Subscribe to Firestore /issued_certificates with role-scoped query
  useEffect(() => {
    if (!resolvedEmail && !resolvedUid) {
      setCertsLoaded(true);
      return;
    }

    const isAdminAccount =
      isSuperAdminEmail(resolvedEmail) ||
      resolvedRole === 'super_admin' ||
      resolvedRole === 'admin';

    const certsQuery = isAdminAccount
      ? collection(db, 'issued_certificates')
      : roleMode === 'student'
        ? query(collection(db, 'issued_certificates'), where('studentEmail', '==', resolvedEmail))
        : query(collection(db, 'issued_certificates'), where('parentEmail', '==', resolvedEmail));

    setCertsLoaded(false);
    const unsub = onSnapshot(
      certsQuery,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as IssuedCertificate));
        list.sort((a, b) => {
          const dateDiff = (b.issueDate || '').localeCompare(a.issueDate || '');
          if (dateDiff !== 0) return dateDiff;
          return getTimestampSeconds(b.createdAt) - getTimestampSeconds(a.createdAt);
        });
        setIssuedCertificates(list);
        setCertsLoaded(true);
      },
      (err) => {
        setCertsLoaded(true);
        console.warn('issued_certificates listener fallback:', err);
      }
    );

    return () => unsub();
  }, [resolvedEmail, resolvedUid, resolvedRole, roleMode]);

  useEffect(() => {
    if (isAdminMode && adminEditorMode === 'new') {
      setCertLang(lang);
    }
  }, [lang, isAdminMode, adminEditorMode]);

  useEffect(() => {
    if (selectedStudentId && students.some((s) => s.id === selectedStudentId)) {
      setInternalStudentId(selectedStudentId);
    } else if (!students.some((s) => s.id === internalStudentId) && students[0]) {
      setInternalStudentId(students[0].id);
    }
  }, [selectedStudentId, students, internalStudentId]);

  const activeStudentId =
    selectedStudentId && onSelectStudentId ? selectedStudentId : internalStudentId;

  const certCountByStudentId = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of issuedCertificates) {
      counts[c.studentId] = (counts[c.studentId] || 0) + 1;
    }
    return counts;
  }, [issuedCertificates]);

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.fullName.toLowerCase().includes(q) ||
        s.cefrLevel.toLowerCase().includes(q) ||
        (s.parentName || '').toLowerCase().includes(q)
    );
  }, [students, studentSearch]);

  const activeStudent = useMemo(
    () => students.find((s) => s.id === activeStudentId) || students[0] || null,
    [students, activeStudentId]
  );

  const studentAssessments = useMemo(() => {
    if (!activeStudent) return [];
    return assessments
      .filter((a) => a.studentId === activeStudent.id)
      .sort((a, b) => getTimestampSeconds(b.createdAt) - getTimestampSeconds(a.createdAt));
  }, [assessments, activeStudent]);

  // All certificates issued specifically for the active student (Admin-issued Firestore records)
  // Plus fallback read-only certificates from published CEFR assessments so Parent/Student always see working certificates immediately!
  const studentIssuedCertificates = useMemo(() => {
    if (!activeStudent) return [];
    const firestoreCerts = issuedCertificates.filter((c) => c.studentId === activeStudent.id);
    if (isAdminMode || firestoreCerts.length > 0) {
      return firestoreCerts;
    }

    // Fallback read-only collection built from the student's existing CEFR assessments (or current milestone)
    const fallbackList: IssuedCertificate[] = [];
    const sources: Array<StudentAssessment | null> =
      studentAssessments.length > 0 ? studentAssessments : [null];

    for (const asm of sources) {
      const m = computeCertificateMetrics(activeStudent, asm);
      const isoDate = extractAssessmentDateIso(asm);
      const citationEn = asm?.teacherCommentEn?.trim()
        ? asm.teacherCommentEn.trim()
        : `In recognition of dedicated progress in Cambridge ${m.cefrDisplay} (${m.pceCourse.titleEn}) and compassionate character growth through the Be Whole Values curriculum.`;
      const citationVi = asm?.teacherCommentVi?.trim()
        ? asm.teacherCommentVi.trim()
        : `Ghi nhận sự nỗ lực vượt trội trong hành trình tiếng Anh Cambridge ${m.cefrDisplay} (${m.pceCourse.titleVi}) và phát triển nhân cách toàn diện theo chương trình Giá trị Sống Be Whole.`;

      fallbackList.push({
        id: asm ? `asm_cert_${asm.id}` : `milestone_cert_${activeStudent.id}`,
        studentId: activeStudent.id,
        studentName: activeStudent.fullName,
        studentAge: activeStudent.age,
        studentGender: activeStudent.gender,
        studentPhotoUrl: activeStudent.photoUrl,
        parentEmail: activeStudent.parentEmail,
        studentEmail: activeStudent.studentEmail,
        assessmentId: asm?.id,
        serialId: m.serialId,
        cefrLevel: m.cefrLevel,
        cefrModifier: m.cefrModifier,
        cefrDisplay: m.cefrDisplay,
        pceLevelNumber: m.pceCourse.levelNumber,
        className: asm?.className || m.pceCourse.titleEn,
        termLabel:
          asm?.termLabel ||
          biText(lang, 'Academic Progress Milestone', 'Cột Mốc Tiến Bộ Học Tập'),
        teacherName: asm?.teacherName || 'LiLab Faculty',
        directorName: 'LiLab Academic Board',
        directorTitleEn: 'Academic Director · LiLab Academy',
        directorTitleVi: 'Giám đốc Học thuật · Học viện LiLab',
        awardTitleEn: DEFAULT_AWARD_TITLES[0].en,
        awardTitleVi: DEFAULT_AWARD_TITLES[0].vi,
        citationEn,
        citationVi,
        issueDate: isoDate,
        certLang: lang,
        theme: 'royal_gold',
        showScores: m.hasScores,
        showStudentPhoto: true,
        hasScores: m.hasScores,
        speakingScore: m.speaking,
        readingScore: m.reading,
        writingScore: m.writing,
        vocabularyScore: m.vocabulary,
        comprehensionScore: m.comprehension,
        socialScore: m.social,
        emotionalScore: m.emotional,
        mentalScore: m.mental,
        englishAvg: m.englishAvg,
        wholeChildAvg: m.wholeChildAvg,
        compositeScore: m.compositeScore,
        honorTierKey: m.honorTier.key,
        issuedByUid: 'lilab_academy',
        issuedByEmail: 'lilabvietnam@gmail.com',
        issuedByName: 'LiLab Academic Board',
      });
    }
    return fallbackList;
  }, [issuedCertificates, activeStudent, isAdminMode, studentAssessments, lang]);

  // Reset student-level editor state when switching students
  useEffect(() => {
    setConfirmDeleteId(null);
    setSelectedAssessmentId('latest');
    setCustomTeacherName('');
    setCustomCitationEn('');
    setCustomCitationVi('');
    setHasManualDateOverride(false);
    if (!isAdminMode) {
      setSelectedCertId(null);
    } else {
      setAdminEditorMode('new');
      setSelectedCertId(null);
    }
  }, [activeStudent?.id, isAdminMode]);

  // Auto-select the latest issued certificate in Parent/Student view (or if selected one was deleted)
  useEffect(() => {
    if (!isAdminMode) {
      if (studentIssuedCertificates.length === 0) {
        if (selectedCertId !== null) setSelectedCertId(null);
      } else if (
        !selectedCertId ||
        !studentIssuedCertificates.some((c) => c.id === selectedCertId)
      ) {
        setSelectedCertId(studentIssuedCertificates[0].id);
      }
    } else if (
      adminEditorMode === 'existing' &&
      selectedCertId &&
      !studentIssuedCertificates.some((c) => c.id === selectedCertId)
    ) {
      setAdminEditorMode('new');
      setSelectedCertId(null);
    }
  }, [isAdminMode, adminEditorMode, studentIssuedCertificates, selectedCertId]);

  const selectedIssuedCert = useMemo(() => {
    if (!selectedCertId) return null;
    return studentIssuedCertificates.find((c) => c.id === selectedCertId) || null;
  }, [studentIssuedCertificates, selectedCertId]);

  const activeAssessment = useMemo(() => {
    if (selectedAssessmentId === 'milestone_only') return null;
    if (selectedAssessmentId === 'latest') return studentAssessments[0] || null;
    return (
      studentAssessments.find((a) => a.id === selectedAssessmentId) ||
      studentAssessments[0] ||
      null
    );
  }, [studentAssessments, selectedAssessmentId]);

  // Auto-sync Date of Completion in Admin new-draft mode unless manually overridden
  useEffect(() => {
    if (!isAdminMode || adminEditorMode !== 'new' || hasManualDateOverride) return;
    setIssueDate(extractAssessmentDateIso(activeAssessment));
  }, [isAdminMode, adminEditorMode, activeAssessment, hasManualDateOverride]);

  const draftMetrics = useMemo(() => {
    if (!activeStudent) return null;
    return computeCertificateMetrics(activeStudent, activeAssessment);
  }, [activeStudent, activeAssessment]);

  // Build the active CertificateRenderPayload:
  // - Parent/Student: ALWAYS strictly from the selected IssuedCertificate Firestore record (read-only!)
  // - Admin (editing existing): starts from the IssuedCertificate's frozen metrics, applying Admin edits live
  // - Admin (drafting new): builds from activeStudent + activeAssessment + Admin form controls
  const payload: CertificateRenderPayload | null = useMemo(() => {
    if (!isAdminMode) {
      if (!selectedIssuedCert) return null;
      return buildPayloadFromIssuedCertificate(selectedIssuedCert);
    }

    if (adminEditorMode === 'existing' && selectedIssuedCert) {
      const base = buildPayloadFromIssuedCertificate(selectedIssuedCert);
      return {
        ...base,
        teacherName: customTeacherName.trim() || base.teacherName,
        directorName: directorName.trim() || base.directorName,
        awardTitleEn: awardTitleEn.trim() || base.awardTitleEn,
        awardTitleVi: awardTitleVi.trim() || base.awardTitleVi,
        citationEn: customCitationEn.trim() || base.citationEn,
        citationVi: customCitationVi.trim() || base.citationVi,
        issueDate: issueDate || base.issueDate,
        lang: certLang,
        theme,
        showScores,
        showStudentPhoto,
      };
    }

    if (!activeStudent || !draftMetrics) return null;

    const defaultCitationEn = activeAssessment?.teacherCommentEn?.trim()
      ? activeAssessment.teacherCommentEn.trim()
      : `In recognition of dedicated progress in Cambridge ${draftMetrics.cefrDisplay} (${draftMetrics.pceCourse.titleEn}) and compassionate character growth through the Be Whole Values curriculum.`;

    const defaultCitationVi = activeAssessment?.teacherCommentVi?.trim()
      ? activeAssessment.teacherCommentVi.trim()
      : `Ghi nhận sự nỗ lực vượt trội trong hành trình tiếng Anh Cambridge ${draftMetrics.cefrDisplay} (${draftMetrics.pceCourse.titleVi}) và phát triển nhân cách toàn diện theo chương trình Giá trị Sống Be Whole.`;

    return {
      studentName: activeStudent.fullName,
      studentAge: activeStudent.age,
      studentGender: activeStudent.gender,
      studentPhotoUrl: activeStudent.photoUrl,
      className: activeAssessment?.className || draftMetrics.pceCourse.titleEn,
      termLabel:
        activeAssessment?.termLabel ||
        biText(certLang, 'Academic Progress Milestone', 'Cột Mốc Tiến Bộ Học Tập'),
      teacherName: customTeacherName.trim() || activeAssessment?.teacherName || 'LiLab Faculty',
      directorName: directorName.trim() || 'LiLab Academic Board',
      directorTitleEn: 'Academic Director · LiLab Academy',
      directorTitleVi: 'Giám đốc Học thuật · Học viện LiLab',
      awardTitleEn: awardTitleEn.trim() || DEFAULT_AWARD_TITLES[0].en,
      awardTitleVi: awardTitleVi.trim() || DEFAULT_AWARD_TITLES[0].vi,
      citationEn: customCitationEn.trim() || defaultCitationEn,
      citationVi: customCitationVi.trim() || defaultCitationVi,
      issueDate,
      lang: certLang,
      theme,
      showScores,
      showStudentPhoto,
      metrics: draftMetrics,
    };
  }, [
    isAdminMode,
    adminEditorMode,
    selectedIssuedCert,
    activeStudent,
    activeAssessment,
    draftMetrics,
    certLang,
    customTeacherName,
    directorName,
    awardTitleEn,
    awardTitleVi,
    customCitationEn,
    customCitationVi,
    issueDate,
    theme,
    showScores,
    showStudentPhoto,
  ]);

  // Live pixel-exact Print Canvas renderer when user switches to Exact Print Canvas mode
  useEffect(() => {
    if (previewMode !== 'canvas' || !payload) return;
    let cancelled = false;
    setIsRenderingCanvas(true);
    const timer = setTimeout(() => {
      import('../services/certificateGenerator')
        .then((mod) => mod.renderCertificateToCanvas(payload))
        .then((canvas) => {
          if (!cancelled) {
            setCanvasPreviewUrl(canvas.toDataURL('image/png'));
          }
        })
        .catch(() => {
          if (!cancelled) setCanvasPreviewUrl(null);
        })
        .finally(() => {
          if (!cancelled) setIsRenderingCanvas(false);
        });
    }, 120);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [previewMode, payload]);

  const notify = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3600);
  };

  const handleSelectStudent = (id: string) => {
    setInternalStudentId(id);
    if (onSelectStudentId) onSelectStudentId(id);
  };

  // Admin: load an existing issued certificate into the editor
  const handleAdminLoadIssuedCert = (cert: IssuedCertificate) => {
    if (!isAdminMode) return;
    setAdminEditorMode('existing');
    setSelectedCertId(cert.id);
    setTheme(cert.theme);
    setCertLang(cert.certLang);
    setShowScores(cert.showScores);
    setShowStudentPhoto(cert.showStudentPhoto);
    setIssueDate(cert.issueDate);
    setHasManualDateOverride(true);
    setAwardTitleEn(cert.awardTitleEn);
    setAwardTitleVi(cert.awardTitleVi);
    setDirectorName(cert.directorName);
    setCustomTeacherName(cert.teacherName);
    setCustomCitationEn(cert.citationEn);
    setCustomCitationVi(cert.citationVi);
    setConfirmDeleteId(null);
  };

  // Admin: start a fresh draft certificate to issue for the active student
  const handleAdminStartNewDraft = () => {
    if (!isAdminMode) return;
    setAdminEditorMode('new');
    setSelectedCertId(null);
    setSelectedAssessmentId('latest');
    setTheme('royal_gold');
    setCertLang(lang);
    setShowScores(true);
    setShowStudentPhoto(true);
    setHasManualDateOverride(false);
    setIssueDate(extractAssessmentDateIso(studentAssessments[0] || null));
    setAwardTitleEn(DEFAULT_AWARD_TITLES[0].en);
    setAwardTitleVi(DEFAULT_AWARD_TITLES[0].vi);
    setDirectorName('LiLab Academic Board');
    setCustomTeacherName('');
    setCustomCitationEn('');
    setCustomCitationVi('');
    setConfirmDeleteId(null);
  };

  // Admin-only: Issue a new official certificate OR save updates to an existing issued certificate
  const handleAdminIssueOrUpdate = async () => {
    if (!isAdminMode || !activeStudent || !payload) return;
    setBusyIssue(true);
    try {
      const m = payload.metrics;

      if (adminEditorMode === 'existing' && selectedIssuedCert) {
        const updatePayload: Record<string, unknown> = {
          className: clip(payload.className, 120) || 'LiLab Academy',
          termLabel: clip(payload.termLabel, 120) || 'Academic Milestone',
          teacherName: clip(payload.teacherName, 120) || 'LiLab Faculty',
          directorName: clip(payload.directorName, 120) || 'LiLab Academic Board',
          directorTitleEn: clip(payload.directorTitleEn, 120) || 'Academic Director · LiLab Academy',
          directorTitleVi: clip(payload.directorTitleVi, 120) || 'Giám đốc Học thuật · Học viện LiLab',
          awardTitleEn: clip(payload.awardTitleEn, 160) || DEFAULT_AWARD_TITLES[0].en,
          awardTitleVi: clip(payload.awardTitleVi, 160) || DEFAULT_AWARD_TITLES[0].vi,
          citationEn: clip(payload.citationEn, 1000) || 'In recognition of dedicated academic progress.',
          citationVi: clip(payload.citationVi, 1000) || 'Ghi nhận sự nỗ lực và tiến bộ xuất sắc trong học tập.',
          issueDate: clip(payload.issueDate, 20) || new Date().toISOString().slice(0, 10),
          certLang: payload.lang,
          theme: payload.theme,
          showScores: Boolean(payload.showScores),
          showStudentPhoto: Boolean(payload.showStudentPhoto),
          updatedAt: serverTimestamp(),
        };

        await updateDoc(doc(db, 'issued_certificates', selectedIssuedCert.id), updatePayload);
        notify(
          biText(
            lang,
            `Updated official certificate ${selectedIssuedCert.serialId} for ${activeStudent.fullName}.`,
            `Đã cập nhật chứng nhận ${selectedIssuedCert.serialId} cho học viên ${activeStudent.fullName}.`
          )
        );
      } else {
        // Ensure unique serial ID if this student already holds one with the same base code
        const existingSerials = new Set(studentIssuedCertificates.map((c) => c.serialId));
        let uniqueSerial = clip(m.serialId, 52);
        if (existingSerials.has(uniqueSerial)) {
          const suffix = String(studentIssuedCertificates.length + 1).padStart(2, '0');
          uniqueSerial = clip(`${m.serialId}-${suffix}`, 60);
        }

        const certDocId = `cert_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const safeAge = Number.isFinite(activeStudent.age)
          ? Math.max(2, Math.min(25, Math.round(activeStudent.age)))
          : 7;

        const newRecord: Record<string, unknown> = {
          studentId: clip(activeStudent.id, 128),
          studentName: clip(activeStudent.fullName, 120) || 'LiLab Student',
          studentAge: safeAge,
          studentGender: activeStudent.gender === 'boy' ? 'boy' : 'girl',
          parentEmail: clip(activeStudent.parentEmail, 160).toLowerCase(),
          serialId: uniqueSerial,
          cefrLevel: m.cefrLevel,
          cefrModifier: m.cefrModifier,
          cefrDisplay: clip(m.cefrDisplay, 80) || m.cefrLevel,
          pceLevelNumber: Math.max(1, Math.min(13, Math.round(m.pceCourse.levelNumber || 1))),
          className: clip(payload.className, 120) || 'LiLab Academy',
          termLabel: clip(payload.termLabel, 120) || 'Academic Progress Milestone',
          teacherName: clip(payload.teacherName, 120) || 'LiLab Faculty',
          directorName: clip(payload.directorName, 120) || 'LiLab Academic Board',
          directorTitleEn: clip(payload.directorTitleEn, 120) || 'Academic Director · LiLab Academy',
          directorTitleVi: clip(payload.directorTitleVi, 120) || 'Giám đốc Học thuật · Học viện LiLab',
          awardTitleEn: clip(payload.awardTitleEn, 160) || DEFAULT_AWARD_TITLES[0].en,
          awardTitleVi: clip(payload.awardTitleVi, 160) || DEFAULT_AWARD_TITLES[0].vi,
          citationEn: clip(payload.citationEn, 1000) || 'In recognition of dedicated academic progress.',
          citationVi: clip(payload.citationVi, 1000) || 'Ghi nhận sự nỗ lực và tiến bộ xuất sắc trong học tập.',
          issueDate: clip(payload.issueDate, 20) || new Date().toISOString().slice(0, 10),
          certLang: payload.lang,
          theme: payload.theme,
          showScores: Boolean(payload.showScores),
          showStudentPhoto: Boolean(payload.showStudentPhoto),
          hasScores: Boolean(m.hasScores),
          speakingScore: clampScore(m.speaking),
          readingScore: clampScore(m.reading),
          writingScore: clampScore(m.writing),
          vocabularyScore: clampScore(m.vocabulary),
          comprehensionScore: clampScore(m.comprehension),
          socialScore: clampScore(m.social),
          emotionalScore: clampScore(m.emotional),
          mentalScore: clampScore(m.mental),
          englishAvg: clampScore(m.englishAvg),
          wholeChildAvg: clampScore(m.wholeChildAvg),
          compositeScore: clampScore(m.compositeScore),
          honorTierKey: m.honorTier.key,
          issuedByUid: clip(resolvedUid, 128),
          issuedByEmail: clip(resolvedEmail, 160).toLowerCase(),
          issuedByName: clip(resolvedDisplayName, 120) || 'LiLab Admin',
          adminUids: resolvedUid ? [resolvedUid] : [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        if (activeStudent.photoUrl && activeStudent.photoUrl.length <= 250000) {
          newRecord.studentPhotoUrl = activeStudent.photoUrl;
        }
        if (activeStudent.parentUid) {
          newRecord.parentUid = clip(activeStudent.parentUid, 128);
        }
        if (activeStudent.studentEmail) {
          newRecord.studentEmail = clip(activeStudent.studentEmail, 160).toLowerCase();
        }
        if (activeAssessment?.id) {
          newRecord.assessmentId = clip(activeAssessment.id, 128);
        }

        await setDoc(doc(db, 'issued_certificates', certDocId), newRecord);
        setAdminEditorMode('existing');
        setSelectedCertId(certDocId);
        notify(
          biText(
            lang,
            `Official certificate ${uniqueSerial} issued for ${activeStudent.fullName}! It is now live in their Parent & Student portals.`,
            `Đã cấp chứng nhận chính thức ${uniqueSerial} cho ${activeStudent.fullName}! Phụ huynh và học viên đã có thể xem và in ngay.`
          )
        );
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'issued_certificates');
    } finally {
      setBusyIssue(false);
    }
  };

  // Admin-only: Revoke / delete an issued certificate
  const handleAdminDeleteCertificate = async (cert: IssuedCertificate) => {
    if (!isAdminMode) return;
    setBusyIssue(true);
    try {
      await deleteDoc(doc(db, 'issued_certificates', cert.id));
      setConfirmDeleteId(null);
      if (selectedCertId === cert.id) {
        setSelectedCertId(null);
        setAdminEditorMode('new');
      }
      notify(
        biText(
          lang,
          `Removed certificate ${cert.serialId} from ${cert.studentName}'s record.`,
          `Đã thu hồi chứng nhận ${cert.serialId} khỏi hồ sơ của ${cert.studentName}.`
        )
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'issued_certificates');
    } finally {
      setBusyIssue(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!payload) return;
    setBusyExport('pdf');
    try {
      const { downloadCertificatePdf } = await import('../services/certificateGenerator');
      await downloadCertificatePdf(payload);
      notify(
        biText(
          lang,
          `Official PDF certificate downloaded for ${payload.studentName}!`,
          `Đã tải xuống chứng nhận PDF chính thức cho ${payload.studentName}!`
        )
      );
    } finally {
      setBusyExport(null);
    }
  };

  const handleDownloadPng = async () => {
    if (!payload) return;
    setBusyExport('png');
    try {
      const { downloadCertificatePng } = await import('../services/certificateGenerator');
      await downloadCertificatePng(payload);
      notify(
        biText(
          lang,
          `High-resolution PNG certificate downloaded for ${payload.studentName}!`,
          `Đã tải xuống ảnh chứng nhận PNG sắc nét cho ${payload.studentName}!`
        )
      );
    } finally {
      setBusyExport(null);
    }
  };

  const handlePrintCertificate = () => {
    if (!payload) return;
    window.print();
  };

  // Loading state
  if ((isLoading || !certsLoaded) && students.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-[#172154]/10 p-10 text-center space-y-3">
        <div className="w-12 h-12 rounded-xl bg-[#F8F9FB] border border-[#172154]/10 text-[#2D3E99] flex items-center justify-center mx-auto animate-pulse">
          <Award className="w-6 h-6" />
        </div>
        <h3 className="font-display text-lg font-extrabold text-[#172154]">
          {biText(lang, 'Loading Official Certificates...', 'Đang Tải Hồ Sơ Chứng Nhận...')}
        </h3>
        <p className="text-sm text-[#172154]/65 max-w-md mx-auto">
          {biText(
            lang,
            'Retrieving student profiles and officially issued LiLab certificates.',
            'Đang đồng bộ danh sách học viên và các chứng nhận chính thức từ LiLab.'
          )}
        </p>
      </div>
    );
  }

  if (!activeStudent) {
    return (
      <div className="bg-white rounded-xl border border-[#172154]/10 p-10 text-center space-y-3">
        <div className="w-12 h-12 rounded-xl bg-[#F8F9FB] border border-[#172154]/10 text-[#2D3E99] flex items-center justify-center mx-auto">
          <Award className="w-6 h-6" />
        </div>
        <h3 className="font-display text-lg font-extrabold text-[#172154]">
          {biText(lang, 'No Student Profile Linked', 'Chưa Có Hồ Sơ Học Viên Liên Kết')}
        </h3>
        <p className="text-sm text-[#172154]/65 max-w-md mx-auto">
          {biText(
            lang,
            'Once a student profile is linked to this account, all official LiLab certificates will appear here.',
            'Khi hồ sơ học viên được liên kết với tài khoản này, toàn bộ chứng nhận chính thức từ LiLab sẽ hiển thị tại đây.'
          )}
        </p>
      </div>
    );
  }

  const activePalette = payload
    ? CERTIFICATE_THEMES[payload.theme] || CERTIFICATE_THEMES.royal_gold
    : CERTIFICATE_THEMES.royal_gold;

  const activeLang = payload?.lang || lang;
  const formattedCompletionDate = payload
    ? formatCompletionDate(payload.issueDate, activeLang)
    : '';

  const skillItems = payload
    ? [
        { labelEn: 'Speaking', labelVi: 'Nói', val: payload.metrics.speaking, color: activePalette.primary },
        { labelEn: 'Reading', labelVi: 'Đọc', val: payload.metrics.reading, color: activePalette.primary },
        { labelEn: 'Writing', labelVi: 'Viết', val: payload.metrics.writing, color: activePalette.primary },
        { labelEn: 'Vocab', labelVi: 'Từ vựng', val: payload.metrics.vocabulary, color: activePalette.primary },
        { labelEn: 'Listening', labelVi: 'Nghe', val: payload.metrics.comprehension, color: activePalette.primary },
        { labelEn: 'Social', labelVi: 'Xã hội', val: payload.metrics.social, color: '#0F766E' },
        { labelEn: 'Emotional', labelVi: 'Cảm xúc', val: payload.metrics.emotional, color: '#0F766E' },
        { labelEn: 'Mental', labelVi: 'Tư duy', val: payload.metrics.mental, color: '#0F766E' },
      ]
    : [];

  // Shared read-only Landscape A4 certificate viewer (used by Admin preview AND Parent/Student read-only view)
  const renderCertificateStage = () => {
    if (!payload) return null;
    const metrics = payload.metrics;

    return (
      <div className="space-y-3">
        {/* Live Preview Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-1 no-print">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#172154]/70">
            {!isAdminMode && selectedIssuedCert ? (
              <span className="inline-flex items-center gap-1.5 font-semibold text-[#0F766E]">
                <Lock className="w-3.5 h-3.5" />
                {biText(lang, 'Official Read-Only Record', 'Bản Chính Thức (Chỉ Xem & In)')}
              </span>
            ) : isAdminMode && adminEditorMode === 'existing' && selectedIssuedCert ? (
              <span className="inline-flex items-center gap-1.5 font-semibold text-[#0F766E]">
                <ShieldCheck className="w-3.5 h-3.5" />
                {biText(lang, 'Officially Issued Certificate', 'Chứng Nhận Đã Cấp Phát')}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-semibold text-[#FF6B00]">
                <Award className="w-3.5 h-3.5" />
                {biText(lang, 'Admin Draft Preview (Not Yet Issued)', 'Bản Nháp Quản Trị (Chưa Cấp Phát)')}
              </span>
            )}
            <span aria-hidden="true">·</span>
            <span>Landscape A4</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-num tabular-nums font-semibold text-[#172154]">
              {metrics.serialId}
            </span>
          </div>

          <div className="flex items-center gap-1 p-1 bg-white border border-[#172154]/10 rounded-lg">
            <button
              type="button"
              onClick={() => setPreviewMode('sheet')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                previewMode === 'sheet'
                  ? 'bg-[#172154] text-white'
                  : 'text-[#172154]/75 hover:text-[#172154]'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{biText(lang, 'Certificate View', 'Xem Chứng Nhận')}</span>
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode('canvas')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                previewMode === 'canvas'
                  ? 'bg-[#172154] text-white'
                  : 'text-[#172154]/75 hover:text-[#172154]'
              }`}
            >
              <FileImage className="w-3.5 h-3.5" />
              <span>{biText(lang, 'Exact Print Render', 'Bản Xuất In A4')}</span>
            </button>
          </div>
        </div>

        {/* Exact Canvas Preview Mode */}
        {previewMode === 'canvas' && (
          <div className="rounded-xl overflow-hidden border border-[#172154]/10 bg-white no-print">
            {isRenderingCanvas || !canvasPreviewUrl ? (
              <div className="aspect-[2339/1654] w-full flex flex-col items-center justify-center bg-[#FDF9EE] text-sm font-semibold text-[#2D3E99] gap-2">
                <span>
                  {biText(
                    lang,
                    'Rendering high-resolution Landscape A4 certificate...',
                    'Đang kết xuất bản in chứng nhận A4 độ phân giải cao...'
                  )}
                </span>
              </div>
            ) : (
              <img
                src={canvasPreviewUrl}
                alt={`Certificate for ${payload.studentName}`}
                referrerPolicy="no-referrer"
                className="w-full h-auto block"
              />
            )}
          </div>
        )}

        {/* Printable Certificate Sheet (Always in DOM for Printing) */}
        <div
          id="lilab-certificate-print-stage"
          className={`certificate-print-root rounded-xl overflow-hidden border border-[#172154]/12 transition-opacity duration-150 ${
            previewMode === 'canvas' ? 'hidden print:block' : 'block'
          }`}
          style={{ backgroundColor: activePalette.bgCanvas }}
        >
          {/* Top Tri-Color Brand Strip */}
          <div className="h-2.5 w-full flex">
            <div className="w-[65%]" style={{ backgroundColor: activePalette.primary }} />
            <div className="w-[17%] bg-[#FFD41D]" />
            <div className="w-[18%]" style={{ backgroundColor: activePalette.accent }} />
          </div>

          <div className="p-4 sm:p-7">
            {/* Outer Frame */}
            <div
              className="relative bg-white rounded-2xl p-2 sm:p-3"
              style={{ border: `4px solid ${activePalette.primary}` }}
            >
              {/* Inner Gold/Secondary Frame */}
              <div
                className="relative rounded-xl px-5 sm:px-9 py-6 sm:py-8 overflow-hidden"
                style={{ border: `1.5px solid ${activePalette.secondary}` }}
              >
                {/* Corner Brackets */}
                <span
                  className="pointer-events-none absolute top-2.5 left-2.5 w-7 h-7 border-t-[3px] border-l-[3px]"
                  style={{ borderColor: activePalette.secondary }}
                />
                <span
                  className="pointer-events-none absolute top-2.5 right-2.5 w-7 h-7 border-t-[3px] border-r-[3px]"
                  style={{ borderColor: activePalette.secondary }}
                />
                <span
                  className="pointer-events-none absolute bottom-2.5 left-2.5 w-7 h-7 border-b-[3px] border-l-[3px]"
                  style={{ borderColor: activePalette.secondary }}
                />
                <span
                  className="pointer-events-none absolute bottom-2.5 right-2.5 w-7 h-7 border-b-[3px] border-r-[3px]"
                  style={{ borderColor: activePalette.secondary }}
                />

                {/* Top Meta Row */}
                <div className="flex items-center justify-between text-[11px] font-mono-num tabular-nums font-semibold text-slate-500 mb-3">
                  <span>PCE-Kids Level {metrics.pceCourse.levelNumber} / 13</span>
                  <span>ID: {metrics.serialId}</span>
                </div>

                {/* Centered Logo & Award Title */}
                <div className="text-center space-y-2">
                  <img
                    src="/assets/lilab_logo.png"
                    alt="LiLab Creative Talent Academy"
                    referrerPolicy="no-referrer"
                    className="h-10 sm:h-12 w-auto object-contain mx-auto"
                  />
                  <h3
                    className="font-display text-xl sm:text-3xl font-extrabold tracking-tight leading-tight text-balance"
                    style={{ color: activePalette.primary }}
                  >
                    {activeLang === 'vi' ? payload.awardTitleVi : payload.awardTitleEn}
                  </h3>
                  {activeLang === 'bi' ? (
                    <div
                      className="text-xs sm:text-sm font-bold tracking-wide"
                      style={{ color: activePalette.accent }}
                    >
                      {payload.awardTitleVi}
                    </div>
                  ) : (
                    <div
                      className="text-xs font-semibold tracking-wide"
                      style={{ color: activePalette.secondary }}
                    >
                      {activeLang === 'vi'
                        ? 'Học Viện Tài Năng Sáng Tạo LiLab · Cambridge CEFR & Be Whole'
                        : 'LiLab Creative Talent Academy · Cambridge CEFR & Be Whole Framework'}
                    </div>
                  )}
                  <div
                    className="w-40 h-0.5 mx-auto my-2"
                    style={{ backgroundColor: activePalette.secondary }}
                  />
                  <p className="text-xs sm:text-sm font-medium text-slate-500">
                    {activeLang === 'vi'
                      ? 'Trân trọng chứng nhận và vinh danh học viên'
                      : activeLang === 'bi'
                        ? 'This certificate is proudly presented to · Trân trọng vinh danh học viên'
                        : 'This certificate is proudly presented to'}
                  </p>
                </div>

                {/* Centerpiece Row: Student Portrait + Student Name + LiLab Mascot */}
                <div className="my-4 sm:my-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="w-20 sm:w-24 flex justify-center shrink-0">
                    {payload.showStudentPhoto && (
                      <div
                        className="p-1 rounded-full"
                        style={{ backgroundColor: activePalette.secondary }}
                      >
                        <ProfileAvatar
                          src={payload.studentPhotoUrl}
                          fallbackSrc={
                            payload.studentGender === 'boy'
                              ? '/assets/lila_boy.png'
                              : '/assets/lila_girl.png'
                          }
                          name={payload.studentName}
                          size="lg"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 text-center min-w-0">
                    <div
                      className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight break-words"
                      style={{ color: activePalette.ink }}
                    >
                      {payload.studentName}
                    </div>
                    <div className="w-56 max-w-full h-1.5 rounded-full bg-[#FFD41D] mx-auto mt-2" />
                  </div>

                  <div className="w-20 sm:w-24 flex justify-center shrink-0">
                    <img
                      src={metrics.pceCourse.lilabCharacterImg}
                      alt={metrics.pceCourse.titleEn}
                      referrerPolicy="no-referrer"
                      className="h-20 sm:h-24 w-auto object-contain"
                    />
                  </div>
                </div>

                {/* Dual-Credential Band: CEFR Level Achieved + Date of Completion */}
                <div
                  className="rounded-xl px-4 sm:px-6 py-3.5 text-white mb-3 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
                  style={{ backgroundColor: activePalette.primary }}
                >
                  <div className="sm:col-span-7 text-center sm:text-left">
                    <div className="text-[11px] font-semibold text-[#FFD41D]">
                      {activeLang === 'vi'
                        ? 'Trình độ Cambridge CEFR Đạt Được'
                        : activeLang === 'bi'
                          ? 'Cambridge CEFR Level Achieved · Trình Độ Đạt Được'
                          : 'Cambridge CEFR Level Achieved'}
                    </div>
                    <div className="font-display text-base sm:text-xl font-extrabold tracking-tight text-white mt-0.5">
                      {metrics.cefrDisplay}{' '}
                      <span className="font-semibold text-white/85 text-sm sm:text-base">
                        · {activeLang === 'vi' ? metrics.pceCourse.titleVi : metrics.pceCourse.titleEn}
                      </span>
                    </div>
                  </div>

                  <div className="sm:col-span-5 text-center sm:text-right sm:border-l sm:border-white/25 sm:pl-4">
                    <div className="text-[11px] font-semibold text-[#FFD41D]">
                      {activeLang === 'vi'
                        ? 'Ngày Hoàn Thành'
                        : activeLang === 'bi'
                          ? 'Date of Completion · Ngày Hoàn Thành'
                          : 'Date of Completion'}
                    </div>
                    <div className="font-display text-base sm:text-lg font-extrabold font-mono-num tabular-nums text-white mt-0.5">
                      {formattedCompletionDate}
                    </div>
                  </div>
                </div>

                {/* Class, Term & Honor Standing Line */}
                <div
                  className="text-center text-xs sm:text-sm font-semibold mb-3"
                  style={{ color: activePalette.accent }}
                >
                  {payload.className} · {payload.termLabel} ·{' '}
                  {activeLang === 'vi'
                    ? metrics.honorTier.labelVi
                    : activeLang === 'bi'
                      ? `${metrics.honorTier.labelEn} / ${metrics.honorTier.labelVi}`
                      : metrics.honorTier.labelEn}
                </div>

                {/* Citation Text */}
                <p className="text-center text-xs sm:text-sm text-[#172154]/85 leading-relaxed max-w-2xl mx-auto mb-5">
                  {activeLang === 'vi'
                    ? payload.citationVi
                    : activeLang === 'bi'
                      ? `${payload.citationEn} — ${payload.citationVi}`
                      : payload.citationEn}
                </p>

                {/* 8-Skill Assessment Strip */}
                {payload.showScores && metrics.hasScores && (
                  <div
                    className="rounded-xl p-3.5 sm:p-4 mb-6 border"
                    style={{
                      backgroundColor: activePalette.bgCanvas,
                      borderColor: `${activePalette.primary}25`,
                    }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <span className="text-xs font-bold" style={{ color: activePalette.primary }}>
                        {activeLang === 'vi'
                          ? 'Điểm Đánh Giá Cambridge CEFR & Be Whole'
                          : 'Cambridge CEFR & Be Whole Assessment Scores'}
                      </span>
                      <span
                        className="text-xs font-mono-num tabular-nums font-bold"
                        style={{ color: activePalette.accent }}
                      >
                        ENG {metrics.englishAvg}/100 · WHOLE {metrics.wholeChildAvg}/100 · AVG{' '}
                        {metrics.compositeScore}/100
                      </span>
                    </div>

                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                      {skillItems.map((sk) => (
                        <div
                          key={sk.labelEn}
                          className="bg-white rounded-lg p-2 border border-slate-200 text-center"
                        >
                          <div className="text-[10px] font-bold text-slate-500 truncate">
                            {activeLang === 'vi' ? sk.labelVi : sk.labelEn}
                          </div>
                          <div
                            className="text-base sm:text-lg font-mono-num tabular-nums font-extrabold leading-tight my-0.5"
                            style={{ color: sk.color }}
                          >
                            {sk.val}
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(100, Math.max(8, sk.val))}%`,
                                backgroundColor: sk.color,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Signatures & Official LiLab Achievement Seal */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-end pt-2">
                  {/* Lead Teacher Signature */}
                  <div className="text-center">
                    <div
                      className="font-serif italic text-lg sm:text-xl font-bold mb-1"
                      style={{ color: activePalette.primary }}
                    >
                      {payload.teacherName}
                    </div>
                    <div className="h-px bg-[#172154]/40 w-44 mx-auto mb-1.5" />
                    <div className="text-xs font-extrabold text-[#172154]">
                      {payload.teacherName}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {activeLang === 'vi'
                        ? 'Giáo viên Phụ trách Cambridge CEFR'
                        : 'Lead Cambridge CEFR Teacher'}
                    </div>
                  </div>

                  {/* Center Seal Rosette */}
                  <div className="flex flex-col items-center justify-center">
                    <div
                      className="w-24 h-24 rounded-full flex flex-col items-center justify-center border-4 border-dashed text-center px-2"
                      style={{
                        backgroundColor: activePalette.sealBg,
                        borderColor: activePalette.sealRing,
                      }}
                    >
                      <span className="text-[9px] font-extrabold tracking-wider text-[#FFD41D] uppercase">
                        {activeLang === 'vi'
                          ? metrics.honorTier.shortSealVi
                          : metrics.honorTier.shortSealEn}
                      </span>
                      <span className="font-mono-num tabular-nums text-xl font-extrabold text-white leading-none my-0.5">
                        {metrics.hasScores
                          ? `${metrics.compositeScore}%`
                          : metrics.cefrLevel.split(' ')[0]}
                      </span>
                      <span className="text-[9px] font-bold text-[#FDF9EE] tracking-widest">
                        LILAB SEAL
                      </span>
                    </div>
                  </div>

                  {/* Academic Director Signature */}
                  <div className="text-center">
                    <div
                      className="font-serif italic text-lg sm:text-xl font-bold mb-1"
                      style={{ color: activePalette.primary }}
                    >
                      {payload.directorName}
                    </div>
                    <div className="h-px bg-[#172154]/40 w-44 mx-auto mb-1.5" />
                    <div className="text-xs font-extrabold text-[#172154]">
                      {payload.directorName}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {activeLang === 'vi' ? payload.directorTitleVi : payload.directorTitleEn}
                    </div>
                  </div>
                </div>

                {/* Verification Footer */}
                <div className="mt-6 pt-3 border-t border-slate-200/80 text-center text-[11px] text-slate-500 font-medium">
                  {activeLang === 'vi' ? 'Ngày hoàn thành' : 'Completed on'}:{' '}
                  <span className="font-mono-num tabular-nums font-bold text-[#172154]">
                    {formattedCompletionDate}
                  </span>{' '}
                  · LiLab Creative Talent Academy · ParcSpring, TP.HCM ·{' '}
                  <span className="font-mono-num tabular-nums font-bold text-[#2D3E99]">
                    {metrics.serialId}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Tri-Color Brand Strip */}
          <div className="h-2.5 w-full flex">
            <div className="w-[65%]" style={{ backgroundColor: activePalette.primary }} />
            <div className="w-[17%] bg-[#FFD41D]" />
            <div className="w-[18%]" style={{ backgroundColor: activePalette.accent }} />
          </div>
        </div>
      </div>
    );
  };

  // =========================================================================
  // PARENT & STUDENT VIEW — STRICTLY READ-ONLY OFFICIAL CERTIFICATE COLLECTION
  // =========================================================================
  if (!isAdminMode) {
    return (
      <div className="space-y-5">
        {toastMsg && (
          <div className="no-print bg-[#ECFDF5] border border-[#0F766E]/25 text-[#0F766E] px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Header Bar */}
        <div className="no-print bg-white rounded-xl border border-[#172154]/10 p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-xl sm:text-2xl font-extrabold text-[#172154] tracking-tight">
                {biText(lang, 'Official Certificate Collection', 'Bộ Sưu Tập Chứng Nhận Chính Thức')}
              </h2>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0F766E] bg-[#ECFDF5] border border-[#0F766E]/20 px-2.5 py-0.5 rounded-md">
                <Lock className="w-3 h-3" />
                {biText(lang, 'View & Print Only', 'Chỉ Xem & In')}
              </span>
            </div>
            <p className="text-xs text-[#172154]/65">
              {activeStudent.fullName} · {formatCefrLabel(activeStudent.cefrLevel, activeStudent.cefrModifier)} ·{' '}
              <span className="font-mono-num tabular-nums font-semibold text-[#172154]">
                {studentIssuedCertificates.length}{' '}
                {biText(
                  lang,
                  studentIssuedCertificates.length === 1 ? 'official certificate' : 'official certificates',
                  'chứng nhận chính thức'
                )}
              </span>
            </p>
          </div>

          {payload && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handlePrintCertificate}
                className="px-3.5 py-2 rounded-lg bg-white border border-[#172154]/15 hover:border-[#172154]/35 text-[#172154] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>{biText(lang, 'Print', 'In Chứng Nhận')}</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadPng}
                disabled={busyExport !== null}
                className="px-3.5 py-2 rounded-lg bg-white border border-[#172154]/15 hover:border-[#172154]/35 text-[#172154] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
              >
                <FileImage className="w-4 h-4" />
                <span>
                  {busyExport === 'png'
                    ? biText(lang, 'Exporting...', 'Đang xuất...')
                    : biText(lang, 'Download PNG', 'Tải PNG')}
                </span>
              </button>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={busyExport !== null}
                className={`px-4 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors ${portalAccent.primaryBtnClass}`}
              >
                <Download className="w-4 h-4" />
                <span>
                  {busyExport === 'pdf'
                    ? biText(lang, 'Building PDF...', 'Đang tạo PDF...')
                    : biText(lang, 'Download Official PDF', 'Tải PDF Chính Thức')}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Multi-child Read-Only Switcher (for Parents with more than 1 student) */}
        {students.length > 1 && (
          <div className="no-print bg-white rounded-xl border border-[#172154]/10 p-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[#172154]/60 px-2">
              {biText(lang, 'Student Portfolio:', 'Hồ Sơ Học Viên:')}
            </span>
            {students.map((stu) => {
              const isSelected = stu.id === activeStudent.id;
              const count = certCountByStudentId[stu.id] || 0;
              return (
                <button
                  key={stu.id}
                  type="button"
                  onClick={() => handleSelectStudent(stu.id)}
                  className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg border text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#FFF5EE] border-[#FF6B00] text-[#172154]'
                      : 'bg-white border-[#172154]/10 text-[#172154]/75 hover:border-[#172154]/25'
                  }`}
                >
                  <ProfileAvatar
                    src={stu.photoUrl}
                    fallbackSrc={stu.gender === 'boy' ? '/assets/lila_boy.png' : '/assets/lila_girl.png'}
                    name={stu.fullName}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">{stu.fullName}</div>
                    <div className="text-[11px] text-[#172154]/60 font-mono-num tabular-nums">
                      {count} {biText(lang, count === 1 ? 'certificate' : 'certificates', 'chứng nhận')}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Empty State if Admin has not issued any certificates for this student yet */}
        {studentIssuedCertificates.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#172154]/10 p-10 sm:p-12 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-[#F8F9FB] border border-[#172154]/10 text-[#2D3E99] flex items-center justify-center mx-auto">
              <Award className="w-7 h-7" />
            </div>
            <h3 className="font-display text-lg font-extrabold text-[#172154]">
              {biText(
                lang,
                `No Official Certificates Issued for ${activeStudent.fullName} Yet`,
                `Chưa Có Chứng Nhận Chính Thức Nào Được Cấp Cho ${activeStudent.fullName}`
              )}
            </h3>
            <p className="text-sm text-[#172154]/65 max-w-lg mx-auto leading-relaxed">
              {biText(
                lang,
                'Certificates are officially reviewed and issued exclusively by the LiLab Creative Talent Academy Administration. Once issued, every certificate earned by this student will be collected here for viewing, printing, and downloading.',
                'Chứng nhận được Ban Quản Trị Học viện Tài năng Sáng tạo LiLab thẩm định và cấp phát chính thức. Ngay khi được cấp, toàn bộ bộ sưu tập chứng nhận của học viên sẽ xuất hiện tại đây để xem, in ấn và tải về.'
              )}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            {/* Left Collection List (Strictly Read-Only Selection) */}
            <div className="xl:col-span-4 space-y-3 no-print">
              <div className="bg-white rounded-xl border border-[#172154]/10 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#172154]/8">
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-[#FF6B00]" />
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#172154]">
                      {biText(lang, 'Earned Certificates', 'Chứng Nhận Đã Đạt Được')}
                    </h3>
                  </div>
                  <span className="text-xs font-mono-num tabular-nums font-bold text-[#172154]/70">
                    {studentIssuedCertificates.length}
                  </span>
                </div>

                <div className="space-y-2 max-h-[560px] overflow-y-auto pr-0.5">
                  {studentIssuedCertificates.map((cert) => {
                    const isActive = cert.id === selectedIssuedCert?.id;
                    const themeDot =
                      CERTIFICATE_THEMES[cert.theme]?.primary || CERTIFICATE_THEMES.royal_gold.primary;

                    return (
                      <button
                        key={cert.id}
                        type="button"
                        onClick={() => setSelectedCertId(cert.id)}
                        className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                          isActive
                            ? 'bg-[#FFF5EE] border-[#FF6B00]'
                            : 'bg-white border-[#172154]/10 hover:border-[#172154]/25'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: themeDot }}
                            />
                            <span className="text-xs font-extrabold text-[#172154] line-clamp-2">
                              {lang === 'vi' ? cert.awardTitleVi : cert.awardTitleEn}
                            </span>
                          </div>
                          {isActive && (
                            <CheckCircle2 className="w-4 h-4 text-[#FF6B00] shrink-0 mt-0.5" />
                          )}
                        </div>

                        <div className="mt-2 text-[11px] font-semibold text-[#2D3E99]">
                          {cert.cefrDisplay} · {cert.termLabel}
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#172154]/60 font-mono-num tabular-nums">
                          <span>{formatCompletionDate(cert.issueDate, lang)}</span>
                          <span aria-hidden="true">·</span>
                          <span>{cert.serialId}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="pt-2.5 border-t border-[#172154]/8 text-[11px] text-[#172154]/60 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#0F766E] shrink-0" />
                  <span>
                    {biText(
                      lang,
                      'Official academy records cannot be modified by parents or students.',
                      'Chứng nhận chính thức được bảo vệ nguyên vẹn và không thể chỉnh sửa.'
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Read-Only Certificate Viewer */}
            <div className="xl:col-span-8">{renderCertificateStage()}</div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // ADMIN PORTAL VIEW — EXCLUSIVE CERTIFICATE ISSUANCE & REGISTRY STUDIO
  // =========================================================================
  return (
    <div className="space-y-5">
      {toastMsg && (
        <div className="no-print bg-[#ECFDF5] border border-[#0F766E]/25 text-[#0F766E] px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Admin Action Header */}
      <div className="no-print bg-white rounded-xl border border-[#172154]/10 p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-xl sm:text-2xl font-extrabold text-[#172154] tracking-tight">
              {biText(lang, 'Official Certificate Issuance Studio', 'Cấp Phát Chứng Nhận Chính Thức')}
            </h2>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2D3E99] bg-[#F0F4FF] border border-[#2D3E99]/15 px-2.5 py-0.5 rounded-md">
              <ShieldCheck className="w-3 h-3" />
              {biText(lang, 'Admin Only', 'Chỉ Quản Trị Viên')}
            </span>
          </div>
          <p className="text-xs text-[#172154]/65">
            {activeStudent.fullName} · {formatCefrLabel(activeStudent.cefrLevel, activeStudent.cefrModifier)} ·{' '}
            <span className="font-mono-num tabular-nums font-semibold text-[#172154]">
              {studentIssuedCertificates.length}{' '}
              {biText(lang, 'issued to this student', 'đã cấp cho học viên này')}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handlePrintCertificate}
            disabled={!payload}
            className="px-3 py-2 rounded-lg bg-white border border-[#172154]/15 hover:border-[#172154]/35 text-[#172154] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>{biText(lang, 'Print', 'In')}</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadPng}
            disabled={!payload || busyExport !== null}
            className="px-3 py-2 rounded-lg bg-white border border-[#172154]/15 hover:border-[#172154]/35 text-[#172154] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
          >
            <FileImage className="w-4 h-4" />
            <span>{busyExport === 'png' ? '...' : 'PNG'}</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={!payload || busyExport !== null}
            className="px-3 py-2 rounded-lg bg-white border border-[#172154]/15 hover:border-[#172154]/35 text-[#172154] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>{busyExport === 'pdf' ? '...' : 'PDF'}</span>
          </button>
          <button
            type="button"
            onClick={handleAdminIssueOrUpdate}
            disabled={!payload || busyIssue}
            className={`px-4 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors ${portalAccent.primaryBtnClass}`}
          >
            <Award className="w-4 h-4" />
            <span>
              {busyIssue
                ? biText(lang, 'Saving...', 'Đang lưu...')
                : adminEditorMode === 'existing' && selectedIssuedCert
                  ? biText(lang, 'Save Certificate Updates', 'Lưu Cập Nhật Chứng Nhận')
                  : biText(lang, 'Issue Official Certificate', 'Cấp Chứng Nhận Chính Thức')}
            </span>
          </button>
        </div>
      </div>

      {/* Main 12-Col Studio Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left Controls & Student Issued Registry */}
        <div className="xl:col-span-4 space-y-4 no-print order-2 xl:order-1">
          {/* 1. Student Selector */}
          <div className="bg-white rounded-xl border border-[#172154]/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#172154]">
                {biText(lang, '1. Select Student', '1. Chọn Học Viên')}
              </span>
              <span className="text-[11px] font-mono-num tabular-nums text-[#172154]/60">
                {students.length} {biText(lang, 'students', 'học viên')}
              </span>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#172154]/45 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder={biText(lang, 'Search student or CEFR level...', 'Tìm học viên hoặc trình độ CEFR...')}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-[#172154]/15 text-xs focus:outline-none focus:border-[#FF6B00]"
              />
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-0.5">
              {filteredStudents.map((stu) => {
                const isSelected = stu.id === activeStudent.id;
                const issuedCount = certCountByStudentId[stu.id] || 0;
                return (
                  <button
                    key={stu.id}
                    type="button"
                    onClick={() => handleSelectStudent(stu.id)}
                    className={`w-full flex items-center justify-between gap-2 p-2 rounded-lg border text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#FFF5EE] border-[#FF6B00]'
                        : 'bg-white border-[#172154]/8 hover:border-[#172154]/20'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <ProfileAvatar
                        src={stu.photoUrl}
                        fallbackSrc={stu.gender === 'boy' ? '/assets/lila_boy.png' : '/assets/lila_girl.png'}
                        name={stu.fullName}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#172154] truncate">{stu.fullName}</div>
                        <div className="text-[11px] text-[#172154]/60 truncate">
                          {formatCefrLabel(stu.cefrLevel, stu.cefrModifier)}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono-num tabular-nums font-semibold text-[#2D3E99] shrink-0">
                      {issuedCount} {biText(lang, 'cert', 'CN')}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Student's Issued Certificates Collection */}
          <div className="bg-white rounded-xl border border-[#172154]/10 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#172154]">
                {biText(lang, '2. Issued Collection', '2. Chứng Nhận Đã Cấp')}
              </span>
              <button
                type="button"
                onClick={handleAdminStartNewDraft}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors ${
                  adminEditorMode === 'new'
                    ? 'bg-[#FF6B00] text-white'
                    : 'bg-[#F8F9FB] border border-[#172154]/15 text-[#172154] hover:border-[#FF6B00]'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{biText(lang, 'New Draft', 'Tạo Mới')}</span>
              </button>
            </div>

            {studentIssuedCertificates.length === 0 ? (
              <p className="text-xs text-[#172154]/60 bg-[#F8F9FB] rounded-lg p-3 border border-[#172154]/8">
                {biText(
                  lang,
                  `No official certificates issued yet for ${activeStudent.fullName}. Configure the details below and click "Issue Official Certificate".`,
                  `Chưa có chứng nhận nào được cấp cho ${activeStudent.fullName}. Hãy tuỳ chỉnh bên dưới và bấm "Cấp Chứng Nhận Chính Thức".`
                )}
              </p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
                {studentIssuedCertificates.map((cert) => {
                  const isEditingThis =
                    adminEditorMode === 'existing' && selectedIssuedCert?.id === cert.id;
                  return (
                    <div
                      key={cert.id}
                      className={`rounded-lg border p-2.5 transition-colors ${
                        isEditingThis
                          ? 'bg-[#FFF5EE] border-[#FF6B00]'
                          : 'bg-white border-[#172154]/10 hover:border-[#172154]/25'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleAdminLoadIssuedCert(cert)}
                          className="text-left min-w-0 flex-1 cursor-pointer"
                        >
                          <div className="text-xs font-bold text-[#172154] truncate">
                            {lang === 'vi' ? cert.awardTitleVi : cert.awardTitleEn}
                          </div>
                          <div className="text-[11px] text-[#172154]/65 font-mono-num tabular-nums mt-0.5">
                            {cert.cefrDisplay} · {cert.issueDate} · {cert.serialId}
                          </div>
                        </button>

                        {confirmDeleteId === cert.id ? (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleAdminDeleteCertificate(cert)}
                              disabled={busyIssue}
                              className="px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold cursor-pointer"
                            >
                              {biText(lang, 'Revoke', 'Xoá')}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-1.5 py-0.5 rounded border border-[#172154]/15 text-[10px] font-semibold text-[#172154] cursor-pointer"
                            >
                              {biText(lang, 'No', 'Huỷ')}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(cert.id)}
                            title={biText(lang, 'Revoke certificate', 'Thu hồi chứng nhận')}
                            className="p-1 text-[#172154]/45 hover:text-red-600 cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. Certificate Parameters (Admin Only) */}
          <div className="bg-white rounded-xl border border-[#172154]/10 p-4 space-y-3.5">
            <div className="text-xs font-extrabold uppercase tracking-wider text-[#172154]">
              {adminEditorMode === 'existing' && selectedIssuedCert
                ? biText(lang, '3. Edit Issued Certificate', '3. Sửa Chứng Nhận Đã Cấp')
                : biText(lang, '3. Configure New Certificate', '3. Cấu Hình Chứng Nhận Mới')}
            </div>

            {adminEditorMode === 'new' && (
              <div>
                <label className="block text-[11px] font-bold text-[#172154]/70 mb-1">
                  {biText(lang, 'Assessment Record Source', 'Nguồn Đánh Giá Cambridge')}
                </label>
                <select
                  value={selectedAssessmentId}
                  onChange={(e) => {
                    setSelectedAssessmentId(e.target.value);
                    setHasManualDateOverride(false);
                  }}
                  className="w-full px-3 py-1.5 rounded-lg border border-[#172154]/15 text-xs bg-white"
                >
                  <option value="latest">
                    {biText(lang, 'Latest Assessment (Auto)', 'Đánh Giá Gần Nhất (Tự Động)')}
                  </option>
                  {studentAssessments.map((asm) => (
                    <option key={asm.id} value={asm.id}>
                      {asm.termLabel} · {formatCefrLabel(asm.cefrLevel, asm.cefrModifier)}
                    </option>
                  ))}
                  <option value="milestone_only">
                    {biText(lang, 'Milestone Only (No Scores)', 'Chỉ Cột Mốc (Không Hiện Điểm)')}
                  </option>
                </select>
              </div>
            )}

            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#172154]/70 mb-1">
                <Calendar className="w-3.5 h-3.5 text-[#FF6B00]" />
                {biText(lang, 'Date of Completion', 'Ngày Hoàn Thành')}
              </label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => {
                  setIssueDate(e.target.value);
                  setHasManualDateOverride(true);
                }}
                className="w-full px-3 py-1.5 rounded-lg border border-[#172154]/15 text-xs font-mono-num tabular-nums"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#172154]/70 mb-1.5">
                <Palette className="w-3.5 h-3.5 text-[#2D3E99]" />
                {biText(lang, 'Certificate Theme', 'Chủ Đề Thiết Kế')}
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(Object.keys(CERTIFICATE_THEMES) as CertificateThemeId[]).map((tid) => {
                  const tPal = CERTIFICATE_THEMES[tid];
                  const active = theme === tid;
                  return (
                    <button
                      key={tid}
                      type="button"
                      onClick={() => setTheme(tid)}
                      className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                        active
                          ? 'border-[#FF6B00] bg-[#FFF5EE]'
                          : 'border-[#172154]/10 bg-white hover:border-[#172154]/25'
                      }`}
                    >
                      <div className="flex items-center gap-1 mb-1">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: tPal.primary }}
                        />
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: tPal.secondary }}
                        />
                      </div>
                      <div className="text-[10px] font-bold text-[#172154] truncate">
                        {lang === 'vi' ? tPal.nameVi : tPal.nameEn}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#172154]/70 mb-1.5">
                {biText(lang, 'Certificate Language', 'Ngôn Ngữ Trên Chứng Nhận')}
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['en', 'vi', 'bi'] as LangCode[]).map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setCertLang(code)}
                    className={`py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      certLang === code
                        ? 'bg-[#172154] text-white border-[#172154]'
                        : 'bg-white text-[#172154]/75 border-[#172154]/15 hover:border-[#172154]/35'
                    }`}
                  >
                    {code === 'bi' ? 'EN+VI' : code.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-[#172154]/8">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#172154] cursor-pointer">
                <input
                  type="checkbox"
                  checked={showScores}
                  onChange={(e) => setShowScores(e.target.checked)}
                  className="rounded border-[#172154]/30 accent-[#FF6B00]"
                />
                <span>{biText(lang, 'Show 8-Skill Scorecard', 'Hiện Bảng Điểm 8 Kỹ Năng')}</span>
              </label>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#172154] cursor-pointer">
                <input
                  type="checkbox"
                  checked={showStudentPhoto}
                  onChange={(e) => setShowStudentPhoto(e.target.checked)}
                  className="rounded border-[#172154]/30 accent-[#FF6B00]"
                />
                <span>{biText(lang, 'Show Student Portrait', 'Hiện Ảnh Học Viên')}</span>
              </label>
            </div>

            {/* Wording & Signatories */}
            <div className="pt-2 border-t border-[#172154]/8 space-y-2.5">
              <button
                type="button"
                onClick={() => setShowAdminCustomize((prev) => !prev)}
                className="w-full flex items-center justify-between text-xs font-bold text-[#2D3E99] cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[#FF6B00]" />
                  {biText(lang, 'Wording & Signatories', 'Nội Dung & Người Ký')}
                </span>
                <span className="text-[11px] text-[#FF6B00]">
                  {showAdminCustomize ? biText(lang, 'Hide', 'Ẩn') : biText(lang, 'Edit', 'Sửa')}
                </span>
              </button>

              {showAdminCustomize && (
                <div className="space-y-2.5 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-[#172154]/70 mb-1">
                      {biText(lang, 'Award Title Preset', 'Mẫu Tiêu Đề Chứng Nhận')}
                    </label>
                    <select
                      value={awardTitleEn}
                      onChange={(e) => {
                        const found = DEFAULT_AWARD_TITLES.find((d) => d.en === e.target.value);
                        if (found) {
                          setAwardTitleEn(found.en);
                          setAwardTitleVi(found.vi);
                        }
                      }}
                      className="w-full px-3 py-1.5 rounded-lg border border-[#172154]/15 text-xs bg-white"
                    >
                      {DEFAULT_AWARD_TITLES.map((item) => (
                        <option key={item.en} value={item.en}>
                          {lang === 'vi' ? item.vi : item.en}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-[#172154]/70 mb-1">
                        {biText(lang, 'Director Signatory', 'Giám Đốc Ký Tên')}
                      </label>
                      <input
                        type="text"
                        value={directorName}
                        onChange={(e) => setDirectorName(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-[#172154]/15 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#172154]/70 mb-1">
                        {biText(lang, 'Lead Teacher', 'Giáo Viên Phụ Trách')}
                      </label>
                      <input
                        type="text"
                        value={customTeacherName}
                        onChange={(e) => setCustomTeacherName(e.target.value)}
                        placeholder={activeAssessment?.teacherName || 'LiLab Faculty'}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-[#172154]/15 text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#172154]/70 mb-1">
                      {biText(lang, 'Citation (English)', 'Lời Vinh Danh (Tiếng Anh)')}
                    </label>
                    <textarea
                      rows={2}
                      value={customCitationEn}
                      onChange={(e) => setCustomCitationEn(e.target.value)}
                      placeholder={payload?.citationEn}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-[#172154]/15 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#172154]/70 mb-1">
                      {biText(lang, 'Citation (Vietnamese)', 'Lời Vinh Danh (Tiếng Việt)')}
                    </label>
                    <textarea
                      rows={2}
                      value={customCitationVi}
                      onChange={(e) => setCustomCitationVi(e.target.value)}
                      placeholder={payload?.citationVi}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-[#172154]/15 text-xs"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Live Certificate Preview Stage */}
        <div className="xl:col-span-8 order-1 xl:order-2">{renderCertificateStage()}</div>
      </div>
    </div>
  );
};
