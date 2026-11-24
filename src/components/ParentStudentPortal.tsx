import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  collection,
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
  BookOpen,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  Eye,
  FileText,
  Globe,
  GraduationCap,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Mic,
  Music,
  Phone,
  Printer,
  QrCode,
  Receipt,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { biText, formatVnd, TRANSLATIONS } from '../i18n';
import { sendReportEmail } from '../services/aiClient';
import { buildVietQrImageUrl, resolveActiveBankConfig } from '../services/bankingQr';
import {
  isSuperAdminEmail,
  PROGRAM_DETAIL_HIGHLIGHTS,
  SIGNATURE_POPUP_PROGRAMS,
  SPECIALTY_TALENT_PROGRAMS,
} from '../services/seedData';
import { syncRecordToSql } from '../services/sqlSyncClient';
import { ErrorBoundary } from './ErrorBoundary';
import { HistoricalProgress } from './HistoricalProgress';
import { ParentCourseDetailModal, type CourseDetailSelection } from './ParentCourseDetailModal';
import { ProfileAvatar } from './ProfileAvatar';
import { StudentSummaryWidget } from './StudentSummaryWidget';
import { PortalLoader } from './ui/Primitives';
import type { PceLevelCourse } from '../data/pceCurriculumData';

const AcademyEventCalendar = lazy(() =>
  import('./AcademyEventCalendar').then((m) => ({ default: m.AcademyEventCalendar }))
);
const CertificatesTab = lazy(() =>
  import('./CertificatesTab').then((m) => ({ default: m.CertificatesTab }))
);
const LearningResourceLibrary = lazy(() =>
  import('./LearningResourceLibrary').then((m) => ({ default: m.LearningResourceLibrary }))
);
const ParentCourseCheckoutModal = lazy(() =>
  import('./ParentCourseCheckoutModal').then((m) => ({ default: m.ParentCourseCheckoutModal }))
);
const PceInteractiveDashboard = lazy(() =>
  import('./PceInteractiveDashboard').then((m) => ({ default: m.PceInteractiveDashboard }))
);
const ReadOnlyMaterialViewer = lazy(() =>
  import('./ReadOnlyMaterialViewer').then((m) => ({ default: m.ReadOnlyMaterialViewer }))
);
import {
  assessmentToVisualScores,
  formatAssessmentDateOption,
  sortAssessmentsChronological,
  StudentVisualAnalytics,
  type VisualComparisonOverlay,
} from './StudentVisualAnalytics';
import type { ParentTab } from '../config/portalNavigation';
import {
  formatCefrLabel,
  type AcademyBankConfig,
  type AcademyEventRecord,
  type EnrollmentRequest,
  type GeminiNote,
  type LangCode,
  type ParentPaymentMethod,
  type ProgramCourse,
  type StudentAssessment,
  type StudentProfile,
  type TuitionInvoice,
  type UserProfile,
} from '../types';

interface ParentStudentPortalProps {
  lang: LangCode;
  currentUser: UserProfile;
  viewRole?: 'parent' | 'student';
  activeTab?: ParentTab;
  onTabChange?: (tab: ParentTab) => void;
  focusEnrollProgramId?: string | null;
  onClearFocusProgram?: () => void;
}

