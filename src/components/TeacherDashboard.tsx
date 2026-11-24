import React, { lazy, Suspense, useEffect, useState } from 'react';
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
import { Award, BookOpen, Calendar, Check, CheckCircle2, Languages, Lock, Pencil, Plus, Printer, ShieldCheck, Sparkles, StickyNote, Trash2, TrendingUp, User, Wallet, X } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { readCatalogue } from '../services/catalogueReads';
import { biText, formatVnd, TRANSLATIONS } from '../i18n';
import { assistAssessmentInsight, translateText } from '../services/aiClient';
import { isSuperAdminEmail } from '../services/seedData';
import { ErrorBoundary } from './ErrorBoundary';
import { HistoricalProgress } from './HistoricalProgress';
import { ProfileAvatar } from './ProfileAvatar';
import { PortalLoader } from './ui/Primitives';

const AcademyEventCalendar = lazy(() =>
  import('./AcademyEventCalendar').then((m) => ({ default: m.AcademyEventCalendar }))
);
const LearningResourceLibrary = lazy(() =>
  import('./LearningResourceLibrary').then((m) => ({ default: m.LearningResourceLibrary }))
);
const ReadOnlyMaterialViewer = lazy(() =>
  import('./ReadOnlyMaterialViewer').then((m) => ({ default: m.ReadOnlyMaterialViewer }))
);
import {
  assessmentToVisualScores,
  formatAssessmentDateOption,
  sortAssessmentsChronological,
  StudentVisualAnalytics,
  type QuadrantCohortPoint,
  type VisualComparisonOverlay,
} from './StudentVisualAnalytics';
import {
  CEFR_LEVELS,
  formatCefrLabel,
  type AcademyClass,
  type CefrLevel,
  type CefrModifier,
  type ClassSchedule,
  type GeminiNote,
  type LangCode,
  type QuickNoteCategory,
  type StudentAssessment,
  type StudentProfile,
  type StudentQuickNote,
  type TeacherProfile,
  type UserProfile,
} from '../types';

interface TeacherDashboardProps {
  lang: LangCode;
  currentUser: UserProfile;
  activeTab?: TeacherTab;
  onTabChange?: (tab: TeacherTab) => void;
}

type TeacherTab = 'assess' | 'classes' | 'schedule' | 'profile' | 'curriculum';

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  lang,
  currentUser,
  activeTab: controlledTab,
  onTabChange,
}) => {
  const t = TRANSLATIONS[lang];
  const [internalTab, setInternalTab] = useState<TeacherTab>('schedule');
  const activeTab: TeacherTab = controlledTab ?? internalTab;
  const setActiveTab = (next: TeacherTab) => {
    setInternalTab(next);
    onTabChange?.(next);
  };

  const [teacherDoc, setTeacherDoc] = useState<TeacherProfile | null>(null);
  const [classes, setClasses] = useState<AcademyClass[]>([]);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
  const [assessments, setAssessments] = useState<StudentAssessment[]>([]);
  const [quickNotes, setQuickNotes] = useState<StudentQuickNote[]>([]);
  const [geminiNotes, setGeminiNotes] = useState<GeminiNote[]>([]);
  const [banner, setBanner] = useState<string | null>(null);
  const [activeReadOnlyNote, setActiveReadOnlyNote] = useState<GeminiNote | null>(null);

  // Quick Notes state
  const [qnDate, setQnDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [qnCategory, setQnCategory] = useState<QuickNoteCategory>('general');
  const [qnText, setQnText] = useState('');
  const [editingQuickNoteId, setEditingQuickNoteId] = useState<string | null>(null);
  const [editQnDate, setEditQnDate] = useState('');
  const [editQnCategory, setEditQnCategory] = useState<QuickNoteCategory>('general');
  const [editQnText, setEditQnText] = useState('');
  const [rosterQuickNoteStudentId, setRosterQuickNoteStudentId] = useState<string | null>(null);

  // Assessment studio state
  const [editingAssessmentId, setEditingAssessmentId] = useState<string | null>(null);
  const [confirmDeleteAllReports, setConfirmDeleteAllReports] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [termLabel, setTermLabel] = useState('Term 1 · Week 01');
  const [cefrLevel, setCefrLevel] = useState<CefrLevel>('Pre-A1 Starters');
  const [cefrMod, setCefrMod] = useState<CefrModifier>('standard');
  const [speakingScore, setSpeakingScore] = useState(84);
  const [readingScore, setReadingScore] = useState(80);
  const [writingScore, setWritingScore] = useState(76);
  const [vocabularyScore, setVocabularyScore] = useState(82);
  const [comprehensionScore, setComprehensionScore] = useState(80);
  const [socialScore, setSocialScore] = useState(90);
  const [emotionalScore, setEmotionalScore] = useState(88);
  const [mentalScore, setMentalScore] = useState(85);
  const [commentEn, setCommentEn] = useState('');
  const [commentVi, setCommentVi] = useState('');
  const [aiInsightEn, setAiInsightEn] = useState('');
  const [aiInsightVi, setAiInsightVi] = useState('');
  const [activities, setActivities] = useState<string[]>([
    'Week 01: The Lion and the Mouse Story',
    'Phonics /k/, /h/, /sh/ Practice',
  ]);
  const [busy, setBusy] = useState(false);

  // Two-date report progression comparison state
  const [compareMode, setCompareMode] = useState(false);
  const [compareFromId, setCompareFromId] = useState('');
  const [compareToId, setCompareToId] = useState('');

  // Editable teacher profile/bank fields
  const [editPhone, setEditPhone] = useState('');
  const [editBioEn, setEditBioEn] = useState('');
  const [editBioVi, setEditBioVi] = useState('');
  const [editBankName, setEditBankName] = useState('');
  const [editBankNum, setEditBankNum] = useState('');
  const [editBankHolder, setEditBankHolder] = useState('');

  useEffect(() => {
    const email = currentUser.email.toLowerCase();
    const isSuperAdmin = isSuperAdminEmail(email);
    const isAdminPreview = isSuperAdmin || currentUser.role === 'super_admin' || currentUser.role === 'admin';
    const unsubs: Array<() => void> = [];

    const scopeQuery = (colName: string, teacherField = 'teacherEmail', isArrayContains = false) => {
      if (isAdminPreview) return collection(db, colName);
      return isArrayContains
        ? query(collection(db, colName), where(teacherField, 'array-contains', email))
        : query(collection(db, colName), where(teacherField, '==', email));
    };

    unsubs.push(
      onSnapshot(
        scopeQuery('teachers'),
        (snap) => {
          if (!snap.empty) {
            const matched =
              snap.docs.find((d) => (d.data().teacherEmail || '').toLowerCase() === email) || snap.docs[0];
            const data = { id: matched.id, ...matched.data() } as TeacherProfile;
            setTeacherDoc(data);
            setEditPhone(data.phone || '');
            setEditBioEn(data.bioEn || '');
            setEditBioVi(data.bioVi || '');
            setEditBankName(data.bankName || '');
            setEditBankNum(data.bankAccountNumber || '');
            setEditBankHolder(data.bankAccountHolder || '');
          }
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'teachers')
      )
    );

    unsubs.push(
      onSnapshot(
        scopeQuery('classes'),
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AcademyClass));
          setClasses(list);
          if (list.length > 0 && !selectedClassId) setSelectedClassId(list[0].id);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'classes')
      )
    );

    unsubs.push(
      onSnapshot(
        scopeQuery('students', 'assignedTeacherEmails', true),
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as StudentProfile));
          setStudents(list);
          if (list.length > 0 && !selectedStudentId) {
            setSelectedStudentId(list[0].id);
            setCefrLevel(list[0].cefrLevel);
            setCefrMod(list[0].cefrModifier);
          }
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'students')
      )
    );

    unsubs.push(
      onSnapshot(
        scopeQuery('schedules'),
        (snap) => setSchedules(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ClassSchedule))),
        (err) => handleFirestoreError(err, OperationType.LIST, 'schedules')
      )
    );

    unsubs.push(
      onSnapshot(
        scopeQuery('assessments'),
        (snap) => setAssessments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as StudentAssessment))),
        (err) => handleFirestoreError(err, OperationType.LIST, 'assessments')
      )
    );

    unsubs.push(
      onSnapshot(
        scopeQuery('quick_notes'),
        (snap) => {
          const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as StudentQuickNote));
          rows.sort((a, b) => (b.observationDate || '').localeCompare(a.observationDate || ''));
          setQuickNotes(rows);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'quick_notes')
      )
    );

    unsubs.push(
      readCatalogue(
        'gemini_notes',
        collection(db, 'gemini_notes'),
        (snap) => {
          const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as GeminiNote));
          rows.sort((a, b) => (a.weekNumber || 0) - (b.weekNumber || 0));
          setGeminiNotes(rows);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'gemini_notes')
      )
    );

    return () => unsubs.forEach((u) => u());
  }, [currentUser.email, currentUser.role, currentUser.uid]);

  const flash = (msg: string) => {
    setBanner(msg);
    setTimeout(() => setBanner(null), 4000);
  };

  const handleStudentSelect = (id: string) => {
    setSelectedStudentId(id);
    const st = students.find((s) => s.id === id);
    if (st) {
      setCefrLevel(st.cefrLevel);
      setCefrMod(st.cefrModifier);
    }
  };

  const handleTranslateComment = async () => {
    if (!commentEn.trim()) return;
    setBusy(true);
    try {
      const vi = await translateText({
        text: commentEn,
        targetLang: 'vi',
        context: 'teacher student progress report',
      });
      setCommentVi(vi);
    } finally {
      setBusy(false);
    }
  };

  const handleAiInsight = async () => {
    const stu = students.find((s) => s.id === selectedStudentId);
    if (!stu) return;
    setBusy(true);
    try {
      const activeQuickNotes = quickNotes.filter(
        (n) => n.studentId === stu.id && n.includeInReport !== false
      );
      const res = await assistAssessmentInsight({
        studentName: stu.fullName,
        cefrDisplay: formatCefrLabel(cefrLevel, cefrMod),
        speakingScore,
        readingScore,
        writingScore,
        vocabularyScore,
        comprehensionScore,
        socialScore,
        emotionalScore,
        mentalScore,
        teacherCommentEn: commentEn || 'Consistent engagement during Be Whole values sessions.',
        quickNotes: activeQuickNotes.map((n) => ({
          observationDate: n.observationDate,
          category: n.category,
          noteText: n.noteText,
        })),
      });
      setAiInsightEn(res.insightEn || '');
      setAiInsightVi(res.insightVi || '');
      if (!commentEn.trim() && res.draftTeacherCommentEn) {
        setCommentEn(res.draftTeacherCommentEn);
      }
      if (!commentVi.trim() && res.draftTeacherCommentVi) {
        setCommentVi(res.draftTeacherCommentVi);
      }
      if (Array.isArray(res.suggestedActivities) && res.suggestedActivities.length > 0) {
        setActivities(res.suggestedActivities.slice(0, 6));
      }
      flash(
        activeQuickNotes.length > 0
          ? biText(
              lang,
              `Gemini synthesized insights using ${activeQuickNotes.length} Quick Notes for ${stu.fullName}.`,
              `Gemini đã tổng hợp báo cáo từ ${activeQuickNotes.length} ghi chú nhanh của ${stu.fullName}!`
            )
          : biText(
              lang,
              'AI generated holistic insights & recommendations.',
              'AI đã phân tích toàn diện hồ sơ học viên!'
            )
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSaveQuickNote = async (e: React.FormEvent, overrideStudentId?: string) => {
    e.preventDefault();
    const stuId = overrideStudentId || selectedStudentId;
    const stu = students.find((s) => s.id === stuId);
    if (!stu || !qnText.trim()) return;
    const matchedClass =
      classes.find((c) => c.id === selectedClassId) ||
      classes.find((c) => (c.studentIds || []).includes(stu.id)) ||
      classes[0];
    setBusy(true);
    try {
      const id = `qn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const payload = {
        studentId: stu.id,
        studentName: stu.fullName,
        ...(matchedClass ? { classId: matchedClass.id, className: matchedClass.name } : {}),
        teacherUid: currentUser.uid,
        teacherEmail: currentUser.email.toLowerCase(),
        teacherName: teacherDoc?.fullName || currentUser.displayName,
        observationDate: qnDate || new Date().toISOString().slice(0, 10),
        category: qnCategory,
        noteText: qnText.trim().slice(0, 1500),
        includeInReport: true,
        adminUids: stu.adminUids || [],
      };
      await setDoc(doc(db, 'quick_notes', id), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setQnText('');
      flash(
        biText(
          lang,
          `Saved daily observation for ${stu.fullName}.`,
          `Đã lưu ghi chú nhanh cho ${stu.fullName}.`
        )
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'quick_notes');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleIncludeQuickNote = async (note: StudentQuickNote) => {
    try {
      const nextInclude = !note.includeInReport;
      await updateDoc(doc(db, 'quick_notes', note.id), {
        includeInReport: nextInclude,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `quick_notes/${note.id}`);
    }
  };

  const startEditQuickNote = (note: StudentQuickNote) => {
    setEditingQuickNoteId(note.id);
    setEditQnDate(note.observationDate);
    setEditQnCategory(note.category);
    setEditQnText(note.noteText);
  };

  const handleSaveEditQuickNote = async (note: StudentQuickNote) => {
    if (!editQnText.trim()) return;
    setBusy(true);
    try {
      const updates = {
        observationDate: editQnDate || note.observationDate,
        category: editQnCategory,
        noteText: editQnText.trim().slice(0, 1500),
      };
      await updateDoc(doc(db, 'quick_notes', note.id), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      setEditingQuickNoteId(null);
      flash(biText(lang, 'Quick note updated.', 'Đã cập nhật ghi chú nhanh.'));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `quick_notes/${note.id}`);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteQuickNote = async (note: StudentQuickNote) => {
    try {
      await deleteDoc(doc(db, 'quick_notes', note.id));
      if (editingQuickNoteId === note.id) setEditingQuickNoteId(null);
      flash(biText(lang, 'Quick note deleted.', 'Đã xóa ghi chú nhanh.'));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `quick_notes/${note.id}`);
    }
  };

  const resetFormToCreate = () => {
    setEditingAssessmentId(null);
    setTermLabel('Term 1 · Week 01');
    setCommentEn('');
    setCommentVi('');
    setAiInsightEn('');
    setAiInsightVi('');
  };

  const handleSaveAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    const stu = students.find((s) => s.id === selectedStudentId);
    const cls = classes.find((c) => c.id === selectedClassId) || classes[0];
    if (!stu || !cls) {
      flash(
        biText(
          lang,
          'Assigned student and class are required.',
          'Cần có học viên và lớp học được phân công.'
        )
      );
      return;
    }
    setBusy(true);
    try {
      const cleanCommentEn = commentEn.trim() || 'Great participation in class.';
      const cleanCommentVi = commentVi.trim() || commentEn.trim() || 'Tham gia tích cực trong lớp.';
      const cleanActivities = activities.slice(0, 15);

      if (editingAssessmentId) {
        const updatePayload = {
          termLabel: termLabel.trim(),
          cefrLevel,
          cefrModifier: cefrMod,
          speakingScore,
          readingScore,
          writingScore,
          vocabularyScore,
          comprehensionScore,
          socialScore,
          emotionalScore,
          mentalScore,
          teacherCommentEn: cleanCommentEn,
          teacherCommentVi: cleanCommentVi,
          aiInsightEn: aiInsightEn.trim(),
          aiInsightVi: aiInsightVi.trim(),
          activitiesCompleted: cleanActivities,
        };
        await updateDoc(doc(db, 'assessments', editingAssessmentId), {
          ...updatePayload,
          updatedAt: serverTimestamp(),
        });
        const existingAsm = assessments.find((x) => x.id === editingAssessmentId);
        await updateDoc(doc(db, 'students', stu.id), {
          cefrLevel,
          cefrModifier: cefrMod,
          updatedAt: serverTimestamp(),
        });
        flash(
          biText(
            lang,
            `Updated published report for ${stu.fullName}.`,
            `Đã cập nhật báo cáo cho ${stu.fullName}!`
          )
        );
        setEditingAssessmentId(null);
      } else {
        const id = `asm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const newPayload = {
          studentId: stu.id,
          studentName: stu.fullName,
          classId: cls.id,
          className: cls.name,
          teacherUid: currentUser.uid,
          teacherEmail: currentUser.email,
          teacherName: teacherDoc?.fullName || currentUser.displayName,
          parentEmail: stu.parentEmail,
          ...(stu.studentEmail ? { studentEmail: stu.studentEmail } : {}),
          termLabel: termLabel.trim(),
          cefrLevel,
          cefrModifier: cefrMod,
          speakingScore,
          readingScore,
          writingScore,
          vocabularyScore,
          comprehensionScore,
          socialScore,
          emotionalScore,
          mentalScore,
          teacherCommentEn: cleanCommentEn,
          teacherCommentVi: cleanCommentVi,
          aiInsightEn: aiInsightEn.trim(),
          aiInsightVi: aiInsightVi.trim(),
          activitiesCompleted: cleanActivities,
          adminUids: stu.adminUids || [],
        };
        await setDoc(doc(db, 'assessments', id), {
          ...newPayload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // Sync student's current CEFR level +/-
        await updateDoc(doc(db, 'students', stu.id), {
          cefrLevel,
          cefrModifier: cefrMod,
          updatedAt: serverTimestamp(),
        });

        flash(
          biText(
            lang,
            `Saved assessment for ${stu.fullName}.`,
            `Đã lưu đánh giá cho ${stu.fullName}!`
          )
        );
      }
    } catch (err) {
      handleFirestoreError(
        err,
        editingAssessmentId ? OperationType.UPDATE : OperationType.CREATE,
        editingAssessmentId ? `assessments/${editingAssessmentId}` : 'assessments'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteAssessment = async (a: StudentAssessment) => {
    setBusy(true);
    try {
      await deleteDoc(doc(db, 'assessments', a.id));
      if (editingAssessmentId === a.id) {
        resetFormToCreate();
      }
      flash(
        biText(
          lang,
          `Deleted report for ${a.studentName}.`,
          `Đã xóa báo cáo của ${a.studentName}.`
        )
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `assessments/${a.id}`);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteAllReports = async () => {
    if (assessments.length === 0) return;
    setBusy(true);
    try {
      for (const a of assessments) {
        await deleteDoc(doc(db, 'assessments', a.id));
      }
      resetFormToCreate();
      setConfirmDeleteAllReports(false);
      flash(
        biText(
          lang,
          'Deleted all published student reports.',
          'Đã xóa toàn bộ báo cáo đã xuất bản.'
        )
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'assessments');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveProfileBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherDoc) return;
    setBusy(true);
    try {
      const updates = {
        teacherUid: currentUser.uid,
        phone: editPhone.trim(),
        bioEn: editBioEn.trim(),
        bioVi: editBioVi.trim(),
        bankName: editBankName.trim(),
        bankAccountNumber: editBankNum.trim(),
        bankAccountHolder: editBankHolder.trim(),
      };
      await updateDoc(doc(db, 'teachers', teacherDoc.id), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      flash(
        biText(
          lang,
          'Updated profile & bank details.',
          'Đã cập nhật hồ sơ & tài khoản ngân hàng.'
        )
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `teachers/${teacherDoc.id}`);
    } finally {
      setBusy(false);
    }
  };

  const handleCompleteSession = async (s: ClassSchedule) => {
    try {
      const nextStatus = s.status === 'completed' ? 'scheduled' : 'completed';
      await updateDoc(doc(db, 'schedules', s.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `schedules/${s.id}`);
    }
  };

  const activeStudent = students.find((s) => s.id === selectedStudentId) || null;
  const activeStudentAssessments = activeStudent
    ? sortAssessmentsChronological(
        assessments.filter((a) => a.studentId === activeStudent.id),
        'desc'
      )
    : [];
  const activeStudentQuickNotes = activeStudent
    ? quickNotes.filter((n) => n.studentId === activeStudent.id)
    : [];
  const includedQuickNotesCount = activeStudentQuickNotes.filter((n) => n.includeInReport !== false).length;

  useEffect(() => {
    if (activeStudentAssessments.length < 2) {
      setCompareMode(false);
      setCompareFromId('');
      setCompareToId('');
      return;
    }
    const newest = activeStudentAssessments[0];
    const earlier = activeStudentAssessments[1];
    const hasTo = activeStudentAssessments.some((a) => a.id === compareToId);
    const hasFrom = activeStudentAssessments.some((a) => a.id === compareFromId);
    if (!hasTo) setCompareToId(newest.id);
    if (!hasFrom || compareFromId === (hasTo ? compareToId : newest.id)) {
      const fallback = activeStudentAssessments.find((a) => a.id !== (hasTo ? compareToId : newest.id)) || earlier;
      setCompareFromId(fallback.id);
    }
  }, [selectedStudentId, assessments]);

  const compareFromReport =
    activeStudentAssessments.find((a) => a.id === compareFromId) || activeStudentAssessments[1] || null;
  const compareToReport =
    activeStudentAssessments.find((a) => a.id === compareToId) || activeStudentAssessments[0] || null;
  const isComparingValid =
    compareMode &&
    activeStudentAssessments.length >= 2 &&
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

  const quickNoteCategories: Array<{ id: QuickNoteCategory; label: string }> = [
    { id: 'general', label: biText(lang, 'General', 'Chung') },
    { id: 'speaking', label: biText(lang, 'Speaking', 'Nói') },
    { id: 'reading', label: biText(lang, 'Reading', 'Đọc') },
    { id: 'writing', label: biText(lang, 'Writing', 'Viết') },
    { id: 'vocabulary', label: biText(lang, 'Vocabulary', 'Từ vựng') },
    { id: 'comprehension', label: biText(lang, 'Comprehension/Listening', 'Nghe hiểu') },
    { id: 'social', label: biText(lang, 'Social', 'Xã hội') },
    { id: 'emotional', label: biText(lang, 'Emotional', 'Cảm xúc') },
    { id: 'mental', label: biText(lang, 'Mental', 'Tinh thần') },
  ];

  const loadAssessmentIntoView = (a: StudentAssessment, editMode = false) => {
    setSelectedStudentId(a.studentId);
    setSelectedClassId(a.classId);
    setTermLabel(a.termLabel);
    setCefrLevel(a.cefrLevel);
    setCefrMod(a.cefrModifier);
    setSpeakingScore(a.speakingScore);
    setReadingScore(a.readingScore);
    setWritingScore(a.writingScore);
    setVocabularyScore(a.vocabularyScore ?? 0);
    setComprehensionScore(a.comprehensionScore ?? 0);
    setSocialScore(a.socialScore);
    setEmotionalScore(a.emotionalScore);
    setMentalScore(a.mentalScore);
    setCommentEn(a.teacherCommentEn || '');
    setCommentVi(a.teacherCommentVi || '');
    setAiInsightEn(a.aiInsightEn || '');
    setAiInsightVi(a.aiInsightVi || '');
    if (Array.isArray(a.activitiesCompleted) && a.activitiesCompleted.length > 0) {
      setActivities(a.activitiesCompleted);
    }
    setEditingAssessmentId(editMode ? a.id : null);
  };

  const latestActiveStudentReport = activeStudentAssessments[0] || null;
  const displayCommentEn = commentEn.trim() || latestActiveStudentReport?.teacherCommentEn || '';
  const displayCommentVi = commentVi.trim() || latestActiveStudentReport?.teacherCommentVi || '';
  const displayAiInsightEn = aiInsightEn.trim() || latestActiveStudentReport?.aiInsightEn || '';
  const displayAiInsightVi = aiInsightVi.trim() || latestActiveStudentReport?.aiInsightVi || '';

  const handlePrintTeacherPdf = async (specificReport?: StudentAssessment) => {
    const { buildPrintableReportFromAssessment, exportStudentReportPdf } = await import(
      '../services/pdfReportGenerator'
    );
    if (specificReport) {
      const stu = students.find((s) => s.id === specificReport.studentId) || activeStudent;
      loadAssessmentIntoView(specificReport, false);
      await exportStudentReportPdf(
        buildPrintableReportFromAssessment(specificReport, stu, lang),
        { alsoTriggerBrowserPrint: true }
      );
      flash(
        biText(
          lang,
          `Exported PDF report for ${specificReport.studentName}.`,
          `Đã xuất báo cáo PDF cho ${specificReport.studentName}!`
        )
      );
      return;
    }

    const targetReport =
      isComparingValid && compareToReport
        ? compareToReport
        : !editingAssessmentId && latestActiveStudentReport
          ? latestActiveStudentReport
          : null;

    if (targetReport) {
      await exportStudentReportPdf(
        buildPrintableReportFromAssessment(targetReport, activeStudent, lang),
        { alsoTriggerBrowserPrint: true }
      );
    } else {
      const activeClassObj = classes.find((c) => c.id === selectedClassId) || classes[0];
      await exportStudentReportPdf(
        {
          studentName: activeStudent?.fullName || currentUser.displayName,
          studentAge: activeStudent?.age,
          studentGender: activeStudent?.gender,
          studentPhotoUrl: activeStudent?.photoUrl,
          parentName: activeStudent?.parentName,
          parentEmail: activeStudent?.parentEmail,
          className: activeClassObj?.name || 'Be Whole Class',
          termLabel: termLabel || 'Current Term',
          teacherName: teacherDoc?.fullName || currentUser.displayName,
          cefrLevel,
          cefrModifier: cefrMod,
          cefrDisplay: formatCefrLabel(cefrLevel, cefrMod),
          speakingScore,
          readingScore,
          writingScore,
          vocabularyScore,
          comprehensionScore,
          socialScore,
          emotionalScore,
          mentalScore,
          teacherCommentEn: displayCommentEn,
          teacherCommentVi: displayCommentVi,
          aiInsightEn: displayAiInsightEn,
          aiInsightVi: displayAiInsightVi,
          activitiesCompleted: activities,
          lang,
        },
        { alsoTriggerBrowserPrint: true }
      );
    }

    flash(
      biText(
        lang,
        `Exported PDF report for ${activeStudent?.fullName || currentUser.displayName}.`,
        `Đã xuất báo cáo PDF cho ${activeStudent?.fullName || currentUser.displayName}!`
      )
    );
  };

  const cohortPoints: QuadrantCohortPoint[] = assessments.map((a) => ({
    id: a.id,
    name: a.studentName,
    langAvg: Math.round(
      (a.speakingScore + a.readingScore + a.writingScore + (a.vocabularyScore ?? 0) + (a.comprehensionScore ?? 0)) / 5
    ),
    wholeAvg: Math.round((a.socialScore + a.emotionalScore + a.mentalScore) / 3),
    cefr: formatCefrLabel(a.cefrLevel, a.cefrModifier),
  }));

  const tabs: Array<{ id: TeacherTab; label: string; icon: React.ReactNode }> = [
    { id: 'schedule', label: biText(lang, 'Schedule & Event Calendar', 'Lịch Dạy & Sự kiện'), icon: <Calendar className="w-4 h-4" /> },
    { id: 'assess', label: t.assessments, icon: <Award className="w-4 h-4" /> },
    { id: 'classes', label: biText(lang, 'Classes & Students', 'Lớp & Học viên'), icon: <User className="w-4 h-4" /> },
    { id: 'profile', label: t.myProfilePay, icon: <Wallet className="w-4 h-4" /> },
    { id: 'curriculum', label: t.geminiNotes, icon: <BookOpen className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#172154]/10 no-print">
        <div className="flex items-center gap-2.5 text-xs font-medium text-[#172154]/75">
          <ProfileAvatar
            src={teacherDoc?.photoUrl || currentUser.photoUrl}
            name={teacherDoc?.fullName || currentUser.displayName}
            size="xs"
          />
          <span className="font-semibold text-[#2563EB]">
            {tabs.find((item) => item.id === activeTab)?.label}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {teacherDoc?.cefrCertification || 'Cambridge CEFR Faculty'} · {classes.length} classes · {students.length} students
          </span>
        </div>
        <button
          type="button"
          onClick={() => void handlePrintTeacherPdf()}
          className="px-3.5 py-2 rounded-lg bg-[#2563EB] text-white text-xs font-semibold hover:bg-[#1D4ED8] transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
        >
          <Printer className="w-3.5 h-3.5" />
          {biText(lang, 'Print / Export PDF Report', 'In / Xuất PDF Phân tích')}
        </button>
      </div>

      {banner && (
        <div className="p-3.5 rounded-xl bg-[#56BEB8]/12 border border-[#56BEB8]/40 text-sm font-medium text-[#172154] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#0F766E]" />
          <span>{banner}</span>
        </div>
      )}

      <ErrorBoundary
        key={activeTab}
        variant="section"
        sectionLabel={biText(lang, 'Teacher Workspace', 'Không gian Giáo viên')}
      >
        <Suspense
          fallback={
            <PortalLoader
              label={biText(lang, 'Loading teacher module…', 'Đang tải phân hệ giáo viên…')}
            />
          }
        >
      {/* TAB 1: ASSESSMENT & CEFR RATING STUDIO */}
      {activeTab === 'assess' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 no-print">
            <form onSubmit={handleSaveAssessment} className="lg:col-span-8 bg-white border border-[#2D3E99]/12 rounded-xl p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-xl font-bold text-[#2D3E99]">
                  {editingAssessmentId
                    ? biText(lang, 'Editing Published Student Report', 'Đang chỉnh sửa Báo cáo Học viên')
                    : biText(lang, 'Student Assessment Studio · Cambridge CEFR -/+', 'Đánh giá Học viên · Cambridge CEFR -/+')}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {editingAssessmentId && (
                  <button
                    type="button"
                    onClick={resetFormToCreate}
                    className="px-2.5 py-1 rounded-lg border border-[#2D3E99]/20 text-xs font-semibold text-[#172154] hover:bg-slate-50 flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    {biText(lang, 'Cancel Edit', 'Hủy sửa')}
                  </button>
                )}
                <span className="font-mono-num text-sm font-bold text-[#E61E64]">
                  {formatCefrLabel(cefrLevel, cefrMod)}
                </span>
              </div>
            </div>

            {students.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#FDF9EE] border border-[#2D3E99]/15 text-sm text-[#172154]/80">
                {biText(
                  lang,
                  'No students are assigned to your teacher email yet. An Admin can assign students to your class in the Admin Console.',
                  'Chưa có học viên nào được gán cho email giáo viên của bạn. Admin có thể xếp học viên vào lớp của bạn trong bảng Admin.'
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Student</label>
                    <select
                      value={selectedStudentId}
                      disabled={Boolean(editingAssessmentId)}
                      onChange={(e) => handleStudentSelect(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm bg-white disabled:opacity-60"
                    >
                      {students.map((st) => (
                        <option key={st.id} value={st.id}>{st.fullName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Class</label>
                    <select
                      value={selectedClassId}
                      onChange={(e) => setSelectedClassId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm bg-white"
                    >
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Term / Week</label>
                    <input
                      type="text"
                      value={termLabel}
                      onChange={(e) => setTermLabel(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm"
                    />
                  </div>
                </div>

                {/* Cambridge CEFR Level + -/+ Modifier */}
                <div className="p-4 rounded-xl bg-[#FDF9EE] border border-[#2D3E99]/12 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#2D3E99] mb-1">
                      Cambridge English CEFR Level
                    </label>
                    <select
                      value={cefrLevel}
                      onChange={(e) => setCefrLevel(e.target.value as CefrLevel)}
                      className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm bg-white font-semibold"
                    >
                      {CEFR_LEVELS.map((l) => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#E61E64] mb-1">
                      Level Modifier (- / Standard / +)
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['-', 'standard', '+'] as CefrModifier[]).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setCefrMod(m)}
                          className={`py-2 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                            cefrMod === m
                              ? 'bg-[#E61E64] text-white border-[#E61E64]'
                              : 'bg-white text-[#172154] border-[#2D3E99]/20'
                          }`}
                        >
                          {m === 'standard' ? 'Standard' : m}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Language & Holistic Scores */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: t.speaking, val: speakingScore, set: setSpeakingScore, color: 'accent-[#2D3E99]' },
                    { label: t.reading, val: readingScore, set: setReadingScore, color: 'accent-[#2D3E99]' },
                    { label: t.writing, val: writingScore, set: setWritingScore, color: 'accent-[#2D3E99]' },
                    { label: t.vocabulary, val: vocabularyScore, set: setVocabularyScore, color: 'accent-[#2596BE]' },
                    { label: t.comprehension, val: comprehensionScore, set: setComprehensionScore, color: 'accent-[#0EA5E9]' },
                    { label: t.social, val: socialScore, set: setSocialScore, color: 'accent-[#E61E64]' },
                    { label: t.emotional, val: emotionalScore, set: setEmotionalScore, color: 'accent-[#E61E64]' },
                    { label: t.mental, val: mentalScore, set: setMentalScore, color: 'accent-[#56BEB8]' },
                  ].map((item) => (
                    <div key={item.label} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span>{item.label}</span>
                        <span className="font-mono-num text-[#2D3E99]">{item.val}/100</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={item.val}
                        onChange={(e) => item.set(Number(e.target.value))}
                        className={`w-full cursor-pointer ${item.color}`}
                      />
                    </div>
                  ))}
                </div>

                {/* Bilingual Teacher Comments + AI */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold">Teacher Notes (English)</label>
                    <button
                      type="button"
                      onClick={handleTranslateComment}
                      disabled={busy || !commentEn.trim()}
                      className="text-xs font-semibold text-[#2D3E99] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Languages className="w-3.5 h-3.5" />
                      Translate EN → VI
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={commentEn}
                    onChange={(e) => setCommentEn(e.target.value)}
                    placeholder="Observe speaking confidence, reading fluency, kindness in group play..."
                    className="w-full p-3 rounded-lg border border-[#2D3E99]/20 text-sm"
                  />
                  <label className="block text-xs font-semibold">Nhận xét của Giáo viên (Tiếng Việt)</label>
                  <textarea
                    rows={2}
                    value={commentVi}
                    onChange={(e) => setCommentVi(e.target.value)}
                    placeholder="Nhận xét bằng tiếng Việt cho phụ huynh..."
                    className="w-full p-3 rounded-lg border border-[#2D3E99]/20 text-sm"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleAiInsight}
                    disabled={busy}
                    className="px-4 py-2.5 rounded-xl bg-[#FFD41D] text-[#172154] text-xs font-bold hover:bg-[#f0c50c] flex items-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    {includedQuickNotesCount > 0
                      ? biText(
                          lang,
                          `AI Generate Report (${includedQuickNotesCount} Quick Notes)`,
                          `AI Tạo Báo cáo (${includedQuickNotesCount} Ghi chú)`
                        )
                      : biText(lang, 'AI Assessment Understanding', 'AI Phân tích Hiểu học viên')}
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="px-5 py-2.5 rounded-xl bg-[#2D3E99] text-white text-sm font-semibold hover:bg-[#22317d] cursor-pointer"
                  >
                    {editingAssessmentId
                      ? biText(lang, 'Update Student Report', 'Cập nhật Báo cáo')
                      : biText(lang, 'Publish Student Report', 'Lưu Báo cáo Đánh giá')}
                  </button>
                </div>

                {(aiInsightEn || aiInsightVi) && (
                  <div className="p-5 rounded-2xl bg-[#FDF9EE] border-2 border-[#56BEB8] space-y-2.5">
                    <div className="font-display text-base sm:text-lg font-extrabold text-[#2D3E99]">
                      AI Holistic Insight (EN & VI)
                    </div>
                    {aiInsightEn && (
                      <p className="text-base leading-relaxed font-medium text-[#172154]">{aiInsightEn}</p>
                    )}
                    {aiInsightVi && (
                      <p className="text-base leading-relaxed font-medium text-[#172154]/85">{aiInsightVi}</p>
                    )}
                  </div>
                )}
              </>
            )}
          </form>

            {/* Published Reports Selector with Edit & Delete */}
            <div className="lg:col-span-4 bg-white border border-[#2D3E99]/12 rounded-xl p-6 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-display text-base font-bold text-[#2D3E99]">
                  {biText(lang, 'Published Reports', 'Báo cáo đã xuất bản')} ({assessments.length})
                </h4>
                {assessments.length > 0 && !confirmDeleteAllReports && (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteAllReports(true)}
                    disabled={busy}
                    className="px-2.5 py-1 rounded-md bg-[#E61E64]/10 text-[#E61E64] text-xs font-semibold hover:bg-[#E61E64] hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    {biText(lang, 'Delete All', 'Xóa tất cả')}
                  </button>
                )}
              </div>
              {confirmDeleteAllReports && assessments.length > 0 && (
                <div className="p-2.5 rounded-lg bg-[#E61E64]/10 border border-[#E61E64]/30 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-[#b0134a]">
                    {biText(lang, `Delete all ${assessments.length} reports?`, `Xóa tất cả ${assessments.length} báo cáo?`)}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteAllReports(false)}
                      className="px-2 py-1 rounded bg-white border border-[#2D3E99]/20 font-semibold cursor-pointer"
                    >
                      {biText(lang, 'Cancel', 'Hủy')}
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteAllReports}
                      disabled={busy}
                      className="px-2.5 py-1 rounded bg-[#E61E64] text-white font-semibold cursor-pointer"
                    >
                      {biText(lang, 'Confirm', 'Xác nhận')}
                    </button>
                  </div>
                </div>
              )}
              <p className="text-xs text-[#172154]/65">
                {biText(
                  lang,
                  'Inspect visual charts, edit scores/comments, or delete published reports.',
                  'Xem biểu đồ, chỉnh sửa điểm/nhận xét, hoặc xóa báo cáo đã xuất bản.'
                )}
              </p>
              <div className="divide-y divide-[#2D3E99]/10 text-sm max-h-[460px] overflow-y-auto">
                {assessments.length === 0 ? (
                  <p className="text-xs text-[#172154]/60 py-3">
                    {biText(lang, 'No reports published yet.', 'Chưa có báo cáo nào được lưu.')}
                  </p>
                ) : (
                  assessments.map((a) => {
                    const stu = students.find((s) => s.id === a.studentId);
                    return (
                    <div
                      key={a.id}
                      className={`py-2.5 px-2 rounded-lg transition-colors space-y-1.5 ${
                        editingAssessmentId === a.id ? 'bg-[#FFD41D]/15' : 'hover:bg-[#FDF9EE]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => loadAssessmentIntoView(a, false)}
                        className="w-full text-left cursor-pointer"
                      >
                        <div className="font-semibold flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2 min-w-0">
                            <ProfileAvatar
                              src={stu?.photoUrl}
                              fallbackSrc={stu ? (stu.gender === 'boy' ? '/assets/lila_boy.png' : '/assets/lila_girl.png') : undefined}
                              name={a.studentName}
                              size="xs"
                            />
                            <span className="truncate">{a.studentName}</span>
                          </span>
                          <span className="font-mono-num text-[#E61E64] shrink-0">
                            {formatCefrLabel(a.cefrLevel, a.cefrModifier)}
                          </span>
                        </div>
                        <div className="text-xs text-[#172154]/70 font-mono-num">
                          {a.termLabel} · Eng {a.speakingScore}/{a.readingScore}/{a.writingScore}/{a.vocabularyScore ?? 0}/{a.comprehensionScore ?? 0} · SEM {a.socialScore}/{a.emotionalScore}/{a.mentalScore}
                        </div>
                      </button>
                      <div className="flex items-center justify-end gap-1.5 pt-0.5">
                        <button
                          type="button"
                          onClick={() => void handlePrintTeacherPdf(a)}
                          className="px-2.5 py-1 rounded-md bg-[#56BEB8]/20 text-[#172154] text-xs font-semibold hover:bg-[#56BEB8] transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Printer className="w-3 h-3" />
                          {biText(lang, 'Print PDF', 'In PDF')}
                        </button>
                        <button
                          type="button"
                          onClick={() => loadAssessmentIntoView(a, true)}
                          className="px-2.5 py-1 rounded-md bg-[#2D3E99]/10 text-[#2D3E99] text-xs font-semibold hover:bg-[#2D3E99] hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" />
                          {biText(lang, 'Edit', 'Sửa')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAssessment(a)}
                          disabled={busy}
                          className="px-2.5 py-1 rounded-md bg-[#E61E64]/10 text-[#E61E64] text-xs font-semibold hover:bg-[#E61E64] hover:text-white transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="w-3 h-3" />
                          {biText(lang, 'Delete', 'Xóa')}
                        </button>
                      </div>
                    </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* QUICK NOTES: DAILY OBSERVATIONS PER STUDENT */}
          {activeStudent && (
            <div className="bg-white border border-[#2D3E99]/12 rounded-2xl p-6 space-y-4 no-print">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2D3E99]/10 pb-3">
                <div className="flex items-center gap-3">
                  <ProfileAvatar
                    src={activeStudent.photoUrl}
                    fallbackSrc={activeStudent.gender === 'boy' ? '/assets/lila_boy.png' : '/assets/lila_girl.png'}
                    name={activeStudent.fullName}
                    size="md"
                  />
                  <div>
                    <h4 className="font-display text-lg font-bold text-[#2D3E99]">
                      {biText(
                        lang,
                        `Quick Notes · Daily Observations for ${activeStudent.fullName}`,
                        `Ghi chú nhanh · Quan sát hằng ngày cho ${activeStudent.fullName}`
                      )}
                    </h4>
                    <p className="text-xs text-[#172154]/70">
                      {biText(
                        lang,
                        `${includedQuickNotesCount} active observation${includedQuickNotesCount === 1 ? '' : 's'} will automatically feed into Gemini student report generation.`,
                        `${includedQuickNotesCount} ghi chú đang bật sẽ tự động được đưa vào Gemini để tạo báo cáo học viên.`
                      )}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAiInsight}
                  disabled={busy}
                  className="px-4 py-2 rounded-xl bg-[#FFD41D] text-[#172154] text-xs font-bold hover:bg-[#f0c50c] transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  {biText(
                    lang,
                    'Generate Gemini Report from Quick Notes',
                    'Tạo Báo cáo Gemini từ Ghi chú'
                  )}
                </button>
              </div>

              <form onSubmit={(e) => handleSaveQuickNote(e)} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold mb-1">
                    {biText(lang, 'Date', 'Ngày')}
                  </label>
                  <input
                    type="date"
                    value={qnDate}
                    onChange={(e) => setQnDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-xs bg-white font-mono-num"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold mb-1">
                    {biText(lang, 'Focus Area', 'Lĩnh vực')}
                  </label>
                  <select
                    value={qnCategory}
                    onChange={(e) => setQnCategory(e.target.value as QuickNoteCategory)}
                    className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-xs bg-white font-semibold"
                  >
                    {quickNoteCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-6">
                  <label className="block text-xs font-semibold mb-1">
                    {biText(lang, 'Daily Classroom Observation', 'Quan sát trong lớp hôm nay')}
                  </label>
                  <input
                    type="text"
                    required
                    value={qnText}
                    onChange={(e) => setQnText(e.target.value)}
                    placeholder={biText(
                      lang,
                      `e.g. Voluntarily retold "The Lion and the Mouse" using new phonics words and helped a classmate...`,
                      `VD: Tự tin kể lại câu chuyện tuần và chủ động giúp bạn trong hoạt động nhóm...`
                    )}
                    className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm bg-white"
                  />
                </div>
                <div className="md:col-span-2">
                  <button
                    type="submit"
                    disabled={busy || !qnText.trim()}
                    className="w-full px-4 py-2 rounded-lg bg-[#E61E64] text-white text-xs font-bold hover:bg-[#c91654] transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    {biText(lang, 'Add Note', 'Thêm ghi chú')}
                  </button>
                </div>
              </form>

              {activeStudentQuickNotes.length === 0 ? (
                <div className="p-4 rounded-xl bg-[#FDF9EE] border border-[#2D3E99]/10 text-xs text-[#172154]/70">
                  {biText(
                    lang,
                    `No daily observations logged for ${activeStudent.fullName} yet. Add quick classroom moments above so Gemini can weave them into your next assessment report.`,
                    `Chưa có ghi chú hằng ngày nào cho ${activeStudent.fullName}. Thêm các quan sát nhanh ở trên để Gemini tổng hợp vào báo cáo tiếp theo.`
                  )}
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {activeStudentQuickNotes.map((note) => {
                    const isEditing = editingQuickNoteId === note.id;
                    const catLabel = quickNoteCategories.find((c) => c.id === note.category)?.label || note.category;
                    const isIncluded = note.includeInReport !== false;
                    return (
                      <div
                        key={note.id}
                        className={`p-3 rounded-xl border transition-colors ${
                          isIncluded
                            ? 'bg-[#FDF9EE] border-[#2D3E99]/15'
                            : 'bg-slate-50 border-slate-200 opacity-70'
                        }`}
                      >
                        {isEditing ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="date"
                              value={editQnDate}
                              onChange={(e) => setEditQnDate(e.target.value)}
                              className="px-2.5 py-1.5 rounded-lg border border-[#2D3E99]/20 text-xs bg-white font-mono-num"
                            />
                            <select
                              value={editQnCategory}
                              onChange={(e) => setEditQnCategory(e.target.value as QuickNoteCategory)}
                              className="px-2.5 py-1.5 rounded-lg border border-[#2D3E99]/20 text-xs bg-white font-semibold"
                            >
                              {quickNoteCategories.map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                  {cat.label}
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              value={editQnText}
                              onChange={(e) => setEditQnText(e.target.value)}
                              className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg border border-[#2D3E99]/20 text-xs bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveEditQuickNote(note)}
                              disabled={busy || !editQnText.trim()}
                              className="px-3 py-1.5 rounded-lg bg-[#2D3E99] text-white text-xs font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <Check className="w-3.5 h-3.5" />
                              {biText(lang, 'Save', 'Lưu')}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingQuickNoteId(null)}
                              className="px-2.5 py-1.5 rounded-lg border border-[#2D3E99]/20 bg-white text-xs font-semibold cursor-pointer"
                            >
                              {biText(lang, 'Cancel', 'Hủy')}
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1 flex-1 min-w-[220px]">
                              <div className="flex flex-wrap items-center gap-2 text-xs">
                                <span className="font-mono-num font-bold text-[#2D3E99]">
                                  {note.observationDate}
                                </span>
                                <span className="px-2 py-0.5 rounded bg-[#2D3E99]/10 text-[#2D3E99] font-semibold">
                                  {catLabel}
                                </span>
                                {note.className && (
                                  <span className="text-[#172154]/60">{note.className}</span>
                                )}
                              </div>
                              <p className="text-sm text-[#172154] leading-snug">{note.noteText}</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleToggleIncludeQuickNote(note)}
                                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                                  isIncluded
                                    ? 'bg-[#56BEB8]/20 text-[#172154] hover:bg-[#56BEB8]/35'
                                    : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                                }`}
                              >
                                {isIncluded
                                  ? biText(lang, 'In Report', 'Đưa vào báo cáo')
                                  : biText(lang, 'Excluded', 'Đã loại trừ')}
                              </button>
                              <button
                                type="button"
                                onClick={() => startEditQuickNote(note)}
                                className="px-2 py-1 rounded-md bg-[#2D3E99]/10 text-[#2D3E99] text-xs font-semibold hover:bg-[#2D3E99] hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <Pencil className="w-3 h-3" />
                                {biText(lang, 'Edit', 'Sửa')}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteQuickNote(note)}
                                disabled={busy}
                                className="px-2 py-1 rounded-md bg-[#E61E64]/10 text-[#E61E64] text-xs font-semibold hover:bg-[#E61E64] hover:text-white transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                <Trash2 className="w-3 h-3" />
                                {biText(lang, 'Delete', 'Xóa')}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Printable 3-Chart Visual Data Analysis Panel */}
          <div className="bg-white border border-[#2D3E99]/12 rounded-2xl p-6 space-y-5 print-only-clean">
            <div className="flex flex-wrap items-center justify-between gap-5 border-b border-[#2D3E99]/12 pb-5">
              <div className="flex items-center gap-5 min-w-0">
                <ProfileAvatar
                  src={activeStudent?.photoUrl}
                  fallbackSrc={activeStudent ? (activeStudent.gender === 'boy' ? '/assets/lila_boy.png' : '/assets/lila_girl.png') : '/assets/lila_girl.png'}
                  name={activeStudent?.fullName || currentUser.displayName}
                  size="2xl"
                  className="report-student-avatar shadow-md ring-4 ring-[#2D3E99]/10"
                />
                <div className="space-y-1 min-w-0">
                  <div className="text-xs sm:text-sm font-bold text-[#56BEB8]">
                    LiLab Creative Talent Academy · {teacherDoc?.fullName || currentUser.displayName}
                  </div>
                  <div className="font-display text-3xl sm:text-4xl font-extrabold text-[#2D3E99] tracking-tight truncate report-student-name">
                    {activeStudent?.fullName || currentUser.displayName}
                  </div>
                  <h3 className="font-display text-base sm:text-lg font-bold text-[#172154]/80">
                    {biText(
                      lang,
                      'Student Visual Data Analysis (Radial Map · Quadrant Map · Bar Graph)',
                      'Phân tích Trực quan Học viên (Mạng nhện · Ma trận · Biểu đồ Cột)'
                    )}
                  </h3>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 no-print">
                <button
                  type="button"
                  onClick={() => setCompareMode((prev) => !prev)}
                  disabled={activeStudentAssessments.length < 2}
                  title={
                    activeStudentAssessments.length < 2
                      ? biText(
                          lang,
                          'At least 2 saved report dates are required for this student.',
                          'Cần ít nhất 2 báo cáo khác ngày của học viên này để so sánh.'
                        )
                      : undefined
                  }
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
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
                  onClick={() => void handlePrintTeacherPdf()}
                  className="px-4 py-2 rounded-lg bg-[#2D3E99] text-white text-xs font-semibold hover:bg-[#22317d] flex items-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  {biText(lang, 'Print / Export PDF Report', 'In / Xuất PDF Báo cáo')}
                </button>
              </div>
            </div>

            {activeStudentAssessments.length < 2 && activeStudent && (
              <div className="text-xs text-[#172154]/65 bg-[#FDF9EE]/80 border border-[#2D3E99]/10 rounded-lg px-3.5 py-2 no-print">
                {biText(
                  lang,
                  `Publish at least 2 report dates for ${activeStudent.fullName} to unlock side-by-side radial & quadrant progression overlays (${activeStudentAssessments.length}/2).`,
                  `Hãy lưu ít nhất 2 báo cáo cho ${activeStudent.fullName} để bật lớp phủ so sánh tiến bộ theo ngày trên bản đồ (${activeStudentAssessments.length}/2).`
                )}
              </div>
            )}

            {compareMode && activeStudentAssessments.length >= 2 && (
              <div className="bg-[#FDF9EE] border border-[#D97706]/35 rounded-xl p-4 space-y-3 no-print">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-bold text-[#B45309] flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4" />
                    {biText(
                      lang,
                      'Report Date Progression Overlay (Earlier → Target)',
                      'So sánh Tiến độ Giữa 2 Ngày Báo cáo (Mốc trước → Mốc sau)'
                    )}
                  </div>
                  {compareFromReport && compareToReport && compareFromReport.id === compareToReport.id && (
                    <span className="text-xs font-semibold text-[#E61E64]">
                      {biText(
                        lang,
                        'Select two different report dates to visualize growth.',
                        'Vui lòng chọn 2 ngày báo cáo khác nhau để hiển thị độ tiến bộ.'
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
                      {activeStudentAssessments.map((a) => (
                        <option key={`from-${a.id}`} value={a.id}>
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
                      {activeStudentAssessments.map((a) => (
                        <option key={`to-${a.id}`} value={a.id}>
                          {formatAssessmentDateOption(a, lang)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            <StudentVisualAnalytics
              lang={lang}
              studentName={activeStudent?.fullName || currentUser.displayName}
              cefrDisplay={
                isComparingValid && compareToReport
                  ? formatCefrLabel(compareToReport.cefrLevel, compareToReport.cefrModifier)
                  : formatCefrLabel(cefrLevel, cefrMod)
              }
              termLabel={
                isComparingValid && compareFromReport && compareToReport
                  ? `${formatAssessmentDateOption(compareFromReport, lang)} → ${formatAssessmentDateOption(compareToReport, lang)}`
                  : termLabel
              }
              scores={
                isComparingValid && compareToReport
                  ? assessmentToVisualScores(compareToReport)
                  : students.length === 0 && assessments.length === 0 && !editingAssessmentId
                    ? {
                        speaking: 0,
                        reading: 0,
                        writing: 0,
                        vocabulary: 0,
                        comprehension: 0,
                        social: 0,
                        emotional: 0,
                        mental: 0,
                      }
                    : {
                        speaking: speakingScore,
                        reading: readingScore,
                        writing: writingScore,
                        vocabulary: vocabularyScore,
                        comprehension: comprehensionScore,
                        social: socialScore,
                        emotional: emotionalScore,
                        mental: mentalScore,
                      }
              }
              comparisonOverlay={visualComparisonOverlay}
              cohortPoints={cohortPoints}
              isBaseline={!isComparingValid && students.length === 0 && assessments.length === 0 && !editingAssessmentId}
            />

            {(displayCommentEn || displayCommentVi || displayAiInsightEn || displayAiInsightVi) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-[#2D3E99]/12">
                {(displayCommentEn || displayCommentVi) && (
                  <div className="p-5 sm:p-6 rounded-2xl bg-[#FDF9EE] border-2 border-[#2D3E99]/15 space-y-2.5 report-narrative-card">
                    <div className="font-display text-lg sm:text-xl font-extrabold text-[#2D3E99] report-narrative-title">
                      Teacher Narrative
                    </div>
                    {displayCommentEn && (
                      <p className="text-base sm:text-lg leading-relaxed font-medium text-[#172154] report-narrative-body">
                        {displayCommentEn}
                      </p>
                    )}
                    {displayCommentVi && (
                      <p className="text-base sm:text-lg leading-relaxed font-medium text-[#172154]/85 report-narrative-body">
                        {displayCommentVi}
                      </p>
                    )}
                  </div>
                )}
                {(displayAiInsightEn || displayAiInsightVi) && (
                  <div className="p-5 sm:p-6 rounded-2xl bg-[#56BEB8]/12 border-2 border-[#56BEB8]/45 space-y-2.5 report-narrative-card">
                    <div className="font-display text-lg sm:text-xl font-extrabold text-[#172154] report-narrative-title">
                      AI Holistic Insight
                    </div>
                    {lang === 'bi' ? (
                      <>
                        {displayAiInsightEn && (
                          <p className="text-base sm:text-lg leading-relaxed font-medium text-[#172154] report-narrative-body">
                            {displayAiInsightEn}
                          </p>
                        )}
                        {displayAiInsightVi && (
                          <p className="text-base sm:text-lg leading-relaxed font-medium text-[#172154]/85 report-narrative-body">
                            {displayAiInsightVi}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-base sm:text-lg leading-relaxed font-medium text-[#172154] report-narrative-body">
                        {lang === 'vi' ? displayAiInsightVi || displayAiInsightEn : displayAiInsightEn || displayAiInsightVi}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <HistoricalProgress
            lang={lang}
            currentUser={currentUser}
            scopeRole="teacher"
            studentId={activeStudent?.id}
            studentName={activeStudent?.fullName}
            studentPhotoUrl={activeStudent?.photoUrl}
            studentGender={activeStudent?.gender}
            students={students}
          />
        </div>
      )}

      {/* TAB 2: MY CLASSES & STUDENTS */}
      {activeTab === 'classes' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-[#2D3E99]/12 rounded-xl p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-[#2D3E99]">
              {lang === 'vi' ? 'Lớp học phụ trách' : 'My Assigned Classes'} ({classes.length})
            </h3>
            <div className="divide-y divide-[#2D3E99]/10">
              {classes.map((c) => (
                <div key={c.id} className="py-3 space-y-1">
                  <div className="font-semibold text-[#172154]">{c.name}</div>
                  <div className="text-xs text-[#172154]/70">
                    {c.programTitle} · {c.room} · {c.scheduleText} ·{' '}
                    <span className="font-mono-num text-[#E61E64]">
                      {formatCefrLabel(c.cefrLevel, c.cefrModifier)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-[#2D3E99]/12 rounded-xl p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-[#E61E64]">
              {biText(lang, 'My Students, CEFR & Quick Notes', 'Danh sách Học viên, CEFR & Ghi chú nhanh')} ({students.length})
            </h3>
            <div className="divide-y divide-[#2D3E99]/10">
              {students.map((st) => {
                const stNotes = quickNotes.filter((n) => n.studentId === st.id);
                const isOpen = rosterQuickNoteStudentId === st.id;
                return (
                  <div key={st.id} className="py-3 space-y-2.5 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <ProfileAvatar
                          src={st.photoUrl}
                          fallbackSrc={st.gender === 'boy' ? '/assets/lila_boy.png' : '/assets/lila_girl.png'}
                          name={st.fullName}
                          size="md"
                        />
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{st.fullName} ({st.age}y)</div>
                          <div className="text-xs text-[#172154]/65 truncate">Parent: {st.parentName} · {st.parentEmail}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono-num font-bold text-[#2D3E99]">
                          {formatCefrLabel(st.cefrLevel, st.cefrModifier)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setRosterQuickNoteStudentId(isOpen ? null : st.id)}
                          className="px-2.5 py-1 rounded-lg bg-[#FDF9EE] border border-[#2D3E99]/20 text-xs font-semibold text-[#2D3E99] hover:bg-[#2D3E99] hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <StickyNote className="w-3 h-3" />
                          {biText(lang, `Quick Notes (${stNotes.length})`, `Ghi chú (${stNotes.length})`)}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleStudentSelect(st.id);
                            setActiveTab('assess');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[#56BEB8]/20 text-[#172154] text-xs font-semibold hover:bg-[#56BEB8] transition-colors cursor-pointer"
                        >
                          {biText(lang, 'Open Report', 'Tạo báo cáo')}
                        </button>
                      </div>
                    </div>
                    {isOpen && (
                      <div className="p-3 rounded-xl bg-[#FDF9EE] border border-[#2D3E99]/15 space-y-2.5 text-xs">
                        <form onSubmit={(e) => handleSaveQuickNote(e, st.id)} className="flex flex-wrap gap-2">
                          <input
                            type="date"
                            value={qnDate}
                            onChange={(e) => setQnDate(e.target.value)}
                            className="px-2 py-1.5 rounded border border-[#2D3E99]/20 bg-white font-mono-num"
                          />
                          <select
                            value={qnCategory}
                            onChange={(e) => setQnCategory(e.target.value as QuickNoteCategory)}
                            className="px-2 py-1.5 rounded border border-[#2D3E99]/20 bg-white"
                          >
                            {quickNoteCategories.map((cat) => (
                              <option key={cat.id} value={cat.id}>{cat.label}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            required
                            value={qnText}
                            onChange={(e) => setQnText(e.target.value)}
                            placeholder={biText(lang, `Quick note for ${st.fullName}...`, `Ghi chú nhanh cho ${st.fullName}...`)}
                            className="flex-1 min-w-[180px] px-2.5 py-1.5 rounded border border-[#2D3E99]/20 bg-white"
                          />
                          <button
                            type="submit"
                            disabled={busy || !qnText.trim()}
                            className="px-3 py-1.5 rounded bg-[#E61E64] text-white font-semibold cursor-pointer"
                          >
                            {biText(lang, 'Save', 'Lưu')}
                          </button>
                        </form>
                        {stNotes.length > 0 && (
                          <div className="space-y-1.5 max-h-40 overflow-y-auto pt-1 border-t border-[#2D3E99]/10">
                            {stNotes.map((n) => (
                              <div key={n.id} className="flex items-center justify-between gap-2 bg-white px-2.5 py-1.5 rounded border border-[#2D3E99]/10">
                                <span>
                                  <strong className="font-mono-num text-[#2D3E99]">{n.observationDate}</strong> [{n.category}]: {n.noteText}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteQuickNote(n)}
                                  className="text-[#E61E64] hover:underline cursor-pointer shrink-0"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MY SCHEDULE & ACADEMY EVENT CALENDAR */}
      {activeTab === 'schedule' && (
        <div className="space-y-6">
          <AcademyEventCalendar
            lang={lang}
            currentUser={currentUser}
            portalMode="teacher"
            student={activeStudent}
            students={students}
            classes={classes}
            schedules={schedules}
            assessments={assessments}
          />

          <div className="bg-white border border-[#2D3E99]/12 rounded-xl p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-[#2D3E99]">
              {lang === 'vi' ? 'Lịch giảng dạy hàng tuần' : 'Weekly Teaching Schedule'}
            </h3>
            {schedules.length === 0 ? (
              <p className="text-sm text-[#172154]/70">No scheduled sessions yet.</p>
            ) : (
              <div className="divide-y divide-[#2D3E99]/10">
                {schedules.map((s) => (
                  <div key={s.id} className="py-3.5 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="font-semibold text-[#172154]">
                        {s.dayOfWeek} · <span className="font-mono-num">{s.startTime}–{s.endTime}</span> · {s.className}
                      </div>
                      <div className="text-xs text-[#172154]/70">
                        Week {s.weekNumber}: {lang === 'vi' ? s.topicVi : s.topicEn} · {s.room} · Status: {s.status}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCompleteSession(s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                        s.status === 'completed'
                          ? 'bg-[#56BEB8]/20 text-[#172154]'
                          : 'bg-[#2D3E99] text-white'
                      }`}
                    >
                      {s.status === 'completed' ? 'Completed' : 'Mark Completed'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: PROFILE & PAY INFO */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white border border-[#2D3E99]/12 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3.5 pb-2 border-b border-[#2D3E99]/10">
              <ProfileAvatar
                src={teacherDoc?.photoUrl || currentUser.photoUrl}
                name={teacherDoc?.fullName || currentUser.displayName}
                size="lg"
              />
              <div>
                <h3 className="font-display text-lg font-bold text-[#2D3E99]">
                  {lang === 'vi' ? 'Thông tin Thu nhập & Hợp đồng' : 'Compensation & Pay Summary'}
                </h3>
                <div className="text-xs text-[#172154]/70">
                  {teacherDoc?.fullName || currentUser.displayName} · {teacherDoc?.cefrCertification || 'CEFR Faculty'}
                </div>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-[#2D3E99]/10">
                <span className="text-[#172154]/70">Teacher</span>
                <span className="font-semibold">{teacherDoc?.fullName || currentUser.displayName}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#2D3E99]/10">
                <span className="text-[#172154]/70">Specialty</span>
                <span className="font-semibold">{teacherDoc?.specialty || 'English & Values'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#2D3E99]/10">
                <span className="text-[#172154]/70">Hourly Rate</span>
                <span className="font-mono-num font-bold text-[#2D3E99]">
                  {formatVnd(teacherDoc?.hourlyRateVnd || 0)}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#2D3E99]/10">
                <span className="text-[#172154]/70">Monthly Base</span>
                <span className="font-mono-num font-bold text-[#E61E64]">
                  {formatVnd(teacherDoc?.monthlyBaseVnd || 0)}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-[#172154]/70">Pay Status</span>
                <span className="font-semibold">{teacherDoc?.payStatus || 'active'}</span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveProfileBank} className="lg:col-span-7 bg-white border border-[#2D3E99]/12 rounded-xl p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-[#2D3E99]">
              {lang === 'vi' ? 'Cập nhật Hồ sơ & Tài khoản Ngân hàng' : 'Update Profile & Bank Account'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="Phone"
                className="px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm"
              />
              <input
                type="text"
                value={editBankName}
                onChange={(e) => setEditBankName(e.target.value)}
                placeholder="Bank Name"
                className="px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm"
              />
              <input
                type="text"
                value={editBankNum}
                onChange={(e) => setEditBankNum(e.target.value)}
                placeholder="Account Number"
                className="px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm font-mono-num"
              />
              <input
                type="text"
                value={editBankHolder}
                onChange={(e) => setEditBankHolder(e.target.value)}
                placeholder="Account Holder"
                className="px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm"
              />
            </div>
            <textarea
              rows={2}
              value={editBioEn}
              onChange={(e) => setEditBioEn(e.target.value)}
              placeholder="Bio (English)"
              className="w-full p-3 rounded-lg border border-[#2D3E99]/20 text-sm"
            />
            <textarea
              rows={2}
              value={editBioVi}
              onChange={(e) => setEditBioVi(e.target.value)}
              placeholder="Giới thiệu (Tiếng Việt)"
              className="w-full p-3 rounded-lg border border-[#2D3E99]/20 text-sm"
            />
            <button
              type="submit"
              disabled={busy || !teacherDoc}
              className="px-5 py-2.5 rounded-lg bg-[#2D3E99] text-white text-sm font-semibold cursor-pointer disabled:opacity-50"
            >
              {lang === 'vi' ? 'Lưu thông tin' : 'Save Changes'}
            </button>
          </form>
        </div>
      )}

      {/* TAB 5: UNIFIED RESOURCE LIBRARY (Class Materials, Homework Assignment & Teacher Exercise Grading) */}
      {activeTab === 'curriculum' && (
        <div className="space-y-6">
          <LearningResourceLibrary
            lang={lang}
            student={activeStudent}
            geminiNotes={geminiNotes}
            currentUser={currentUser}
            classes={classes}
            students={students}
            portalRole="teacher"
            onOpenReadOnlyNote={(res) => {
              if (res.note) {
                setActiveReadOnlyNote(res.note);
              }
            }}
          />

          <div
            className="space-y-4 select-none no-print"
            onContextMenu={(e) => e.preventDefault()}
            onCopy={(e) => e.preventDefault()}
            onCut={(e) => e.preventDefault()}
            onDragStart={(e) => e.preventDefault()}
          >
            <div className="bg-[#FDF9EE] border border-[#2D3E99]/15 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#172154]">
              <span className="font-semibold flex items-center gap-2 text-[#2D3E99]">
                <ShieldCheck className="w-4 h-4 text-[#E61E64]" />
                {biText(
                  lang,
                  'Resource Library · Read-Only Class Study Guides (Downloads, exports & copying are disabled to protect curriculum copyright).',
                  'Thư viện Học liệu · Tài liệu Lớp học Chỉ đọc (Tắt tải xuống, sao chép và xuất tệp để bảo vệ bản quyền giáo trình).'
                )}
              </span>
            </div>

            {geminiNotes.map((note) => (
              <div key={note.id} className="bg-white border border-[#2D3E99]/12 rounded-xl p-6 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-[#E61E64]">
                      Week {note.weekNumber} · {note.programTitle}
                    </div>
                    <h3 className="font-display text-lg font-bold text-[#2D3E99] mt-0.5">{note.title}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveReadOnlyNote(note)}
                    className="px-3.5 py-1.5 rounded-lg bg-[#2D3E99] text-white text-xs font-semibold hover:bg-[#22307a] flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Lock className="w-3.5 h-3.5 text-[#FFD41D]" />
                    {biText(lang, 'Read Material (Read-Only)', 'Xem Tài liệu (Chỉ đọc)')}
                  </button>
                </div>
                <p className="text-sm text-[#172154]/85">{lang === 'vi' ? note.summaryVi : note.summaryEn}</p>
                <div className="text-xs text-[#172154]/75 pt-2 border-t border-[#2D3E99]/10 space-y-1">
                  <div><strong>Key English:</strong> {note.keyVocabulary?.join(', ')}</div>
                  {note.phonicsFocus && <div><strong>Phonics:</strong> {note.phonicsFocus}</div>}
                  {note.grammarFocus && <div><strong>Grammar:</strong> {note.grammarFocus}</div>}
                  <div><strong>Activities:</strong> {lang === 'vi' ? note.activitiesVi : note.activitiesEn}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
        </Suspense>
      </ErrorBoundary>

      {activeReadOnlyNote && (
        <Suspense fallback={null}>
          <ReadOnlyMaterialViewer
            lang={lang}
            noteId={activeReadOnlyNote.id}
            note={activeReadOnlyNote}
            viewerLabel={currentUser.email}
            onClose={() => setActiveReadOnlyNote(null)}
          />
        </Suspense>
      )}
    </div>
  );
};