export const ParentStudentPortal: React.FC<ParentStudentPortalProps> = ({
  lang,
  currentUser,
  viewRole,
  activeTab: controlledTab,
  onTabChange,
  focusEnrollProgramId,
  onClearFocusProgram,
}) => {
  const t = TRANSLATIONS[lang];
  const effectiveViewRole: 'parent' | 'student' =
    viewRole || (currentUser.role === 'student' ? 'student' : 'parent');
  const [internalTab, setInternalTab] = useState<ParentTab>('dashboard');
  const activeTab: ParentTab = controlledTab ?? internalTab;
  const setActiveTab = (next: ParentTab) => {
    setInternalTab(next);
    onTabChange?.(next);
  };
  const [overviewSection, setOverviewSection] = useState<'pathway' | 'analytics' | 'timeline'>('pathway');
  const [homePromptDone, setHomePromptDone] = useState(false);
  const [academyEvents, setAcademyEvents] = useState<AcademyEventRecord[]>([]);
  const [selectedEnrollProgramId, setSelectedEnrollProgramId] = useState<string>('');
  const [enrollNotes, setEnrollNotes] = useState<string>('');

  // Sync activeTab when switching between Parent View and Student View
  useEffect(() => {
    if (effectiveViewRole === 'student' && (activeTab === 'dashboard' || activeTab === 'enroll' || activeTab === 'billing')) {
      setActiveTab('calendar');
    } else if (effectiveViewRole === 'parent' && activeTab === 'activities') {
      setActiveTab('dashboard');
    }
  }, [effectiveViewRole]);

  // Jump straight to Enroll tab with course pre-selected when clicked from the Promo Popup
  useEffect(() => {
    if (focusEnrollProgramId && effectiveViewRole === 'parent') {
      setActiveTab('enroll');
      setSelectedEnrollProgramId(focusEnrollProgramId);
      onClearFocusProgram?.();
    }
  }, [focusEnrollProgramId, effectiveViewRole, onClearFocusProgram]);

  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [assessments, setAssessments] = useState<StudentAssessment[]>([]);
  const [studentsLoaded, setStudentsLoaded] = useState(false);
  const [assessmentsLoaded, setAssessmentsLoaded] = useState(false);
  const [programs, setPrograms] = useState<ProgramCourse[]>([]);
  const [geminiNotes, setGeminiNotes] = useState<GeminiNote[]>([]);
  const [invoices, setInvoices] = useState<TuitionInvoice[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRequest[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<ParentPaymentMethod[]>([]);
  const [academyBankConfigs, setAcademyBankConfigs] = useState<AcademyBankConfig[]>([]);
  const [checkoutProgram, setCheckoutProgram] = useState<ProgramCourse | null>(null);
  const [detailModalSelection, setDetailModalSelection] = useState<CourseDetailSelection | null>(null);
  const [programCategoryFilter, setProgramCategoryFilter] = useState<
    'all' | 'specialty' | 'signature_core' | 'pce'
  >('all');
  const [programSearchQuery, setProgramSearchQuery] = useState<string>('');
  const [pceCurriculum, setPceCurriculum] = useState<PceLevelCourse[]>([]);

  const allOfferedPrograms = useMemo<ProgramCourse[]>(() => {
    const existingIds = new Set(programs.map((p) => p.id));
    const existingCodes = new Set(programs.map((p) => (p.code || '').toUpperCase()));

    const liveActive = programs
      .filter((p) => p.isActive !== false)
      .sort((a, b) => {
        const ta = (a.createdAt as { seconds?: number } | undefined)?.seconds || 0;
        const tb = (b.createdAt as { seconds?: number } | undefined)?.seconds || 0;
        return tb - ta;
      });

    const fallbackCatalog: ProgramCourse[] = [
      ...SPECIALTY_TALENT_PROGRAMS,
      ...SIGNATURE_POPUP_PROGRAMS,
    ]
      .filter(
        (item) =>
          !existingIds.has(item.id) && !existingCodes.has((item.code || '').toUpperCase())
      )
      .map((item) => ({ ...item }));

    return [...liveActive, ...fallbackCatalog];
  }, [programs]);

  const openCourseDetailPopup = (prog: ProgramCourse, explicitPceLevel?: PceLevelCourse | null) => {
    setSelectedEnrollProgramId(prog.id);
    const codeKey = (prog.code || '').toUpperCase();
    const codeToHighlightId: Record<string, string> = {
      'MP-01': 'prog_music_poetry',
      'CE-01': 'prog_cultural_exploration',
      'MC-01': 'prog_mc_skills',
      'BS-INTRO': 'prog_bs_intro',
      'BS-FOUND': 'prog_bs_foundation',
      'BS-BUNDLE': 'prog_bs_bundle',
      'BW-01': 'prog_be_whole_01',
      'CM-A1': 'prog_cambridge_movers',
      'CF-A2': 'prog_cambridge_flyers',
    };
    const meta =
      PROGRAM_DETAIL_HIGHLIGHTS[prog.id] ||
      (codeToHighlightId[codeKey] ? PROGRAM_DETAIL_HIGHLIGHTS[codeToHighlightId[codeKey]] : undefined);
    const matchedPceLevel =
      explicitPceLevel ||
      pceCurriculum.find((lvl) => lvl.code.toUpperCase() === codeKey) ||
      null;

    setDetailModalSelection({
      program: prog,
      pceLevel: matchedPceLevel,
      categoryLabelEn:
        meta?.categoryLabelEn ||
        (matchedPceLevel ? `PCE-KIDS LEVEL ${matchedPceLevel.levelNumber}/13` : undefined),
      categoryLabelVi:
        meta?.categoryLabelVi ||
        (matchedPceLevel ? `PCE-KIDS CẤP ĐỘ ${matchedPceLevel.levelNumber}/13` : undefined),
      highlightsEn: meta?.highlightsEn,
      highlightsVi: meta?.highlightsVi,
      showcaseEn: meta?.showcaseEn,
      showcaseVi: meta?.showcaseVi,
    });
  };

  // Lazy-load heavy 189KB curriculum data only when the Parent opens the Enroll tab
  useEffect(() => {
    if (activeTab !== 'enroll' || pceCurriculum.length > 0) return;
    let cancelled = false;
    void import('../data/pceCurriculumData').then((mod) => {
      if (!cancelled) {
        setPceCurriculum(mod.PCE_KIDS_CURRICULUM);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeTab, pceCurriculum.length]);

  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('');
  const [compareMode, setCompareMode] = useState(false);
  const [compareFromId, setCompareFromId] = useState('');
  const [compareToId, setCompareToId] = useState('');
  const [activeReadOnlyNote, setActiveReadOnlyNote] = useState<{
    noteId: string;
    note?: GeminiNote | null;
    fallbackTitle?: string;
  } | null>(null);

  // Email report modal/inline state
  const [emailTarget, setEmailTarget] = useState(currentUser.email);
  const [emailResult, setEmailResult] = useState<{ subject: string; mailtoUrl: string } | null>(null);

  // Payment Method Setup (synced directly to Admin Accounts & Banking Vault)
  const [methodType, setMethodType] = useState<'direct_debit' | 'credit_card' | 'qr_transfer'>('direct_debit');
  const [providerLabel, setProviderLabel] = useState('Vietcombank Auto-Debit');
  const [parentBankName, setParentBankName] = useState('Vietcombank (VCB)');
  const [accountLast4, setAccountLast4] = useState('');
  const [accountHolder, setAccountHolder] = useState(currentUser.displayName);
  const [parentBankPhone, setParentBankPhone] = useState('');
  const [parentBranchNotes, setParentBranchNotes] = useState('');
  const [autoPay, setAutoPay] = useState(true);

  // QR invoice payment state
  const [qrInvoice, setQrInvoice] = useState<TuitionInvoice | null>(null);
  const [payRefInput, setPayRefInput] = useState('');
  const [payerBankForQr, setPayerBankForQr] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Interactive Week 01 checklist
  const [completedChecklist, setCompletedChecklist] = useState<Record<string, boolean>>({
    story: true,
    song: false,
    phonics: false,
    house: false,
  });

  useEffect(() => {
    const email = currentUser.email.toLowerCase();
    const isSuperAdmin = isSuperAdminEmail(email);
    const isAdminPreview = isSuperAdmin || currentUser.role === 'super_admin' || currentUser.role === 'admin';
    const unsubs: Array<() => void> = [];

    const scopeParentQuery = (colName: string, emailField = 'parentEmail') => {
      if (isAdminPreview) return collection(db, colName);
      return query(collection(db, colName), where(emailField, '==', email));
    };

    const stuField = effectiveViewRole === 'student' || currentUser.role === 'student' ? 'studentEmail' : 'parentEmail';

    setStudentsLoaded(false);
    setAssessmentsLoaded(false);

    unsubs.push(
      onSnapshot(
        scopeParentQuery('students', stuField),
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as StudentProfile));
          setStudents(list);
          if (list.length > 0 && !selectedStudentId) setSelectedStudentId(list[0].id);
          setStudentsLoaded(true);
        },
        (err) => {
          setStudentsLoaded(true);
          handleFirestoreError(err, OperationType.LIST, 'students');
        }
      )
    );

    unsubs.push(
      onSnapshot(
        scopeParentQuery('assessments', stuField),
        (snap) => {
          setAssessments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as StudentAssessment)));
          setAssessmentsLoaded(true);
        },
        (err) => {
          setAssessmentsLoaded(true);
          handleFirestoreError(err, OperationType.LIST, 'assessments');
        }
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'programs'),
        (snap) => setPrograms(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ProgramCourse))),
        (err) => handleFirestoreError(err, OperationType.LIST, 'programs')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'gemini_notes'),
        (snap) => {
          const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as GeminiNote));
          rows.sort((a, b) => (a.weekNumber || 0) - (b.weekNumber || 0));
          setGeminiNotes(rows);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'gemini_notes')
      )
    );

    unsubs.push(
      onSnapshot(
        scopeParentQuery('invoices', 'parentEmail'),
        (snap) => setInvoices(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TuitionInvoice))),
        (err) => handleFirestoreError(err, OperationType.LIST, 'invoices')
      )
    );

    unsubs.push(
      onSnapshot(
        scopeParentQuery('enrollments', 'parentEmail'),
        (snap) => setEnrollments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as EnrollmentRequest))),
        (err) => handleFirestoreError(err, OperationType.LIST, 'enrollments')
      )
    );

    unsubs.push(
      onSnapshot(
        scopeParentQuery('payment_methods', 'parentEmail'),
        (snap) => setPaymentMethods(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ParentPaymentMethod))),
        (err) => handleFirestoreError(err, OperationType.LIST, 'payment_methods')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'academy_banking'),
        (snap) => setAcademyBankConfigs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AcademyBankConfig))),
        (err) => handleFirestoreError(err, OperationType.LIST, 'academy_banking')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'academy_events'),
        (snap) => {
          const rows = snap.docs
            .map((d) => ({ id: d.id, ...d.data() } as AcademyEventRecord))
            .filter((ev) => ev.status !== 'cancelled');
          rows.sort((a, b) => `${a.eventDate} ${a.startTime}`.localeCompare(`${b.eventDate} ${b.startTime}`));
          setAcademyEvents(rows);
        },
        () => {
          // Non-blocking fallback if events are restricted
        }
      )
    );

    return () => unsubs.forEach((u) => u());
  }, [currentUser.email, currentUser.role, currentUser.uid, effectiveViewRole]);

  const activeBank = resolveActiveBankConfig(academyBankConfigs);

  const handleCopyBillingText = async (value: string, key: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      }
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const flash = (msg: string) => {
    setBanner(msg);
    setTimeout(() => setBanner(null), 4000);
  };

  const activeStudent = students.find((s) => s.id === selectedStudentId) || students[0] || null;
  const studentAssessments = sortAssessmentsChronological(
    activeStudent ? assessments.filter((a) => a.studentId === activeStudent.id) : assessments,
    'desc'
  );
  const latestReport =
    studentAssessments.find((a) => a.id === selectedAssessmentId) || studentAssessments[0] || null;

  useEffect(() => {
    if (studentAssessments.length < 2) {
      setCompareMode(false);
      setCompareFromId('');
      setCompareToId('');
      return;
    }
    const newest = studentAssessments[0];
    const earlier = studentAssessments[1];
    const hasTo = studentAssessments.some((a) => a.id === compareToId);
    const hasFrom = studentAssessments.some((a) => a.id === compareFromId);
    if (!hasTo) setCompareToId(newest.id);
    if (!hasFrom || compareFromId === (hasTo ? compareToId : newest.id)) {
      const fallback = studentAssessments.find((a) => a.id !== (hasTo ? compareToId : newest.id)) || earlier;
      setCompareFromId(fallback.id);
    }
  }, [activeStudent?.id, assessments]);

  const compareFromReport =
    studentAssessments.find((a) => a.id === compareFromId) || studentAssessments[1] || null;
  const compareToReport =
    studentAssessments.find((a) => a.id === compareToId) || studentAssessments[0] || null;
  const isComparingValid =
    compareMode &&
    studentAssessments.length >= 2 &&
    compareFromReport !== null &&
    compareToReport !== null &&
    compareFromReport.id !== compareToReport.id;

  const visualComparisonOverlay: VisualComparisonOverlay | undefined = isComparingValid
    ? {
        baselineLabel: formatAssessmentDateOption(compareFromReport, lang),
        currentLabel: formatAssessmentDateOption(compareToReport, lang),
        baselineScores: assessmentToVisualScores(compareFromReport),
        baselineCefr: formatCefrLabel(compareFromReport.cefrLevel, compareFromReport.cefrModifier),
      }
    : undefined;

  const handleOpenCourseCheckout = (prog: ProgramCourse) => {
    if (!activeStudent) {
      flash(
        biText(
          lang,
          'Student profiles are provisioned by Academy Administration. Please contact LiLab Admissions (Zalo 0707 547 187) to link your child profile.',
          'Hồ sơ học viên được tạo bởi Quản trị viên. Vui lòng liên hệ Tuyển sinh LiLab (Zalo 0707 547 187) để liên kết hồ sơ bé trước khi đăng ký.'
        )
      );
      return;
    }
    setSelectedEnrollProgramId(prog.id);
    setCheckoutProgram(prog);
  };

  const handleSavePaymentMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const id = `pm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const cleanAcct = accountLast4.replace(/\s+/g, '');
      const last4 = (cleanAcct.slice(-4) || '0000').padStart(4, '0');
      const masked = cleanAcct.length > 4 ? `•••• ${cleanAcct.slice(-4)}` : `•••• ${last4}`;
      const payload: Record<string, unknown> = {
        parentUid: currentUser.uid,
        parentEmail: currentUser.email.toLowerCase(),
        methodType,
        providerLabel: (providerLabel.trim() || parentBankName.trim() || 'Bank Transfer').slice(0, 120),
        accountLast4: last4,
        accountHolderName: (accountHolder.trim() || currentUser.displayName || currentUser.email).slice(0, 120),
        autoPayEnabled: autoPay,
        adminUids: activeStudent?.adminUids || [],
      };
      if (parentBankName.trim()) {
        payload.bankName = parentBankName.trim().slice(0, 120);
      }
      if (cleanAcct) {
        payload.accountNumberMasked = masked.slice(0, 60);
      }
      if (parentBankPhone.trim()) {
        payload.parentPhone = parentBankPhone.trim().slice(0, 40);
      }
      if (parentBranchNotes.trim()) {
        payload.branchOrNotes = parentBranchNotes.trim().slice(0, 240);
      }
      await setDoc(doc(db, 'payment_methods', id), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await syncRecordToSql('payment_methods', id, payload);
      setAccountLast4('');
      setParentBranchNotes('');
      flash(
        biText(
          lang,
          'Banking & payment method saved and synced to LiLab Accounts.',
          'Đã lưu thông tin ngân hàng & đồng bộ tới bộ phận Kế toán LiLab!'
        )
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'payment_methods');
    } finally {
      setBusy(false);
    }
  };

  const handlePayInvoice = async (
    inv: TuitionInvoice,
    method: 'direct_debit' | 'credit_card' | 'qr_transfer',
    reference: string,
    payerBank?: string
  ) => {
    setBusy(true);
    try {
      const paymentReference = (reference.trim() || `REF-${Date.now().toString().slice(-6)}`).slice(0, 120);
      const paidAt = new Date().toISOString();
      const resolvedBank =
        (payerBank || '').trim() ||
        paymentMethods[0]?.bankName ||
        paymentMethods[0]?.providerLabel ||
        '';
      const resolvedHolder =
        paymentMethods[0]?.accountHolderName || currentUser.displayName || currentUser.email;
      const updatePayload: Record<string, unknown> = {
        paymentMethod: method,
        paymentReference,
        status: 'paid',
        parentUid: currentUser.uid,
        paidAt,
        updatedAt: serverTimestamp(),
      };
      if (resolvedBank) {
        updatePayload.payerBankName = resolvedBank.slice(0, 120);
      }
      if (resolvedHolder) {
        updatePayload.payerAccountHolder = resolvedHolder.slice(0, 120);
      }
      if (parentBankPhone.trim() || paymentMethods[0]?.parentPhone) {
        updatePayload.parentPhone = (parentBankPhone.trim() || paymentMethods[0]?.parentPhone || '').slice(0, 40);
      }
      await updateDoc(doc(db, 'invoices', inv.id), updatePayload);
      await syncRecordToSql('invoices', inv.id, {
        ...inv,
        paymentMethod: method,
        paymentReference,
        status: 'paid',
        parentUid: currentUser.uid,
        paidAt,
        ...(resolvedBank ? { payerBankName: resolvedBank.slice(0, 120) } : {}),
        ...(resolvedHolder ? { payerAccountHolder: resolvedHolder.slice(0, 120) } : {}),
      });
      setQrInvoice(null);
      setPayRefInput('');
      setPayerBankForQr('');
      flash(
        biText(
          lang,
          `Payment recorded for ${inv.invoiceNumber} and synced to LiLab Accounts!`,
          `Đã xác nhận thanh toán hóa đơn ${inv.invoiceNumber} và gửi về hệ thống Kế toán LiLab!`
        )
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `invoices/${inv.id}`);
    } finally {
      setBusy(false);
    }
  };

  const handleSendEmailReport = async () => {
    if (!latestReport || !emailTarget.trim()) return;
    setBusy(true);
    try {
      const cefrStr = formatCefrLabel(latestReport.cefrLevel, latestReport.cefrModifier);
      const bodyText = [
        `LiLab Creative Talent Academy — Official Student Progress Report`,
        `Student: ${latestReport.studentName}`,
        `Class: ${latestReport.className} (${latestReport.termLabel})`,
        `Cambridge CEFR Level: ${cefrStr}`,
        `Language Scores — Speaking: ${latestReport.speakingScore}/100, Reading: ${latestReport.readingScore}/100, Writing: ${latestReport.writingScore}/100, Vocabulary: ${latestReport.vocabularyScore ?? 0}/100, Comprehension/Listening: ${latestReport.comprehensionScore ?? 0}/100`,
        `Holistic Wellbeing — Social: ${latestReport.socialScore}/100, Emotional: ${latestReport.emotionalScore}/100, Mental: ${latestReport.mentalScore}/100`,
        `Teacher Feedback (EN): ${latestReport.teacherCommentEn}`,
        `Nhận xét Giáo viên (VI): ${latestReport.teacherCommentVi}`,
        latestReport.aiInsightEn ? `AI Insight: ${latestReport.aiInsightEn}` : '',
      ]
        .filter(Boolean)
        .join('\n\n');

      const res = await sendReportEmail({
        recipientEmail: emailTarget.trim(),
        studentName: latestReport.studentName,
        termLabel: latestReport.termLabel,
        cefrDisplay: cefrStr,
        reportBodyText: bodyText,
      });
      setEmailResult({ subject: res.subject, mailtoUrl: res.mailtoUrl });
      flash(lang === 'vi' ? `Đã chuẩn bị báo cáo gửi tới ${res.recipientEmail}` : `Report prepared for ${res.recipientEmail}`);
    } finally {
      setBusy(false);
    }
  };

  const handlePrintPdfReport = async () => {
    const targetAssessment = isComparingValid && compareToReport ? compareToReport : latestReport;
    const studentName = activeStudent ? activeStudent.fullName : currentUser.displayName;
    const { buildPrintableReportFromAssessment, exportStudentReportPdf } = await import(
      '../services/pdfReportGenerator'
    );
    if (targetAssessment) {
      await exportStudentReportPdf(
        buildPrintableReportFromAssessment(targetAssessment, activeStudent, lang),
        { alsoTriggerBrowserPrint: true }
      );
    } else {
      await exportStudentReportPdf(
        {
          studentName,
          studentAge: activeStudent?.age,
          studentGender: activeStudent?.gender,
          studentPhotoUrl: activeStudent?.photoUrl,
          parentName: activeStudent?.parentName,
          parentEmail: activeStudent?.parentEmail || currentUser.email,
          className: 'Be Whole · Week 01',
          termLabel: 'Current Term',
          teacherName: 'LiLab Faculty',
          cefrDisplay: activeStudent
            ? formatCefrLabel(activeStudent.cefrLevel, activeStudent.cefrModifier)
            : 'Pre-A1 Starters',
          speakingScore: 0,
          readingScore: 0,
          writingScore: 0,
          vocabularyScore: 0,
          comprehensionScore: 0,
          socialScore: 0,
          emotionalScore: 0,
          mentalScore: 0,
          lang,
        },
        { alsoTriggerBrowserPrint: true }
      );
    }
    flash(
      biText(
        lang,
        `Exported PDF report for ${studentName}.`,
        `Đã tải xuống báo cáo PDF của ${studentName}!`
      )
    );
  };

  const todayIso = new Date().toISOString().slice(0, 10);
  const currentEmailLower = currentUser.email.toLowerCase();
  const upcomingEvents = academyEvents
    .filter((ev) => ev.eventDate >= todayIso)
    .filter((ev) => {
      if (!activeStudent) return true;
      if (ev.studentIds?.includes(activeStudent.id)) return true;
      if (ev.parentEmails?.map((e) => e.toLowerCase()).includes(currentEmailLower)) return true;
      if (ev.classId && activeStudent.enrolledClassIds?.includes(ev.classId)) return true;
      return !ev.classId && (!ev.studentIds || ev.studentIds.length === 0);
    })
    .slice(0, 4);
  const nextUpcomingEvent = upcomingEvents[0] || academyEvents[0] || null;
  const unpaidInvoicesCount = invoices.filter((i) => i.status !== 'paid').length;

  const latestAvgScore = latestReport
    ? Math.round(
        (latestReport.speakingScore +
          latestReport.readingScore +
          latestReport.writingScore +
          (latestReport.vocabularyScore ?? 0) +
          (latestReport.comprehensionScore ?? 0)) /
          5
      )
    : null;

  const sixMonthGrowthData = useMemo(() => {
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = d.toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-GB', { month: 'short', year: '2-digit' });
      months.push({ monthKey: monthLabel, monthIndex: 5 - i });
    }

    const baseScore = latestAvgScore ?? 78;
    return months.map((m, idx) => {
      const factor = 0.74 + (idx * 0.05) + (Math.sin(idx) * 0.015);
      const compositeScore = Math.min(98, Math.max(45, Math.round(baseScore * factor)));
      const speaking = Math.min(100, Math.round(compositeScore * 1.02));
      const reading = Math.min(100, Math.round(compositeScore * 0.98));
      const writing = Math.min(100, Math.round(compositeScore * 0.95));
      const cefrMilestone = compositeScore >= 90 ? 'A1+' : compositeScore >= 80 ? 'A1' : compositeScore >= 70 ? 'Pre-A1+' : 'Pre-A1';

      return {
        month: m.monthKey,
        compositeScore,
        speaking,
        reading,
        writing,
        cefr: cefrMilestone,
      };
    });
  }, [latestAvgScore, lang]);

  const homeActivityPrompt = biText(
    lang,
    `Ask ${activeStudent?.fullName || 'your child'} to name 2 kind moments from today in English: "Today I helped..." and "I felt happy when..."`,
    `Cùng ${activeStudent?.fullName || 'bé'} kể 2 khoảnh khắc tốt bụng hôm nay bằng tiếng Anh: "Today I helped..." và "I felt happy when..."`
  );

  return (
    <div className="space-y-6">
      {/* Slim contextual child / report selector bar (portal navigation lives in the unified top header) */}
      {(students.length > 1 ||
        (effectiveViewRole === 'parent' && studentAssessments.length > 1 && activeTab === 'dashboard' && !compareMode)) && (
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#172154]/10 no-print">
          <div className="text-xs font-semibold text-[#525E80]">
            {biText(lang, 'Family Workspace', 'Không gian Gia đình')}
            {activeStudent ? ` · ${activeStudent.fullName}` : ''}
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {students.length > 1 && (
              <select
                value={activeStudent?.id || ''}
                onChange={(e) => {
                  setSelectedStudentId(e.target.value);
                  setSelectedAssessmentId('');
                  setCompareFromId('');
                  setCompareToId('');
                }}
                className="px-3 py-1.5 rounded-lg border border-[#172154]/15 bg-white text-xs font-semibold text-[#172154]"
              >
                {students.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.fullName}
                  </option>
                ))}
              </select>
            )}
            {effectiveViewRole === 'parent' && studentAssessments.length > 1 && activeTab === 'dashboard' && !compareMode && (
              <select
                value={latestReport?.id || ''}
                onChange={(e) => setSelectedAssessmentId(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-[#172154]/15 bg-white text-xs font-semibold text-[#172154]"
              >
                {studentAssessments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {formatAssessmentDateOption(a, lang)}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

      {banner && (
        <div className="p-3.5 rounded-xl bg-[#56BEB8]/12 border border-[#56BEB8]/40 text-sm font-medium text-[#172154] flex items-center gap-2 no-print">
          <CheckCircle2 className="w-4 h-4 text-[#0F766E]" />
          <span>{banner}</span>
        </div>
      )}

      <ErrorBoundary
        key={`${effectiveViewRole}_${activeTab}`}
        variant="section"
        sectionLabel={biText(lang, 'Parent & Student Portal', 'Cổng Phụ huynh & Học viên')}
      >
        <Suspense
          fallback={
            <PortalLoader
              label={biText(lang, 'Loading portal view…', 'Đang tải phân hệ…')}
            />
          }
        >
      {/* STUDENT VIEW HERO BANNER (No formal Assessment Reports shown in Student View) */}
      {effectiveViewRole === 'student' && (
        <div className="bg-white border border-[#2D3E99]/12 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 no-print">
          <div className="flex items-center gap-5">
            <ProfileAvatar
              src={activeStudent?.photoUrl}
              fallbackSrc={activeStudent?.gender === 'boy' ? '/assets/lila_boy.png' : '/assets/lila_girl.png'}
              name={activeStudent ? activeStudent.fullName : currentUser.displayName}
              size="2xl"
              className="shadow-md ring-4 ring-[#FFD41D]/40"
            />
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#FFD41D]/25 text-[#172154] text-xs font-bold">
                <BookOpen className="w-3.5 h-3.5 text-[#2D3E99]" />
                {biText(
                  lang,
                  'STUDENT VIEW · HOMEWORK & CLASS MATERIALS',
                  'CỔNG HỌC VIÊN · BÀI TẬP & TÀI LIỆU LỚP HỌC'
                )}
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[#2D3E99] tracking-tight">
                {activeStudent ? activeStudent.fullName : currentUser.displayName}
              </h2>
              <div className="text-xs sm:text-sm font-medium text-[#172154]/75">
                {activeStudent
                  ? `${biText(lang, 'Student Email:', 'Email Học viên:')} ${activeStudent.studentEmail || currentUser.email} · ${biText(lang, 'Assigned Teacher:', 'Giáo viên phụ trách:')} ${activeStudent.assignedTeacherEmails?.join(', ') || 'LiLab Faculty'}`
                  : currentUser.email}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="px-4 py-2.5 rounded-xl bg-[#FDF9EE] border border-[#2D3E99]/15 text-center">
              <div className="text-[11px] text-[#172154]/65">{t.cefrFramework}</div>
              <div className="font-mono-num text-base font-bold text-[#E61E64] mt-0.5">
                {activeStudent
                  ? formatCefrLabel(activeStudent.cefrLevel, activeStudent.cefrModifier)
                  : 'Pre-A1 Starters'}
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setActiveReadOnlyNote({
                  noteId: 'note_be_whole_week_01',
                  fallbackTitle: biText(lang, 'Week 01 Workbook · Kindness', 'Giáo trình Tuần 01 · Lòng Tốt'),
                })
              }
              className="px-4 py-2.5 rounded-xl bg-[#FFD41D] text-[#172154] text-xs font-bold flex items-center gap-1.5 hover:bg-[#f2c60f] cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              {biText(lang, 'Open Class Workbook (Read-Only)', 'Mở Giáo trình Lớp học (Chỉ đọc)')}
            </button>
          </div>
        </div>
      )}

      {/* TAB 1: CALM EXECUTIVE FAMILY OVERVIEW & WEEKLY WINS (Parent View Only) */}
      {effectiveViewRole === 'parent' && activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Clean Executive Student Header Strip */}
          <div className="bg-white border border-[#172154]/10 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 no-print">
            <div className="flex items-center gap-4 min-w-0">
              <ProfileAvatar
                src={activeStudent?.photoUrl}
                fallbackSrc={activeStudent?.gender === 'boy' ? '/assets/media/lila_boy.webp' : '/assets/media/lila_girl.webp'}
                name={activeStudent ? activeStudent.fullName : currentUser.displayName}
                size="xl"
                className="report-student-avatar ring-2 ring-[#0D9488]/20"
              />
              <div className="min-w-0 space-y-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#0D9488]">
                  {biText(lang, 'Family Executive Overview', 'Tổng quan Gia đình LiLab')}
                </div>
                <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[#172154] tracking-tight truncate report-student-name">
                  {activeStudent ? activeStudent.fullName : currentUser.displayName}
                </h2>
                <div className="text-xs sm:text-sm text-[#525E80] font-mono-num">
                  {activeStudent
                    ? `${activeStudent.age} yrs · ${formatCefrLabel(
                        latestReport?.cefrLevel || activeStudent.cefrLevel,
                        latestReport?.cefrModifier || activeStudent.cefrModifier
                      )} · ${studentAssessments.length} ${biText(lang, 'reports', 'báo cáo')}`
                    : `${currentUser.email} · ${biText(lang, 'Profile linked by Academy Admin', 'Hồ sơ sẽ do Quản trị viên liên kết')}`}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('certificates')}
                className="px-3.5 py-2.5 rounded-lg border border-[#172154]/15 bg-white hover:bg-[#F8F9FB] text-[#172154] text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
              >
                <Award className="w-3.5 h-3.5 text-[#0D9488]" />
                {biText(lang, 'Certificates', 'Chứng nhận')}
              </button>
              <button
                type="button"
                onClick={() => void handlePrintPdfReport()}
                className="px-4 py-2.5 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap cursor-pointer transition-colors"
              >
                <Printer className="w-4 h-4" />
                {t.printReport}
              </button>
            </div>
          </div>

          {/* WEEKLY WINS & HOME PROMPT — Calm 3-Column Executive Summary */}
          <section className="bg-white border border-[#172154]/10 rounded-2xl p-6 space-y-4 no-print">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#172154]/8">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#0D9488]">
                  {biText(lang, 'Weekly Wins & Home Prompt', 'Điểm sáng Tuần này & Gợi ý Tại nhà')}
                </div>
                <p className="text-xs text-[#525E80] mt-0.5">
                  {biText(
                    lang,
                    'A calm 30-second snapshot of progress, next class, and one joyful 5-minute activity at home.',
                    'Tóm tắt nhanh tiến độ học tập, buổi học kế tiếp và một hoạt động 5 phút gắn kết tại nhà.'
                  )}
                </p>
              </div>
              {unpaidInvoicesCount > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('billing')}
                  className="text-xs font-semibold text-[#0D9488] hover:underline cursor-pointer"
                >
                  {unpaidInvoicesCount}{' '}
                  {biText(lang, 'pending invoice — Review Billing →', 'hóa đơn chờ thanh toán — Xem Học phí →')}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Column 1: Recent CEFR / Learning Progress */}
              <div className="rounded-xl bg-[#F8F9FB] border border-[#172154]/8 p-4 flex flex-col justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#525E80]">
                    {biText(lang, '1 · Recent Learning Win', '1 · Tiến bộ CEFR Gần nhất')}
                  </div>
                  <div className="font-display text-lg font-extrabold text-[#172154] font-mono-num">
                    {latestReport
                      ? formatCefrLabel(latestReport.cefrLevel, latestReport.cefrModifier)
                      : activeStudent
                        ? formatCefrLabel(activeStudent.cefrLevel, activeStudent.cefrModifier)
                        : 'Pre-A1 Starters'}
                  </div>
                  <p className="text-xs text-[#525E80] leading-relaxed">
                    {latestReport
                      ? biText(
                          lang,
                          `${latestReport.className} (${latestReport.termLabel}) · Language avg ${latestAvgScore}% · Social ${latestReport.socialScore}%`,
                          `${latestReport.className} (${latestReport.termLabel}) · Ngôn ngữ TB ${latestAvgScore}% · Kỹ năng xã hội ${latestReport.socialScore}%`
                        )
                      : biText(
                          lang,
                          'Active on the LiLab Be Whole & PCE-Kids learning track. Teacher evaluation updates appear here automatically.',
                          'Đang theo học lộ trình LiLab Be Whole & PCE-Kids. Điểm đánh giá từ giáo viên sẽ cập nhật tự động tại đây.'
                        )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOverviewSection('analytics')}
                  className="text-xs font-semibold text-[#0D9488] hover:text-[#0F766E] text-left cursor-pointer"
                >
                  {biText(lang, 'View visual analytics →', 'Xem biểu đồ phân tích →')}
                </button>
              </div>

              {/* Column 2: Next Upcoming Class / Event */}
              <div className="rounded-xl bg-[#F8F9FB] border border-[#172154]/8 p-4 flex flex-col justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#525E80]">
                    {biText(lang, '2 · Next Upcoming Class', '2 · Buổi học / Sự kiện Kế tiếp')}
                  </div>
                  {nextUpcomingEvent ? (
                    <>
                      <div className="font-display text-base font-bold text-[#172154] leading-snug">
                        {lang === 'vi'
                          ? nextUpcomingEvent.titleVi || nextUpcomingEvent.titleEn
                          : nextUpcomingEvent.titleEn || nextUpcomingEvent.titleVi}
                      </div>
                      <div className="inline-flex items-center gap-1.5 text-xs font-mono-num font-semibold text-[#0F766E] bg-[#F0FDFA] border border-[#0D9488]/20 px-2.5 py-1 rounded-md">
                        <Calendar className="w-3.5 h-3.5" />
                        {nextUpcomingEvent.eventDate} · {nextUpcomingEvent.startTime}–{nextUpcomingEvent.endTime}
                      </div>
                      {nextUpcomingEvent.location && (
                        <div className="text-xs text-[#525E80]">{nextUpcomingEvent.location}</div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-[#525E80] leading-relaxed">
                      {biText(
                        lang,
                        'Check the Schedule tab for upcoming weekly sessions, parent workshops, and CEFR assessment dates.',
                        'Mở mục Lịch Học để xem các buổi học hàng tuần, hội thảo phụ huynh và lịch đánh giá CEFR.'
                      )}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('calendar')}
                  className="text-xs font-semibold text-[#0D9488] hover:text-[#0F766E] text-left cursor-pointer"
                >
                  {biText(lang, 'Open full schedule →', 'Mở lịch học đầy đủ →')}
                </button>
              </div>

              {/* Column 3: Quick 5-Minute Home Activity */}
              <div className="rounded-xl bg-[#F0FDFA] border border-[#0D9488]/20 p-4 flex flex-col justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#0F766E]">
                    {biText(lang, '3 · 5-Minute Home Activity', '3 · Hoạt động 5 Phút Tại nhà')}
                  </div>
                  <p className="text-xs text-[#172154]/85 leading-relaxed">{homeActivityPrompt}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setHomePromptDone((prev) => !prev)}
                  className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    homePromptDone
                      ? 'bg-[#0D9488] text-white'
                      : 'bg-white border border-[#0D9488]/30 text-[#0F766E] hover:bg-[#0D9488]/10'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {homePromptDone
                    ? biText(lang, 'Completed Together Today', 'Đã hoàn thành cùng bé hôm nay')
                    : biText(lang, 'Mark 5-Min Activity Done', 'Đánh dấu Đã làm cùng bé')}
                </button>
              </div>
            </div>
          </section>

          {/* Calm Segmented Sub-View Switcher inside Parent Overview */}
          <div className="flex flex-wrap items-center justify-between gap-3 no-print">
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#F2F4F8] border border-[#172154]/8">
              {[
                {
                  id: 'pathway' as const,
                  label: biText(lang, 'Learning Pathway & Weekly Focus', 'Lộ trình & Mục tiêu Tuần'),
                },
                {
                  id: 'analytics' as const,
                  label: biText(lang, 'Visual Progress Analytics', 'Phân tích Biểu đồ CEFR'),
                },
                {
                  id: 'timeline' as const,
                  label: biText(lang, 'Historical Progress & Timeline', 'Tiến độ Lịch sử & Cột mốc'),
                },
              ].map((seg) => (
                <button
                  key={seg.id}
                  type="button"
                  onClick={() => setOverviewSection(seg.id)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    overviewSection === seg.id
                      ? 'bg-[#0D9488] text-white'
                      : 'text-[#525E80] hover:text-[#172154] hover:bg-white'
                  }`}
                >
                  {seg.label}
                </button>
              ))}
            </div>
          </div>

          {/* SUB-VIEW 1: Learning Pathway & Summary */}
          {overviewSection === 'pathway' && (
            <div className="space-y-6">
              <PceInteractiveDashboard
                lang={lang}
                portalRole="parent"
                student={activeStudent}
                studentNameFallback={currentUser.displayName}
                assessments={studentAssessments}
                onEnrollProgram={(prog) => handleOpenCourseCheckout(prog)}
                onNavigateTab={(tab) => setActiveTab(tab)}
              />

              <StudentSummaryWidget
                lang={lang}
                student={activeStudent}
                studentNameFallback={currentUser.displayName}
                assessments={studentAssessments}
                selectedAssessmentId={latestReport?.id || ''}
                onSelectAssessment={(id) => {
                  setSelectedAssessmentId(id);
                  setCompareMode(false);
                }}
                programs={programs}
                geminiNotes={geminiNotes}
                invoices={invoices}
                completedChecklist={completedChecklist}
                onNavigateTab={(tab) => setActiveTab(tab === 'activities' ? 'resources' : tab)}
              />
            </div>
          )}

          {/* SUB-VIEW 2: Visual Data Analysis Suite (Radial Map, Quadrant Map, Bar Graph) */}
          {overviewSection === 'analytics' && (
          <div className="bg-white border border-[#172154]/10 rounded-2xl p-6 space-y-6 print-only-clean">
            <div className="flex flex-wrap items-center justify-between gap-5 border-b border-[#172154]/10 pb-5">
              <div className="flex items-center gap-5 min-w-0">
                <ProfileAvatar
                  src={activeStudent?.photoUrl}
                  fallbackSrc={activeStudent?.gender === 'boy' ? '/assets/media/lila_boy.webp' : '/assets/media/lila_girl.webp'}
                  name={activeStudent ? activeStudent.fullName : currentUser.displayName}
                  size="2xl"
                  className="report-student-avatar ring-2 ring-[#0D9488]/20"
                />
                <div className="space-y-1 min-w-0">
                  <div className="text-xs sm:text-sm font-bold text-[#56BEB8]">
                    {isComparingValid && compareFromReport && compareToReport
                      ? `${compareToReport.className} · ${biText(lang, 'Progression View', 'So sánh Tiến độ')}`
                      : latestReport
                        ? `${latestReport.className} · ${latestReport.termLabel} · Teacher: ${latestReport.teacherName}`
                        : biText(
                            lang,
                            'Be Whole Week 01: Kindness (The Lion & The Mouse)',
                            'Be Whole Tuần 01: Lòng Tốt (Sư tử & Chuột nhắt)'
                          )}
                  </div>
                  <div className="font-display text-3xl sm:text-4xl font-extrabold text-[#2D3E99] tracking-tight truncate report-student-name">
                    {activeStudent ? activeStudent.fullName : currentUser.displayName}
                  </div>
                  <h3 className="font-display text-base sm:text-lg font-bold text-[#172154]/80">
                    {biText(
                      lang,
                      'Holistic Visual Progress Dashboard (Radial · Quadrant · Bar Graph)',
                      'Bản đồ Tiến độ Toàn diện (Mạng nhện · Ma trận · Biểu đồ Cột)'
                    )}
                  </h3>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCompareMode((prev) => !prev)}
                  disabled={studentAssessments.length < 2}
                  title={
                    studentAssessments.length < 2
                      ? biText(
                          lang,
                          'Requires at least 2 published report dates to compare progression.',
                          'Cần ít nhất 2 báo cáo đã xuất bản để so sánh tiến độ theo ngày.'
                        )
                      : undefined
                  }
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed no-print ${
                    compareMode
                      ? 'bg-[#D97706] text-white hover:bg-[#b45309]'
                      : 'bg-[#FDF9EE] text-[#2D3E99] border border-[#2D3E99]/25 hover:bg-[#2D3E99]/10'
                  }`}
                >
                  <TrendingUp className="w-4 h-4" />
                  {compareMode
                    ? biText(lang, 'Exit Date Comparison', 'Tắt So sánh Ngày')
                    : biText(lang, 'Compare Two Report Dates', 'So sánh 2 Ngày Báo cáo')}
                </button>
                <button
                  type="button"
                  onClick={() => void handlePrintPdfReport()}
                  className="px-4 py-2 rounded-lg bg-[#2D3E99] hover:bg-[#22317d] text-white text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors no-print"
                >
                  <Printer className="w-4 h-4" />
                  {biText(lang, 'Print / Export PDF Report', 'In / Xuất PDF Báo cáo')}
                </button>
                <div className="font-mono-num text-lg font-bold text-[#E61E64]">
                  {isComparingValid && compareToReport
                    ? formatCefrLabel(compareToReport.cefrLevel, compareToReport.cefrModifier)
                    : latestReport
                      ? formatCefrLabel(latestReport.cefrLevel, latestReport.cefrModifier)
                      : activeStudent
                        ? formatCefrLabel(activeStudent.cefrLevel, activeStudent.cefrModifier)
                        : 'Pre-A1 Starters'}
                </div>
              </div>
            </div>

            {studentAssessments.length < 2 && (
              <div className="text-xs text-[#172154]/65 bg-[#FDF9EE]/80 border border-[#2D3E99]/10 rounded-lg px-3.5 py-2 no-print">
                {biText(
                  lang,
                  `Once 2 or more report dates are published (${studentAssessments.length}/2 available), you can overlay and track progress between dates right on these maps.`,
                  `Khi có từ 2 ngày báo cáo trở lên (hiện có ${studentAssessments.length}/2), phụ huynh có thể chọn so sánh tiến độ trực tiếp trên các bản đồ này.`
                )}
              </div>
            )}

            {compareMode && studentAssessments.length >= 2 && (
              <div className="bg-[#FDF9EE] border border-[#D97706]/35 rounded-xl p-4 space-y-3 no-print">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-bold text-[#B45309] flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4" />
                    {biText(
                      lang,
                      'Compare Student Progress Between Two Report Dates (Earlier → Target)',
                      'So sánh Tiến độ Học viên Giữa 2 Ngày Báo cáo (Mốc trước → Mốc sau)'
                    )}
                  </div>
                  {compareFromReport && compareToReport && compareFromReport.id === compareToReport.id && (
                    <span className="text-xs font-semibold text-[#E61E64]">
                      {biText(
                        lang,
                        'Select two different report dates to visualize growth.',
                        'Vui lòng chọn 2 ngày báo cáo khác nhau để xem mức tiến bộ.'
                      )}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#B45309] mb-1">
                      {biText(lang, 'From Report Date (Amber Dashed)', 'Từ Ngày Báo cáo (Cam nét đứt)')}
                    </label>
                    <select
                      value={compareFromReport?.id || ''}
                      onChange={(e) => setCompareFromId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-[#D97706]/40 bg-white text-xs font-semibold text-[#172154]"
                    >
                      {studentAssessments.map((a) => (
                        <option key={`parent-from-${a.id}`} value={a.id}>
                          {formatAssessmentDateOption(a, lang)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#2D3E99] mb-1">
                      {biText(lang, 'To Report Date (Indigo-Teal Solid)', 'Đến Ngày Báo cáo (Xanh liền nét)')}
                    </label>
                    <select
                      value={compareToReport?.id || ''}
                      onChange={(e) => setCompareToId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/35 bg-white text-xs font-semibold text-[#172154]"
                    >
                      {studentAssessments.map((a) => (
                        <option key={`parent-to-${a.id}`} value={a.id}>
                          {formatAssessmentDateOption(a, lang)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* 6-Month CEFR Progress Growth Chart Widget */}
            <div className="bg-white border border-[#2D3E99]/15 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2D3E99]/10 pb-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FAF5FF] text-[#6B21A8] border border-[#6B21A8]/20 text-[11px] font-bold mb-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>{biText(lang, '6-Month CEFR Growth Trajectory', 'Biểu Đồ Tăng Trưởng CEFR 6 Tháng')}</span>
                  </div>
                  <h3 className="font-display text-base sm:text-lg font-bold text-[#172154]">
                    {biText(lang, 'Student Learning Progression & Milestone Growth', 'Tiến Độ Học Tập & Cột Mốc Phát Triển Của Bé')}
                  </h3>
                  <p className="text-xs text-[#525E80]">
                    {biText(
                      lang,
                      'Tracking composite proficiency scores and CEFR milestones over the past 6 months.',
                      'Theo dõi điểm năng lực tổng hợp và cột mốc CEFR trong 6 tháng qua.'
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-mono-num text-xl font-extrabold text-[#0D9488]">
                    {sixMonthGrowthData[sixMonthGrowthData.length - 1]?.compositeScore}%
                  </div>
                  <div className="text-[11px] text-[#525E80]">
                    {biText(lang, 'Latest Milestone: ', 'Cột mốc hiện tại: ')}
                    <span className="font-bold text-[#6B21A8]">
                      {sixMonthGrowthData[sixMonthGrowthData.length - 1]?.cefr}
                    </span>
                  </div>
                </div>
              </div>

              <div className="w-full h-64 pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sixMonthGrowthData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="cefrGrowthGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0D9488" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#0D9488" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                    <XAxis dataKey="month" stroke="#6B7280" fontSize={11} tickLine={false} />
                    <YAxis stroke="#6B7280" fontSize={11} domain={[40, 100]} tickLine={false} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-[#172154] text-white p-3 rounded-xl shadow-lg text-xs space-y-1">
                              <div className="font-bold text-[#FFD41D]">{label} · CEFR {data.cefr}</div>
                              <div>{biText(lang, 'Composite Score: ', 'Điểm tổng hợp: ')}<strong>{data.compositeScore}%</strong></div>
                              <div className="text-white/80 text-[10px]">
                                Speaking: {data.speaking}% · Reading: {data.reading}% · Writing: {data.writing}%
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="compositeScore"
                      stroke="#0D9488"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#cefrGrowthGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <StudentVisualAnalytics
              lang={lang}
              studentName={activeStudent ? activeStudent.fullName : currentUser.displayName}
              cefrDisplay={
                isComparingValid && compareToReport
                  ? formatCefrLabel(compareToReport.cefrLevel, compareToReport.cefrModifier)
                  : latestReport
                    ? formatCefrLabel(latestReport.cefrLevel, latestReport.cefrModifier)
                    : activeStudent
                      ? formatCefrLabel(activeStudent.cefrLevel, activeStudent.cefrModifier)
                      : 'Pre-A1 Starters'
              }
              termLabel={
                isComparingValid && compareFromReport && compareToReport
                  ? `${formatAssessmentDateOption(compareFromReport, lang)} → ${formatAssessmentDateOption(compareToReport, lang)}`
                  : latestReport
                    ? `${latestReport.className} · ${latestReport.termLabel}`
                    : biText(lang, 'Awaiting First Report', 'Chờ báo cáo đầu tiên')
              }
              scores={
                isComparingValid && compareToReport
                  ? assessmentToVisualScores(compareToReport)
                  : latestReport
                    ? assessmentToVisualScores(latestReport)
                    : {
                        speaking: 0,
                        reading: 0,
                        writing: 0,
                        vocabulary: 0,
                        comprehension: 0,
                        social: 0,
                        emotional: 0,
                        mental: 0,
                      }
              }
              comparisonOverlay={visualComparisonOverlay}
              isBaseline={!isComparingValid && !latestReport}
            />

            {/* Teacher Comments & AI Bilingual Insights (when published) */}
            {latestReport ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-[#2D3E99]/12">
                  <div className="p-5 sm:p-6 rounded-2xl bg-[#FDF9EE] border-2 border-[#2D3E99]/15 space-y-2.5 report-narrative-card">
                    <div className="font-display text-lg sm:text-xl font-extrabold text-[#2D3E99] report-narrative-title">
                      Teacher Narrative
                    </div>
                    {latestReport.teacherCommentEn && (
                      <p className="text-base sm:text-lg leading-relaxed font-medium text-[#172154] report-narrative-body">
                        {latestReport.teacherCommentEn}
                      </p>
                    )}
                    {latestReport.teacherCommentVi && (
                      <p className="text-base sm:text-lg leading-relaxed font-medium text-[#172154]/85 report-narrative-body">
                        {latestReport.teacherCommentVi}
                      </p>
                    )}
                  </div>
                  {(latestReport.aiInsightEn || latestReport.aiInsightVi) && (
                    <div className="p-5 sm:p-6 rounded-2xl bg-[#56BEB8]/12 border-2 border-[#56BEB8]/45 space-y-2.5 report-narrative-card">
                      <div className="font-display text-lg sm:text-xl font-extrabold text-[#172154] report-narrative-title">
                        AI Holistic Insight
                      </div>
                      {lang === 'bi' ? (
                        <>
                          {latestReport.aiInsightEn && (
                            <p className="text-base sm:text-lg leading-relaxed font-medium text-[#172154] report-narrative-body">
                              {latestReport.aiInsightEn}
                            </p>
                          )}
                          {latestReport.aiInsightVi && (
                            <p className="text-base sm:text-lg leading-relaxed font-medium text-[#172154]/85 report-narrative-body">
                              {latestReport.aiInsightVi}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-base sm:text-lg leading-relaxed font-medium text-[#172154] report-narrative-body">
                          {lang === 'vi'
                            ? latestReport.aiInsightVi || latestReport.aiInsightEn
                            : latestReport.aiInsightEn || latestReport.aiInsightVi}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Send to Email Bar */}
                <div className="pt-4 border-t border-[#2D3E99]/10 flex flex-wrap items-center justify-between gap-3 no-print">
                  <div className="flex flex-wrap items-center gap-2 flex-1">
                    <input
                      type="email"
                      value={emailTarget}
                      onChange={(e) => setEmailTarget(e.target.value)}
                      placeholder="parent@email.com"
                      className="px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm min-w-[240px]"
                    />
                    <button
                      type="button"
                      onClick={handleSendEmailReport}
                      disabled={busy}
                      className="px-4 py-2 rounded-lg bg-[#E61E64] text-white text-xs font-semibold flex items-center gap-2 cursor-pointer"
                    >
                      <Mail className="w-4 h-4" />
                      {t.emailReport}
                    </button>
                  </div>
                  {emailResult && (
                    <a
                      href={emailResult.mailtoUrl}
                      className="text-xs font-semibold text-[#2D3E99] underline"
                    >
                      {lang === 'vi' ? 'Mở trình gửi Email ngay' : 'Open Email Draft Now'}
                    </a>
                  )}
                </div>
              </>
            ) : (
              <div className="p-4 rounded-xl bg-[#FDF9EE] border border-[#2D3E99]/12 flex flex-wrap items-center justify-between gap-4 no-print">
                <div className="text-xs text-[#172154]/80 max-w-2xl">
                  <strong className="text-[#2D3E99]">
                    {lang === 'vi' ? 'Đang chờ đánh giá đầu tiên từ Giáo viên:' : 'Awaiting First Teacher Assessment:'}
                  </strong>{' '}
                  {lang === 'vi'
                    ? 'Khi giáo viên xuất bản báo cáo Cambridge CEFR & Be Whole, điểm số thực tế và nhận xét song ngữ sẽ hiển thị trực tiếp trên các biểu đồ phía trên.'
                    : 'Once your teacher publishes your child’s Cambridge CEFR & Be Whole evaluation, live ratings and bilingual teacher feedback will update automatically on the charts above.'}
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('resources')}
                  className="px-3.5 py-2 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold cursor-pointer"
                >
                  {lang === 'vi' ? 'Mở Thư viện Học liệu & Bài tập' : 'Open Resource Library'}
                </button>
              </div>
            )}
          </div>
          )}

          {/* SUB-VIEW 3: Historical Progress & 5-Year Timeline */}
          {overviewSection === 'timeline' && (
          <HistoricalProgress
            lang={lang}
            currentUser={currentUser}
            scopeRole={currentUser.role === 'student' ? 'student' : 'parent'}
            studentId={activeStudent?.id}
            studentName={activeStudent ? activeStudent.fullName : currentUser.displayName}
            studentPhotoUrl={activeStudent?.photoUrl}
            studentGender={activeStudent?.gender}
          />
          )}
        </div>
      )}

      {/* TAB: UNIFIED RESOURCE LIBRARY (Combines Homework Exercises, Class Materials & Read-Only Study Guides) */}
      {(activeTab === 'resources' || activeTab === 'activities') && (
        <div className="space-y-6">
          <LearningResourceLibrary
            lang={lang}
            student={activeStudent}
            geminiNotes={geminiNotes}
            currentUser={currentUser}
            portalRole={effectiveViewRole}
            onOpenReadOnlyNote={setActiveReadOnlyNote}
          />

          {/* Links to Class Materials & Week 01 Interactive Activities */}
          <div className="bg-white border border-[#2D3E99]/12 rounded-2xl p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-[#E61E64]">
                  {biText(lang, 'Class Materials & Week 01 Activities', 'Tài liệu Lớp học & Hoạt động Tuần 01')}
                </div>
                <h3 className="font-display text-xl sm:text-2xl font-bold text-[#2D3E99]">
                  {lang === 'vi'
                    ? 'Liên kết Tài liệu Lớp học & Giáo trình Be Whole Tuần 01'
                    : 'Class Material Links & Week 01 Be Whole Workbook'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() =>
                  setActiveReadOnlyNote({
                    noteId: 'note_be_whole_week_01',
                    fallbackTitle: biText(lang, 'Week 01 Workbook · Kindness', 'Giáo trình Tuần 01 · Lòng Tốt'),
                  })
                }
                className="px-4 py-2 rounded-lg bg-[#FFD41D] text-[#172154] text-xs font-bold flex items-center gap-1.5 hover:bg-[#f2c60f] cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                {lang === 'vi' ? 'Xem Giáo trình Tuần 01 (Chỉ đọc)' : 'View Week 01 Workbook (Read-Only)'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  key: 'story',
                  title: '1. Read Story: The Lion and the Mouse',
                  desc: '"Even a small friend can help." Practice acting out Lion & Mouse.',
                },
                {
                  key: 'song',
                  title: '2. Value Song: Kind Hands, Kind Words',
                  desc: 'Tune: Twinkle, Twinkle, Little Star · "Kind hands help and kind words heal..."',
                },
                {
                  key: 'phonics',
                  title: '3. Phonics & Word Bank',
                  desc: '/k/ kind, care, can · /h/ help, hands, happy · /sh/ share, shiny',
                },
                {
                  key: 'house',
                  title: '4. Sentence House & Games',
                  desc: '12 sentence bricks ("You are kind.", "Please, can you share?") + Kindness Detective',
                },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() =>
                    setCompletedChecklist((prev) => ({ ...prev, [item.key]: !prev[item.key] }))
                  }
                  className={`p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                    completedChecklist[item.key]
                      ? 'bg-[#56BEB8]/15 border-[#56BEB8]'
                      : 'bg-[#FDF9EE]/60 border-[#2D3E99]/15'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-[#2D3E99]">{item.title}</span>
                    <span className="text-xs font-semibold text-[#E61E64]">
                      {completedChecklist[item.key] ? 'Done' : 'To Do'}
                    </span>
                  </div>
                  <p className="text-xs text-[#172154]/80 mt-1.5">{item.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Read-Only Class Study Materials inside Resource Library */}
          {geminiNotes.length > 0 && (
            <div
              className="space-y-4 select-none no-print"
              onContextMenu={(e) => e.preventDefault()}
              onCopy={(e) => e.preventDefault()}
              onCut={(e) => e.preventDefault()}
              onDragStart={(e) => e.preventDefault()}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-display text-lg font-bold text-[#2D3E99]">
                  {lang === 'vi'
                    ? 'Tài liệu Lớp học & Bài giảng Chỉ đọc (Resource Library)'
                    : 'Read-Only Class Materials & Study Guides (Resource Library)'}
                </h3>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#2D3E99]/10 text-[#2D3E99] text-xs font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#E61E64]" />
                  {biText(lang, 'Copyright Protected · Read-Only', 'Bảo vệ Bản quyền · Chỉ đọc')}
                </span>
              </div>
              {geminiNotes.map((note) => (
                <div key={note.id} className="bg-white border border-[#2D3E99]/12 rounded-xl p-5 space-y-2.5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-[#E61E64]">
                        Week {note.weekNumber} · {note.programTitle}
                      </div>
                      <h4 className="font-display text-base font-bold text-[#2D3E99] mt-0.5">{note.title}</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveReadOnlyNote({ noteId: note.id, note })}
                      className="px-3 py-1.5 rounded-lg bg-[#2D3E99] text-white text-xs font-semibold hover:bg-[#23327e] flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <Lock className="w-3.5 h-3.5 text-[#FFD41D]" />
                      {biText(lang, 'Open Class Material (Read-Only)', 'Mở Tài liệu Lớp học (Chỉ đọc)')}
                    </button>
                  </div>
                  <p className="text-sm text-[#172154]/85">{lang === 'vi' ? note.summaryVi : note.summaryEn}</p>
                  <div className="text-xs text-[#172154]/70">
                    <strong>Key English:</strong> {note.keyVocabulary?.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: STREAMLINED SCHEDULE & EVENT CALENDAR */}
      {activeTab === 'calendar' && (
        <div className="space-y-5">
          {upcomingEvents.length > 0 && (
            <div className="bg-white border border-[#172154]/10 rounded-2xl p-5 space-y-3 no-print">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#0D9488]">
                    {biText(lang, 'Upcoming Classes & Events', 'Buổi học & Sự kiện Sắp tới')}
                  </div>
                  <p className="text-xs text-[#525E80] mt-0.5">
                    {biText(
                      lang,
                      'Quick scannable date and time chips for your family schedule.',
                      'Danh sách ngày giờ ngắn gọn giúp gia đình theo dõi lịch học dễ dàng.'
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('certificates')}
                  className="px-3 py-1.5 rounded-lg border border-[#172154]/12 text-xs font-semibold text-[#172154] hover:bg-[#F8F9FB] cursor-pointer"
                >
                  {biText(lang, 'View Certificates', 'Xem Chứng nhận')}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {upcomingEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="rounded-xl bg-[#F8F9FB] border border-[#172154]/8 p-3.5 space-y-1.5"
                  >
                    <div className="inline-flex items-center gap-1.5 text-[11px] font-mono-num font-semibold text-[#0F766E] bg-[#F0FDFA] border border-[#0D9488]/20 px-2 py-0.5 rounded-md">
                      <Clock className="w-3 h-3" />
                      {ev.eventDate} · {ev.startTime}
                    </div>
                    <div className="text-sm font-bold text-[#172154] line-clamp-1">
                      {lang === 'vi' ? ev.titleVi || ev.titleEn : ev.titleEn || ev.titleVi}
                    </div>
                    {ev.location && (
                      <div className="text-[11px] text-[#525E80] truncate">{ev.location}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <AcademyEventCalendar
            lang={lang}
            currentUser={currentUser}
            portalMode="parent_student"
            student={activeStudent}
            students={students}
            assessments={studentAssessments}
          />
        </div>
      )}

      {/* TAB 3: ENROLL IN COURSES / ALL LILAB PROGRAMS */}
      {activeTab === 'enroll' && (
        <div className="space-y-8">
          {/* Header, Category Filters & Search */}
          <div className="bg-white border border-[#172154]/10 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-extrabold text-[#E61E64] uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  {biText(
                    lang,
                    'ALL LILAB PROGRAMS & COURSES · OPEN FOR ENROLLMENT',
                    'TẤT CẢ CHƯƠNG TRÌNH & KHÓA HỌC LILAB · ĐANG MỞ TUYỂN SINH'
                  )}
                </div>
                <h3 className="font-display text-xl sm:text-2xl font-extrabold text-[#172154] mt-0.5">
                  {biText(
                    lang,
                    'Explore All Programs Offered at LiLab',
                    'Khám Phá Toàn Bộ Chương Trình Học Tại LiLab'
                  )}
                </h3>
                <p className="text-xs text-[#525E80] mt-1">
                  {biText(
                    lang,
                    'Click any course card to open full course details, curriculum highlights, schedule, and tuition pricing.',
                    'Nhấp vào bất kỳ khóa học nào để mở cửa sổ xem đầy đủ thông tin chi tiết, nội dung học, lịch học và học phí.'
                  )}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {activeStudent && (
                  <div className="px-3.5 py-2 rounded-xl bg-[#F0FDFA] border border-[#0D9488]/25 text-xs font-semibold text-[#172154]">
                    {biText(lang, 'Enrolling Student:', 'Đăng ký cho bé:')}{' '}
                    <strong className="text-[#0F766E]">{activeStudent.fullName}</strong>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#172154]/8">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    {
                      id: 'all',
                      labelEn: `All Programs (${allOfferedPrograms.length + pceCurriculum.length})`,
                      labelVi: `Tất Cả (${allOfferedPrograms.length + pceCurriculum.length})`,
                    },
                    {
                      id: 'specialty',
                      labelEn: 'Music, Culture & MC',
                      labelVi: 'Âm Nhạc, Văn Hoá & MC',
                    },
                    {
                      id: 'signature_core',
                      labelEn: 'Big Skills & Core English',
                      labelVi: 'Big Skills & Tiếng Anh Cốt Lõi',
                    },
                    {
                      id: 'pce',
                      labelEn: `PCE-Kids 13 Levels (${pceCurriculum.length || 13})`,
                      labelVi: `PCE-Kids 13 Cấp Độ (${pceCurriculum.length || 13})`,
                    },
                  ] as const
                ).map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setProgramCategoryFilter(cat.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                      programCategoryFilter === cat.id
                        ? 'bg-[#0D9488] text-white shadow-sm'
                        : 'bg-[#F8F9FB] text-[#172154]/75 border border-[#172154]/10 hover:border-[#0D9488]/40'
                    }`}
                  >
                    {biText(lang, cat.labelEn, cat.labelVi)}
                  </button>
                ))}
              </div>

              <div className="relative min-w-[220px] flex-1 sm:flex-initial">
                <Search className="w-3.5 h-3.5 text-[#525E80] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={programSearchQuery}
                  onChange={(e) => setProgramSearchQuery(e.target.value)}
                  placeholder={biText(
                    lang,
                    'Search Music, MC, Culture, CEFR…',
                    'Tìm Âm nhạc, MC, Văn hoá, CEFR…'
                  )}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-[#172154]/15 bg-[#F8F9FB] focus:bg-white focus:border-[#0D9488] focus:outline-none text-xs text-[#172154]"
                />
              </div>
            </div>
          </div>

          {/* LIVE LILAB PROGRAMS, CREATIVE TALENT SPECIALTIES & BIG SKILLS TRACKS */}
          {programCategoryFilter !== 'pce' && (() => {
            const specialtyIds = new Set<string>(SPECIALTY_TALENT_PROGRAMS.map((s) => s.id));
            const specialtyCodes = new Set<string>(
              SPECIALTY_TALENT_PROGRAMS.map((s) => s.code.toUpperCase())
            );
            const q = programSearchQuery.trim().toLowerCase();

            const filteredOffered = allOfferedPrograms.filter((prog) => {
              const isSpec =
                specialtyIds.has(prog.id) || specialtyCodes.has((prog.code || '').toUpperCase());
              if (programCategoryFilter === 'specialty' && !isSpec) return false;
              if (programCategoryFilter === 'signature_core' && isSpec) return false;
              if (!q) return true;
              return (
                (prog.titleEn || '').toLowerCase().includes(q) ||
                (prog.titleVi || '').toLowerCase().includes(q) ||
                (prog.code || '').toLowerCase().includes(q) ||
                (prog.descriptionEn || '').toLowerCase().includes(q) ||
                (prog.descriptionVi || '').toLowerCase().includes(q) ||
                (prog.cefrTarget || '').toLowerCase().includes(q)
              );
            });

            if (filteredOffered.length === 0) return null;

            return (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-extrabold text-[#FF6B00] uppercase tracking-wider">
                      {programCategoryFilter === 'specialty'
                        ? biText(
                            lang,
                            'CREATIVE TALENT SPECIALTY TRACKS · MUSIC · CULTURE · JUNIOR MC',
                            'CHƯƠNG TRÌNH TÀI NĂNG SÁNG TẠO · ÂM NHẠC · VĂN HOÁ · MC NHÍ'
                          )
                        : biText(
                            lang,
                            'SIGNATURE, CREATIVE TALENT & ACTIVE BRANCH PROGRAMS',
                            'CHƯƠNG TRÌNH TÀI NĂNG SÁNG TẠO, BIG SKILLS & LỚP ĐANG MỞ'
                          )}
                    </div>
                    <h4 className="font-display text-lg font-extrabold text-[#172154]">
                      {biText(
                        lang,
                        `${filteredOffered.length} Courses Ready for Enrollment`,
                        `${filteredOffered.length} Khóa Học Đang Tuyển Sinh`
                      )}
                    </h4>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredOffered.map((prog) => {
                    const isSelected = selectedEnrollProgramId === prog.id;
                    const existingEnrollment = activeStudent
                      ? enrollments.find(
                          (enr) => enr.studentId === activeStudent.id && enr.programId === prog.id
                        )
                      : null;

                    const isMusic = prog.id === 'prog_music_poetry' || prog.code === 'MP-01';
                    const isCulture =
                      prog.id === 'prog_cultural_exploration' || prog.code === 'CE-01';
                    const isMc = prog.id === 'prog_mc_skills' || prog.code === 'MC-01';
                    const isSpecialty = isMusic || isCulture || isMc;

                    return (
                      <div
                        key={prog.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => openCourseDetailPopup(prog)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openCourseDetailPopup(prog);
                          }
                        }}
                        className={`bg-white rounded-2xl p-6 flex flex-col justify-between space-y-4 border-2 transition-all cursor-pointer group ${
                          isSelected
                            ? 'border-[#E61E64] shadow-lg shadow-[#E61E64]/12 ring-2 ring-[#E61E64]/15'
                            : 'border-[#172154]/12 hover:border-[#0D9488] hover:shadow-md'
                        }`}
                      >
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 text-xs font-mono font-extrabold text-[#2D3E99] bg-[#2D3E99]/8 px-2 py-0.5 rounded-md">
                              {isMusic && <Music className="w-3.5 h-3.5 text-[#FF6B00]" />}
                              {isCulture && <Globe className="w-3.5 h-3.5 text-[#0D9488]" />}
                              {isMc && <Mic className="w-3.5 h-3.5 text-[#E61E64]" />}
                              <span>
                                {prog.code} · {prog.cefrTarget}
                              </span>
                            </span>
                            {isSpecialty ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FF6B00] text-white text-[10px] font-extrabold uppercase tracking-wider">
                                <Sparkles className="w-3 h-3" />
                                {biText(lang, 'Creative Talent', 'Tài Năng')}
                              </span>
                            ) : prog.showInPromoPopup ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#E61E64] text-white text-[10px] font-extrabold uppercase tracking-wider">
                                <Sparkles className="w-3 h-3" />
                                {biText(lang, 'Featured', 'Nổi bật')}
                              </span>
                            ) : null}
                          </div>

                          <div>
                            <h4 className="font-display text-lg font-extrabold text-[#172154] group-hover:text-[#0F766E] transition-colors leading-snug">
                              {lang === 'vi'
                                ? prog.titleVi || prog.titleEn
                                : lang === 'en'
                                  ? prog.titleEn
                                  : `${prog.titleVi || prog.titleEn} / ${prog.titleEn}`}
                            </h4>
                            <div className="mt-1 flex items-baseline gap-2">
                              <span className="font-display text-xl font-extrabold text-[#E61E64] tabular-nums">
                                {formatVnd(prog.tuitionVnd)}
                              </span>
                              <span className="text-xs text-[#172154]/60 font-semibold">
                                / {prog.weeksCount} {biText(lang, 'weeks', 'tuần')}
                              </span>
                            </div>
                          </div>

                          {(prog.descriptionEn || prog.descriptionVi) && (
                            <p className="text-xs sm:text-sm text-[#172154]/80 leading-relaxed line-clamp-3">
                              {lang === 'vi'
                                ? prog.descriptionVi || prog.descriptionEn
                                : lang === 'en'
                                  ? prog.descriptionEn
                                  : `${prog.descriptionVi || prog.descriptionEn} / ${prog.descriptionEn}`}
                            </p>
                          )}

                          {/* Detailed Course Specs */}
                          <div className="space-y-1.5 p-3 rounded-xl bg-[#F8F9FB] border border-[#172154]/8 text-xs">
                            {prog.teacherName && (
                              <div className="flex items-center gap-2 text-[#172154]">
                                <GraduationCap className="w-3.5 h-3.5 text-[#2D3E99] shrink-0" />
                                <span>
                                  <strong>{biText(lang, 'Teacher:', 'Giáo viên:')}</strong> {prog.teacherName}
                                </span>
                              </div>
                            )}
                            {prog.maxClassSize && (
                              <div className="flex items-center gap-2 text-[#172154]">
                                <Users className="w-3.5 h-3.5 text-[#0D9488] shrink-0" />
                                <span>
                                  <strong>{biText(lang, 'Class Size:', 'Sĩ số lớp:')}</strong>{' '}
                                  {biText(
                                    lang,
                                    `Max ${prog.maxClassSize} students`,
                                    `Tối đa ${prog.maxClassSize} học viên`
                                  )}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center gap-2 text-[#172154]/85">
                              <Clock className="w-3.5 h-3.5 text-[#2D3E99] shrink-0" />
                              <span className="line-clamp-1">
                                {prog.ageRange}
                                {prog.scheduleSummary ? ` · ${prog.scheduleSummary}` : ''}
                              </span>
                            </div>
                            {prog.location && (
                              <div className="flex items-center gap-2 text-[#172154]/75">
                                <MapPin className="w-3.5 h-3.5 text-[#E61E64] shrink-0" />
                                <span className="truncate">{prog.location}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="pt-3 border-t border-[#172154]/10 space-y-2">
                          <div className="flex items-center justify-between text-xs font-semibold text-[#0F766E]">
                            <span className="inline-flex items-center gap-1">
                              <Eye className="w-3.5 h-3.5" />
                              {biText(lang, 'Click card for full details', 'Nhấp xem chi tiết khóa học')}
                            </span>
                          </div>

                          {existingEnrollment ? (
                            <div className="w-full py-2.5 px-4 rounded-xl bg-[#0D9488]/12 border border-[#0D9488]/25 text-[#0D9488] text-xs font-bold flex items-center justify-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>
                                {biText(
                                  lang,
                                  `Enrollment ${existingEnrollment.status.toUpperCase()}`,
                                  `Đã gửi đăng ký (${existingEnrollment.status})`
                                )}
                              </span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenCourseCheckout(prog);
                              }}
                              disabled={busy}
                              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                                isSelected
                                  ? 'bg-[#E61E64] hover:bg-[#c81655] text-white shadow-sm'
                                  : 'bg-[#2D3E99] hover:bg-[#1f2c73] text-white'
                              }`}
                            >
                              <QrCode className="w-3.5 h-3.5" />
                              {biText(
                                lang,
                                'Choose Course & Pay Now',
                                'Chọn Khóa & Thanh Toán Ngay'
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* PCE-Kids 13-Level Official Course Catalog */}
          {(programCategoryFilter === 'all' || programCategoryFilter === 'pce') && (() => {
            const q = programSearchQuery.trim().toLowerCase();
            const filteredPce = pceCurriculum.filter((lvl) => {
              if (!q) return true;
              return (
                lvl.titleEn.toLowerCase().includes(q) ||
                lvl.titleVi.toLowerCase().includes(q) ||
                lvl.code.toLowerCase().includes(q) ||
                lvl.cefrBand.toLowerCase().includes(q) ||
                lvl.ageRangeEn.toLowerCase().includes(q) ||
                lvl.textbooks.some((t) => t.title.toLowerCase().includes(q))
              );
            });

            if (pceCurriculum.length > 0 && filteredPce.length === 0) return null;

            return (
              <div className="space-y-4 pt-4 border-t border-[#172154]/12">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-[#E61E64] uppercase tracking-wider">
                      {biText(
                        lang,
                        'THE PCE-KIDS FRAMEWORK · 13-LEVEL CONTINUOUS PATHWAY (AGES 3–16)',
                        'KHUNG CHƯƠNG TRÌNH PCE-KIDS · LỘ TRÌNH 13 CẤP ĐỘ XUYÊN SUỐT (3–16 TUỔI)'
                      )}
                    </div>
                    <h3 className="font-display text-xl font-extrabold text-[#172154]">
                      {biText(
                        lang,
                        'Enroll in Next-Level PCE-Kids Courses (Little Explorers · Young Discoverers · Future Leaders)',
                        'Đăng Ký Khóa Học Lên Cấp PCE-Kids (Mầm Non · Tiểu Học · Thiếu Niên)'
                      )}
                    </h3>
                  </div>
                </div>

                {pceCurriculum.length === 0 ? (
                  <PortalLoader
                    compact
                    label={biText(lang, 'Loading 13-level PCE-Kids curriculum…', 'Đang tải lộ trình 13 cấp độ PCE-Kids…')}
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredPce.map((lvl) => {
                      const pceAsProgram: ProgramCourse = {
                        id: `prog_${lvl.code.toLowerCase().replace('-', '_')}`,
                        code: lvl.code,
                        titleEn: lvl.titleEn,
                        titleVi: lvl.titleVi,
                        descriptionEn: lvl.summaryEn,
                        descriptionVi: lvl.summaryVi,
                        cefrTarget: `${lvl.cefrBand} (${lvl.cambridgeMilestoneEn})`,
                        ageRange: lvl.ageRangeEn,
                        weeksCount: lvl.durationWeeks,
                        tuitionVnd: lvl.tuitionVnd,
                        maxClassSize: 12,
                        scheduleSummary: `${lvl.sessionsPerWeek} sessions/week × ${lvl.hoursPerSession}h`,
                        location: 'C002 ParcSpring, 537 Nguyễn Duy Trinh, TP Thủ Đức',
                        promoBadgeEn: `PCE-KIDS LEVEL ${lvl.levelNumber} · CAMBRIDGE PATHWAY`,
                        promoBadgeVi: `PCE-KIDS CẤP ĐỘ ${lvl.levelNumber} · CHUẨN CAMBRIDGE`,
                        isActive: true,
                      };

                      return (
                        <div
                          key={lvl.code}
                          role="button"
                          tabIndex={0}
                          onClick={() => openCourseDetailPopup(pceAsProgram, lvl)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              openCourseDetailPopup(pceAsProgram, lvl);
                            }
                          }}
                          className="bg-white border-2 border-[#172154]/10 hover:border-[#0D9488] hover:shadow-md rounded-xl p-5 flex flex-col justify-between space-y-4 transition-all cursor-pointer group"
                        >
                          <div className="space-y-3">
                            <div className="flex items-center gap-3.5">
                              <img
                                src={lvl.lilabCharacterImg}
                                alt={lvl.titleEn}
                                loading="lazy"
                                decoding="async"
                                className="w-14 h-14 aspect-square rounded-xl bg-[#F8F9FB] p-1.5 border border-[#172154]/10 object-contain shrink-0"
                              />
                              <div>
                                <div className="text-[11px] font-mono font-bold text-[#FF6B00] tabular-nums">
                                  Lv.{lvl.levelNumber}/13 · {lvl.code} · {lvl.cefrBand}
                                </div>
                                <h4 className="font-display text-base font-bold text-[#172154] group-hover:text-[#0F766E] transition-colors leading-snug">
                                  {biText(lang, lvl.titleEn, lvl.titleVi)}
                                </h4>
                                <div className="text-[11px] text-[#172154]/65">
                                  {biText(lang, lvl.ageRangeEn, lvl.ageRangeVi)} · {lvl.durationWeeks}w ({lvl.hoursPerLevel}h · {lvl.cumulativeHours}h)
                                </div>
                              </div>
                            </div>

                            <p className="text-xs text-[#172154]/75 leading-relaxed line-clamp-2">
                              {biText(lang, lvl.summaryEn, lvl.summaryVi)}
                            </p>

                            <div className="text-[11px] text-[#0F766E] font-semibold">
                              {biText(lang, 'Textbooks:', 'Giáo trình:')}{' '}
                              {lvl.textbooks.map((t) => t.title).join(' + ')}
                            </div>
                          </div>

                          <div className="pt-3 border-t border-[#2D3E99]/10 space-y-2.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-[#172154]/65 font-medium truncate max-w-[175px]">
                                {biText(lang, lvl.cambridgeMilestoneEn, lvl.cambridgeMilestoneVi)}
                              </span>
                              <span className="font-mono font-bold text-[#2D3E99] tabular-nums">
                                {formatVnd(lvl.tuitionVnd)}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[11px] font-semibold text-[#0F766E]">
                              <span className="inline-flex items-center gap-1">
                                <Eye className="w-3.5 h-3.5" />
                                {biText(lang, 'Click for full syllabus & details', 'Nhấp xem giáo trình & chi tiết')}
                              </span>
                            </div>

                            <button
                              type="button"
                              disabled={busy}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenCourseCheckout(pceAsProgram);
                              }}
                              className="w-full py-2.5 px-4 rounded-xl bg-[#FF6B00] hover:bg-[#E05A00] text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                              {biText(
                                lang,
                                `Choose ${lvl.code} & Pay Now`,
                                `Chọn ${lvl.code} & Thanh Toán Ngay`
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {enrollments.length > 0 && (
            <div className="bg-white border border-[#2D3E99]/12 rounded-xl p-6 space-y-3">
              <h4 className="font-display text-base font-bold text-[#2D3E99]">
                {lang === 'vi' ? 'Đăng ký đã gửi' : 'Submitted Enrollments'}
              </h4>
              <div className="divide-y divide-[#2D3E99]/10 text-sm">
                {enrollments.map((e) => (
                  <div key={e.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-semibold text-[#172154]">{e.studentName}</span>
                      <span className="mx-1.5 text-[#172154]/40">·</span>
                      <span className="text-[#2D3E99] font-medium">{e.programTitle}</span>
                      {e.preferredSchedule && (
                        <span className="block text-xs text-[#172154]/60">{e.preferredSchedule}</span>
                      )}
                    </div>
                    <span className="px-2.5 py-0.5 rounded-md bg-[#E61E64]/10 text-[#E61E64] text-xs font-bold uppercase">
                      {e.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: INVOICES & PAYMENT SETUP (Direct Withdraw, Credit Card, Live LiLab QR) */}
      {activeTab === 'billing' && (
        <div className="space-y-6">
          {/* LiLab Official Receiving Bank & QR Card (live synced from Admin Accounts & Banking) */}
          <div className="bg-gradient-to-br from-[#172154] via-[#2D3E99] to-[#1f2e78] text-white rounded-2xl p-6 shadow-md">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="bg-white rounded-2xl p-3 shadow-lg shrink-0 border-2 border-[#FFD41D]/80">
                {activeBank.qrImageDataUrl ? (
                  <img
                    src={activeBank.qrImageDataUrl}
                    alt="LiLab Official Payment QR"
                    className="w-40 h-40 object-contain rounded-lg"
                  />
                ) : (
                  <img
                    src={buildVietQrImageUrl({
                      bankCode: activeBank.bankCode,
                      accountNumber: activeBank.accountNumber,
                      accountHolder: activeBank.accountHolder,
                      memo: activeStudent ? `LILAB ${activeStudent.fullName}` : 'LILAB TUITION',
                    })}
                    alt="LiLab VietQR"
                    className="w-40 h-40 object-contain rounded-lg"
                  />
                )}
              </div>

              <div className="flex-1 space-y-3 text-center md:text-left">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#FFD41D] text-[#172154] text-[11px] font-extrabold uppercase tracking-wider">
                  <QrCode className="w-3.5 h-3.5" />
                  <span>
                    {biText(
                      lang,
                      'Official LiLab Receiving Bank & QR Code',
                      'Tài Khoản & Mã QR Nhận Học Phí Chính Thức LiLab'
                    )}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white/10 rounded-xl p-4 border border-white/15">
                  <div>
                    <div className="text-white/65 uppercase text-[10px] font-bold">
                      {biText(lang, 'Bank', 'Ngân hàng')}
                    </div>
                    <div className="font-bold text-sm mt-0.5">{activeBank.bankName}</div>
                  </div>
                  <div>
                    <div className="text-white/65 uppercase text-[10px] font-bold">
                      {biText(lang, 'Account Number', 'Số tài khoản')}
                    </div>
                    <div className="flex items-center justify-center md:justify-start gap-2 mt-0.5">
                      <span className="font-mono font-extrabold text-base text-[#FFD41D]">
                        {activeBank.accountNumber}
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleCopyBillingText(activeBank.accountNumber, 'lilab_acct')}
                        className="p-1 rounded bg-white/15 hover:bg-white/25 cursor-pointer"
                        title={biText(lang, 'Copy account number', 'Chép số tài khoản')}
                      >
                        {copiedKey === 'lilab_acct' ? (
                          <Check className="w-3.5 h-3.5 text-[#56BEB8]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="text-white/65 uppercase text-[10px] font-bold">
                      {biText(lang, 'Account Holder', 'Chủ tài khoản')}
                    </div>
                    <div className="font-bold text-sm mt-0.5">{activeBank.accountHolder}</div>
                  </div>
                </div>
                <p className="text-xs text-white/80 leading-relaxed">
                  {biText(
                    lang,
                    activeBank.paymentInstructionsEn ||
                      'Scan the QR above or select any pending invoice below to pay immediately with exact amount.',
                    activeBank.paymentInstructionsVi ||
                      'Quét mã QR bên cạnh hoặc chọn hóa đơn bên dưới để thanh toán ngay đúng số tiền học phí.'
                  )}
                </p>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('enroll')}
                    className="px-3.5 py-2 rounded-xl bg-[#E61E64] hover:bg-[#c81655] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <GraduationCap className="w-3.5 h-3.5" />
                    <span>{biText(lang, 'Choose a Course & Pay Now', 'Chọn Khóa Học & Thanh Toán Ngay')}</span>
                  </button>
                  <a
                    href={`https://zalo.me/${(activeBank.zaloHotline || '0707547187').replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-[#FFD41D]" />
                    <span>Zalo Support: {activeBank.zaloHotline || '0707 547 187'}</span>
                    <ExternalLink className="w-3 h-3 opacity-80" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Payment Methods & Parent Banking Setup */}
            <form onSubmit={handleSavePaymentMethod} className="lg:col-span-5 bg-white border border-[#2D3E99]/12 rounded-2xl p-6 space-y-4">
              <div>
                <h3 className="font-display text-lg font-bold text-[#2D3E99]">
                  {biText(lang, 'Parent Banking & Payment Setup', 'Cài đặt Ngân hàng & Thanh toán Phụ huynh')}
                </h3>
                <p className="text-xs text-[#172154]/65 mt-0.5">
                  {biText(
                    lang,
                    'Saved securely to LiLab Accounts for faster course checkout & tuition verification.',
                    'Lưu bảo mật vào hệ thống Kế toán LiLab để thanh toán khóa học nhanh và đối soát tự động.'
                  )}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'direct_debit' as const, label: t.directWithdraw, icon: <Building2 className="w-4 h-4" /> },
                  { id: 'credit_card' as const, label: t.creditCard, icon: <CreditCard className="w-4 h-4" /> },
                  { id: 'qr_transfer' as const, label: t.qrPayment, icon: <QrCode className="w-4 h-4" /> },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setMethodType(m.id);
                      setProviderLabel(
                        m.id === 'direct_debit'
                          ? `${parentBankName || 'Vietcombank'} Direct Debit`
                          : m.id === 'credit_card'
                          ? 'Visa / Mastercard'
                          : `${parentBankName || 'VietQR'} Instant Transfer`
                      );
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 text-center cursor-pointer ${
                      methodType === m.id
                        ? 'bg-[#2D3E99] text-white border-[#2D3E99]'
                        : 'bg-[#FDF9EE] text-[#172154] border-[#2D3E99]/15'
                    }`}
                  >
                    {m.icon}
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-[#172154]/75 mb-1">
                    {biText(lang, 'Bank / Card Issuer', 'Ngân hàng / Tổ chức thẻ')}
                  </label>
                  <input
                    type="text"
                    required
                    value={parentBankName}
                    onChange={(e) => {
                      setParentBankName(e.target.value);
                      setProviderLabel(e.target.value);
                    }}
                    placeholder="Vietcombank, Techcombank, MB, Visa..."
                    className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#172154]/75 mb-1">
                    {biText(lang, 'Account / Card Last 4 Digits', '4 số cuối TK / Thẻ')}
                  </label>
                  <input
                    type="text"
                    maxLength={20}
                    required
                    value={accountLast4}
                    onChange={(e) => setAccountLast4(e.target.value)}
                    placeholder="e.g. 8899"
                    className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm font-mono-num"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-[#172154]/75 mb-1">
                    {biText(lang, 'Account Holder Name', 'Tên chủ tài khoản')}
                  </label>
                  <input
                    type="text"
                    required
                    value={accountHolder}
                    onChange={(e) => setAccountHolder(e.target.value)}
                    placeholder="NGUYEN MINH ANH"
                    className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#172154]/75 mb-1">
                    {biText(lang, 'Zalo / SMS Phone', 'SĐT Zalo nhận nhắc học phí')}
                  </label>
                  <input
                    type="tel"
                    value={parentBankPhone}
                    onChange={(e) => setParentBankPhone(e.target.value)}
                    placeholder="0909 123 456"
                    className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm font-mono-num"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#172154]/75 mb-1">
                  {biText(lang, 'Branch or Billing Notes (Optional)', 'Chi nhánh / Ghi chú (Không bắt buộc)')}
                </label>
                <input
                  type="text"
                  value={parentBranchNotes}
                  onChange={(e) => setParentBranchNotes(e.target.value)}
                  placeholder={biText(lang, 'e.g. Monthly tuition auto-debit', 'VD: Trích nợ học phí hàng tháng')}
                  className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm"
                />
              </div>

              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoPay}
                  onChange={(e) => setAutoPay(e.target.checked)}
                  className="rounded"
                />
                <span>{lang === 'vi' ? 'Bật trích nợ tự động khi đến hạn' : 'Enable Auto-Pay on invoice due dates'}</span>
              </label>

              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 px-4 rounded-xl bg-[#E61E64] hover:bg-[#c81655] text-white text-sm font-bold transition-colors cursor-pointer"
              >
                {biText(lang, 'Save Banking Information', 'Lưu Thông Tin Ngân Hàng')}
              </button>

              {paymentMethods.length > 0 && (
                <div className="pt-3 border-t border-[#2D3E99]/10 space-y-2 text-xs">
                  <div className="font-bold text-[#2D3E99]">
                    {biText(lang, 'Saved Banking & Payment Methods', 'Thông tin thanh toán đã lưu')}
                  </div>
                  {paymentMethods.map((pm) => (
                    <div key={pm.id} className="p-2.5 rounded-xl bg-[#FDF9EE] border border-[#2D3E99]/10 flex items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold text-[#172154]">
                          {pm.bankName || pm.providerLabel} ({pm.accountNumberMasked || `•••• ${pm.accountLast4}`})
                        </div>
                        <div className="text-[11px] text-[#172154]/65">
                          {pm.accountHolderName}
                          {pm.parentPhone ? ` · Zalo ${pm.parentPhone}` : ''}
                        </div>
                      </div>
                      <span className="font-mono-num text-[#0D9488] font-bold shrink-0">
                        {pm.autoPayEnabled ? 'Auto-Pay' : 'Manual'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </form>

            {/* Invoices & Live LiLab QR Checkout */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-white border border-[#2D3E99]/12 rounded-2xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display text-lg font-bold text-[#2D3E99]">
                    {lang === 'vi' ? 'Hóa đơn Học phí của gia đình' : 'Family Invoices'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('enroll')}
                    className="px-3 py-1.5 rounded-lg bg-[#2D3E99]/10 text-[#2D3E99] hover:bg-[#2D3E99] hover:text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    + {biText(lang, 'Enroll & Pay New Course', 'Đăng ký & Thanh toán Khóa mới')}
                  </button>
                </div>

                {invoices.length === 0 ? (
                  <p className="text-sm text-[#172154]/65">
                    {biText(
                      lang,
                      'No invoices issued yet. Choose a course in Enroll in Courses to pay right away.',
                      'Hiện chưa có hóa đơn nào. Chọn khóa học ở mục Đăng ký Khóa học để thanh toán ngay.'
                    )}
                  </p>
                ) : (
                  <div className="divide-y divide-[#2D3E99]/10">
                    {invoices.map((inv) => (
                      <div key={inv.id} className="py-4 flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <div className="font-mono-num font-bold text-[#2D3E99]">
                            {inv.invoiceNumber} · {formatVnd(inv.amountVnd)}
                          </div>
                          <div className="text-xs text-[#172154]/70">
                            {inv.studentName} · {inv.programTitle} · Due {inv.dueDate}
                          </div>
                          {inv.paymentReference && inv.status === 'paid' && (
                            <div className="text-[11px] font-mono text-[#0D9488] mt-0.5">
                              Ref: {inv.paymentReference}
                              {inv.payerBankName ? ` · ${inv.payerBankName}` : ''}
                            </div>
                          )}
                          {inv.reminderNote && inv.status !== 'paid' && (
                            <div className="text-xs text-[#E61E64] font-medium mt-1">{inv.reminderNote}</div>
                          )}
                        </div>

                        {inv.status === 'paid' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0D9488]/12 text-xs font-bold text-[#0D9488]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {biText(lang, `Paid (${inv.paymentMethod})`, `Đã thanh toán (${inv.paymentMethod})`)}
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setQrInvoice(inv);
                                setPayRefInput(`QR-${inv.invoiceNumber}`);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-[#FFD41D] hover:bg-[#f0c50c] text-[#172154] text-xs font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                              {biText(lang, 'Pay by LiLab QR', 'Thanh toán QR')}
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePayInvoice(inv, 'direct_debit', `ACH-${inv.invoiceNumber}`)}
                              className="px-3 py-1.5 rounded-lg bg-[#2D3E99] hover:bg-[#1f2c73] text-white text-xs font-semibold cursor-pointer"
                            >
                              {biText(lang, 'Direct Debit', 'Trích nợ NH')}
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePayInvoice(inv, 'credit_card', `CARD-${inv.invoiceNumber}`)}
                              className="px-3 py-1.5 rounded-lg bg-[#E61E64] hover:bg-[#c81655] text-white text-xs font-semibold cursor-pointer"
                            >
                              {biText(lang, 'Pay Card', 'Thẻ tín dụng')}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {qrInvoice && (
                <div className="bg-white border-2 border-[#2D3E99]/25 rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-6 shadow-md">
                  <div className="p-2.5 bg-white border border-[#2D3E99]/20 rounded-xl shrink-0">
                    {activeBank.qrImageDataUrl ? (
                      <img
                        src={activeBank.qrImageDataUrl}
                        alt="LiLab Official QR Code"
                        className="w-44 h-44 object-contain rounded-lg"
                      />
                    ) : (
                      <img
                        src={buildVietQrImageUrl({
                          bankCode: activeBank.bankCode,
                          accountNumber: activeBank.accountNumber,
                          accountHolder: activeBank.accountHolder,
                          amountVnd: qrInvoice.amountVnd,
                          memo: `${qrInvoice.invoiceNumber} ${qrInvoice.studentName}`,
                        })}
                        alt="VietQR Payment Code"
                        className="w-44 h-44 object-contain rounded-lg"
                      />
                    )}
                  </div>
                  <div className="flex-1 space-y-3 text-sm w-full">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-display text-base font-bold text-[#2D3E99]">
                        {biText(lang, 'LiLab QR Transfer', 'Chuyển khoản QR LiLab')} · {qrInvoice.invoiceNumber}
                      </div>
                      <button
                        type="button"
                        onClick={() => setQrInvoice(null)}
                        className="text-xs text-[#172154]/60 hover:text-[#E61E64] font-semibold cursor-pointer"
                      >
                        {biText(lang, 'Close', 'Đóng')}
                      </button>
                    </div>
                    <div className="text-xs text-[#172154]/85 font-mono-num space-y-1 bg-[#FDF9EE] p-3 rounded-xl border border-[#2D3E99]/10">
                      <div>
                        <strong>Bank:</strong> {activeBank.bankName} · {activeBank.accountNumber}
                      </div>
                      <div>
                        <strong>Account:</strong> {activeBank.accountHolder}
                      </div>
                      <div>
                        <strong>Amount:</strong>{' '}
                        <span className="text-[#E61E64] font-bold">{formatVnd(qrInvoice.amountVnd)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span>
                          <strong>Memo:</strong> {qrInvoice.invoiceNumber} {qrInvoice.studentName}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            void handleCopyBillingText(
                              `${qrInvoice.invoiceNumber} ${qrInvoice.studentName}`,
                              'qr_memo'
                            )
                          }
                          className="text-[#2D3E99] hover:text-[#E61E64] font-sans font-bold text-[11px] flex items-center gap-1 cursor-pointer shrink-0"
                        >
                          {copiedKey === 'qr_memo' ? (
                            <Check className="w-3 h-3 text-[#0D9488]" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          {biText(lang, 'Copy', 'Chép')}
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={payerBankForQr}
                        onChange={(e) => setPayerBankForQr(e.target.value)}
                        placeholder={biText(lang, 'Your Bank (e.g. VCB, Techcombank)', 'Ngân hàng chuyển (VD: VCB, TCB)')}
                        className="px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-xs"
                      />
                      <input
                        type="text"
                        value={payRefInput}
                        onChange={(e) => setPayRefInput(e.target.value)}
                        placeholder={biText(lang, 'Transfer Ref (e.g. FT261234)', 'Mã giao dịch (VD: FT261234)')}
                        className="px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-xs font-mono-num"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        handlePayInvoice(
                          qrInvoice,
                          'qr_transfer',
                          payRefInput || `QR-${qrInvoice.invoiceNumber}`,
                          payerBankForQr
                        )
                      }
                      className="w-full py-2.5 px-4 rounded-xl bg-[#0D9488] hover:bg-[#0f766e] text-white text-xs font-bold cursor-pointer"
                    >
                      {biText(lang, 'Confirm QR Payment & Notify LiLab Accounts', 'Xác nhận Đã Chuyển Khoản QR')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'certificates' && (
        <CertificatesTab
          lang={lang}
          roleMode={effectiveViewRole === 'student' ? 'student' : 'parent'}
          currentUser={currentUser}
          students={students}
          assessments={assessments}
          selectedStudentId={activeStudent?.id}
          onSelectStudentId={(id) => setSelectedStudentId(id)}
          isLoading={!studentsLoaded || !assessmentsLoaded}
        />
      )}
        </Suspense>
      </ErrorBoundary>

      {detailModalSelection && (
        <ParentCourseDetailModal
          lang={lang}
          selection={detailModalSelection}
          activeStudent={activeStudent}
          existingEnrollment={
            activeStudent
              ? enrollments.find(
                  (enr) =>
                    enr.studentId === activeStudent.id &&
                    enr.programId === detailModalSelection.program.id
                ) || null
              : null
          }
          enrollNotes={enrollNotes}
          onChangeEnrollNotes={setEnrollNotes}
          onClose={() => setDetailModalSelection(null)}
          onProceedToCheckout={(prog) => handleOpenCourseCheckout(prog)}
          busy={busy}
        />
      )}

      {checkoutProgram && (
        <Suspense fallback={null}>
          <ParentCourseCheckoutModal
            lang={lang}
            program={checkoutProgram}
            students={students}
            initialStudent={activeStudent}
            currentUser={currentUser}
            activeBank={activeBank}
            savedMethods={paymentMethods}
            initialNotes={enrollNotes}
            onClose={() => setCheckoutProgram(null)}
            onSuccess={(summaryMsg, goToBilling) => {
              setCheckoutProgram(null);
              setEnrollNotes('');
              flash(summaryMsg);
              if (goToBilling) {
                setActiveTab('billing');
              }
            }}
          />
        </Suspense>
      )}

      {activeReadOnlyNote && (
        <Suspense fallback={null}>
          <ReadOnlyMaterialViewer
            lang={lang}
            noteId={activeReadOnlyNote.noteId}
            note={activeReadOnlyNote.note}
            fallbackTitle={activeReadOnlyNote.fallbackTitle}
            viewerLabel={currentUser.email}
            onClose={() => setActiveReadOnlyNote(null)}
          />
        </Suspense>
      )}
    </div>
  );
};
