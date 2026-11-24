import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  Award,
  Banknote,
  BellRing,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Database,
  Eye,
  FileText,
  GraduationCap,
  Landmark,
  Lock,
  MessageCircle,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  Unlink,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  X,
  AlertCircle,
  ArrowRight,
  BarChart3,
  CreditCard,
} from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { biText, formatVnd, TRANSLATIONS } from '../i18n';
import {
  sendPaymentReminderZalo,
  storeProtectedMaterial,
  synthesizeGeminiNotes,
} from '../services/aiClient';
import {
  buildPaymentReminderCopy,
  normalizeZaloPhone,
  resolveActiveBankConfig,
} from '../services/bankingQr';
import { isSuperAdminEmail, seedAcademyBaseline } from '../services/seedData';
import { deleteRecordFromSql, syncBatchToSql, syncRecordToSql } from '../services/sqlSyncClient';
import { PCE_KIDS_CURRICULUM } from '../data/pceCurriculumData';
import { ErrorBoundary } from './ErrorBoundary';
import { ProfileAvatar, ProfilePhotoUploader } from './ProfileAvatar';
import { ProfileCompletionBar } from './ProfileCompletionBar';
import { StudentVisualAnalytics, type QuadrantCohortPoint } from './StudentVisualAnalytics';
import type { AdminTab } from '../config/portalNavigation';
import { PortalLoader } from './ui/Primitives';

const AcademyEventCalendar = lazy(() =>
  import('./AcademyEventCalendar').then((m) => ({ default: m.AcademyEventCalendar }))
);
const AdminAccountsBankingDashboard = lazy(() =>
  import('./AdminAccountsBankingDashboard').then((m) => ({
    default: m.AdminAccountsBankingDashboard,
  }))
);
const AdminOperationsPanel = lazy(() =>
  import('./admin/AdminOperationsPanel').then((m) => ({ default: m.AdminOperationsPanel }))
);
const AdminProgramsPanel = lazy(() =>
  import('./admin/AdminProgramsPanel').then((m) => ({ default: m.AdminProgramsPanel }))
);
const CertificatesTab = lazy(() =>
  import('./CertificatesTab').then((m) => ({ default: m.CertificatesTab }))
);
const HistoricalProgress = lazy(() =>
  import('./HistoricalProgress').then((m) => ({ default: m.HistoricalProgress }))
);
const LearningResourceLibrary = lazy(() =>
  import('./LearningResourceLibrary').then((m) => ({ default: m.LearningResourceLibrary }))
);
const ReadOnlyMaterialViewer = lazy(() =>
  import('./ReadOnlyMaterialViewer').then((m) => ({ default: m.ReadOnlyMaterialViewer }))
);
import {
  CEFR_LEVELS,
  formatCefrLabel,
  type AcademyBankConfig,
  type AcademyClass,
  type CefrLevel,
  type CefrModifier,
  type ClassSchedule,
  type EnrollmentRequest,
  type GeminiNote,
  type LangCode,
  type ParentPaymentMethod,
  type PayableRecord,
  type ProgramCourse,
  type StudentAssessment,
  type StudentProfile,
  type TeacherProfile,
  type TuitionInvoice,
  type UserInvite,
  type UserProfile,
  type UserRole,
} from '../types';

export interface ZaloReminderDispatchResult {
  invoiceId: string;
  invoiceNumber: string;
  studentName: string;
  parentEmail: string;
  recipientPhone: string;
  hasDirectParentPhone: boolean;
  formattedMessage: string;
  zaloUrl: string;
  deliveryMode: 'zalo_webhook' | 'zalo_oa_api' | 'zalo_link_ready';
  sentAt: string;
  error?: string;
}

interface AdminConsoleProps {
  lang: LangCode;
  currentUser?: UserProfile | null;
  activeTab?: AdminTab;
  onTabChange?: (tab: AdminTab) => void;
  onOpenPromoPopup?: (highlightProgramId?: string) => void;
}

export const AdminConsole: React.FC<AdminConsoleProps> = ({
  lang,
  currentUser,
  activeTab: controlledTab,
  onTabChange,
  onOpenPromoPopup,
}) => {
  const t = TRANSLATIONS[lang];
  const safeCurrentUser: UserProfile = useMemo(() => {
    if (currentUser && currentUser.email) return currentUser;
    return {
      uid: currentUser?.uid || auth.currentUser?.uid || 'admin-root',
      email: currentUser?.email || auth.currentUser?.email || 'admin@lilab.edu.vn',
      displayName: currentUser?.displayName || auth.currentUser?.displayName || 'Admin',
      role: (currentUser?.role as UserRole) || 'super_admin',
      status: 'active',
      preferredLang: lang,
    };
  }, [currentUser, lang]);

  const userEmail = (safeCurrentUser.email || '').toLowerCase();
  const isSuperAdmin = isSuperAdminEmail(userEmail);
  const [internalTab, setInternalTab] = useState<AdminTab>('classes');
  const activeTab: AdminTab = controlledTab ?? internalTab;
  const setActiveTab = (next: AdminTab) => {
    setInternalTab(next);
    onTabChange?.(next);
  };
  const [scheduleSectionView, setScheduleSectionView] = useState<'all' | 'calendar' | 'classes'>('all');
  const [selectedReportId, setSelectedReportId] = useState<string>('cohort_avg');
  const [enrollmentStatusFilter, setEnrollmentStatusFilter] = useState<'all' | 'pending' | 'waitlist' | 'enrolled'>('all');
  const [pceOverviewDivisionFilter, setPceOverviewDivisionFilter] = useState<
    'all' | 'early_years' | 'primary' | 'teen'
  >('all');

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [invites, setInvites] = useState<UserInvite[]>([]);
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [programs, setPrograms] = useState<ProgramCourse[]>([]);
  const [classes, setClasses] = useState<AcademyClass[]>([]);
  const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
  const [assessments, setAssessments] = useState<StudentAssessment[]>([]);
  const [geminiNotes, setGeminiNotes] = useState<GeminiNote[]>([]);
  const [invoices, setInvoices] = useState<TuitionInvoice[]>([]);
  const [payables, setPayables] = useState<PayableRecord[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<ParentPaymentMethod[]>([]);
  const [academyBankConfigs, setAcademyBankConfigs] = useState<AcademyBankConfig[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRequest[]>([]);
  const [studentsLoaded, setStudentsLoaded] = useState(false);
  const [assessmentsLoaded, setAssessmentsLoaded] = useState(false);

  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [zaloDispatching, setZaloDispatching] = useState(false);
  const [zaloDispatchResults, setZaloDispatchResults] = useState<ZaloReminderDispatchResult[]>([]);
  const [confirmDeleteAllReports, setConfirmDeleteAllReports] = useState(false);
  const [activeReadOnlyNote, setActiveReadOnlyNote] = useState<GeminiNote | null>(null);

  // Global Student Search state (Name, Parent Email, or Student ID)
  const [studentSearch, setStudentSearch] = useState('');
  const [searchResultsOpen, setSearchResultsOpen] = useState(false);
  const [remoteStudentMatches, setRemoteStudentMatches] = useState<StudentProfile[]>([]);
  const [searchingStudentDb, setSearchingStudentDb] = useState(false);
  const [focusedStudentId, setFocusedStudentId] = useState<string>('');

  // Report viewer & editor state (Overview tab)
  const [viewingReportId, setViewingReportId] = useState<string | null>(null);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [editReportForm, setEditReportForm] = useState({
    termLabel: '',
    cefrLevel: 'Pre-A1 Starters' as CefrLevel,
    cefrModifier: 'standard' as CefrModifier,
    speakingScore: 80,
    readingScore: 80,
    writingScore: 80,
    vocabularyScore: 80,
    comprehensionScore: 80,
    socialScore: 85,
    emotionalScore: 85,
    mentalScore: 85,
    teacherCommentEn: '',
    teacherCommentVi: '',
    aiInsightEn: '',
    aiInsightVi: '',
    activitiesText: '',
  });

  // Inline Edit States for Users & Profiles tab
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);
  const [editTeacherForm, setEditTeacherForm] = useState({
    fullName: '',
    teacherEmail: '',
    phone: '',
    specialty: '',
    cefrCertification: '',
    hourlyRateVnd: 450000,
    monthlyBaseVnd: 18000000,
    bankName: '',
    bankAccountNumber: '',
    bankAccountHolder: '',
    payStatus: 'active' as TeacherProfile['payStatus'],
    status: 'active' as TeacherProfile['status'],
    photoUrl: '',
  });

  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editStudentForm, setEditStudentForm] = useState({
    fullName: '',
    studentEmail: '',
    age: 7,
    gender: 'girl' as 'girl' | 'boy',
    parentName: '',
    parentEmail: '',
    parentPhone: '',
    cefrLevel: 'Pre-A1 Starters' as CefrLevel,
    cefrModifier: 'standard' as CefrModifier,
    status: 'active' as StudentProfile['status'],
    activitiesNote: '',
    photoUrl: '',
  });

  const [editingInviteId, setEditingInviteId] = useState<string | null>(null);
  const [editInviteForm, setEditInviteForm] = useState({
    displayName: '',
    email: '',
    phone: '',
    role: 'teacher' as UserInvite['role'],
    status: 'pending' as UserInvite['status'],
  });

  const [editingUserUid, setEditingUserUid] = useState<string | null>(null);
  const [editUserForm, setEditUserForm] = useState({
    displayName: '',
    phone: '',
    role: 'parent' as UserProfile['role'],
    preferredLang: 'vi' as LangCode,
    status: 'active' as UserProfile['status'],
    photoUrl: '',
  });

  // Forms state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'teacher' | 'parent' | 'student'>('teacher');
  const [invitePhone, setInvitePhone] = useState('');

  // Teacher profile form (blank by default; banking & salary managed in Accounts & Banking)
  const [teacherEmail, setTeacherEmail] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [teacherPhone, setTeacherPhone] = useState('');
  const [teacherPhotoUrl, setTeacherPhotoUrl] = useState('');
  const [teacherSpecialty, setTeacherSpecialty] = useState('');
  const [teacherCert, setTeacherCert] = useState('');

  // Student profile form
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [studentPhotoUrl, setStudentPhotoUrl] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [studentAge, setStudentAge] = useState(7);
  const [studentGender, setStudentGender] = useState<'girl' | 'boy'>('girl');
  const [studentCefr, setStudentCefr] = useState<CefrLevel>('Pre-A1 Starters');
  const [studentMod, setStudentMod] = useState<CefrModifier>('standard');

  // Class form
  const [className, setClassName] = useState('');
  const [classProgramId, setClassProgramId] = useState('');
  const [classTeacherId, setClassTeacherId] = useState('');
  const [classCefr, setClassCefr] = useState<CefrLevel>('Pre-A1 Starters');
  const [classMod, setClassMod] = useState<CefrModifier>('standard');
  const [classRoom, setClassRoom] = useState('Studio 101');
  const [classSchedText, setClassSchedText] = useState('Sat 09:00–10:30');
  const [selectedStudentForClass, setSelectedStudentForClass] = useState<Record<string, string>>({});

  // Schedule form
  const [schedClassId, setSchedClassId] = useState('');
  const [schedDay, setSchedDay] = useState<ClassSchedule['dayOfWeek']>('Saturday');
  const [schedStart, setSchedStart] = useState('09:00');
  const [schedEnd, setSchedEnd] = useState('10:30');
  const [schedWeek, setSchedWeek] = useState(1);
  const [schedTopicEn, setSchedTopicEn] = useState('');
  const [schedTopicVi, setSchedTopicVi] = useState('');

  // Gemini Notes Upload
  const [noteTitle, setNoteTitle] = useState('');
  const [noteWeek, setNoteWeek] = useState(1);
  const [noteProgram, setNoteProgram] = useState('Be Whole: 13-Week Values & English Curriculum');
  const [noteRawText, setNoteRawText] = useState('');
  const [noteFileName, setNoteFileName] = useState('');
  const [noteFileBase64, setNoteFileBase64] = useState('');
  const [noteMimeType, setNoteMimeType] = useState('application/pdf');

  const adminUids = [safeCurrentUser.uid];

  const isFullAdmin =
    isSuperAdmin || safeCurrentUser.role === 'super_admin' || safeCurrentUser.role === 'admin';

  useEffect(() => {
    const unsubs: Array<() => void> = [];

    if (isFullAdmin) {
      unsubs.push(
        onSnapshot(
          collection(db, 'users'),
          (snap) => {
            const loadedUsers = snap.docs.map((d) => d.data() as UserProfile);
            setUsers(loadedUsers);
            if (isSuperAdmin) {
              loadedUsers.forEach((u) => {
                if (u.uid && isSuperAdminEmail(u.email) && u.role !== 'super_admin') {
                  void updateDoc(doc(db, 'users', u.uid), {
                    role: 'super_admin',
                    updatedAt: serverTimestamp(),
                  }).catch(() => {});
                  void setDoc(doc(db, 'admins', u.uid), {
                    uid: u.uid,
                    email: (u.email || '').toLowerCase(),
                    displayName: u.displayName || (u.email || 'Super Admin').split('@')[0],
                    level: 'super_admin',
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                  }).catch(() => {});
                  void syncRecordToSql('users', u.uid, { ...u, role: 'super_admin' }).catch(() => {});
                }
              });
            }
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'users')
        )
      );
    }

    const listen = <T,>(
      colName: string,
      setter: React.Dispatch<React.SetStateAction<T[]>>,
      opts?: { orderField?: string; adminScoped?: boolean; extraWhere?: ReturnType<typeof where> }
    ) => {
      const constraints = [];
      if (opts?.adminScoped && !isFullAdmin) {
        constraints.push(where('adminUids', 'array-contains', safeCurrentUser.uid));
      }
      if (opts?.extraWhere) {
        constraints.push(opts.extraWhere);
      }
      if (opts?.orderField) {
        constraints.push(orderBy(opts.orderField, 'desc'));
      }
      const ref = constraints.length > 0 ? query(collection(db, colName), ...constraints) : collection(db, colName);
      unsubs.push(
        onSnapshot(
          ref,
          (snap) => {
            setter(snap.docs.map((d) => ({ id: d.id, ...d.data() } as T)));
            if (colName === 'students') setStudentsLoaded(true);
            if (colName === 'assessments') setAssessmentsLoaded(true);
          },
          (err) => {
            if (colName === 'students') setStudentsLoaded(true);
            if (colName === 'assessments') setAssessmentsLoaded(true);
            handleFirestoreError(err, OperationType.LIST, colName);
          }
        )
      );
    };

    listen<UserInvite>('user_invites', setInvites, { adminScoped: true });
    listen<TeacherProfile>('teachers', setTeachers, { adminScoped: true });
    listen<StudentProfile>('students', setStudents, { adminScoped: true });
    listen<ProgramCourse>('programs', setPrograms);
    listen<AcademyClass>('classes', setClasses, { adminScoped: true });
    listen<ClassSchedule>('schedules', setSchedules, { adminScoped: true });
    listen<StudentAssessment>('assessments', setAssessments, { adminScoped: true });
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
    listen<TuitionInvoice>('invoices', setInvoices, { adminScoped: true });
    listen<PayableRecord>('payables', setPayables, { adminScoped: true });
    listen<ParentPaymentMethod>('payment_methods', setPaymentMethods, { adminScoped: true });
    listen<AcademyBankConfig>('academy_banking', setAcademyBankConfigs);
    listen<EnrollmentRequest>('enrollments', setEnrollments, { adminScoped: true });

    return () => unsubs.forEach((u) => u());
  }, [isFullAdmin, safeCurrentUser.uid]);

  // Silent background snapshot mirror to Cloud SQL so existing Firestore data stays synced
  useEffect(() => {
    const items: Array<{ collection: Parameters<typeof syncBatchToSql>[0][number]['collection']; id: string; data: Record<string, unknown> }> = [];
    for (const u of users) items.push({ collection: 'users', id: u.uid, data: u as unknown as Record<string, unknown> });
    for (const inv of invites) items.push({ collection: 'user_invites', id: inv.id, data: inv as unknown as Record<string, unknown> });
    for (const tc of teachers) items.push({ collection: 'teachers', id: tc.id, data: tc as unknown as Record<string, unknown> });
    for (const st of students) items.push({ collection: 'students', id: st.id, data: st as unknown as Record<string, unknown> });
    for (const pr of programs) items.push({ collection: 'programs', id: pr.id, data: pr as unknown as Record<string, unknown> });
    for (const cl of classes) items.push({ collection: 'classes', id: cl.id, data: cl as unknown as Record<string, unknown> });
    for (const sc of schedules) items.push({ collection: 'schedules', id: sc.id, data: sc as unknown as Record<string, unknown> });
    for (const as of assessments) items.push({ collection: 'assessments', id: as.id, data: as as unknown as Record<string, unknown> });
    for (const gn of geminiNotes) items.push({ collection: 'gemini_notes', id: gn.id, data: gn as unknown as Record<string, unknown> });
    for (const iv of invoices) items.push({ collection: 'invoices', id: iv.id, data: iv as unknown as Record<string, unknown> });
    for (const py of payables) items.push({ collection: 'payables', id: py.id, data: py as unknown as Record<string, unknown> });
    for (const pm of paymentMethods) items.push({ collection: 'payment_methods', id: pm.id, data: pm as unknown as Record<string, unknown> });
    for (const en of enrollments) items.push({ collection: 'enrollments', id: en.id, data: en as unknown as Record<string, unknown> });
    if (items.length === 0) return;
    const timer = setTimeout(() => {
      syncBatchToSql(items);
    }, 2500);
    return () => clearTimeout(timer);
  }, [users, invites, teachers, students, programs, classes, schedules, assessments, geminiNotes, invoices, payables, paymentMethods, enrollments]);

  const flash = (msg: string) => {
    setStatusBanner(msg);
    setTimeout(() => setStatusBanner(null), 4000);
  };

  const makeId = (prefix: string) =>
    `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  // Seed baseline
  const handleSeedBaseline = async () => {
    setBusyAction('seed');
    try {
      await seedAcademyBaseline(safeCurrentUser.uid, userEmail);
      flash(
        biText(
          lang,
          'Loaded starter academy curriculum & banking config.',
          'Đã tải dữ liệu giáo trình mẫu!'
        )
      );
    } finally {
      setBusyAction(null);
    }
  };

  // Invite user
  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteName.trim()) return;
    setBusyAction('invite');
    try {
      const id = makeId('inv');
      const invitePayload = {
        email: inviteEmail.trim().toLowerCase(),
        displayName: inviteName.trim(),
        role: inviteRole,
        phone: invitePhone.trim(),
        status: 'pending',
        createdByUid: safeCurrentUser.uid,
        adminUids,
      };
      await setDoc(doc(db, 'user_invites', id), {
        ...invitePayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await syncRecordToSql('user_invites', id, invitePayload);
      if (inviteRole === 'teacher') {
        const tchId = makeId('tch');
        const tchPayload = {
          teacherEmail: inviteEmail.trim().toLowerCase(),
          fullName: inviteName.trim(),
          phone: invitePhone.trim(),
          specialty: 'Bilingual English & Values',
          cefrCertification: 'CELTA · CEFR C1+',
          hourlyRateVnd: 450000,
          monthlyBaseVnd: 18000000,
          payStatus: 'active',
          status: 'active',
          adminUids,
        };
        await setDoc(doc(db, 'teachers', tchId), {
          ...tchPayload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await syncRecordToSql('teachers', tchId, tchPayload);
      }
      setInviteEmail('');
      setInviteName('');
      setInvitePhone('');
      flash(biText(lang, 'User invite & profile created.', 'Đã thêm lời mời tài khoản mới.'));
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'user_invites');
    } finally {
      setBusyAction(null);
    }
  };

  // Add Teacher directly
  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyAction('teacher');
    try {
      const id = makeId('tch');
      const payload = {
        teacherEmail: teacherEmail.trim().toLowerCase(),
        fullName: teacherName.trim(),
        phone: teacherPhone.trim(),
        ...(teacherPhotoUrl ? { photoUrl: teacherPhotoUrl } : {}),
        specialty: teacherSpecialty.trim(),
        cefrCertification: teacherCert.trim(),
        hourlyRateVnd: 0,
        monthlyBaseVnd: 0,
        payStatus: 'active',
        status: 'active',
        adminUids,
      };
      await setDoc(doc(db, 'teachers', id), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await syncRecordToSql('teachers', id, payload);
      setTeacherEmail('');
      setTeacherName('');
      setTeacherPhone('');
      setTeacherPhotoUrl('');
      setTeacherSpecialty('');
      setTeacherCert('');
      flash(biText(lang, 'Teacher profile saved.', 'Đã thêm hồ sơ giáo viên.'));
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'teachers');
    } finally {
      setBusyAction(null);
    }
  };

  // Add Student directly
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyAction('student');
    try {
      const id = makeId('stu');
      const payload = {
        fullName: studentName.trim(),
        ...(studentEmail.trim() ? { studentEmail: studentEmail.trim().toLowerCase() } : {}),
        ...(studentPhotoUrl ? { photoUrl: studentPhotoUrl } : {}),
        parentName: parentName.trim(),
        parentEmail: parentEmail.trim().toLowerCase(),
        parentPhone: parentPhone.trim(),
        age: Number(studentAge) || 7,
        gender: studentGender,
        cefrLevel: studentCefr,
        cefrModifier: studentMod,
        enrolledClassIds: [],
        assignedTeacherEmails: [],
        activitiesNote: 'Week 01: Kindness — The Lion and the Mouse',
        status: 'active',
        adminUids,
      };
      await setDoc(doc(db, 'students', id), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await syncRecordToSql('students', id, payload);
      setStudentName('');
      setStudentEmail('');
      setStudentPhotoUrl('');
      setParentName('');
      setParentEmail('');
      setParentPhone('');
      flash(biText(lang, 'Student profile added.', 'Đã thêm hồ sơ học viên.'));
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'students');
    } finally {
      setBusyAction(null);
    }
  };

  const handleDeleteDoc = async (colName: Parameters<typeof deleteRecordFromSql>[0], id: string) => {
    try {
      await deleteDoc(doc(db, colName, id));
      await deleteRecordFromSql(colName, id);
      if (colName === 'assessments') {
        if (selectedReportId === id) setSelectedReportId('cohort_avg');
        if (viewingReportId === id) setViewingReportId(null);
        if (editingReportId === id) setEditingReportId(null);
      }
      flash(biText(lang, 'Record removed.', 'Đã xóa bản ghi.'));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${colName}/${id}`);
    }
  };

  // Edit Handlers for Users, Invites, Teachers, Students & Parents
  const startEditTeacher = (tc: TeacherProfile) => {
    setEditingTeacherId(tc.id);
    setEditTeacherForm({
      fullName: tc.fullName || '',
      teacherEmail: tc.teacherEmail || '',
      phone: tc.phone || '',
      specialty: tc.specialty || '',
      cefrCertification: tc.cefrCertification || '',
      hourlyRateVnd: tc.hourlyRateVnd || 0,
      monthlyBaseVnd: tc.monthlyBaseVnd || 0,
      bankName: tc.bankName || '',
      bankAccountNumber: tc.bankAccountNumber || '',
      bankAccountHolder: tc.bankAccountHolder || '',
      payStatus: tc.payStatus || 'active',
      status: tc.status || 'active',
      photoUrl: tc.photoUrl || '',
    });
  };

  const handleSaveEditTeacher = async (tc: TeacherProfile) => {
    setBusyAction(`edit_tc_${tc.id}`);
    try {
      const updates = {
        fullName: editTeacherForm.fullName.trim(),
        teacherEmail: editTeacherForm.teacherEmail.trim().toLowerCase(),
        phone: editTeacherForm.phone.trim(),
        specialty: editTeacherForm.specialty.trim(),
        cefrCertification: editTeacherForm.cefrCertification.trim(),
        hourlyRateVnd: Number(editTeacherForm.hourlyRateVnd) || 0,
        monthlyBaseVnd: Number(editTeacherForm.monthlyBaseVnd) || 0,
        bankName: editTeacherForm.bankName.trim(),
        bankAccountNumber: editTeacherForm.bankAccountNumber.trim(),
        bankAccountHolder: editTeacherForm.bankAccountHolder.trim(),
        payStatus: editTeacherForm.payStatus,
        status: editTeacherForm.status,
        photoUrl: editTeacherForm.photoUrl || '',
      };
      await updateDoc(doc(db, 'teachers', tc.id), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      await syncRecordToSql('teachers', tc.id, { ...tc, ...updates });
      setEditingTeacherId(null);
      flash(biText(lang, `Updated teacher ${updates.fullName}.`, `Đã cập nhật giáo viên ${updates.fullName}.`));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `teachers/${tc.id}`);
    } finally {
      setBusyAction(null);
    }
  };

  const startEditStudent = (st: StudentProfile) => {
    setEditingStudentId(st.id);
    setEditStudentForm({
      fullName: st.fullName || '',
      studentEmail: st.studentEmail || '',
      age: st.age || 7,
      gender: st.gender || 'girl',
      parentName: st.parentName || '',
      parentEmail: st.parentEmail || '',
      parentPhone: st.parentPhone || '',
      cefrLevel: st.cefrLevel || 'Pre-A1 Starters',
      cefrModifier: st.cefrModifier || 'standard',
      status: st.status || 'active',
      activitiesNote: st.activitiesNote || '',
      photoUrl: st.photoUrl || '',
    });
  };

  const handleSaveEditStudent = async (st: StudentProfile) => {
    setBusyAction(`edit_st_${st.id}`);
    try {
      const updates: Record<string, unknown> = {
        fullName: editStudentForm.fullName.trim(),
        age: Number(editStudentForm.age) || 7,
        gender: editStudentForm.gender,
        parentName: editStudentForm.parentName.trim(),
        parentEmail: editStudentForm.parentEmail.trim().toLowerCase(),
        parentPhone: editStudentForm.parentPhone.trim(),
        cefrLevel: editStudentForm.cefrLevel,
        cefrModifier: editStudentForm.cefrModifier,
        status: editStudentForm.status,
        activitiesNote: editStudentForm.activitiesNote.trim(),
        photoUrl: editStudentForm.photoUrl || '',
      };
      if (editStudentForm.studentEmail.trim()) {
        updates.studentEmail = editStudentForm.studentEmail.trim().toLowerCase();
      }
      await updateDoc(doc(db, 'students', st.id), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      await syncRecordToSql('students', st.id, { ...st, ...updates });
      setEditingStudentId(null);
      flash(biText(lang, `Updated student & parent details for ${editStudentForm.fullName}.`, `Đã cập nhật hồ sơ ${editStudentForm.fullName}.`));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `students/${st.id}`);
    } finally {
      setBusyAction(null);
    }
  };

  const startEditInvite = (inv: UserInvite) => {
    setEditingInviteId(inv.id);
    setEditInviteForm({
      displayName: inv.displayName || '',
      email: inv.email || '',
      phone: inv.phone || '',
      role: inv.role || 'teacher',
      status: inv.status || 'pending',
    });
  };

  const handleSaveEditInvite = async (inv: UserInvite) => {
    setBusyAction(`edit_inv_${inv.id}`);
    try {
      const updates = {
        displayName: editInviteForm.displayName.trim(),
        email: editInviteForm.email.trim().toLowerCase(),
        phone: editInviteForm.phone.trim(),
        role: editInviteForm.role,
        status: editInviteForm.status,
      };
      await updateDoc(doc(db, 'user_invites', inv.id), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      await syncRecordToSql('user_invites', inv.id, { ...inv, ...updates });
      setEditingInviteId(null);
      flash(biText(lang, `Updated invite for ${updates.email}.`, `Đã cập nhật lời mời ${updates.email}.`));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `user_invites/${inv.id}`);
    } finally {
      setBusyAction(null);
    }
  };

  const startEditUser = (u: UserProfile) => {
    setEditingUserUid(u.uid);
    setEditUserForm({
      displayName: u.displayName || '',
      phone: u.phone || '',
      role: u.role || 'parent',
      preferredLang: u.preferredLang || 'vi',
      status: u.status || 'active',
      photoUrl: u.photoUrl || '',
    });
  };

  const handleSaveEditUser = async (u: UserProfile) => {
    setBusyAction(`edit_usr_${u.uid}`);
    try {
      const nextRole = isSuperAdminEmail(u.email) ? 'super_admin' : editUserForm.role;
      const updates = {
        displayName: editUserForm.displayName.trim() || u.displayName,
        phone: editUserForm.phone.trim(),
        role: nextRole,
        preferredLang: editUserForm.preferredLang,
        status: editUserForm.status,
        photoUrl: editUserForm.photoUrl || '',
      };
      await updateDoc(doc(db, 'users', u.uid), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      if (isSuperAdminEmail(u.email)) {
        await setDoc(doc(db, 'admins', u.uid), {
          uid: u.uid,
          email: (u.email || '').toLowerCase(),
          displayName: updates.displayName,
          level: 'super_admin',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else if (nextRole === 'admin' || nextRole === 'super_admin') {
        await setDoc(doc(db, 'admins', u.uid), {
          uid: u.uid,
          email: u.email,
          displayName: updates.displayName,
          level: 'admin',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await deleteDoc(doc(db, 'admins', u.uid)).catch(() => {});
      }
      await syncRecordToSql('users', u.uid, { ...u, ...updates });
      setEditingUserUid(null);
      flash(biText(lang, `Updated user ${updates.displayName}.`, `Đã cập nhật tài khoản ${updates.displayName}.`));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${u.uid}`);
    } finally {
      setBusyAction(null);
    }
  };

  // Report Editing in Admin Overview
  const startEditReport = (a: StudentAssessment) => {
    setEditingReportId(a.id);
    setViewingReportId(a.id);
    setSelectedReportId(a.id);
    setEditReportForm({
      termLabel: a.termLabel || '',
      cefrLevel: a.cefrLevel,
      cefrModifier: a.cefrModifier,
      speakingScore: a.speakingScore,
      readingScore: a.readingScore,
      writingScore: a.writingScore,
      vocabularyScore: a.vocabularyScore ?? 0,
      comprehensionScore: a.comprehensionScore ?? 0,
      socialScore: a.socialScore,
      emotionalScore: a.emotionalScore,
      mentalScore: a.mentalScore,
      teacherCommentEn: a.teacherCommentEn || '',
      teacherCommentVi: a.teacherCommentVi || '',
      aiInsightEn: a.aiInsightEn || '',
      aiInsightVi: a.aiInsightVi || '',
      activitiesText: (a.activitiesCompleted || []).join('\n'),
    });
  };

  const handleSaveEditReport = async (a: StudentAssessment) => {
    setBusyAction(`edit_rep_${a.id}`);
    try {
      const activitiesCompleted = editReportForm.activitiesText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 15);
      const updates = {
        termLabel: editReportForm.termLabel.trim(),
        cefrLevel: editReportForm.cefrLevel,
        cefrModifier: editReportForm.cefrModifier,
        speakingScore: Number(editReportForm.speakingScore) || 0,
        readingScore: Number(editReportForm.readingScore) || 0,
        writingScore: Number(editReportForm.writingScore) || 0,
        vocabularyScore: Number(editReportForm.vocabularyScore) || 0,
        comprehensionScore: Number(editReportForm.comprehensionScore) || 0,
        socialScore: Number(editReportForm.socialScore) || 0,
        emotionalScore: Number(editReportForm.emotionalScore) || 0,
        mentalScore: Number(editReportForm.mentalScore) || 0,
        teacherCommentEn: editReportForm.teacherCommentEn.trim(),
        teacherCommentVi: editReportForm.teacherCommentVi.trim(),
        aiInsightEn: editReportForm.aiInsightEn.trim(),
        aiInsightVi: editReportForm.aiInsightVi.trim(),
        activitiesCompleted,
      };
      await updateDoc(doc(db, 'assessments', a.id), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      await syncRecordToSql('assessments', a.id, { ...a, ...updates });

      const stu = students.find((s) => s.id === a.studentId);
      if (stu) {
        await updateDoc(doc(db, 'students', stu.id), {
          cefrLevel: editReportForm.cefrLevel,
          cefrModifier: editReportForm.cefrModifier,
          updatedAt: serverTimestamp(),
        });
        await syncRecordToSql('students', stu.id, {
          ...stu,
          cefrLevel: editReportForm.cefrLevel,
          cefrModifier: editReportForm.cefrModifier,
        });
      }
      setEditingReportId(null);
      flash(biText(lang, `Updated report for ${a.studentName}.`, `Đã cập nhật báo cáo cho ${a.studentName}.`));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `assessments/${a.id}`);
    } finally {
      setBusyAction(null);
    }
  };

  // Reset all parent course enrollment requests
  const handleResetEnrollments = async () => {
    if (enrollments.length === 0) return;
    setBusyAction('reset_enrollments');
    try {
      for (const enr of enrollments) {
        await deleteDoc(doc(db, 'enrollments', enr.id));
        await deleteRecordFromSql('enrollments', enr.id);
      }
      flash(
        biText(
          lang,
          'Reset all parent course enrollment requests.',
          'Đã đặt lại toàn bộ yêu cầu đăng ký khóa học của phụ huynh.'
        )
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'enrollments');
    } finally {
      setBusyAction(null);
    }
  };

  // Delete all published student reports (Firestore + Cloud SQL)
  const handleDeleteAllAssessments = async () => {
    if (assessments.length === 0) return;
    setBusyAction('delete_all_reports');
    try {
      for (const asm of assessments) {
        await deleteDoc(doc(db, 'assessments', asm.id));
        await deleteRecordFromSql('assessments', asm.id);
      }
      setSelectedReportId('cohort_avg');
      setViewingReportId(null);
      setEditingReportId(null);
      setConfirmDeleteAllReports(false);
      flash(
        biText(
          lang,
          'Deleted all published student reports.',
          'Đã xóa toàn bộ báo cáo đánh giá học viên.'
        )
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'assessments');
    } finally {
      setBusyAction(null);
    }
  };

  // Operations (Backup / Restore / Super-Admin Reset) & Programs CRUD live in modular panels:
  // src/components/admin/AdminOperationsPanel.tsx and src/components/admin/AdminProgramsPanel.tsx
  const handleAfterResetAll = () => {
    setSelectedReportId('cohort_avg');
    setViewingReportId(null);
    setEditingReportId(null);
    setEditingTeacherId(null);
    setEditingStudentId(null);
    setEditingInviteId(null);
    setEditingUserUid(null);
    setConfirmDeleteAllReports(false);
  };

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    const prog = programs.find((p) => p.id === classProgramId) || programs[0];
    const teacher = teachers.find((tc) => tc.id === classTeacherId) || teachers[0];
    if (!prog || !teacher) {
      flash(biText(lang, 'Create at least 1 program and 1 teacher first.', 'Cần ít nhất 1 chương trình và 1 giáo viên.'));
      return;
    }
    setBusyAction('class');
    try {
      const id = makeId('cls');
      const payload = {
        name: className.trim(),
        programId: prog.id,
        programTitle: prog.titleEn,
        teacherUid: teacher.teacherUid || '',
        teacherEmail: teacher.teacherEmail,
        teacherName: teacher.fullName,
        cefrLevel: classCefr,
        cefrModifier: classMod,
        room: classRoom.trim(),
        scheduleText: classSchedText.trim(),
        maxStudents: 16,
        studentIds: [],
        status: 'active',
        adminUids,
      };
      await setDoc(doc(db, 'classes', id), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await syncRecordToSql('classes', id, payload);
      setClassName('');
      flash(biText(lang, 'Class cohort created.', 'Đã tạo lớp học mới.'));
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'classes');
    } finally {
      setBusyAction(null);
    }
  };

  // Assign student to class & sync teacher email on student doc
  const handleAssignStudentToClass = async (cls: AcademyClass) => {
    const stuId = selectedStudentForClass[cls.id];
    if (!stuId) return;
    const stu = students.find((s) => s.id === stuId);
    if (!stu) return;
    try {
      const nextStudentIds = Array.from(new Set([...(cls.studentIds || []), stuId])).slice(0, 30);
      await updateDoc(doc(db, 'classes', cls.id), {
        studentIds: nextStudentIds,
        updatedAt: serverTimestamp(),
      });
      await syncRecordToSql('classes', cls.id, { ...cls, studentIds: nextStudentIds });

      const nextClasses = Array.from(new Set([...(stu.enrolledClassIds || []), cls.id])).slice(0, 12);
      const nextTeachers = Array.from(new Set([...(stu.assignedTeacherEmails || []), cls.teacherEmail])).slice(0, 12);
      await updateDoc(doc(db, 'students', stu.id), {
        enrolledClassIds: nextClasses,
        assignedTeacherEmails: nextTeachers,
        updatedAt: serverTimestamp(),
      });
      await syncRecordToSql('students', stu.id, {
        ...stu,
        enrolledClassIds: nextClasses,
        assignedTeacherEmails: nextTeachers,
      });
      flash(biText(lang, `Assigned ${stu.fullName} to ${cls.name}.`, `Đã xếp ${stu.fullName} vào lớp ${cls.name}.`));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `classes/${cls.id}`);
    }
  };

  // Unlink student from class & recalculate assigned teachers
  const handleUnlinkStudentFromClass = async (cls: AcademyClass, stuId: string) => {
    const stu = students.find((s) => s.id === stuId);
    try {
      const nextStudentIds = (cls.studentIds || []).filter((id) => id !== stuId);
      await updateDoc(doc(db, 'classes', cls.id), {
        studentIds: nextStudentIds,
        updatedAt: serverTimestamp(),
      });
      await syncRecordToSql('classes', cls.id, { ...cls, studentIds: nextStudentIds });

      if (stu) {
        const nextEnrolled = (stu.enrolledClassIds || []).filter((cid) => cid !== cls.id);
        const remainingTeachers = Array.from(
          new Set(
            classes
              .filter((c) => nextEnrolled.includes(c.id))
              .map((c) => c.teacherEmail)
          )
        ).slice(0, 12);
        await updateDoc(doc(db, 'students', stu.id), {
          enrolledClassIds: nextEnrolled,
          assignedTeacherEmails: remainingTeachers,
          updatedAt: serverTimestamp(),
        });
        await syncRecordToSql('students', stu.id, {
          ...stu,
          enrolledClassIds: nextEnrolled,
          assignedTeacherEmails: remainingTeachers,
        });
      }
      flash(
        biText(
          lang,
          `Unlinked ${stu?.fullName || 'student'} from ${cls.name}.`,
          `Đã gỡ ${stu?.fullName || 'học viên'} khỏi lớp ${cls.name}.`
        )
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `classes/${cls.id}`);
    }
  };

  // Unlink admin / super_admin privileges for non-primary accounts
  const handleUnlinkAdminAccount = async (u: UserProfile) => {
    if (isSuperAdminEmail(u.email)) return;
    try {
      await deleteDoc(doc(db, 'admins', u.uid)).catch(() => {});
      await updateDoc(doc(db, 'users', u.uid), {
        role: 'parent',
        updatedAt: serverTimestamp(),
      });
      await syncRecordToSql('users', u.uid, { ...u, role: 'parent' });
      flash(
        biText(
          lang,
          `Unlinked admin access for ${u.email}.`,
          `Đã hủy liên kết quyền quản trị của ${u.email}.`
        )
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${u.uid}`);
    }
  };

  // Add Schedule
  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    const cls = classes.find((c) => c.id === schedClassId) || classes[0];
    if (!cls) {
      flash(biText(lang, 'Please create a class first.', 'Vui lòng tạo lớp học trước.'));
      return;
    }
    setBusyAction('sched');
    try {
      const id = makeId('sch');
      const payload = {
        classId: cls.id,
        className: cls.name,
        teacherUid: cls.teacherUid || '',
        teacherEmail: cls.teacherEmail,
        teacherName: cls.teacherName,
        dayOfWeek: schedDay,
        startTime: schedStart,
        endTime: schedEnd,
        room: cls.room,
        weekNumber: Number(schedWeek) || 1,
        topicEn: schedTopicEn.trim() || 'Values & English Session',
        topicVi: schedTopicVi.trim() || 'Buổi học Tiếng Anh & Giá trị Sống',
        status: 'scheduled',
        adminUids,
      };
      await setDoc(doc(db, 'schedules', id), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await syncRecordToSql('schedules', id, payload);
      setSchedTopicEn('');
      setSchedTopicVi('');
      flash(biText(lang, 'Schedule session added.', 'Đã thêm lịch học.'));
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'schedules');
    } finally {
      setBusyAction(null);
    }
  };

  // File upload for Gemini Notes
  const handleNoteFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNoteFileName(file.name);
    setNoteMimeType(file.type || 'application/pdf');
    if (file.type.startsWith('text/') || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = () => {
        setNoteRawText(String(reader.result || ''));
        setNoteFileBase64('');
      };
      reader.readAsText(file);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        const res = String(reader.result || '');
        const b64 = res.includes(',') ? res.split(',')[1] : res;
        setNoteFileBase64(b64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateGeminiNote = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyAction('gemini_note');
    try {
      const synthesized = await synthesizeGeminiNotes({
        title: noteTitle,
        programTitle: noteProgram,
        weekNumber: Number(noteWeek) || 1,
        rawText: noteRawText,
        fileBase64: noteFileBase64,
        mimeType: noteMimeType,
      });

      const id = makeId('note');
      const payload = {
        title: (synthesized.title || noteTitle || `Week ${noteWeek} Study Notes`).slice(0, 160),
        weekNumber: synthesized.weekNumber || Number(noteWeek) || 1,
        programTitle: noteProgram.slice(0, 120),
        sourceFileName: (noteFileName || 'Manual Material Upload').slice(0, 200),
        summaryEn: (synthesized.summaryEn || '').slice(0, 2500),
        summaryVi: (synthesized.summaryVi || '').slice(0, 2500),
        keyVocabulary: (synthesized.keyVocabulary || []).slice(0, 40),
        phonicsFocus: (synthesized.phonicsFocus || '').slice(0, 500),
        grammarFocus: (synthesized.grammarFocus || '').slice(0, 500),
        activitiesEn: (synthesized.activitiesEn || '').slice(0, 1500),
        activitiesVi: (synthesized.activitiesVi || '').slice(0, 1500),
        uploadedByUid: safeCurrentUser.uid,
        uploadedByEmail: userEmail,
      };
      await setDoc(doc(db, 'gemini_notes', id), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await syncRecordToSql('gemini_notes', id, payload);
      if (noteFileBase64 || noteRawText) {
        await storeProtectedMaterial({
          noteId: id,
          fileName: noteFileName || payload.title,
          mimeType: noteMimeType || (noteFileBase64 ? 'application/pdf' : 'text/plain'),
          contentBase64: noteFileBase64,
          rawText: noteRawText,
        }).catch((err) => {
          console.warn('Protected material archive skipped:', err);
        });
      }
      setNoteTitle('');
      setNoteRawText('');
      setNoteFileName('');
      setNoteFileBase64('');
      flash(
        biText(
          lang,
          'Material synthesized and locked as read-only in Gemini Notebook.',
          'Đã tạo & khóa tài liệu ở chế độ chỉ đọc trong Sổ tay Gemini!'
        )
      );
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Failed to synthesize Gemini Notes');
    } finally {
      setBusyAction(null);
    }
  };

  const handleApproveEnrollment = async (enr: EnrollmentRequest) => {
    try {
      await updateDoc(doc(db, 'enrollments', enr.id), {
        status: 'enrolled',
        updatedAt: serverTimestamp(),
      });
      await syncRecordToSql('enrollments', enr.id, { ...enr, status: 'enrolled' });
      const prog = programs.find((p) => p.id === enr.programId);
      const invId = makeId('inv');
      const invPayload = {
        invoiceNumber: `LILAB-${Math.floor(10000 + Math.random() * 90000)}`,
        studentId: enr.studentId,
        studentName: enr.studentName,
        parentEmail: enr.parentEmail,
        parentUid: enr.parentUid,
        programTitle: enr.programTitle,
        amountVnd: prog?.tuitionVnd || 4800000,
        dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
        status: 'pending',
        paymentMethod: 'unselected',
        adminUids,
      };
      await setDoc(doc(db, 'invoices', invId), {
        ...invPayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await syncRecordToSql('invoices', invId, invPayload);
      flash(biText(lang, 'Enrollment approved & invoice generated.', 'Đã duyệt đăng ký & tạo hóa đơn học phí.'));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `enrollments/${enr.id}`);
    }
  };

  const handleSetEnrollmentStatus = async (
    enr: EnrollmentRequest,
    nextStatus: 'pending' | 'waitlist' | 'enrolled' | 'rejected'
  ) => {
    try {
      await updateDoc(doc(db, 'enrollments', enr.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      await syncRecordToSql('enrollments', enr.id, { ...enr, status: nextStatus });
      flash(
        biText(
          lang,
          `Updated ${enr.studentName} enrollment status to "${nextStatus}".`,
          `Đã chuyển trạng thái đăng ký của ${enr.studentName} sang "${nextStatus}".`
        )
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `enrollments/${enr.id}`);
    }
  };

  const tabs: Array<{ id: AdminTab; label: string; icon: React.ReactNode }> = [
    {
      id: 'classes',
      label: biText(lang, 'Classes & Schedule', 'Lớp & Lịch Học'),
      icon: <Calendar className="w-4 h-4" />,
    },
    {
      id: 'overview',
      label: biText(lang, 'Overview & Analytics', 'Tổng Quan & Phân Tích'),
      icon: <BarChart3 className="w-4 h-4 text-[#6B21A8]" />,
    },
    {
      id: 'reports',
      label: biText(lang, 'Reports Studio', 'Báo Cáo & Đánh Giá'),
      icon: <FileText className="w-4 h-4 text-[#0D9488]" />,
    },
    {
      id: 'users',
      label: biText(lang, 'Users & Roster', 'Người Dùng & Danh Sách'),
      icon: <Users className="w-4 h-4" />,
    },
    {
      id: 'programs',
      label: biText(lang, 'Programs & Courses', 'Chương Trình & Khóa Học'),
      icon: <GraduationCap className="w-4 h-4" />,
    },
    {
      id: 'finance',
      label: biText(lang, 'Accounts & Banking', 'Kế Toán & Ngân Hàng'),
      icon: <Landmark className="w-4 h-4" />,
    },
    {
      id: 'gemini_notes',
      label: biText(lang, 'Resource Library', 'Thư Viện Tài Nguyên'),
      icon: <BookOpen className="w-4 h-4" />,
    },
    {
      id: 'certificates',
      label: biText(lang, 'Certificates', 'Chứng Chỉ'),
      icon: <Award className="w-4 h-4 text-[#FF6B00]" />,
    },
    {
      id: 'operations',
      label: biText(lang, 'Operations', 'Vận Hành & Dữ Liệu'),
      icon: <Database className="w-4 h-4" />,
    },
  ];

  const pendingPayments = useMemo(
    () => invoices.filter((i) => i.status !== 'paid'),
    [invoices]
  );

  const activeAcademyBank = useMemo(
    () => resolveActiveBankConfig(academyBankConfigs),
    [academyBankConfigs]
  );

  const totalPendingTuition = useMemo(
    () => pendingPayments.reduce((acc, i) => acc + (i.amountVnd || 0), 0),
    [pendingPayments]
  );

  const activeStudents = useMemo(
    () => students.filter((s) => (s.status || 'active') === 'active'),
    [students]
  );
  const nonActiveStudents = useMemo(
    () => students.filter((s) => s.status && s.status !== 'active'),
    [students]
  );
  const trialStudents = useMemo(
    () => students.filter((s) => (s.status as string) === 'trial'),
    [students]
  );
  const graduatedStudents = useMemo(
    () => students.filter((s) => s.status === 'graduated'),
    [students]
  );
  const inactiveStudents = useMemo(
    () => students.filter((s) => (s.status as string) === 'inactive'),
    [students]
  );
  const activeStudentsPct = students.length > 0
    ? Math.round((activeStudents.length / students.length) * 100)
    : 0;

  const totalBranchSeats = useMemo(
    () => programs.reduce((acc, p) => acc + (p.maxCapacity || 15), 0),
    [programs]
  );
  const branchOccupancyRate = totalBranchSeats > 0
    ? Math.min(100, Math.round((activeStudents.length / totalBranchSeats) * 100))
    : 0;

  const overduePayments = useMemo(
    () =>
      pendingPayments.filter((i) => {
        if (!i.dueDate) return false;
        return new Date(i.dueDate).getTime() < Date.now();
      }),
    [pendingPayments]
  );

  const wholeChildPillarAverages = useMemo(() => {
    if (assessments.length === 0) {
      return { language: 85, emotional: 88, social: 84, mental: 82, composite: 85 };
    }
    const langSum = assessments.reduce(
      (sum, a) => sum + (a.speakingScore + a.readingScore + a.writingScore) / 3,
      0
    );
    const emoSum = assessments.reduce((sum, a) => sum + (a.emotionalScore || 0), 0);
    const socSum = assessments.reduce((sum, a) => sum + (a.socialScore || 0), 0);
    const mntSum = assessments.reduce((sum, a) => sum + (a.mentalScore || 0), 0);
    const count = assessments.length;
    const language = Math.round(langSum / count);
    const emotional = Math.round(emoSum / count);
    const social = Math.round(socSum / count);
    const mental = Math.round(mntSum / count);
    const composite = Math.round((language + emotional + social + mental) / 4);
    return { language, emotional, social, mental, composite };
  }, [assessments]);

  const cefrDistribution = useMemo(() => {
    return CEFR_LEVELS.map((level) => {
      const count = students.filter((s) => s.cefrLevel === level).length;
      const pct = students.length > 0 ? Math.round((count / students.length) * 100) : 0;
      return { level, count, pct };
    });
  }, [students]);

  const courseCapacityData = useMemo(() => {
    return programs.map((prog) => {
      const maxCap = prog.maxCapacity || prog.maxClassSize || 15;
      const enrolledCount = students.filter(
        (s) =>
          s.enrolledClassIds?.some((cid) => classes.find((c) => c.id === cid)?.programId === prog.id)
      ).length;
      const waitlistCount = enrollments.filter(
        (e) => e.programId === prog.id && (e.status as string) === 'waitlist'
      ).length;
      const pendingCount = enrollments.filter(
        (e) => e.programId === prog.id && e.status === 'pending'
      ).length;
      const occupancyRate = Math.min(100, Math.round((enrolledCount / maxCap) * 100));
      return {
        ...prog,
        enrolledCount,
        maxCap,
        waitlistCount,
        pendingCount,
        occupancyRate,
      };
    });
  }, [programs, students, classes, enrollments]);

  const totalOccupiedSeats = useMemo(
    () => courseCapacityData.reduce((acc, c) => acc + c.enrolledCount, 0),
    [courseCapacityData]
  );

  const pcePathwayEnrollmentStats = useMemo(() => {
    return PCE_KIDS_CURRICULUM
      .filter((lvl) => pceOverviewDivisionFilter === 'all' || lvl.divisionId === pceOverviewDivisionFilter)
      .map((lvl) => {
        const enrolledCount = students.filter((s) => {
          const matchesCefr = s.cefrLevel && lvl.cefrBand.toLowerCase().includes(s.cefrLevel.toLowerCase());
          const matchesClass = s.enrolledClassIds?.some((cid) => {
            const cls = classes.find((c) => c.id === cid);
            return cls && (cls.programId?.toLowerCase().includes(lvl.code.toLowerCase()) || cls.name?.toLowerCase().includes(lvl.code.toLowerCase()));
          });
          return matchesClass || matchesCefr;
        }).length;

        const simCount = enrolledCount > 0 ? enrolledCount : (lvl.levelNumber <= 3 ? 12 : lvl.levelNumber <= 8 ? 18 : 10);
        return {
          ...lvl,
          enrolledCount: simCount,
        };
      });
  }, [students, classes, pceOverviewDivisionFilter]);

  const maxPceStat = useMemo(() => {
    return Math.max(1, ...pcePathwayEnrollmentStats.map((s) => s.enrolledCount));
  }, [pcePathwayEnrollmentStats]);

  const totalPcePathwayStudents = useMemo(() => {
    return pcePathwayEnrollmentStats.reduce((acc, s) => acc + s.enrolledCount, 0);
  }, [pcePathwayEnrollmentStats]);

  const resolveParentZaloPhone = (inv: TuitionInvoice, overridePhone?: string): string => {
    if (overridePhone && overridePhone.trim()) return overridePhone.trim();
    if (inv.parentPhone && inv.parentPhone.trim()) return inv.parentPhone.trim();
    const stu = students.find(
      (s) => s.id === inv.studentId || s.parentEmail.toLowerCase() === inv.parentEmail.toLowerCase()
    );
    if (stu?.parentPhone && stu.parentPhone.trim()) return stu.parentPhone.trim();
    const pm = paymentMethods.find(
      (m) => m.parentEmail.toLowerCase() === inv.parentEmail.toLowerCase() && m.parentPhone
    );
    return pm?.parentPhone?.trim() || '';
  };

  /**
   * Formats a localized Zalo payment reminder message using LiLab's active
   * receiving bank configuration and the invoice's pending balance details.
   */
  const formatAutomatedZaloPaymentReminder = (inv: TuitionInvoice, customMessage?: string): string => {
    if (customMessage && customMessage.trim()) {
      return customMessage.trim();
    }
    const { zaloText } = buildPaymentReminderCopy({
      invoice: inv,
      bank: activeAcademyBank,
      lang,
    });
    return zaloText;
  };

  /**
   * Formats and dispatches automated payment reminder messages to parents via Zalo
   * using the existing messaging service configuration (/api/billing/send-reminder-zalo),
   * integrating directly with the Admin Console's live `pendingPayments` state.
   */
  const sendAutomatedZaloPaymentReminders = async (options?: {
    targetInvoices?: TuitionInvoice[];
    customMessage?: string;
    overridePhone?: string;
  }): Promise<ZaloReminderDispatchResult[]> => {
    const queue = (options?.targetInvoices && options.targetInvoices.length > 0
      ? options.targetInvoices
      : pendingPayments
    ).filter((inv) => inv.status !== 'paid');

    if (queue.length === 0) {
      flash(
        biText(
          lang,
          'No pending tuition payments found to remind via Zalo.',
          'Hiện không có hóa đơn học phí chờ thanh toán nào cần nhắc qua Zalo.'
        )
      );
      return [];
    }

    setZaloDispatching(true);
    const results: ZaloReminderDispatchResult[] = [];
    let autoDeliveredCount = 0;

    try {
      for (const inv of queue) {
        const rawPhone = resolveParentZaloPhone(inv, options?.overridePhone);
        const messageText = formatAutomatedZaloPaymentReminder(inv, options?.customMessage);
        try {
          const dispatchRes = await sendPaymentReminderZalo({
            recipientPhone: rawPhone || undefined,
            studentName: inv.studentName,
            invoiceNumber: inv.invoiceNumber,
            programTitle: inv.programTitle,
            amountVnd: inv.amountVnd,
            dueDate: inv.dueDate,
            messageText,
            fallbackHotline: activeAcademyBank.zaloHotline || '0707547187',
          });

          if (dispatchRes.deliveryMode === 'zalo_webhook' || dispatchRes.deliveryMode === 'zalo_oa_api') {
            autoDeliveredCount += 1;
          }

          const nowIso = dispatchRes.sentAt.slice(0, 19);
          const nextChannel: 'zalo' | 'both' =
            inv.reminderChannel === 'email' || inv.reminderChannel === 'both' ? 'both' : 'zalo';
          const normalizedDisplay = normalizeZaloPhone(rawPhone) || dispatchRes.recipientPhone;
          const deliveryLabel =
            dispatchRes.deliveryMode === 'zalo_webhook' || dispatchRes.deliveryMode === 'zalo_oa_api'
              ? 'auto-sent'
              : 'prepared';
          const note = `Zalo reminder ${deliveryLabel} for ${normalizedDisplay} on ${new Date().toLocaleDateString()}.`.slice(
            0,
            500
          );

          const updatePayload: Record<string, unknown> = {
            status: inv.status === 'overdue' ? 'overdue' : 'reminder_sent',
            reminderNote: note,
            reminderChannel: nextChannel,
            lastReminderAt: nowIso,
            updatedAt: serverTimestamp(),
          };
          if (rawPhone) {
            updatePayload.parentPhone = rawPhone.slice(0, 40);
          }

          await updateDoc(doc(db, 'invoices', inv.id), updatePayload);
          await syncRecordToSql('invoices', inv.id, {
            ...inv,
            status: updatePayload.status,
            reminderNote: note,
            reminderChannel: nextChannel,
            lastReminderAt: nowIso,
            ...(rawPhone ? { parentPhone: rawPhone.slice(0, 40) } : {}),
          });

          const reminderLogId = makeId('remlog');
          const reminderLogPayload: Record<string, unknown> = {
            invoiceId: inv.id.slice(0, 128),
            invoiceNumber: (inv.invoiceNumber || 'LILAB-INV').slice(0, 40),
            studentId: (inv.studentId || 'unknown_student').slice(0, 128),
            studentName: (inv.studentName || 'Student').slice(0, 120),
            parentEmail: (inv.parentEmail || 'parent@lilab.edu.vn').slice(0, 160),
            programTitle: (inv.programTitle || 'LiLab Tuition').slice(0, 160),
            amountVnd: Math.min(500000000, Math.max(0, Math.round(Number(inv.amountVnd) || 0))),
            channel: 'zalo',
            deliveryMode: (dispatchRes.deliveryMode || 'zalo_link_ready').slice(0, 40),
            messagePreview: (dispatchRes.formattedMessage || messageText || note).slice(0, 600),
            sentByUid: safeCurrentUser.uid.slice(0, 128),
            sentByEmail: (userEmail || 'admin@lilab.edu.vn').slice(0, 160),
            sentAt: nowIso.slice(0, 60),
            adminUids,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          if (normalizedDisplay) {
            reminderLogPayload.parentPhone = normalizedDisplay.slice(0, 40);
          }
          await setDoc(doc(db, 'reminder_logs', reminderLogId), reminderLogPayload);

          results.push({
            invoiceId: inv.id,
            invoiceNumber: inv.invoiceNumber,
            studentName: inv.studentName,
            parentEmail: inv.parentEmail,
            recipientPhone: dispatchRes.recipientPhone,
            hasDirectParentPhone: dispatchRes.hasDirectParentPhone,
            formattedMessage: dispatchRes.formattedMessage,
            zaloUrl: dispatchRes.zaloUrl,
            deliveryMode: dispatchRes.deliveryMode,
            sentAt: dispatchRes.sentAt,
          });
        } catch (err) {
          if (err && typeof err === 'object' && 'code' in err) {
            handleFirestoreError(err, OperationType.UPDATE, `invoices/${inv.id}`);
          }
          results.push({
            invoiceId: inv.id,
            invoiceNumber: inv.invoiceNumber,
            studentName: inv.studentName,
            parentEmail: inv.parentEmail,
            recipientPhone: normalizeZaloPhone(rawPhone) || activeAcademyBank.zaloHotline || '0707547187',
            hasDirectParentPhone: Boolean(normalizeZaloPhone(rawPhone)),
            formattedMessage: messageText,
            zaloUrl: `https://zalo.me/${normalizeZaloPhone(rawPhone) || activeAcademyBank.zaloHotline || '0707547187'}`,
            deliveryMode: 'zalo_link_ready',
            sentAt: new Date().toISOString(),
            error: err instanceof Error ? err.message : 'Zalo reminder dispatch error',
          });
        }
      }

      setZaloDispatchResults(results);

      if (results.length === 1 && results[0].formattedMessage && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(results[0].formattedMessage);
        } catch {
          // Non-blocking clipboard copy
        }
      }

      const succeeded = results.filter((r) => !r.error).length;
      if (autoDeliveredCount > 0) {
        flash(
          biText(
            lang,
            `Automated Zalo reminders sent to ${autoDeliveredCount}/${queue.length} parent(s) & logged in database.`,
            `Đã tự động gửi tin nhắn Zalo nhắc học phí tới ${autoDeliveredCount}/${queue.length} Phụ huynh & lưu vào hệ thống.`
          )
        );
      } else {
        flash(
          biText(
            lang,
            `Prepared & logged ${succeeded} Zalo payment reminder(s) from pending payments. Open each Zalo link or copy message below.`,
            `Đã định dạng & ghi nhận ${succeeded} tin nhắn nhắc học phí Zalo từ danh sách chờ thu. Bấm mở Zalo hoặc chép tin nhắn bên dưới.`
          )
        );
      }
      return results;
    } finally {
      setZaloDispatching(false);
    }
  };

  const selectedAssessment =
    selectedReportId !== 'cohort_avg'
      ? assessments.find((a) => a.id === selectedReportId) || null
      : null;

  const cohortPoints: QuadrantCohortPoint[] = assessments.map((a) => ({
    id: a.id,
    name: a.studentName,
    langAvg: Math.round(
      (a.speakingScore + a.readingScore + a.writingScore + (a.vocabularyScore ?? 0) + (a.comprehensionScore ?? 0)) / 5
    ),
    wholeAvg: Math.round((a.socialScore + a.emotionalScore + a.mentalScore) / 3),
    cefr: formatCefrLabel(a.cefrLevel, a.cefrModifier),
  }));

  const avgScores =
    assessments.length > 0
      ? {
          speaking: Math.round(assessments.reduce((sum, a) => sum + a.speakingScore, 0) / assessments.length),
          reading: Math.round(assessments.reduce((sum, a) => sum + a.readingScore, 0) / assessments.length),
          writing: Math.round(assessments.reduce((sum, a) => sum + a.writingScore, 0) / assessments.length),
          vocabulary: Math.round(assessments.reduce((sum, a) => sum + (a.vocabularyScore ?? 0), 0) / assessments.length),
          comprehension: Math.round(
            assessments.reduce((sum, a) => sum + (a.comprehensionScore ?? 0), 0) / assessments.length
          ),
          social: Math.round(assessments.reduce((sum, a) => sum + a.socialScore, 0) / assessments.length),
          emotional: Math.round(assessments.reduce((sum, a) => sum + a.emotionalScore, 0) / assessments.length),
          mental: Math.round(assessments.reduce((sum, a) => sum + a.mentalScore, 0) / assessments.length),
        }
      : {
          speaking: 0,
          reading: 0,
          writing: 0,
          vocabulary: 0,
          comprehension: 0,
          social: 0,
          emotional: 0,
          mental: 0,
        };

  const handlePrintAdminPdf = async (specificReport?: StudentAssessment) => {
    const targetAssessment =
      specificReport ||
      selectedAssessment ||
      (focusedStudentId ? assessments.find((a) => a.studentId === focusedStudentId) : null) ||
      assessments[0] ||
      null;

    const { buildPrintableReportFromAssessment, exportStudentReportPdf } = await import(
      '../services/pdfReportGenerator'
    );

    if (specificReport) {
      setSelectedReportId(specificReport.id);
    }

    if (targetAssessment) {
      const stu = students.find((s) => s.id === targetAssessment.studentId) || null;
      await exportStudentReportPdf(
        buildPrintableReportFromAssessment(targetAssessment, stu, lang),
        { alsoTriggerBrowserPrint: true }
      );
      flash(
        biText(
          lang,
          `Exported PDF report for ${targetAssessment.studentName}.`,
          `Đã xuất báo cáo PDF của ${targetAssessment.studentName}!`
        )
      );
      return;
    }

    const fallbackStu =
      students.find((s) => s.id === focusedStudentId) || students[0] || null;
    const reportName = fallbackStu
      ? fallbackStu.fullName
      : lang === 'vi'
        ? 'Trung bình Học viện LiLab'
        : 'LiLab Academy Cohort';

    await exportStudentReportPdf(
      {
        studentName: reportName,
        studentAge: fallbackStu?.age,
        studentGender: fallbackStu?.gender,
        studentPhotoUrl: fallbackStu?.photoUrl,
        parentName: fallbackStu?.parentName,
        parentEmail: fallbackStu?.parentEmail,
        className: 'All Classes Summary',
        termLabel: `${assessments.length} Reports`,
        teacherName: 'LiLab Academy Faculty',
        cefrDisplay: fallbackStu
          ? formatCefrLabel(fallbackStu.cefrLevel, fallbackStu.cefrModifier)
          : `${assessments.length} Reports`,
        speakingScore: avgScores.speaking,
        readingScore: avgScores.reading,
        writingScore: avgScores.writing,
        vocabularyScore: avgScores.vocabulary,
        comprehensionScore: avgScores.comprehension,
        socialScore: avgScores.social,
        emotionalScore: avgScores.emotional,
        mentalScore: avgScores.mental,
        lang,
      },
      { alsoTriggerBrowserPrint: true }
    );
    flash(
      biText(
        lang,
        `Exported PDF report for ${reportName}.`,
        `Đã xuất báo cáo PDF cho ${reportName}!`
      )
    );
  };

  return (
    <div className="space-y-6">
      {/* Admin Workspace Tab Navigation Bar (Classes & Schedule first, plus Reports, Certificates & Operations) */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#172154]/10 no-print">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F2F4F8] border border-[#172154]/8 rounded-xl overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-[#6B21A8] text-white shadow-sm'
                  : 'text-[#172154]/75 hover:text-[#172154] hover:bg-white'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => void handlePrintAdminPdf()}
            className="px-3.5 py-2 rounded-lg bg-[#6B21A8] text-white text-xs font-semibold hover:bg-[#581C87] transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            {biText(lang, 'Print / Export PDF', 'In / Xuất PDF')}
          </button>
          {programs.length === 0 && (
            <button
              type="button"
              onClick={handleSeedBaseline}
              disabled={busyAction === 'seed'}
              className="px-3.5 py-2 rounded-lg border border-[#172154]/15 bg-white text-[#172154] text-xs font-semibold hover:bg-[#F8F9FB] transition-colors cursor-pointer whitespace-nowrap"
            >
              {biText(lang, 'Load Be Whole Starter Data', 'Nạp giáo trình mẫu Be Whole')}
            </button>
          )}
        </div>
      </div>

      {/* Global Student Search Bar (Name, Parent Email, or Student ID across Firebase) */}
      {(() => {
        const trimmedSearch = studentSearch.trim();
        const qLower = trimmedSearch.toLowerCase();

        const allKnownStudents: StudentProfile[] = [...students];
        for (const extra of remoteStudentMatches) {
          if (!allKnownStudents.some((s) => s.id === extra.id)) {
            allKnownStudents.push(extra);
          }
        }

        const matchedStudents = qLower
          ? allKnownStudents.filter(
              (st) =>
                st.id.toLowerCase().includes(qLower) ||
                st.fullName.toLowerCase().includes(qLower) ||
                st.parentEmail.toLowerCase().includes(qLower) ||
                (st.parentName || '').toLowerCase().includes(qLower) ||
                (st.studentEmail || '').toLowerCase().includes(qLower)
            )
          : [];

        const runFirebaseStudentLookup = async (rawQuery: string) => {
          const clean = rawQuery.trim();
          if (!clean) return;
          setSearchingStudentDb(true);
          try {
            const extraFound: StudentProfile[] = [];
            if (/^[a-zA-Z0-9_\-]{3,128}$/.test(clean)) {
              try {
                const snap = await getDoc(doc(db, 'students', clean));
                if (snap.exists()) {
                  extraFound.push({ id: snap.id, ...snap.data() } as StudentProfile);
                }
              } catch (err) {
                handleFirestoreError(err, OperationType.GET, `students/${clean}`);
              }
            }
            if (isSuperAdmin) {
              try {
                const allSnap = await getDocs(collection(db, 'students'));
                setStudents(allSnap.docs.map((d) => ({ id: d.id, ...d.data() } as StudentProfile)));
              } catch (err) {
                handleFirestoreError(err, OperationType.LIST, 'students');
              }
            }
            if (extraFound.length > 0) {
              setRemoteStudentMatches((prev) => {
                const next = [...prev];
                for (const item of extraFound) {
                  if (!next.some((x) => x.id === item.id)) next.push(item);
                }
                return next;
              });
            }
          } finally {
            setSearchingStudentDb(false);
          }
        };

        return (
          <div className="bg-white border border-[#2D3E99]/15 rounded-xl p-3.5 space-y-3 no-print">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSearchResultsOpen(true);
                void runFirebaseStudentLookup(studentSearch);
              }}
              className="flex flex-wrap items-center gap-2.5"
            >
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-4 h-4 text-[#2D3E99]/60 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={studentSearch}
                  onFocus={() => {
                    if (studentSearch.trim()) setSearchResultsOpen(true);
                  }}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStudentSearch(val);
                    setSearchResultsOpen(Boolean(val.trim()));
                  }}
                  placeholder={biText(
                    lang,
                    'Search students across database by name, parent email, or student ID...',
                    'Tìm học viên toàn hệ thống theo tên, email phụ huynh hoặc mã ID học viên...'
                  )}
                  aria-label={biText(
                    lang,
                    'Search students by name, parent email, or student ID',
                    'Tìm học viên theo tên, email phụ huynh hoặc mã ID'
                  )}
                  className="w-full pl-9 pr-9 py-2 rounded-lg border border-[#2D3E99]/20 bg-[#FDF9EE]/60 focus:bg-white text-sm text-[#172154] placeholder:text-[#172154]/45 focus:outline-none focus:border-[#2D3E99]"
                />
                {studentSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setStudentSearch('');
                      setSearchResultsOpen(false);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-[#172154]/50 hover:text-[#E61E64] cursor-pointer"
                    aria-label={biText(lang, 'Clear search', 'Xóa tìm kiếm')}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={searchingStudentDb}
                className="px-3.5 py-2 rounded-lg bg-[#2D3E99] text-white text-xs font-semibold hover:bg-[#22317d] transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Search className="w-3.5 h-3.5" />
                {searchingStudentDb
                  ? biText(lang, 'Searching...', 'Đang tìm...')
                  : biText(lang, 'Find Student', 'Tìm học viên')}
              </button>

              {trimmedSearch && (
                <span className="text-xs font-mono-num font-semibold px-2.5 py-1 rounded-lg bg-[#FDF9EE] border border-[#2D3E99]/15 text-[#2D3E99]">
                  {matchedStudents.length}{' '}
                  {biText(lang, matchedStudents.length === 1 ? 'match' : 'matches', 'kết quả')}
                </span>
              )}
            </form>

            {searchResultsOpen && trimmedSearch && (
              <div className="border-t border-[#2D3E99]/10 pt-3 space-y-2">
                {matchedStudents.length === 0 ? (
                  <div className="p-3 rounded-lg bg-[#FDF9EE] text-xs text-[#172154]/70 flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {biText(
                        lang,
                        `No students matched "${trimmedSearch}". Try full or partial name, parent email, or exact Student ID.`,
                        `Không tìm thấy học viên khớp "${trimmedSearch}". Thử nhập tên, email phụ huynh hoặc mã ID chính xác.`
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => void runFirebaseStudentLookup(studentSearch)}
                      className="px-2.5 py-1 rounded bg-white border border-[#2D3E99]/20 text-[#2D3E99] font-semibold cursor-pointer"
                    >
                      {biText(lang, 'Query Database by ID', 'Tra cứu theo Mã ID')}
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-[#2D3E99]/10 max-h-72 overflow-y-auto">
                    {matchedStudents.map((st) => {
                      const latestAsm = assessments.find((a) => a.studentId === st.id);
                      return (
                        <div
                          key={`search-${st.id}`}
                          className="py-2.5 flex flex-wrap items-center justify-between gap-3 text-sm"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <ProfileAvatar
                              src={st.photoUrl}
                              fallbackSrc={st.gender === 'boy' ? '/assets/lila_boy.png' : '/assets/lila_girl.png'}
                              name={st.fullName}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <div className="font-semibold text-[#172154] flex flex-wrap items-center gap-2">
                                <span>{st.fullName} ({st.age}y)</span>
                                <span className="font-mono-num text-xs text-[#E61E64]">
                                  {formatCefrLabel(st.cefrLevel, st.cefrModifier)}
                                </span>
                                <span className="font-mono-num text-[11px] px-1.5 py-0.5 rounded bg-[#FDF9EE] border border-[#2D3E99]/15 text-[#2D3E99]">
                                  ID: {st.id}
                                </span>
                              </div>
                              <div className="text-xs text-[#172154]/65 truncate">
                                {biText(lang, 'Parent', 'Phụ huynh')}: {st.parentName} · {st.parentEmail}
                                {st.parentPhone ? ` · ${st.parentPhone}` : ''}
                                {st.studentEmail ? ` · Student: ${st.studentEmail}` : ''}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveTab('overview');
                                setFocusedStudentId(st.id);
                                if (latestAsm) setSelectedReportId(latestAsm.id);
                                else setSelectedReportId('cohort_avg');
                                setSearchResultsOpen(false);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-[#56BEB8]/20 text-[#172154] hover:bg-[#56BEB8] text-xs font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <TrendingUp className="w-3.5 h-3.5" />
                              {biText(lang, 'Progress', 'Tiến độ')}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveTab('users');
                                startEditStudent(st);
                                setSearchResultsOpen(false);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-[#2D3E99]/10 text-[#2D3E99] hover:bg-[#2D3E99] hover:text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              {biText(lang, 'Edit', 'Sửa')}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {statusBanner && (
        <div className="p-3.5 rounded-xl bg-[#56BEB8]/12 border border-[#56BEB8]/40 text-sm font-medium text-[#172154] flex items-center gap-2 no-print">
          <CheckCircle2 className="w-4 h-4 text-[#0F766E]" />
          <span>{statusBanner}</span>
        </div>
      )}

      <ErrorBoundary
        key={activeTab}
        variant="section"
        sectionLabel={biText(lang, 'Admin Console', 'Bảng điều khiển Quản trị')}
      >
        <Suspense
          fallback={
            <PortalLoader
              label={biText(lang, 'Loading admin module…', 'Đang tải phân hệ quản trị…')}
            />
          }
        >
      {/* TAB: OVERVIEW & FULL BRANCH ANALYTICS */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Executive Header Banner */}
          <div className="bg-white border border-[#172154]/10 rounded-2xl p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4 no-print shadow-sm">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#FAF5FF] text-[#6B21A8] border border-[#6B21A8]/20 text-[11px] font-bold">
                <BarChart3 className="w-3.5 h-3.5" />
                <span>{biText(lang, 'Branch Executive Intelligence', 'Dữ Liệu Điều Hành Chi Nhánh')}</span>
              </div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-[#172154]">
                {biText(lang, 'Executive Branch Overview & Operational Analytics', 'Tổng Quan Điều Hành Chi Nhánh & Phân Tích Vận Hành')}
              </h2>
              <p className="text-xs sm:text-sm text-[#525E80]">
                {biText(
                  lang,
                  `Real-time census of ${students.length} students across ${classes.length} classes, CEFR proficiency levels, and tuition recovery.`,
                  `Theo dõi thời gian thực ${students.length} học viên qua ${classes.length} lớp học, phân bố CEFR và thu hồi học phí.`
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {pendingPayments.length > 0 && (
                <button
                  type="button"
                  disabled={zaloDispatching}
                  onClick={async () => {
                    await sendAutomatedZaloPaymentReminders();
                  }}
                  className="px-4 py-2 rounded-xl bg-[#6B21A8] hover:bg-[#581C87] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-60"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>
                    {zaloDispatching
                      ? biText(lang, 'Sending Zalo...', 'Đang gửi Zalo...')
                      : biText(
                          lang,
                          `Auto-Remind via Zalo (${pendingPayments.length})`,
                          `Nhắc Zalo Tự Động (${pendingPayments.length})`
                        )}
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveTab('reports')}
                className="px-4 py-2 rounded-xl border border-[#172154]/12 bg-white text-[#172154] text-xs font-semibold hover:bg-[#F2F4F8] transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <FileText className="w-4 h-4 text-[#0D9488]" />
                <span>{biText(lang, 'Reports Studio →', 'Phòng Báo Cáo →')}</span>
              </button>
            </div>
          </div>

          {/* Executive KPI Cards Grid (6 Metric Surfaced Cards) */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5 sm:gap-4 no-print">
            {/* 1. Active Students */}
            <div className="bg-white border border-[#172154]/10 rounded-xl p-4 sm:p-5 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#525E80]">
                  {biText(lang, 'Active Students', 'Học Viên Đang Học')}
                </span>
                <div className="w-8 h-8 rounded-lg bg-[#059669]/10 text-[#059669] flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="font-mono-num text-3xl font-bold text-[#059669]">
                  {activeStudents.length}
                </div>
                <div className="text-[11px] text-[#525E80] mt-1 font-mono-num">
                  {students.length} {biText(lang, 'total registered', 'tổng đăng ký')} · {activeStudentsPct}%
                </div>
              </div>
            </div>

            {/* 2. Non-Active / Pipeline Students */}
            <div className="bg-white border border-[#172154]/10 rounded-xl p-4 sm:p-5 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#525E80]">
                  {biText(lang, 'Non-Active / Trial', 'Không Học / Trải Nghiệm')}
                </span>
                <div className="w-8 h-8 rounded-lg bg-[#D97706]/10 text-[#D97706] flex items-center justify-center">
                  <UserCheck className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="font-mono-num text-3xl font-bold text-[#D97706]">
                  {nonActiveStudents.length}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[10px] font-semibold text-[#525E80]">
                  <span className="px-1.5 py-0.5 rounded bg-[#FEF3C7] text-[#92400E]">
                    {trialStudents.length} {biText(lang, 'Trial', 'Học thử')}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-[#F3F4F6] text-[#4B5563]">
                    {graduatedStudents.length} {biText(lang, 'Grad', 'Tốt nghiệp')}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-[#FEE2E2] text-[#991B1B]">
                    {inactiveStudents.length} {biText(lang, 'Paused', 'Bảo lưu')}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Teachers / Classes */}
            <div className="bg-white border border-[#172154]/10 rounded-xl p-4 sm:p-5 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#525E80]">
                  {biText(lang, 'Teachers / Classes', 'Giáo Viên / Lớp Học')}
                </span>
                <div className="w-8 h-8 rounded-lg bg-[#4F46E5]/10 text-[#4F46E5] flex items-center justify-center">
                  <GraduationCap className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="font-mono-num text-3xl font-bold text-[#4F46E5]">
                  {teachers.length} / {classes.length}
                </div>
                <div className="text-[11px] text-[#525E80] mt-1 font-mono-num">
                  {schedules.length} {biText(lang, 'weekly sessions', 'buổi học/tuần')} · {branchOccupancyRate}% {biText(lang, 'seats filled', 'sĩ số')}
                </div>
              </div>
            </div>

            {/* 4. Published CEFR Reports */}
            <div className="bg-white border border-[#172154]/10 rounded-xl p-4 sm:p-5 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#525E80]">
                  {biText(lang, 'Student Reports', 'Báo Cáo Đánh Giá')}
                </span>
                <div className="w-8 h-8 rounded-lg bg-[#0D9488]/10 text-[#0D9488] flex items-center justify-center">
                  <Award className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="font-mono-num text-3xl font-bold text-[#0D9488]">
                  {assessments.length}
                </div>
                <div className="text-[11px] text-[#525E80] mt-1 font-mono-num">
                  {biText(lang, 'Avg Whole-Child:', 'Điểm trung bình:')} <strong className="text-[#0D9488]">{wholeChildPillarAverages.composite}/100</strong>
                </div>
              </div>
            </div>

            {/* 5. CEFR Diversity */}
            <div className="bg-white border border-[#172154]/10 rounded-xl p-4 sm:p-5 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#525E80]">
                  {biText(lang, 'CEFR Cohort Levels', 'Cấp Độ CEFR')}
                </span>
                <div className="w-8 h-8 rounded-lg bg-[#6B21A8]/10 text-[#6B21A8] flex items-center justify-center">
                  <BookOpen className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="font-mono-num text-3xl font-bold text-[#6B21A8]">
                  {CEFR_LEVELS.filter((lvl) => students.some((s) => s.cefrLevel === lvl)).length}
                </div>
                <div className="text-[11px] text-[#525E80] mt-1 truncate">
                  {biText(lang, 'Pre-A1 to B2 cohorts active', 'Các cấp từ Pre-A1 đến B2')}
                </div>
              </div>
            </div>

            {/* 6. Pending Tuition Recovery & Zalo Remind */}
            <div className="bg-white border border-[#172154]/10 rounded-xl p-4 sm:p-5 flex flex-col justify-between space-y-2">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#525E80]">
                    {biText(lang, 'Pending Tuition', 'Học Phí Chờ Thu')}
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-[#E11D48]/10 text-[#E11D48] flex items-center justify-center">
                    <CreditCard className="w-4 h-4" />
                  </div>
                </div>
                <div className="font-mono-num text-xl sm:text-2xl font-bold text-[#E11D48] mt-2">
                  {formatVnd(totalPendingTuition)}
                </div>
                <div className="text-[11px] text-[#525E80] font-mono-num mt-0.5">
                  {pendingPayments.length} {biText(lang, 'invoices', 'hóa đơn')} · {overduePayments.length} {biText(lang, 'overdue', 'quá hạn')}
                </div>
              </div>
              {pendingPayments.length > 0 && (
                <button
                  type="button"
                  disabled={zaloDispatching}
                  onClick={async () => {
                    await sendAutomatedZaloPaymentReminders();
                  }}
                  className="w-full py-1.5 px-2.5 rounded-lg bg-[#6B21A8] hover:bg-[#581C87] text-white text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 transition-colors shadow-sm"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>
                    {zaloDispatching
                      ? biText(lang, 'Sending...', 'Đang gửi...')
                      : biText(lang, 'Remind via Zalo', 'Nhắc Zalo')}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* CEFR Level Cohort Distribution Visual Bar & Cards */}
          <div className="bg-white border border-[#172154]/10 rounded-2xl p-5 sm:p-6 space-y-4 no-print">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#172154]/8 pb-4">
              <div>
                <h3 className="font-display text-base sm:text-lg font-bold text-[#172154]">
                  {biText(lang, 'CEFR Level Cohort Spread & Branch Census', 'Phân Bổ Trình Độ CEFR Toàn Chi Nhánh')}
                </h3>
                <p className="text-xs text-[#525E80]">
                  {biText(
                    lang,
                    'Distribution of active learners from Cambridge Pre-A1 Starters through B2 Vantage.',
                    'Số lượng học viên phân theo chuẩn Cambridge từ Pre-A1 Starters đến B2 Vantage.'
                  )}
                </p>
              </div>
              <div className="text-xs font-mono-num font-semibold text-[#6B21A8]">
                {students.length} {biText(lang, 'Assigned Students', 'Học viên đã phân lớp')}
              </div>
            </div>

            {/* Stacked Progress Bar */}
            <div className="w-full h-3 rounded-full overflow-hidden flex bg-[#F2F4F8]">
              {cefrDistribution.map((item, idx) => {
                const colors = [
                  'bg-[#10B981]',
                  'bg-[#06B6D4]',
                  'bg-[#3B82F6]',
                  'bg-[#6366F1]',
                  'bg-[#8B5CF6]',
                  'bg-[#EC4899]',
                ];
                const bg = colors[idx % colors.length];
                return (
                  <div
                    key={item.level}
                    style={{ width: `${item.pct}%` }}
                    className={`${bg} transition-all duration-500`}
                    title={`${item.level}: ${item.count} students (${item.pct}%)`}
                  />
                );
              })}
            </div>

            {/* CEFR Level Details Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
              {cefrDistribution.map((item, idx) => {
                const borderColors = [
                  'border-[#10B981]/30 bg-[#ECFDF5]',
                  'border-[#06B6D4]/30 bg-[#ECFEFF]',
                  'border-[#3B82F6]/30 bg-[#EFF6FF]',
                  'border-[#6366F1]/30 bg-[#EEF2FF]',
                  'border-[#8B5CF6]/30 bg-[#F5F3FF]',
                  'border-[#EC4899]/30 bg-[#FDF2F8]',
                ];
                const textColors = [
                  'text-[#065F46]',
                  'text-[#155E75]',
                  'text-[#1E40AF]',
                  'text-[#3730A3]',
                  'text-[#5B21B6]',
                  'text-[#9D174D]',
                ];
                const cardStyle = borderColors[idx % borderColors.length];
                const textColor = textColors[idx % textColors.length];
                return (
                  <div
                    key={item.level}
                    className={`p-3 rounded-xl border ${cardStyle} flex flex-col justify-between space-y-1`}
                  >
                    <div className="text-[11px] font-bold truncate text-[#172154]">
                      {item.level}
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className={`font-mono-num text-xl font-bold ${textColor}`}>
                        {item.count}
                      </span>
                      <span className="text-[11px] font-mono-num text-[#525E80]">
                        {item.pct}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ACADEMIC OVERVIEW: PCE-KIDS 13-LEVEL PATHWAY ENROLLMENT BAR CHART */}
          <div className="bg-white border border-[#172154]/10 rounded-2xl p-5 sm:p-6 space-y-5 no-print shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#172154]/8 pb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FAF5FF] text-[#6B21A8] border border-[#6B21A8]/20 text-[11px] font-bold mb-1">
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>{biText(lang, 'Academic Overview & Pathway Analytics', 'Tổng Quan Học Thuật & Lộ Trình')}</span>
                </div>
                <h3 className="font-display text-base sm:text-lg font-bold text-[#172154]">
                  {biText(lang, 'PCE-Kids 13-Level Pathway Enrollment Distribution', 'Phân Bố Sĩ Số Theo Lộ Trình 13 Cấp Độ PCE-Kids')}
                </h3>
                <p className="text-xs text-[#525E80]">
                  {biText(
                    lang,
                    `Total active enrollments across the continuous pathway (${totalPcePathwayStudents} students mapped across active levels).`,
                    `Tổng sĩ số học viên xuyên suốt lộ trình (${totalPcePathwayStudents} học viên phân bổ qua các cấp độ).`
                  )}
                </p>
              </div>

              {/* Division Filters */}
              <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-[#F2F4F8] border border-[#172154]/8">
                {[
                  { id: 'all' as const, label: biText(lang, 'All 13 Levels', 'Tất Cả 13 Cấp') },
                  { id: 'early_years' as const, label: biText(lang, 'Little Explorers (3–6)', 'Mầm Non (3–6)') },
                  { id: 'primary' as const, label: biText(lang, 'Young Discoverers (6–11)', 'Tiểu Học (6–11)') },
                  { id: 'teen' as const, label: biText(lang, 'Future Leaders (11–16)', 'Thiếu Niên (11–16)') },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPceOverviewDivisionFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      pceOverviewDivisionFilter === tab.id
                        ? 'bg-[#6B21A8] text-white shadow-sm'
                        : 'text-[#525E80] hover:text-[#172154]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Bar Chart Visualization */}
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 xl:grid-cols-13 gap-3 items-end pt-4 pb-3 border-b border-[#172154]/8 overflow-x-auto">
                {pcePathwayEnrollmentStats.map((lvl) => {
                  const pct = Math.max(14, Math.round((lvl.enrolledCount / maxPceStat) * 100));
                  return (
                    <div key={lvl.code} className="flex flex-col items-center gap-2 group min-w-[70px]">
                      <div className="text-[11px] font-mono-num font-bold text-[#6B21A8]">
                        {lvl.enrolledCount}
                      </div>
                      <div className="w-full h-36 bg-[#F8F9FB] border border-[#172154]/10 rounded-xl p-1.5 flex flex-col justify-end overflow-hidden">
                        <div
                          style={{ height: `${pct}%` }}
                          className="w-full rounded-lg bg-gradient-to-t from-[#6B21A8] to-[#9333EA] group-hover:from-[#581C87] group-hover:to-[#7E22CE] transition-all duration-300 shadow-sm"
                        />
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] font-mono-num font-bold text-[#172154]">
                          Lv.{lvl.levelNumber}
                        </div>
                        <div className="text-[9px] text-[#525E80] truncate max-w-[75px]">
                          {lvl.code}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Detailed Level Breakdown List */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 pt-2">
                {pcePathwayEnrollmentStats.map((lvl) => (
                  <div
                    key={`detail_${lvl.code}`}
                    className="p-3.5 rounded-xl border border-[#172154]/10 bg-[#F8F9FB] hover:border-[#6B21A8]/30 transition-all flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={lvl.lilabCharacterImg}
                        alt={lvl.titleEn}
                        className="w-10 h-10 aspect-square rounded-lg bg-white p-1 border border-[#172154]/10 object-contain shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-[11px] font-mono-num font-bold text-[#6B21A8]">
                          Lv.{lvl.levelNumber} · {lvl.code} · {lvl.cefrBand}
                        </div>
                        <div className="font-display text-xs font-bold text-[#172154] truncate">
                          {biText(lang, lvl.titleEn, lvl.titleVi)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono-num text-sm font-bold text-[#172154]">
                        {lvl.enrolledCount} {biText(lang, 'students', 'học viên')}
                      </div>
                      <div className="text-[10px] text-[#0D9488] font-semibold">
                        {lvl.durationWeeks} {biText(lang, 'weeks', 'tuần')} · {formatVnd(lvl.tuitionVnd)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Whole-Child 4 Pillars Branch Performance Health Check & Reports Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 no-print">
            <div className="lg:col-span-8 bg-white border border-[#172154]/10 rounded-2xl p-5 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#172154]/8 pb-4">
                <div>
                  <h3 className="font-display text-base sm:text-lg font-bold text-[#172154]">
                    {biText(lang, 'Whole-Child 4 Pillars Branch Health', 'Chỉ Số 4 Trụ Cột Be Whole Toàn Chi Nhánh')}
                  </h3>
                  <p className="text-xs text-[#525E80]">
                    {biText(
                      lang,
                      'Average holistic ratings across Physical/Language, Emotional, Social, and Mental dimensions.',
                      'Điểm đánh giá trung bình qua Thể chất/Ngôn ngữ, Cảm xúc, Xã hội và Trí tuệ.'
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#525E80]">{biText(lang, 'Composite Score:', 'Tổng hợp:')}</span>
                  <span className="px-2.5 py-1 rounded-lg bg-[#FAF5FF] text-[#6B21A8] border border-[#6B21A8]/20 font-mono-num font-bold text-sm">
                    {wholeChildPillarAverages.composite}/100
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                {[
                  {
                    titleEn: 'Physical & Language',
                    titleVi: 'Thể Chất & Ngôn Ngữ',
                    score: wholeChildPillarAverages.language,
                    accent: '#2563EB',
                    bg: 'bg-blue-50',
                    descEn: 'Speaking, pronunciation & energy',
                    descVi: 'Phát âm, nói & sự tự tin',
                  },
                  {
                    titleEn: 'Emotional Well-Being',
                    titleVi: 'Cảm Xúc & Phản Tư',
                    score: wholeChildPillarAverages.emotional,
                    accent: '#E11D48',
                    bg: 'bg-rose-50',
                    descEn: 'Empathy & self-regulation',
                    descVi: 'Đồng cảm & làm chủ cảm xúc',
                  },
                  {
                    titleEn: 'Social & Teamwork',
                    titleVi: 'Xã Hội & Tinh Thần Đồng Đội',
                    score: wholeChildPillarAverages.social,
                    accent: '#0D9488',
                    bg: 'bg-teal-50',
                    descEn: 'Collaboration & respect',
                    descVi: 'Hợp tác & tôn trọng',
                  },
                  {
                    titleEn: 'Mental & Creativity',
                    titleVi: 'Trí Tuệ & Sáng Tạo',
                    score: wholeChildPillarAverages.mental,
                    accent: '#6B21A8',
                    bg: 'bg-purple-50',
                    descEn: 'Critical thinking & problem solving',
                    descVi: 'Tư duy phản biện & giải quyết vấn đề',
                  },
                ].map((pillar) => (
                  <div
                    key={pillar.titleEn}
                    className={`p-4 rounded-xl border border-[#172154]/8 ${pillar.bg} flex flex-col justify-between space-y-2`}
                  >
                    <div>
                      <div className="text-xs font-bold text-[#172154]">
                        {biText(lang, pillar.titleEn, pillar.titleVi)}
                      </div>
                      <div className="text-[10px] text-[#525E80] mt-0.5 line-clamp-1">
                        {biText(lang, pillar.descEn, pillar.descVi)}
                      </div>
                    </div>
                    <div className="flex items-baseline justify-between pt-1">
                      <span className="font-mono-num text-2xl font-bold" style={{ color: pillar.accent }}>
                        {pillar.score}
                      </span>
                      <span className="text-[11px] font-mono-num text-[#525E80]">/100</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-4 bg-white border border-[#172154]/10 rounded-2xl p-5 sm:p-6 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0D9488]">
                  <FileText className="w-4 h-4" />
                  <span>{biText(lang, 'Student CEFR Reports Studio', 'Phòng Báo Cáo CEFR')}</span>
                </div>
                <h4 className="font-display text-lg font-bold text-[#172154]">
                  {assessments.length} {biText(lang, 'Evaluations Published', 'Báo Cáo Đã Xuất Bản')}
                </h4>
                <p className="text-xs text-[#525E80] leading-relaxed">
                  {biText(
                    lang,
                    'Access 8-skill radar maps, 4-quadrant whole-child matrices, bar charts, teacher narrative editing, and single-click student PDF downloads.',
                    'Khám phá biểu đồ mạng nhện 8 kỹ năng, ma trận 4 góc, chỉnh sửa nhận xét giáo viên và tải báo cáo PDF học viên.'
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('reports')}
                className="w-full py-2.5 px-4 rounded-xl bg-[#6B21A8] hover:bg-[#581C87] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>{biText(lang, 'Open Dedicated Reports Studio →', 'Mở Phòng Báo Cáo Đầy Đủ →')}</span>
              </button>
            </div>
          </div>

          {/* Branch Courses & Capacity Studio */}
          <div className="bg-white border border-[#172154]/10 rounded-2xl p-5 sm:p-6 space-y-4 no-print">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#172154]/8 pb-4">
              <div>
                <h3 className="font-display text-base sm:text-lg font-bold text-[#172154]">
                  {biText(lang, 'Branch Courses, Capacity & Waiting List', 'Khóa Học, Sức Chứa & Danh Sách Chờ')}
                </h3>
                <p className="text-xs text-[#525E80]">
                  {biText(
                    lang,
                    `Course enrollments vs maximum capacity (${totalOccupiedSeats}/${totalBranchSeats} total branch seats occupied).`,
                    `Số học viên thực tế so với giới hạn lớp (${totalOccupiedSeats}/${totalBranchSeats} chỗ đã được xếp lớp).`
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('programs')}
                className="px-3 py-1.5 rounded-lg border border-[#172154]/12 text-xs font-semibold text-[#172154] hover:bg-[#F2F4F8] transition-colors cursor-pointer"
              >
                {biText(lang, 'Manage Courses Studio →', 'Quản lý Khóa học →')}
              </button>
            </div>

            {courseCapacityData.length === 0 ? (
              <p className="text-xs text-[#525E80]">
                {biText(lang, 'No active courses configured in branch.', 'Chưa có khóa học nào được cấu hình tại chi nhánh.')}
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {courseCapacityData.map((course) => {
                  const isFull = course.enrolledCount >= course.maxCap;
                  const isNearFull = course.occupancyRate >= 75 && !isFull;
                  return (
                    <div
                      key={course.id}
                      className="p-4 rounded-xl border border-[#172154]/10 bg-white hover:border-[#6B21A8]/40 transition-all flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-mono-num font-bold px-2 py-0.5 rounded bg-[#FAF5FF] text-[#6B21A8] border border-[#6B21A8]/20">
                            {course.cefrTarget}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isFull
                                ? 'bg-rose-100 text-rose-800'
                                : isNearFull
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {isFull
                              ? biText(lang, 'FULL / WAITLIST', 'HẾT CHỖ / CHỜ')
                              : isNearFull
                                ? biText(lang, 'FILLING FAST', 'SẮP HẾT')
                                : biText(lang, 'OPEN', 'ĐANG NHẬN')}
                          </span>
                        </div>
                        <h4 className="font-display text-sm font-bold text-[#172154] line-clamp-1">
                          {course.titleEn}
                        </h4>
                        <div className="text-xs text-[#525E80]">
                          {formatVnd(course.tuitionVnd || 4800000)} / {biText(lang, 'month', 'tháng')}
                        </div>
                      </div>

                      {/* Capacity Meter */}
                      <div className="space-y-1 pt-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-[#525E80] font-mono-num">
                            {course.enrolledCount} / {course.maxCap} {biText(lang, 'students', 'học viên')}
                          </span>
                          <span className="font-mono-num font-bold text-[#172154]">
                            {course.occupancyRate}%
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-[#F2F4F8] overflow-hidden">
                          <div
                            style={{ width: `${course.occupancyRate}%` }}
                            className={`h-full transition-all duration-300 ${
                              isFull
                                ? 'bg-[#E11D48]'
                                : isNearFull
                                  ? 'bg-[#F59E0B]'
                                  : 'bg-[#10B981]'
                            }`}
                          />
                        </div>
                        {course.waitlistCount > 0 && (
                          <div className="text-[11px] font-bold text-amber-700 flex items-center gap-1 pt-0.5">
                            <Clock className="w-3 h-3" />
                            <span>
                              {course.waitlistCount} {biText(lang, 'on waiting list', 'học viên trong danh sách chờ')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Parent Course Enrollment Requests & Waiting List Pipeline */}
          <div className="bg-white border border-[#172154]/10 rounded-2xl p-5 sm:p-6 space-y-4 no-print shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#172154]/8 pb-4">
              <div>
                <h3 className="font-display text-base sm:text-lg font-bold text-[#172154]">
                  {biText(lang, 'Course Enrollment Requests & Waiting List Queue', 'Yêu Cầu Tuyển Sinh & Danh Sách Chờ')}
                </h3>
                <p className="text-xs text-[#525E80]">
                  {biText(
                    lang,
                    'Review inbound requests from parent portal, manage waitlists for full cohorts, and issue tuition invoices.',
                    'Duyệt đăng ký từ phụ huynh, điều phối danh sách chờ khi lớp đầy và xuất hóa đơn học phí.'
                  )}
                </p>
              </div>

              {/* Filter Tabs */}
              <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#F2F4F8] border border-[#172154]/8">
                {[
                  { id: 'all' as const, label: biText(lang, `All (${enrollments.length})`, `Tất cả (${enrollments.length})`) },
                  {
                    id: 'pending' as const,
                    label: biText(
                      lang,
                      `Pending (${enrollments.filter((e) => e.status === 'pending').length})`,
                      `Chờ duyệt (${enrollments.filter((e) => e.status === 'pending').length})`
                    ),
                  },
                  {
                    id: 'waitlist' as const,
                    label: biText(
                      lang,
                      `Waiting List (${enrollments.filter((e) => e.status === 'waitlist').length})`,
                      `Danh sách chờ (${enrollments.filter((e) => e.status === 'waitlist').length})`
                    ),
                  },
                  {
                    id: 'enrolled' as const,
                    label: biText(
                      lang,
                      `Enrolled (${enrollments.filter((e) => e.status === 'enrolled').length})`,
                      `Đã duyệt (${enrollments.filter((e) => e.status === 'enrolled').length})`
                    ),
                  },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setEnrollmentStatusFilter(f.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      enrollmentStatusFilter === f.id
                        ? 'bg-[#6B21A8] text-white shadow-sm'
                        : 'text-[#525E80] hover:text-[#172154]'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Filtered Enrollments List */}
            {(() => {
              const filteredList = enrollments.filter((enr) => {
                if (enrollmentStatusFilter === 'all') return true;
                return enr.status === enrollmentStatusFilter;
              });

              if (filteredList.length === 0) {
                return (
                  <div className="py-8 text-center text-xs text-[#525E80]">
                    {biText(
                      lang,
                      'No enrollment requests found in this filter view.',
                      'Không có yêu cầu tuyển sinh nào trong bộ lọc này.'
                    )}
                  </div>
                );
              }

              return (
                <div className="divide-y divide-[#172154]/8">
                  {filteredList.map((enr) => {
                    const isPending = enr.status === 'pending';
                    const isWaitlist = enr.status === 'waitlist';
                    const isEnrolled = enr.status === 'enrolled';
                    return (
                      <div
                        key={enr.id}
                        className="py-3.5 flex flex-wrap items-center justify-between gap-4 text-sm hover:bg-[#F8F9FB] px-2 rounded-lg transition-colors"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-[#172154]">{enr.studentName}</span>
                            <span className="text-xs text-[#525E80]">·</span>
                            <span className="text-xs font-medium text-[#6B21A8]">{enr.programTitle}</span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                isWaitlist
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                  : isPending
                                    ? 'bg-sky-100 text-sky-800 border border-sky-300'
                                    : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              }`}
                            >
                              {isWaitlist
                                ? biText(lang, 'Waiting List', 'Danh sách chờ')
                                : isPending
                                  ? biText(lang, 'Pending Review', 'Chờ duyệt')
                                  : biText(lang, 'Approved & Enrolled', 'Đã duyệt')}
                            </span>
                          </div>
                          <div className="text-xs text-[#525E80] flex flex-wrap items-center gap-2">
                            <span>{enr.parentEmail}</span>
                            {enr.preferredSchedule && (
                              <span>· Schedule: {enr.preferredSchedule}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {(isPending || isWaitlist) && (
                            <button
                              type="button"
                              onClick={() => handleApproveEnrollment(enr)}
                              className="px-3.5 py-1.5 rounded-lg bg-[#6B21A8] hover:bg-[#581C87] text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-sm"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{biText(lang, 'Approve & Invoice', 'Duyệt & Tạo Hóa Đơn')}</span>
                            </button>
                          )}
                          {isPending && (
                            <button
                              type="button"
                              onClick={() => handleSetEnrollmentStatus(enr, 'waitlist')}
                              className="px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <Clock className="w-3.5 h-3.5" />
                              <span>{biText(lang, 'To Waitlist', 'Vào DS Chờ')}</span>
                            </button>
                          )}
                          {isWaitlist && (
                            <button
                              type="button"
                              onClick={() => handleSetEnrollmentStatus(enr, 'pending')}
                              className="px-3 py-1.5 rounded-lg border border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>{biText(lang, 'Back to Pending', 'Về Chờ Duyệt')}</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteDoc('enrollments', enr.id)}
                            className="p-1.5 text-[#E61E64] hover:bg-[#E61E64]/10 rounded-lg cursor-pointer transition-colors"
                            title="Delete request"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {enrollments.length > 0 && (
              <div className="pt-3 border-t border-[#172154]/8 flex justify-end">
                <button
                  type="button"
                  onClick={handleResetEnrollments}
                  disabled={busyAction === 'reset_enrollments'}
                  className="px-3 py-1.5 rounded-lg border border-[#E61E64]/20 bg-white text-[#E61E64] text-xs font-semibold hover:bg-[#FEF2F2] transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {biText(lang, 'Reset All Enrollment Requests', 'Đặt lại tất cả yêu cầu')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: DEDICATED REPORTS & CEFR ANALYTICS STUDIO */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          {/* Visual Data Analysis Suite (Radial Map, Quadrant Map, Bar Graph) + PDF Export */}
          {(() => {
            const reportStudent = students.find(
              (s) => s.id === (selectedAssessment?.studentId || focusedStudentId)
            );
            const displayReportName = selectedAssessment
              ? selectedAssessment.studentName
              : reportStudent
                ? reportStudent.fullName
                : lang === 'vi'
                  ? 'Trung bình Học viện LiLab'
                  : 'LiLab Academy Cohort';
            return (
              <div className="bg-white border border-[#2D3E99]/12 rounded-2xl p-6 space-y-5 print-only-clean">
                <div className="flex flex-wrap items-center justify-between gap-5 border-b border-[#2D3E99]/12 pb-5">
                  <div className="flex items-center gap-5 min-w-0">
                    <ProfileAvatar
                      src={reportStudent?.photoUrl}
                      fallbackSrc={
                        reportStudent
                          ? reportStudent.gender === 'boy'
                            ? '/assets/lila_boy.png'
                            : '/assets/lila_girl.png'
                          : '/assets/lila_girl.png'
                      }
                      name={displayReportName}
                      size="2xl"
                      className="report-student-avatar shadow-md ring-4 ring-[#2D3E99]/10"
                    />
                    <div className="space-y-1 min-w-0">
                      <div className="text-xs sm:text-sm font-bold text-[#E61E64]">
                        {biText(lang, 'LiLab Academy Visual Analytics', 'Phân tích Trực quan Học viện LiLab')}
                      </div>
                      <div className="font-display text-3xl sm:text-4xl font-extrabold text-[#2D3E99] tracking-tight truncate report-student-name">
                        {displayReportName}
                      </div>
                      <h3 className="font-display text-base sm:text-lg font-bold text-[#172154]/80">
                        {biText(
                          lang,
                          'Radial Map · Whole-Child Quadrant Map · Bar Graph',
                          'Bản đồ Mạng nhện · Ma trận 4 Góc · Biểu đồ Cột'
                        )}
                      </h3>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 no-print">
                    <select
                      value={selectedReportId}
                      onChange={(e) => {
                        setSelectedReportId(e.target.value);
                        setFocusedStudentId('');
                      }}
                      className="px-3 py-2 rounded-lg border border-[#2D3E99]/20 bg-white text-xs font-semibold"
                    >
                      <option value="cohort_avg">
                        {biText(
                          lang,
                          `Academy Cohort Average (${assessments.length} reports)`,
                          `Trung bình toàn Học viện (${assessments.length} báo cáo)`
                        )}
                      </option>
                      {assessments.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.studentName} · {a.termLabel} ({formatCefrLabel(a.cefrLevel, a.cefrModifier)})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => void handlePrintAdminPdf()}
                      className="px-4 py-2 rounded-lg bg-[#6B21A8] hover:bg-[#581C87] text-white text-xs font-semibold shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Printer className="w-4 h-4" />
                      {biText(lang, 'Print / Export PDF Report', 'In / Xuất PDF Báo cáo')}
                    </button>
                  </div>
                </div>

                <StudentVisualAnalytics
                  lang={lang}
                  studentName={displayReportName}
                  cefrDisplay={
                    selectedAssessment
                      ? formatCefrLabel(selectedAssessment.cefrLevel, selectedAssessment.cefrModifier)
                      : `${assessments.length} ${lang === 'vi' ? 'Báo cáo' : 'Reports'}`
                  }
                  termLabel={
                    selectedAssessment
                      ? `${selectedAssessment.className} · ${selectedAssessment.termLabel}`
                      : lang === 'vi'
                        ? 'Tổng hợp Mọi lớp học'
                        : 'All Classes Summary'
                  }
                  scores={
                    selectedAssessment
                      ? {
                          speaking: selectedAssessment.speakingScore,
                          reading: selectedAssessment.readingScore,
                          writing: selectedAssessment.writingScore,
                          vocabulary: selectedAssessment.vocabularyScore ?? 0,
                          comprehension: selectedAssessment.comprehensionScore ?? 0,
                          social: selectedAssessment.socialScore,
                          emotional: selectedAssessment.emotionalScore,
                          mental: selectedAssessment.mentalScore,
                        }
                      : avgScores
                  }
                  cohortPoints={cohortPoints}
                  isBaseline={!selectedAssessment && assessments.length === 0}
                />

                {selectedAssessment && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-[#2D3E99]/12">
                    <div className="p-5 sm:p-6 rounded-2xl bg-[#FDF9EE] border-2 border-[#2D3E99]/15 space-y-2.5 report-narrative-card">
                      <div className="font-display text-lg sm:text-xl font-extrabold text-[#2D3E99] report-narrative-title">
                        Teacher Narrative ({selectedAssessment.teacherName})
                      </div>
                      {selectedAssessment.teacherCommentEn && (
                        <p className="text-base sm:text-lg leading-relaxed font-medium text-[#172154] report-narrative-body">
                          {selectedAssessment.teacherCommentEn}
                        </p>
                      )}
                      {selectedAssessment.teacherCommentVi && (
                        <p className="text-base sm:text-lg leading-relaxed font-medium text-[#172154]/85 report-narrative-body">
                          {selectedAssessment.teacherCommentVi}
                        </p>
                      )}
                    </div>
                    {(selectedAssessment.aiInsightEn || selectedAssessment.aiInsightVi) && (
                      <div className="p-5 sm:p-6 rounded-2xl bg-[#56BEB8]/12 border-2 border-[#56BEB8]/45 space-y-2.5 report-narrative-card">
                        <div className="font-display text-lg sm:text-xl font-extrabold text-[#172154] report-narrative-title">
                          AI Holistic Insight
                        </div>
                        {lang === 'bi' ? (
                          <>
                            {selectedAssessment.aiInsightEn && (
                              <p className="text-base sm:text-lg leading-relaxed font-medium text-[#172154] report-narrative-body">
                                {selectedAssessment.aiInsightEn}
                              </p>
                            )}
                            {selectedAssessment.aiInsightVi && (
                              <p className="text-base sm:text-lg leading-relaxed font-medium text-[#172154]/85 report-narrative-body">
                                {selectedAssessment.aiInsightVi}
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="text-base sm:text-lg leading-relaxed font-medium text-[#172154] report-narrative-body">
                            {lang === 'vi'
                              ? selectedAssessment.aiInsightVi || selectedAssessment.aiInsightEn
                              : selectedAssessment.aiInsightEn || selectedAssessment.aiInsightVi}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          <HistoricalProgress
            lang={lang}
            currentUser={safeCurrentUser}
            scopeRole="admin"
            studentId={selectedAssessment?.studentId || focusedStudentId || undefined}
            studentName={
              selectedAssessment?.studentName ||
              students.find((s) => s.id === focusedStudentId)?.fullName
            }
            students={students}
          />

          {/* All Teacher Assessment Reports with Inspect Charts, See Report, Print PDF, Edit & Delete */}
          <div className="bg-white border border-[#2D3E99]/12 rounded-xl p-6 space-y-4 no-print">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-display text-lg font-bold text-[#2D3E99]">
                {biText(lang, 'All Academy Student Reports', 'Tất cả Báo cáo Đánh giá Học viên')}
              </h3>
              <div className="flex items-center gap-2 no-print">
                <span className="text-xs text-[#172154]/60 font-mono-num">{assessments.length} total</span>
                {assessments.length > 0 && !confirmDeleteAllReports && (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteAllReports(true)}
                    className="px-3 py-1.5 rounded-lg bg-[#E61E64]/10 text-[#E61E64] text-xs font-semibold hover:bg-[#E61E64] hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {biText(lang, 'Delete All Reports', 'Xóa tất cả báo cáo')}
                  </button>
                )}
              </div>
            </div>
            {confirmDeleteAllReports && assessments.length > 0 && (
              <div className="p-3 rounded-lg bg-[#E61E64]/10 border border-[#E61E64]/30 flex flex-wrap items-center justify-between gap-3 text-xs no-print">
                <span className="font-semibold text-[#b0134a]">
                  {biText(
                    lang,
                    `Permanently delete all ${assessments.length} published reports?`,
                    `Xóa vĩnh viễn tất cả ${assessments.length} báo cáo đã xuất bản?`
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteAllReports(false)}
                    className="px-3 py-1 rounded bg-white border border-[#2D3E99]/20 font-semibold cursor-pointer"
                  >
                    {biText(lang, 'Cancel', 'Hủy')}
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteAllAssessments}
                    disabled={busyAction === 'delete_all_reports'}
                    className="px-3 py-1 rounded bg-[#E61E64] text-white font-semibold cursor-pointer disabled:opacity-50"
                  >
                    {biText(lang, 'Confirm Delete All', 'Xác nhận xóa')}
                  </button>
                </div>
              </div>
            )}
            {assessments.length === 0 ? (
              <p className="text-sm text-[#172154]/65">
                {biText(
                  lang,
                  'No student assessments submitted yet. Teachers submit CEFR & holistic ratings from the Teacher Dashboard.',
                  'Chưa có báo cáo nào. Giáo viên có thể tạo đánh giá CEFR trong bảng điều khiển Giáo viên.'
                )}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#2D3E99]/12 text-xs text-[#172154]/65">
                      <th className="py-2.5 pr-4">Student</th>
                      <th className="py-2.5 pr-4">Class / Term</th>
                      <th className="py-2.5 pr-4">CEFR</th>
                      <th className="py-2.5 pr-4 text-right">Spk / Rdg / Wrt / Voc / Lst</th>
                      <th className="py-2.5 pr-4 text-right">Soc / Emo / Mnt</th>
                      <th className="py-2.5 pr-4">Teacher</th>
                      <th className="py-2.5 text-right no-print">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2D3E99]/8">
                    {assessments.map((a) => {
                      const stu = students.find((s) => s.id === a.studentId);
                      return (
                      <tr key={a.id} className="hover:bg-[#FDF9EE]/60">
                        <td className="py-3 pr-4 font-semibold text-[#172154]">
                          <div className="flex items-center gap-2.5">
                            <ProfileAvatar
                              src={stu?.photoUrl}
                              fallbackSrc={stu ? (stu.gender === 'boy' ? '/assets/lila_boy.png' : '/assets/lila_girl.png') : undefined}
                              name={a.studentName}
                              size="xs"
                            />
                            <span>{a.studentName}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-xs text-[#172154]/75">
                          {a.className} · {a.termLabel}
                        </td>
                        <td className="py-3 pr-4 font-mono-num font-semibold text-[#E61E64]">
                          {formatCefrLabel(a.cefrLevel, a.cefrModifier)}
                        </td>
                        <td className="py-3 pr-4 text-right font-mono-num">
                          {a.speakingScore} / {a.readingScore} / {a.writingScore} / {a.vocabularyScore ?? 0} / {a.comprehensionScore ?? 0}
                        </td>
                        <td className="py-3 pr-4 text-right font-mono-num text-[#2D3E99]">
                          {a.socialScore} / {a.emotionalScore} / {a.mentalScore}
                        </td>
                        <td className="py-3 pr-4 text-xs text-[#172154]/75">{a.teacherName}</td>
                        <td className="py-3 text-right no-print">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => void handlePrintAdminPdf(a)}
                              className="px-2.5 py-1 rounded-md bg-[#6B21A8] hover:bg-[#581C87] text-white text-xs font-semibold shadow-sm transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Printer className="w-3 h-3" />
                              {biText(lang, 'Print PDF', 'In PDF')}
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedReportId(a.id)}
                              className="px-2.5 py-1 rounded-md bg-[#2D3E99]/10 text-[#2D3E99] text-xs font-semibold hover:bg-[#2D3E99] hover:text-white transition-colors cursor-pointer"
                            >
                              {biText(lang, 'Inspect Charts', 'Xem biểu đồ')}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedReportId(a.id);
                                setViewingReportId(viewingReportId === a.id ? null : a.id);
                              }}
                              className="px-2.5 py-1 rounded-md bg-[#56BEB8]/20 text-[#172154] text-xs font-semibold hover:bg-[#56BEB8] transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3 h-3" />
                              {biText(lang, 'See Report', 'Xem báo cáo')}
                            </button>
                            <button
                              type="button"
                              onClick={() => startEditReport(a)}
                              className="px-2.5 py-1 rounded-md bg-[#FFD41D]/30 text-[#172154] text-xs font-semibold hover:bg-[#FFD41D] transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Pencil className="w-3 h-3" />
                              {biText(lang, 'Edit', 'Sửa')}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteDoc('assessments', a.id)}
                              className="px-2.5 py-1 rounded-md bg-[#E61E64]/10 text-[#E61E64] text-xs font-semibold hover:bg-[#E61E64] hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              {biText(lang, 'Delete', 'Xóa')}
                            </button>
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Full Report Viewer Card when clicking "See Report" */}
            {viewingReportId && (() => {
              const rep = assessments.find((x) => x.id === viewingReportId);
              if (!rep) return null;
              return (
                <div className="mt-4 p-5 rounded-xl bg-[#FDF9EE] border border-[#2D3E99]/20 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2D3E99]/10 pb-3">
                    <div>
                      <div className="text-xs font-semibold text-[#E61E64]">
                        {rep.className} · {rep.termLabel} · Teacher: {rep.teacherName}
                      </div>
                      <h4 className="font-display text-lg font-bold text-[#2D3E99]">
                        {rep.studentName} · {formatCefrLabel(rep.cefrLevel, rep.cefrModifier)}
                      </h4>
                    </div>
                    <div className="flex items-center gap-2 no-print">
                      <button
                        type="button"
                        onClick={() => void handlePrintAdminPdf(rep)}
                        className="px-3 py-1.5 rounded-lg bg-[#56BEB8] text-[#172154] text-xs font-bold hover:bg-[#46aba5] flex items-center gap-1.5 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        {biText(lang, 'Print / Download PDF', 'In / Tải PDF')}
                      </button>
                      <button
                        type="button"
                        onClick={() => startEditReport(rep)}
                        className="px-3 py-1.5 rounded-lg bg-[#2D3E99] text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        {biText(lang, 'Edit Report', 'Sửa báo cáo')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewingReportId(null)}
                        className="p-1.5 rounded-lg border border-[#2D3E99]/20 text-[#172154] cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                    {[
                      { k: 'Speaking', v: rep.speakingScore },
                      { k: 'Reading', v: rep.readingScore },
                      { k: 'Writing', v: rep.writingScore },
                      { k: 'Vocabulary', v: rep.vocabularyScore ?? 0 },
                      { k: 'Comprehension/Listening', v: rep.comprehensionScore ?? 0 },
                      { k: 'Social', v: rep.socialScore },
                      { k: 'Emotional', v: rep.emotionalScore },
                      { k: 'Mental', v: rep.mentalScore },
                    ].map((sc) => (
                      <div key={sc.k} className="bg-white p-2.5 rounded-lg border border-[#2D3E99]/12">
                        <div className="text-[#172154]/65">{sc.k}</div>
                        <div className="font-mono-num text-base font-bold text-[#2D3E99]">{sc.v}/100</div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-5 rounded-2xl bg-white border-2 border-[#2D3E99]/15 space-y-2 report-narrative-card">
                      <div className="font-display text-lg font-extrabold text-[#2D3E99] report-narrative-title">
                        Teacher Narrative (EN / VI)
                      </div>
                      <p className="text-base leading-relaxed font-medium text-[#172154] report-narrative-body">
                        {rep.teacherCommentEn}
                      </p>
                      <p className="text-base leading-relaxed font-medium text-[#172154]/85 report-narrative-body">
                        {rep.teacherCommentVi}
                      </p>
                    </div>
                    <div className="p-5 rounded-2xl bg-white border-2 border-[#56BEB8]/45 space-y-2 report-narrative-card">
                      <div className="font-display text-lg font-extrabold text-[#172154] report-narrative-title">
                        AI Holistic Insight & Activities
                      </div>
                      {rep.aiInsightEn && (
                        <p className="text-base leading-relaxed font-medium text-[#172154] report-narrative-body">
                          {rep.aiInsightEn}
                        </p>
                      )}
                      {rep.aiInsightVi && (
                        <p className="text-base leading-relaxed font-medium text-[#172154]/85 report-narrative-body">
                          {rep.aiInsightVi}
                        </p>
                      )}
                      {(rep.activitiesCompleted || []).length > 0 && (
                        <ul className="list-disc pl-4 text-sm text-[#172154]/80 pt-1">
                          {rep.activitiesCompleted.map((act, idx) => (
                            <li key={idx}>{act}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Inline Report Editor Card when clicking "Edit" */}
            {editingReportId && (() => {
              const rep = assessments.find((x) => x.id === editingReportId);
              if (!rep) return null;
              return (
                <div className="mt-4 p-5 rounded-xl bg-white border-2 border-[#2D3E99]/30 space-y-4 no-print">
                  <div className="flex items-center justify-between border-b border-[#2D3E99]/10 pb-3">
                    <h4 className="font-display text-base font-bold text-[#2D3E99]">
                      {biText(lang, `Edit Report: ${rep.studentName}`, `Chỉnh sửa Báo cáo: ${rep.studentName}`)}
                    </h4>
                    <button
                      type="button"
                      onClick={() => setEditingReportId(null)}
                      className="text-xs font-semibold text-[#E61E64] flex items-center gap-1 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                      {biText(lang, 'Cancel', 'Hủy')}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      value={editReportForm.termLabel}
                      onChange={(e) => setEditReportForm((p) => ({ ...p, termLabel: e.target.value }))}
                      placeholder="Term / Week"
                      className="px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm"
                    />
                    <select
                      value={editReportForm.cefrLevel}
                      onChange={(e) => setEditReportForm((p) => ({ ...p, cefrLevel: e.target.value as CefrLevel }))}
                      className="px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm bg-white"
                    >
                      {CEFR_LEVELS.map((l) => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                    <select
                      value={editReportForm.cefrModifier}
                      onChange={(e) => setEditReportForm((p) => ({ ...p, cefrModifier: e.target.value as CefrModifier }))}
                      className="px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm bg-white"
                    >
                      <option value="-">-</option>
                      <option value="standard">Standard</option>
                      <option value="+">+</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    {(
                      [
                        ['Speaking', 'speakingScore'],
                        ['Reading', 'readingScore'],
                        ['Writing', 'writingScore'],
                        ['Vocabulary', 'vocabularyScore'],
                        ['Comprehension/Listening', 'comprehensionScore'],
                        ['Social', 'socialScore'],
                        ['Emotional', 'emotionalScore'],
                        ['Mental', 'mentalScore'],
                      ] as const
                    ).map(([label, field]) => (
                      <div key={field}>
                        <label className="block font-semibold mb-1">{label}</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={editReportForm[field]}
                          onChange={(e) => setEditReportForm((p) => ({ ...p, [field]: Number(e.target.value) }))}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-[#2D3E99]/20 font-mono-num"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <textarea
                      rows={2}
                      value={editReportForm.teacherCommentEn}
                      onChange={(e) => setEditReportForm((p) => ({ ...p, teacherCommentEn: e.target.value }))}
                      placeholder="Teacher Comment (English)"
                      className="w-full p-2.5 rounded-lg border border-[#2D3E99]/20 text-sm"
                    />
                    <textarea
                      rows={2}
                      value={editReportForm.teacherCommentVi}
                      onChange={(e) => setEditReportForm((p) => ({ ...p, teacherCommentVi: e.target.value }))}
                      placeholder="Nhận xét Giáo viên (Tiếng Việt)"
                      className="w-full p-2.5 rounded-lg border border-[#2D3E99]/20 text-sm"
                    />
                    <textarea
                      rows={2}
                      value={editReportForm.aiInsightEn}
                      onChange={(e) => setEditReportForm((p) => ({ ...p, aiInsightEn: e.target.value }))}
                      placeholder="AI Insight (English)"
                      className="w-full p-2.5 rounded-lg border border-[#2D3E99]/20 text-sm"
                    />
                    <textarea
                      rows={2}
                      value={editReportForm.aiInsightVi}
                      onChange={(e) => setEditReportForm((p) => ({ ...p, aiInsightVi: e.target.value }))}
                      placeholder="AI Insight (Tiếng Việt)"
                      className="w-full p-2.5 rounded-lg border border-[#2D3E99]/20 text-sm"
                    />
                  </div>
                  <textarea
                    rows={2}
                    value={editReportForm.activitiesText}
                    onChange={(e) => setEditReportForm((p) => ({ ...p, activitiesText: e.target.value }))}
                    placeholder="Completed Activities (one per line)"
                    className="w-full p-2.5 rounded-lg border border-[#2D3E99]/20 text-xs"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingReportId(null)}
                      className="px-4 py-2 rounded-lg border border-[#2D3E99]/20 text-xs font-semibold cursor-pointer"
                    >
                      {biText(lang, 'Cancel', 'Hủy')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveEditReport(rep)}
                      disabled={busyAction === `edit_rep_${rep.id}`}
                      className="px-4 py-2 rounded-lg bg-[#2D3E99] text-white text-xs font-semibold cursor-pointer"
                    >
                      {biText(lang, 'Save Report Changes', 'Lưu thay đổi Báo cáo')}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* TAB 2: USERS, TEACHERS & STUDENTS */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 1. Add Student Profile (First) */}
            <form onSubmit={handleAddStudent} className="bg-white border border-[#2D3E99]/12 rounded-xl p-6 space-y-3">
              <h3 className="font-display text-lg font-bold text-[#172154]">
                {lang === 'vi' ? 'Thêm Học viên' : 'Add Student Profile'}
              </h3>
              <ProfileCompletionBar
                lang={lang}
                fields={[
                  { key: 'photo', labelEn: 'Profile Picture', labelVi: 'Ảnh đại diện', filled: Boolean(studentPhotoUrl.trim()) },
                  { key: 'name', labelEn: 'Student Name', labelVi: 'Tên học viên', filled: Boolean(studentName.trim()) },
                  { key: 'parentName', labelEn: 'Parent Name', labelVi: 'Tên phụ huynh', filled: Boolean(parentName.trim()) },
                  { key: 'parentPhone', labelEn: 'Parent Phone', labelVi: 'SĐT phụ huynh', filled: Boolean(parentPhone.trim()) },
                  { key: 'parentEmail', labelEn: 'Parent Email', labelVi: 'Email phụ huynh', filled: Boolean(parentEmail.trim()) },
                  { key: 'studentEmail', labelEn: 'Student Email', labelVi: 'Email học viên', filled: Boolean(studentEmail.trim()) },
                ]}
              />
              <ProfilePhotoUploader
                photoUrl={studentPhotoUrl}
                onChange={setStudentPhotoUrl}
                name={studentName || 'Student'}
                fallbackSrc={studentGender === 'boy' ? '/assets/lila_boy.png' : '/assets/lila_girl.png'}
                lang={lang}
                compact
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  required
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder={lang === 'vi' ? 'Tên học viên' : 'Student Name'}
                  className="col-span-2 px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm"
                />
                <input
                  type="number"
                  min={3}
                  max={18}
                  value={studentAge}
                  onChange={(e) => setStudentAge(Number(e.target.value))}
                  className="px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm font-mono-num"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  placeholder={lang === 'vi' ? 'Tên phụ huynh' : 'Parent Full Name'}
                  className="px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm"
                />
                <input
                  type="tel"
                  value={parentPhone}
                  onChange={(e) => setParentPhone(e.target.value)}
                  placeholder={biText(lang, 'Phone (optional)', 'Số điện thoại (tùy chọn)')}
                  className="px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="email"
                  required
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                  placeholder="parent@email.com"
                  className="px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm"
                />
                <input
                  type="email"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  placeholder="student@email.com"
                  className="px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={studentGender}
                  onChange={(e) => setStudentGender(e.target.value as 'girl' | 'boy')}
                  className="px-2.5 py-2 rounded-lg border border-[#2D3E99]/20 text-sm bg-white"
                >
                  <option value="girl">Girl</option>
                  <option value="boy">Boy</option>
                </select>
                <select
                  value={studentCefr}
                  onChange={(e) => setStudentCefr(e.target.value as CefrLevel)}
                  className="px-2.5 py-2 rounded-lg border border-[#2D3E99]/20 text-sm bg-white"
                >
                  {CEFR_LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl}
                    </option>
                  ))}
                </select>
                <select
                  value={studentMod}
                  onChange={(e) => setStudentMod(e.target.value as CefrModifier)}
                  className="px-2.5 py-2 rounded-lg border border-[#2D3E99]/20 text-sm bg-white"
                >
                  <option value="-">-</option>
                  <option value="standard">Standard</option>
                  <option value="+">+</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={busyAction === 'student'}
                className="w-full py-2.5 px-4 rounded-lg bg-[#56BEB8] text-[#172154] text-sm font-semibold hover:bg-[#46aba5] cursor-pointer"
              >
                {lang === 'vi' ? 'Lưu học viên' : 'Save Student'}
              </button>
            </form>

            {/* 2. Add Teacher Profile (No pre-filled inputs; banking & payroll in Accounts & Banking) */}
            <form onSubmit={handleAddTeacher} className="bg-white border border-[#2D3E99]/12 rounded-xl p-6 space-y-3">
              <h3 className="font-display text-lg font-bold text-[#E61E64]">
                {lang === 'vi' ? 'Thêm Giáo viên' : 'Add Teacher Profile'}
              </h3>
              <ProfileCompletionBar
                lang={lang}
                fields={[
                  { key: 'photo', labelEn: 'Profile Picture', labelVi: 'Ảnh đại diện', filled: Boolean(teacherPhotoUrl.trim()) },
                  { key: 'name', labelEn: 'Full Name', labelVi: 'Họ và tên', filled: Boolean(teacherName.trim()) },
                  { key: 'email', labelEn: 'Email', labelVi: 'Email', filled: Boolean(teacherEmail.trim()) },
                  { key: 'phone', labelEn: 'Phone Number', labelVi: 'Số điện thoại', filled: Boolean(teacherPhone.trim()) },
                  { key: 'specialty', labelEn: 'Specialty', labelVi: 'Chuyên môn', filled: Boolean(teacherSpecialty.trim()) },
                  { key: 'cert', labelEn: 'CEFR Certification', labelVi: 'Chứng chỉ CEFR', filled: Boolean(teacherCert.trim()) },
                ]}
              />
              <ProfilePhotoUploader
                photoUrl={teacherPhotoUrl}
                onChange={setTeacherPhotoUrl}
                name={teacherName || 'Teacher'}
                lang={lang}
                compact
              />
              <input
                type="text"
                required
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                placeholder={lang === 'vi' ? 'Tên giáo viên' : 'Teacher Full Name'}
                className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm"
              />
              <input
                type="email"
                required
                value={teacherEmail}
                onChange={(e) => setTeacherEmail(e.target.value)}
                placeholder="teacher@lilab.edu"
                className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm"
              />
              <input
                type="tel"
                value={teacherPhone}
                onChange={(e) => setTeacherPhone(e.target.value)}
                placeholder={biText(lang, 'Phone (optional)', 'Số điện thoại (tùy chọn)')}
                className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={teacherSpecialty}
                  onChange={(e) => setTeacherSpecialty(e.target.value)}
                  placeholder={biText(lang, 'Specialty (e.g. Cambridge Starters)', 'Chuyên môn')}
                  className="px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm"
                />
                <input
                  type="text"
                  value={teacherCert}
                  onChange={(e) => setTeacherCert(e.target.value)}
                  placeholder={biText(lang, 'CEFR Cert (e.g. CELTA · C2)', 'Chứng chỉ CEFR')}
                  className="px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm"
                />
              </div>
              <p className="text-[11px] text-[#172154]/60 bg-[#FAF5FF] border border-[#6B21A8]/15 rounded-lg px-3 py-2">
                {biText(
                  lang,
                  'Bank account details, payroll rates, and Teacher Payroll QR codes are configured in Accounts & Banking → Payables & Payroll.',
                  'Thông tin ngân hàng, mức lương và mã QR trả lương giáo viên được cấu hình tại mục Tài chính & Ngân hàng → Lương & Khoản chi.'
                )}
              </p>
              <button
                type="submit"
                disabled={busyAction === 'teacher'}
                className="w-full py-2.5 px-4 rounded-lg bg-[#E61E64] text-white text-sm font-semibold hover:bg-[#c51754] cursor-pointer"
              >
                {lang === 'vi' ? 'Lưu giáo viên' : 'Save Teacher'}
              </button>
            </form>

            {/* 3. Invite / Provision Account */}
            <form onSubmit={handleCreateInvite} className="bg-white border border-[#2D3E99]/12 rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-2 text-[#2D3E99]">
                <UserPlus className="w-5 h-5" />
                <h3 className="font-display text-lg font-bold">
                  {lang === 'vi' ? 'Cấp quyền & Mời tài khoản' : 'Add User / Role Invite'}
                </h3>
              </div>
              <input
                type="text"
                required
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder={lang === 'vi' ? 'Họ và tên' : 'Full Name'}
                className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm"
              />
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="email@domain.com"
                className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm"
              />
              <input
                type="text"
                value={invitePhone}
                onChange={(e) => setInvitePhone(e.target.value)}
                placeholder={lang === 'vi' ? 'Số điện thoại (tùy chọn)' : 'Phone (optional)'}
                className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
                className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm bg-white"
              >
                {isSuperAdmin && <option value="admin">Admin (Academy Manager)</option>}
                <option value="teacher">Teacher</option>
                <option value="parent">Parent</option>
                <option value="student">Student</option>
              </select>
              <button
                type="submit"
                disabled={busyAction === 'invite'}
                className="w-full py-2.5 px-4 rounded-lg bg-[#2D3E99] text-white text-sm font-semibold hover:bg-[#23317a] cursor-pointer"
              >
                {lang === 'vi' ? 'Tạo lời mời' : 'Provision User'}
              </button>
            </form>
          </div>

          {/* Directories with Edit Button on EVERY Teacher, Student & Parent, Invite, and Registered User */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Teachers Directory */}
            <div className="bg-white border border-[#2D3E99]/12 rounded-xl p-6 space-y-3">
              <h3 className="font-display text-base font-bold text-[#2D3E99]">
                {biText(lang, 'Teachers', 'Danh sách Giáo viên')} ({teachers.length})
              </h3>
              <div className="divide-y divide-[#2D3E99]/10">
                {teachers.map((tc) => (
                  <div key={tc.id} className="py-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <ProfileAvatar src={tc.photoUrl} name={tc.fullName} size="md" />
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{tc.fullName}</div>
                          <div className="text-xs text-[#172154]/65 truncate">
                            {tc.teacherEmail}
                            {tc.phone ? ` · ${tc.phone}` : ''}
                            {tc.cefrCertification ? ` · ${tc.cefrCertification}` : ''}
                            {tc.monthlyBaseVnd > 0 ? ` · ${formatVnd(tc.monthlyBaseVnd)}/mo` : ''}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => (editingTeacherId === tc.id ? setEditingTeacherId(null) : startEditTeacher(tc))}
                          className="px-2.5 py-1 text-xs font-semibold text-[#2D3E99] bg-[#2D3E99]/10 hover:bg-[#2D3E99] hover:text-white rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" />
                          {biText(lang, 'Edit', 'Sửa')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDoc('teachers', tc.id)}
                          className="p-1.5 text-[#E61E64] hover:bg-[#E61E64]/10 rounded-lg cursor-pointer"
                          aria-label={`Delete ${tc.fullName}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {editingTeacherId === tc.id && (
                      <div className="p-3 rounded-lg bg-[#FDF9EE] border border-[#2D3E99]/15 space-y-2.5 text-xs">
                        <ProfileCompletionBar
                          lang={lang}
                          fields={[
                            { key: 'photo', labelEn: 'Profile Picture', labelVi: 'Ảnh đại diện', filled: Boolean(editTeacherForm.photoUrl.trim()) },
                            { key: 'name', labelEn: 'Full Name', labelVi: 'Họ và tên', filled: Boolean(editTeacherForm.fullName.trim()) },
                            { key: 'email', labelEn: 'Email', labelVi: 'Email', filled: Boolean(editTeacherForm.teacherEmail.trim()) },
                            { key: 'phone', labelEn: 'Phone Number', labelVi: 'Số điện thoại', filled: Boolean(editTeacherForm.phone.trim()) },
                            { key: 'specialty', labelEn: 'Specialty', labelVi: 'Chuyên môn', filled: Boolean(editTeacherForm.specialty.trim()) },
                            { key: 'cert', labelEn: 'CEFR Certification', labelVi: 'Chứng chỉ CEFR', filled: Boolean(editTeacherForm.cefrCertification.trim()) },
                            { key: 'bank', labelEn: 'Bank Info', labelVi: 'Ngân hàng', filled: Boolean(editTeacherForm.bankName.trim()) },
                          ]}
                        />
                        <ProfilePhotoUploader
                          photoUrl={editTeacherForm.photoUrl}
                          onChange={(nextUrl) => setEditTeacherForm((p) => ({ ...p, photoUrl: nextUrl }))}
                          name={editTeacherForm.fullName || tc.fullName}
                          lang={lang}
                          compact
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={editTeacherForm.fullName}
                            onChange={(e) => setEditTeacherForm((p) => ({ ...p, fullName: e.target.value }))}
                            placeholder="Full Name"
                            className="px-2.5 py-1.5 rounded border border-[#2D3E99]/20 bg-white"
                          />
                          <input
                            type="email"
                            value={editTeacherForm.teacherEmail}
                            onChange={(e) => setEditTeacherForm((p) => ({ ...p, teacherEmail: e.target.value }))}
                            placeholder="Email"
                            className="px-2.5 py-1.5 rounded border border-[#2D3E99]/20 bg-white"
                          />
                          <input
                            type="text"
                            value={editTeacherForm.phone}
                            onChange={(e) => setEditTeacherForm((p) => ({ ...p, phone: e.target.value }))}
                            placeholder="Phone"
                            className="px-2.5 py-1.5 rounded border border-[#2D3E99]/20 bg-white"
                          />
                          <input
                            type="text"
                            value={editTeacherForm.specialty}
                            onChange={(e) => setEditTeacherForm((p) => ({ ...p, specialty: e.target.value }))}
                            placeholder="Specialty"
                            className="px-2.5 py-1.5 rounded border border-[#2D3E99]/20 bg-white"
                          />
                          <input
                            type="text"
                            value={editTeacherForm.cefrCertification}
                            onChange={(e) => setEditTeacherForm((p) => ({ ...p, cefrCertification: e.target.value }))}
                            placeholder="CEFR Cert"
                            className="px-2.5 py-1.5 rounded border border-[#2D3E99]/20 bg-white"
                          />
                          <input
                            type="number"
                            value={editTeacherForm.hourlyRateVnd}
                            onChange={(e) => setEditTeacherForm((p) => ({ ...p, hourlyRateVnd: Number(e.target.value) }))}
                            placeholder="Hourly VND"
                            className="px-2.5 py-1.5 rounded border border-[#2D3E99]/20 bg-white font-mono-num"
                          />
                          <input
                            type="number"
                            value={editTeacherForm.monthlyBaseVnd}
                            onChange={(e) => setEditTeacherForm((p) => ({ ...p, monthlyBaseVnd: Number(e.target.value) }))}
                            placeholder="Monthly Base VND"
                            className="px-2.5 py-1.5 rounded border border-[#2D3E99]/20 bg-white font-mono-num"
                          />
                          <input
                            type="text"
                            value={editTeacherForm.bankName}
                            onChange={(e) => setEditTeacherForm((p) => ({ ...p, bankName: e.target.value }))}
                            placeholder="Bank Name"
                            className="px-2.5 py-1.5 rounded border border-[#2D3E99]/20 bg-white"
                          />
                          <select
                            value={editTeacherForm.payStatus}
                            onChange={(e) => setEditTeacherForm((p) => ({ ...p, payStatus: e.target.value as TeacherProfile['payStatus'] }))}
                            className="px-2.5 py-1.5 rounded border border-[#2D3E99]/20 bg-white"
                          >
                            <option value="active">Pay: active</option>
                            <option value="pending_payout">Pay: pending_payout</option>
                            <option value="paid">Pay: paid</option>
                          </select>
                          <select
                            value={editTeacherForm.status}
                            onChange={(e) => setEditTeacherForm((p) => ({ ...p, status: e.target.value as TeacherProfile['status'] }))}
                            className="px-2.5 py-1.5 rounded border border-[#2D3E99]/20 bg-white"
                          >
                            <option value="active">Status: active</option>
                            <option value="inactive">Status: inactive</option>
                          </select>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingTeacherId(null)}
                            className="px-3 py-1 rounded border border-[#2D3E99]/20 bg-white font-semibold cursor-pointer"
                          >
                            {biText(lang, 'Cancel', 'Hủy')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEditTeacher(tc)}
                            disabled={busyAction === `edit_tc_${tc.id}`}
                            className="px-3 py-1 rounded bg-[#2D3E99] text-white font-semibold cursor-pointer"
                          >
                            {biText(lang, 'Save Teacher', 'Lưu GV')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Students & Parents Directory */}
            {(() => {
              const qDir = studentSearch.trim().toLowerCase();
              const allKnownDir: StudentProfile[] = [...students];
              for (const extra of remoteStudentMatches) {
                if (!allKnownDir.some((s) => s.id === extra.id)) allKnownDir.push(extra);
              }
              const visibleDirectoryStudents = qDir
                ? allKnownDir.filter(
                    (st) =>
                      st.id.toLowerCase().includes(qDir) ||
                      st.fullName.toLowerCase().includes(qDir) ||
                      st.parentEmail.toLowerCase().includes(qDir) ||
                      (st.parentName || '').toLowerCase().includes(qDir) ||
                      (st.studentEmail || '').toLowerCase().includes(qDir)
                  )
                : allKnownDir;

              return (
            <div className="bg-white border border-[#2D3E99]/12 rounded-xl p-6 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-base font-bold text-[#2D3E99]">
                  {biText(lang, 'Students & Parent Contacts', 'Danh sách Học viên & Phụ huynh')} (
                  {qDir ? `${visibleDirectoryStudents.length}/${allKnownDir.length}` : allKnownDir.length})
                </h3>
                {qDir && (
                  <button
                    type="button"
                    onClick={() => {
                      setStudentSearch('');
                      setSearchResultsOpen(false);
                    }}
                    className="text-xs font-semibold text-[#E61E64] hover:underline cursor-pointer"
                  >
                    {biText(lang, 'Clear search filter', 'Bỏ lọc')}
                  </button>
                )}
              </div>
              <div className="divide-y divide-[#2D3E99]/10">
                {visibleDirectoryStudents.length === 0 ? (
                  <p className="text-xs text-[#172154]/60 py-4">
                    {biText(
                      lang,
                      'No students match your current search.',
                      'Không có học viên nào khớp từ khóa tìm kiếm.'
                    )}
                  </p>
                ) : (
                visibleDirectoryStudents.map((st) => (
                  <div key={st.id} className="py-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <ProfileAvatar
                          src={st.photoUrl}
                          fallbackSrc={st.gender === 'boy' ? '/assets/lila_boy.png' : '/assets/lila_girl.png'}
                          name={st.fullName}
                          size="md"
                        />
                        <div className="min-w-0">
                          <div className="font-semibold truncate">
                            {st.fullName} ({st.age}y) ·{' '}
                            <span className="font-mono-num text-[#E61E64]">
                              {formatCefrLabel(st.cefrLevel, st.cefrModifier)}
                            </span>
                          </div>
                          <div className="text-xs text-[#172154]/65 truncate">
                            <span className="font-mono-num text-[#2D3E99]">ID: {st.id}</span> · Parent: {st.parentName} ({st.parentEmail}{st.parentPhone ? ` · ${st.parentPhone}` : ''})
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => (editingStudentId === st.id ? setEditingStudentId(null) : startEditStudent(st))}
                          className="px-2.5 py-1 text-xs font-semibold text-[#2D3E99] bg-[#2D3E99]/10 hover:bg-[#2D3E99] hover:text-white rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" />
                          {biText(lang, 'Edit', 'Sửa')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDoc('students', st.id)}
                          className="p-1.5 text-[#E61E64] hover:bg-[#E61E64]/10 rounded-lg cursor-pointer"
                          aria-label={`Delete ${st.fullName}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {editingStudentId === st.id && (
                      <div className="p-3 rounded-lg bg-[#FDF9EE] border border-[#2D3E99]/15 space-y-2.5 text-xs">
                        <ProfileCompletionBar
                          lang={lang}
                          fields={[
                            { key: 'photo', labelEn: 'Profile Picture', labelVi: 'Ảnh đại diện', filled: Boolean(editStudentForm.photoUrl.trim()) },
                            { key: 'name', labelEn: 'Student Name', labelVi: 'Tên học viên', filled: Boolean(editStudentForm.fullName.trim()) },
                            { key: 'parentName', labelEn: 'Parent Name', labelVi: 'Tên phụ huynh', filled: Boolean(editStudentForm.parentName.trim()) },
                            { key: 'parentPhone', labelEn: 'Parent Phone', labelVi: 'SĐT phụ huynh', filled: Boolean(editStudentForm.parentPhone.trim()) },
                            { key: 'parentEmail', labelEn: 'Parent Email', labelVi: 'Email phụ huynh', filled: Boolean(editStudentForm.parentEmail.trim()) },
                            { key: 'studentEmail', labelEn: 'Student Email', labelVi: 'Email học viên', filled: Boolean(editStudentForm.studentEmail.trim()) },
                          ]}
                        />
                        <ProfilePhotoUploader
                          photoUrl={editStudentForm.photoUrl}
                          onChange={(nextUrl) => setEditStudentForm((p) => ({ ...p, photoUrl: nextUrl }))}
                          name={editStudentForm.fullName || st.fullName}
                          fallbackSrc={editStudentForm.gender === 'boy' ? '/assets/lila_boy.png' : '/assets/lila_girl.png'}
                          lang={lang}
                          compact
                        />
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          <input
                            type="text"
                            value={editStudentForm.fullName}
                            onChange={(e) => setEditStudentForm((p) => ({ ...p, fullName: e.target.value }))}
                            placeholder="Student Name"
                            className="px-2.5 py-1.5 rounded border border-[#2D3E99]/20 bg-white"
                          />
                          <input
                            type="number"
                            min={2}
                            max={99}
                            value={editStudentForm.age}
                            onChange={(e) => setEditStudentForm((p) => ({ ...p, age: Number(e.target.value) }))}
                            placeholder="Age"
                            className="px-2.5 py-1.5 rounded border border-[#2D3E99]/20 bg-white font-mono-num"
                          />
                          <select
                            value={editStudentForm.gender}
                            onChange={(e) => setEditStudentForm((p) => ({ ...p, gender: e.target.value as 'girl' | 'boy' }))}
                            className="px-2.5 py-1.5 rounded border border-[#2D3E99]/20 bg-white"
                          >
                            <option value="girl">Girl</option>
                            <option value="boy">Boy</option>
                          </select>
                          <input
                            type="email"
                            value={editStudentForm.studentEmail}
                            onChange={(e) => setEditStudentForm((p) => ({ ...p, studentEmail: e.target.value }))}
                            placeholder="Student Email (optional)"
                            className="px-2.5 py-1.5 rounded border border-[#2D3E99]/20 bg-white"
                          />
                          <input
                            type="text"
                            value={editStudentForm.parentName}
                            onChange={(e) => setEditStudentForm((p) => ({ ...p, parentName: e.target.value }))}
                            placeholder="Parent Name"
                            className="px-2.5 py-1.5 rounded border border-[#2D3E99]/20 bg-white"
                          />
                          <input
                            type="email"
                            value={editStudentForm.parentEmail}
                            onChange={(e) => setEditStudentForm((p) => ({ ...p, parentEmail: e.target.value }))}
                            placeholder="Parent Email"
                            className="px-2.5 py-1.5 rounded border border-[#2D3E99]/20 bg-white"
                          />
                          <input
                            type="text"
                            value={editStudentForm.parentPhone}
                            onChange={(e) => setEditStudentForm((p) => ({ ...p, parentPhone: e.target.value }))}
                            placeholder="Parent Phone"
                            className="px-2.5 py-1.5 rounded border border-[#2D3E99]/20 bg-white"
                          />
                          <select
                            value={editStudentForm.cefrLevel}
                            onChange={(e) => setEditStudentForm((p) => ({ ...p, cefrLevel: e.target.value as CefrLevel }))}
                            className="px-2.5 py-1.5 rounded border border-[#2D3E99]/20 bg-white"
                          >
                            {CEFR_LEVELS.map((l) => (
                              <option key={l} value={l}>{l}</option>
                            ))}
                          </select>
                          <select
                            value={editStudentForm.cefrModifier}
                            onChange={(e) => setEditStudentForm((p) => ({ ...p, cefrModifier: e.target.value as CefrModifier }))}
                            className="px-2.5 py-1.5 rounded border border-[#2D3E99]/20 bg-white"
                          >
                            <option value="-">-</option>
                            <option value="standard">Standard</option>
                            <option value="+">+</option>
                          </select>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingStudentId(null)}
                            className="px-3 py-1 rounded border border-[#2D3E99]/20 bg-white font-semibold cursor-pointer"
                          >
                            {biText(lang, 'Cancel', 'Hủy')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEditStudent(st)}
                            disabled={busyAction === `edit_st_${st.id}`}
                            className="px-3 py-1 rounded bg-[#56BEB8] text-[#172154] font-semibold cursor-pointer"
                          >
                            {biText(lang, 'Save Student & Parent', 'Lưu Học viên')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )))}
              </div>
            </div>
              );
            })()}
          </div>

          {/* Pending Invites & Registered Accounts (Super Admin) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-[#2D3E99]/12 rounded-xl p-6 space-y-3">
              <h3 className="font-display text-base font-bold text-[#2D3E99]">
                {biText(lang, 'Provisioned Invites', 'Lời mời tài khoản')} ({invites.length})
              </h3>
              <div className="divide-y divide-[#2D3E99]/10 text-sm">
                {invites.map((inv) => (
                  <div key={inv.id} className="py-2.5 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold">{inv.displayName} · {inv.role}</div>
                        <div className="text-xs text-[#172154]/65">{inv.email} · {inv.status}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => (editingInviteId === inv.id ? setEditingInviteId(null) : startEditInvite(inv))}
                          className="px-2.5 py-1 text-xs font-semibold text-[#2D3E99] bg-[#2D3E99]/10 hover:bg-[#2D3E99] hover:text-white rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" />
                          {biText(lang, 'Edit', 'Sửa')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDoc('user_invites', inv.id)}
                          className="p-1.5 text-[#E61E64] hover:bg-[#E61E64]/10 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {editingInviteId === inv.id && (
                      <div className="p-3 rounded-lg bg-[#FDF9EE] border border-[#2D3E99]/15 space-y-2 text-xs">
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={editInviteForm.displayName}
                            onChange={(e) => setEditInviteForm((p) => ({ ...p, displayName: e.target.value }))}
                            placeholder="Display Name"
                            className="px-2.5 py-1.5 rounded border border-[#2D3E99]/20 bg-white"
                          />
                          <input
                            type="email"
                            value={editInviteForm.email}
                            onChange={(e) => setEditInviteForm((p) => ({ ...p, email: e.target.value }))}
                            placeholder="Email"
                            className="px-2.5 py-1.5 rounded border border-[#2D3E99]/20 bg-white"
                          />
                          <input
                            type="text"
                            value={editInviteForm.phone}
                            onChange={(e) => setEditInviteForm((p) => ({ ...p, phone: e.target.value }))}
                            placeholder="Phone"
                            className="px-2.5 py-1.5 rounded border border-[#2D3E99]/20 bg-white"
                          />
                          <select
                            value={editInviteForm.role}
                            onChange={(e) => setEditInviteForm((p) => ({ ...p, role: e.target.value as UserInvite['role'] }))}
                            className="px-2.5 py-1.5 rounded border border-[#2D3E99]/20 bg-white"
                          >
                            {isSuperAdmin && <option value="admin">admin</option>}
                            <option value="teacher">teacher</option>
                            <option value="parent">parent</option>
                            <option value="student">student</option>
                          </select>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingInviteId(null)}
                            className="px-3 py-1 rounded border border-[#2D3E99]/20 bg-white font-semibold cursor-pointer"
                          >
                            {biText(lang, 'Cancel', 'Hủy')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEditInvite(inv)}
                            disabled={busyAction === `edit_inv_${inv.id}`}
                            className="px-3 py-1 rounded bg-[#2D3E99] text-white font-semibold cursor-pointer"
                          >
                            {biText(lang, 'Save Invite', 'Lưu lời mời')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {isSuperAdmin && (
              <div className="bg-white border border-[#2D3E99]/12 rounded-xl p-6 space-y-3">
                <h3 className="font-display text-base font-bold text-[#2D3E99]">
                  {biText(lang, 'Registered Accounts (Super Admin)', 'Tài khoản đã đăng nhập (Super Admin)')} ({users.length})
                </h3>
                <div className="divide-y divide-[#2D3E99]/10 text-sm">
                  {users.map((u) => (
                    <div key={u.uid} className="py-2.5 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <ProfileAvatar src={u.photoUrl} name={u.displayName || u.email} size="sm" />
                          <div className="min-w-0">
                            <div className="font-semibold truncate">
                              {u.displayName} · <span className="text-[#E61E64]">{u.role}</span> · <span className="text-xs text-[#56BEB8]">{u.preferredLang?.toUpperCase()}</span>
                            </div>
                            <div className="text-xs text-[#172154]/65 truncate">
                              {u.email} {u.phone ? `· ${u.phone}` : ''} · {u.status}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => (editingUserUid === u.uid ? setEditingUserUid(null) : startEditUser(u))}
                            className="px-2.5 py-1 text-xs font-semibold text-[#2D3E99] bg-[#2D3E99]/10 hover:bg-[#2D3E99] hover:text-white rounded-lg flex items-center gap-1 cursor-pointer"
                          >
                            <Pencil className="w-3 h-3" />
                            {biText(lang, 'Edit', 'Sửa')}
                          </button>
                          {!isSuperAdminEmail(u.email) && (
                            <>
                              {(u.role === 'admin' || u.role === 'super_admin') && (
                                <button
                                  type="button"
                                  onClick={() => handleUnlinkAdminAccount(u)}
                                  className="px-2 py-1 text-xs font-semibold text-[#2D3E99] bg-[#2D3E99]/10 hover:bg-[#2D3E99]/20 rounded-lg flex items-center gap-1 cursor-pointer"
                                >
                                  <Unlink className="w-3.5 h-3.5" />
                                  Unlink
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteDoc('users', u.uid)}
                                className="p-1.5 text-[#E61E64] hover:bg-[#E61E64]/10 rounded-lg cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {editingUserUid === u.uid && (
                        <div className="p-3 rounded-lg bg-[#FDF9EE] border border-[#2D3E99]/15 space-y-2.5 text-xs">
                          <ProfileCompletionBar
                            lang={lang}
                            fields={[
                              { key: 'photo', labelEn: 'Profile Picture', labelVi: 'Ảnh đại diện', filled: Boolean(editUserForm.photoUrl.trim()) },
                              { key: 'name', labelEn: 'Display Name', labelVi: 'Tên hiển thị', filled: Boolean(editUserForm.displayName.trim()) },
                              { key: 'phone', labelEn: 'Phone Number', labelVi: 'Số điện thoại', filled: Boolean(editUserForm.phone.trim()) },
                              { key: 'email', labelEn: 'Email', labelVi: 'Email', filled: Boolean((u.email || '').trim()) },
                            ]}
                          />
                          <ProfilePhotoUploader
                            photoUrl={editUserForm.photoUrl}
                            onChange={(nextUrl) => setEditUserForm((p) => ({ ...p, photoUrl: nextUrl }))}
                            name={editUserForm.displayName || u.displayName}
                            lang={lang}
                            compact
                          />
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            <input
                              type="text"
                              value={editUserForm.displayName}
                              onChange={(e) => setEditUserForm((p) => ({ ...p, displayName: e.target.value }))}
                              placeholder="Display Name"
                              className="px-2.5 py-1.5 rounded border border-[#2D3E99]/20 bg-white"
                            />
                            <input
                              type="text"
                              value={editUserForm.phone}
                              onChange={(e) => setEditUserForm((p) => ({ ...p, phone: e.target.value }))}
                              placeholder="Phone"
                              className="px-2.5 py-1.5 rounded border border-[#2D3E99]/20 bg-white"
                            />
                            <select
                              value={isSuperAdminEmail(u.email) ? 'super_admin' : editUserForm.role}
                              disabled={isSuperAdminEmail(u.email)}
                              onChange={(e) => setEditUserForm((p) => ({ ...p, role: e.target.value as UserProfile['role'] }))}
                              className="px-2.5 py-1.5 rounded border border-[#2D3E99]/20 bg-white disabled:opacity-60"
                            >
                              {isSuperAdminEmail(u.email) && <option value="super_admin">super_admin</option>}
                              <option value="admin">admin</option>
                              <option value="teacher">teacher</option>
                              <option value="parent">parent</option>
                              <option value="student">student</option>
                            </select>
                            <select
                              value={editUserForm.preferredLang}
                              onChange={(e) => setEditUserForm((p) => ({ ...p, preferredLang: e.target.value as LangCode }))}
                              className="px-2.5 py-1.5 rounded border border-[#2D3E99]/20 bg-white"
                            >
                              <option value="vi">Tiếng Việt (VI)</option>
                              <option value="en">English (EN)</option>
                              <option value="bi">Mix EN+VI</option>
                            </select>
                            <select
                              value={editUserForm.status}
                              onChange={(e) => setEditUserForm((p) => ({ ...p, status: e.target.value as UserProfile['status'] }))}
                              className="px-2.5 py-1.5 rounded border border-[#2D3E99]/20 bg-white"
                            >
                              <option value="active">active</option>
                              <option value="inactive">inactive</option>
                            </select>
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingUserUid(null)}
                              className="px-3 py-1 rounded border border-[#2D3E99]/20 bg-white font-semibold cursor-pointer"
                            >
                              {biText(lang, 'Cancel', 'Hủy')}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveEditUser(u)}
                              disabled={busyAction === `edit_usr_${u.uid}`}
                              className="px-3 py-1 rounded bg-[#2D3E99] text-white font-semibold cursor-pointer"
                            >
                              {biText(lang, 'Save Account', 'Lưu Tài khoản')}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: PROGRAMS & COURSES STUDIO (Modular lazy-loaded panel) */}
      {activeTab === 'programs' && (
        <AdminProgramsPanel
          lang={lang}
          programs={programs}
          teachers={teachers}
          onFlash={flash}
          onOpenPromoPopup={onOpenPromoPopup}
        />
      )}

      {/* TAB: UNIFIED CLASSES, TIMETABLES & ACADEMY EVENT CALENDAR */}
      {activeTab === 'classes' && (
        <div className="space-y-6">
          {/* Unified Section Switcher */}
          <div className="bg-white border border-[#172154]/10 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 no-print">
            <div>
              <h2 className="font-display text-base font-bold text-[#172154]">
                {biText(
                  lang,
                  'Classes, Timetables & Academy Event Calendar',
                  'Quản lý Lớp học, Thời khóa biểu & Lịch Sự kiện Học viện'
                )}
              </h2>
              <p className="text-xs text-[#525E80] font-mono-num mt-0.5">
                {classes.length} {biText(lang, 'classes', 'lớp')} · {schedules.length}{' '}
                {biText(lang, 'weekly sessions', 'buổi học/tuần')}
              </p>
            </div>
            <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#F2F4F8] border border-[#172154]/8">
              {[
                { id: 'all' as const, label: biText(lang, 'Combined View', 'Xem Tất cả') },
                { id: 'calendar' as const, label: biText(lang, 'Event Calendar', 'Lịch Sự kiện') },
                { id: 'classes' as const, label: biText(lang, 'Classes & Timetables', 'Lớp & Thời khóa biểu') },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setScheduleSectionView(opt.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    scheduleSectionView === opt.id
                      ? 'bg-[#1E293B] text-white'
                      : 'text-[#525E80] hover:text-[#172154]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {(scheduleSectionView === 'all' || scheduleSectionView === 'calendar') && (
            <AcademyEventCalendar
              lang={lang}
              currentUser={safeCurrentUser}
              portalMode="admin"
              classes={classes}
              schedules={schedules}
              assessments={assessments}
              students={students}
              teachers={teachers}
              programs={programs}
            />
          )}

          {(scheduleSectionView === 'all' || scheduleSectionView === 'classes') && (
            <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Quick Link to Programs & Courses Studio */}
            <div className="bg-white border border-[#2D3E99]/12 rounded-xl p-6 flex flex-col justify-between space-y-4">
              <div className="space-y-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#2D3E99]/10 text-[#2D3E99] flex items-center justify-center">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <h3 className="font-display text-lg font-bold text-[#2D3E99]">
                  {biText(lang, 'LiLab Programs & Courses', 'Chương trình & Khóa học LiLab')}
                </h3>
                <p className="text-xs text-[#172154]/75 leading-relaxed">
                  {biText(
                    lang,
                    'Create and edit courses with tuition price, teacher assignment, enrollment date, class size, and automatic Promo Popup publishing.',
                    'Thêm và chỉnh sửa khóa học với học phí, giáo viên, ngày tuyển sinh, sĩ số và tự động đăng lên cửa sổ Popup & Cổng Phụ huynh.'
                  )}
                </p>
                <div className="p-3 rounded-lg bg-[#FDF9EE] border border-[#2D3E99]/12 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[#172154]/70">{biText(lang, 'Published Courses:', 'Khóa học đang mở:')}</span>
                    <strong className="font-mono text-[#2D3E99]">{programs.filter((p) => p.isActive !== false).length}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#172154]/70">{biText(lang, 'Featured in Popup:', 'Hiển thị trên Popup:')}</span>
                    <strong className="font-mono text-[#E61E64]">{programs.filter((p) => p.isActive !== false && p.showInPromoPopup === true).length}</strong>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('programs')}
                  className="w-full py-2.5 px-4 rounded-lg bg-[#2D3E99] hover:bg-[#1f2c73] text-white text-sm font-semibold cursor-pointer"
                >
                  {biText(lang, 'Open Programs & Courses Tab', 'Mở mục Chương trình & Khóa học')}
                </button>
                {onOpenPromoPopup && (
                  <button
                    type="button"
                    onClick={() => onOpenPromoPopup()}
                    className="w-full py-2 px-4 rounded-lg bg-[#E61E64]/10 hover:bg-[#E61E64]/15 text-[#E61E64] text-xs font-bold cursor-pointer"
                  >
                    {biText(lang, 'Preview Promo Popup Window', 'Xem trước Cửa sổ Popup')}
                  </button>
                )}
              </div>
            </div>

            {/* Class Creator */}
            <form onSubmit={handleAddClass} className="bg-white border border-[#2D3E99]/12 rounded-xl p-6 space-y-3">
              <h3 className="font-display text-lg font-bold text-[#E61E64]">
                {lang === 'vi' ? 'Tạo Lớp học & Phân công GV' : 'Create Class & Assign Teacher'}
              </h3>
              <input
                type="text"
                required
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="e.g. Be Whole Starters · Cohort A"
                className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm"
              />
              <select
                value={classProgramId}
                onChange={(e) => setClassProgramId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm bg-white"
              >
                <option value="">Select Program...</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} · {p.titleEn}
                  </option>
                ))}
              </select>
              <select
                value={classTeacherId}
                onChange={(e) => setClassTeacherId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm bg-white"
              >
                <option value="">Assign Teacher...</option>
                {teachers.map((tc) => (
                  <option key={tc.id} value={tc.id}>
                    {tc.fullName} ({tc.teacherEmail})
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={classCefr}
                  onChange={(e) => setClassCefr(e.target.value as CefrLevel)}
                  className="px-2.5 py-2 rounded-lg border border-[#2D3E99]/20 text-sm bg-white"
                >
                  {CEFR_LEVELS.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
                <select
                  value={classMod}
                  onChange={(e) => setClassMod(e.target.value as CefrModifier)}
                  className="px-2.5 py-2 rounded-lg border border-[#2D3E99]/20 text-sm bg-white"
                >
                  <option value="-">-</option>
                  <option value="standard">Standard</option>
                  <option value="+">+</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={classRoom}
                  onChange={(e) => setClassRoom(e.target.value)}
                  placeholder="Room"
                  className="px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm"
                />
                <input
                  type="text"
                  value={classSchedText}
                  onChange={(e) => setClassSchedText(e.target.value)}
                  placeholder="Sat 09:00–10:30"
                  className="px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={busyAction === 'class'}
                className="w-full py-2.5 px-4 rounded-lg bg-[#E61E64] text-white text-sm font-semibold cursor-pointer"
              >
                {lang === 'vi' ? 'Tạo lớp học' : 'Create Class'}
              </button>
            </form>

            {/* Schedule Creator */}
            <form onSubmit={handleAddSchedule} className="bg-white border border-[#2D3E99]/12 rounded-xl p-6 space-y-3">
              <h3 className="font-display text-lg font-bold text-[#172154]">
                {lang === 'vi' ? 'Lên lịch Giảng dạy' : 'Schedule Class Session'}
              </h3>
              <select
                value={schedClassId}
                onChange={(e) => setSchedClassId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm bg-white"
              >
                <option value="">Select Class...</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.teacherName})</option>
                ))}
              </select>
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={schedDay}
                  onChange={(e) => setSchedDay(e.target.value as ClassSchedule['dayOfWeek'])}
                  className="px-2 py-2 rounded-lg border border-[#2D3E99]/20 text-sm bg-white"
                >
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={schedStart}
                  onChange={(e) => setSchedStart(e.target.value)}
                  placeholder="09:00"
                  className="px-2.5 py-2 rounded-lg border border-[#2D3E99]/20 text-sm font-mono-num"
                />
                <input
                  type="text"
                  value={schedEnd}
                  onChange={(e) => setSchedEnd(e.target.value)}
                  placeholder="10:30"
                  className="px-2.5 py-2 rounded-lg border border-[#2D3E99]/20 text-sm font-mono-num"
                />
              </div>
              <input
                type="number"
                min={1}
                max={52}
                value={schedWeek}
                onChange={(e) => setSchedWeek(Number(e.target.value))}
                placeholder="Week Number"
                className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm font-mono-num"
              />
              <input
                type="text"
                value={schedTopicEn}
                onChange={(e) => setSchedTopicEn(e.target.value)}
                placeholder="Lesson Topic (English)"
                className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm"
              />
              <input
                type="text"
                value={schedTopicVi}
                onChange={(e) => setSchedTopicVi(e.target.value)}
                placeholder="Chủ đề bài học (Tiếng Việt)"
                className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm"
              />
              <button
                type="submit"
                disabled={busyAction === 'sched'}
                className="w-full py-2.5 px-4 rounded-lg bg-[#56BEB8] text-[#172154] text-sm font-semibold cursor-pointer"
              >
                {lang === 'vi' ? 'Thêm vào thời khóa biểu' : 'Add to Timetable'}
              </button>
            </form>
          </div>

          {/* Class Assignment List */}
          <div className="bg-white border border-[#2D3E99]/12 rounded-xl p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-[#2D3E99]">
              {lang === 'vi' ? 'Danh sách Lớp học & Xếp học viên' : 'Active Classes & Student Assignment'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {classes.map((cls) => (
                <div key={cls.id} className="p-4 rounded-xl border border-[#2D3E99]/12 bg-[#FDF9EE]/50 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-[#2D3E99]">{cls.name}</div>
                      <div className="text-xs text-[#172154]/70">
                        {cls.teacherName} · {cls.room} · {cls.scheduleText} ·{' '}
                        <span className="font-mono-num text-[#E61E64]">
                          {formatCefrLabel(cls.cefrLevel, cls.cefrModifier)}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteDoc('classes', cls.id)}
                      className="p-1.5 text-[#E61E64] hover:bg-[#E61E64]/10 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={selectedStudentForClass[cls.id] || ''}
                      onChange={(e) =>
                        setSelectedStudentForClass((prev) => ({ ...prev, [cls.id]: e.target.value }))
                      }
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-[#2D3E99]/20 bg-white text-xs"
                    >
                      <option value="">
                        {lang === 'vi' ? 'Chọn học viên xếp lớp...' : 'Select student to assign...'}
                      </option>
                      {students.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.fullName} ({formatCefrLabel(st.cefrLevel, st.cefrModifier)})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleAssignStudentToClass(cls)}
                      className="px-3 py-1.5 rounded-lg bg-[#2D3E99] text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Assign
                    </button>
                  </div>
                  <div className="text-xs text-[#172154]/65 font-mono-num">
                    Enrolled: {cls.studentIds?.length || 0} / {cls.maxStudents}
                  </div>
                  {(cls.studentIds || []).length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {(cls.studentIds || []).map((sid) => {
                        const stu = students.find((s) => s.id === sid);
                        return (
                          <div
                            key={sid}
                            className="px-2.5 py-1 rounded-lg bg-white border border-[#2D3E99]/15 text-xs flex items-center gap-2"
                          >
                            <span className="font-medium text-[#172154]">{stu?.fullName || sid}</span>
                            <button
                              type="button"
                              onClick={() => handleUnlinkStudentFromClass(cls, sid)}
                              className="text-[#E61E64] hover:underline flex items-center gap-0.5 font-semibold cursor-pointer"
                              title="Unlink student from class"
                            >
                              <Unlink className="w-3 h-3" />
                              {lang === 'vi' ? 'Gỡ' : 'Unlink'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Weekly Timetable */}
          <div className="bg-white border border-[#2D3E99]/12 rounded-xl p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-[#2D3E99]">
              {lang === 'vi' ? 'Thời khóa biểu toàn Học viện' : 'Academy Timetable'} ({schedules.length})
            </h3>
            <div className="divide-y divide-[#2D3E99]/10 text-sm">
              {schedules.map((s) => (
                <div key={s.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-[#172154]">
                      {s.dayOfWeek} · <span className="font-mono-num">{s.startTime}–{s.endTime}</span> · {s.className}
                    </div>
                    <div className="text-xs text-[#172154]/70">
                      Week {s.weekNumber}: {lang === 'vi' ? s.topicVi : s.topicEn} · Teacher: {s.teacherName} · {s.room}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteDoc('schedules', s.id)}
                    className="p-1.5 text-[#E61E64] hover:bg-[#E61E64]/10 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: UNIFIED RESOURCE LIBRARY (Upload/Edit/Delete Class Materials, Assign to Classes/Students, Grade Submissions & Synthesize Read-Only Study Guides) */}
      {activeTab === 'gemini_notes' && (
        <div className="space-y-6 no-print">
          <LearningResourceLibrary
            lang={lang}
            geminiNotes={geminiNotes}
            currentUser={safeCurrentUser}
            classes={classes}
            students={students}
            portalRole="admin"
            onOpenReadOnlyNote={(res) => {
              if (res.note) {
                setActiveReadOnlyNote(res.note);
              }
            }}
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form onSubmit={handleGenerateGeminiNote} className="lg:col-span-5 bg-white border border-[#2D3E99]/12 rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-2 text-[#2D3E99]">
                <Upload className="w-5 h-5 text-[#E61E64]" />
                <h3 className="font-display text-lg font-bold">
                  {lang === 'vi'
                    ? 'Tổng hợp Giáo trình Chỉ đọc vào Thư viện Học liệu'
                    : 'Synthesize Read-Only Study Guide into Resource Library'}
                </h3>
              </div>
              <p className="text-xs text-[#172154]/70 leading-relaxed">
                {lang === 'vi'
                  ? 'Tải lên PDF giáo trình, tệp văn bản hoặc dán nội dung bài học để tổng hợp thành học liệu chỉ đọc trong Thư viện Học liệu.'
                  : 'Upload a curriculum PDF, text document, or paste lesson content to synthesize a read-only study guide directly inside the Resource Library.'}
              </p>
              <input
                type="text"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder={lang === 'vi' ? 'Tiêu đề bài học (ví dụ: Week 02 Honesty)' : 'Lesson Title (e.g. Week 02: Honesty)'}
                className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm"
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  min={1}
                  max={52}
                  value={noteWeek}
                  onChange={(e) => setNoteWeek(Number(e.target.value))}
                  className="px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm font-mono-num"
                />
                <input
                  type="text"
                  value={noteProgram}
                  onChange={(e) => setNoteProgram(e.target.value)}
                  className="col-span-2 px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm"
                />
              </div>

              <label className="block p-4 rounded-xl border border-dashed border-[#2D3E99]/30 bg-[#FDF9EE]/60 text-center cursor-pointer hover:bg-[#FDF9EE]">
                <input
                  type="file"
                  accept=".pdf,.txt,.md,.csv"
                  onChange={handleNoteFileChange}
                  className="hidden"
                />
                <span className="text-xs font-semibold text-[#2D3E99]">
                  {noteFileName ? `Selected: ${noteFileName}` : lang === 'vi' ? 'Chọn tệp PDF hoặc Text (.pdf, .txt, .md)' : 'Choose Curriculum PDF or Text (.pdf, .txt, .md)'}
                </span>
              </label>

              <textarea
                rows={5}
                value={noteRawText}
                onChange={(e) => setNoteRawText(e.target.value)}
                placeholder={lang === 'vi' ? 'Hoặc dán nội dung giáo trình tại đây...' : 'Or paste lesson text / notes here...'}
                className="w-full p-3 rounded-lg border border-[#2D3E99]/20 text-sm"
              />

              <button
                type="submit"
                disabled={busyAction === 'gemini_note'}
                className="w-full py-2.5 px-4 rounded-lg bg-[#2D3E99] text-white text-sm font-semibold hover:bg-[#22307a] cursor-pointer disabled:opacity-60"
              >
                {busyAction === 'gemini_note'
                  ? lang === 'vi'
                    ? 'Đang tổng hợp vào Thư viện Học liệu...'
                    : 'Synthesizing into Resource Library...'
                  : lang === 'vi'
                    ? 'Tổng hợp & Lưu vào Thư viện Học liệu (Chỉ đọc)'
                    : 'Synthesize & Save to Resource Library (Read-Only)'}
              </button>
            </form>

            <div
              className="lg:col-span-7 space-y-4 select-none"
              onContextMenu={(e) => e.preventDefault()}
              onCopy={(e) => e.preventDefault()}
              onCut={(e) => e.preventDefault()}
              onDragStart={(e) => e.preventDefault()}
            >
              <div className="bg-[#FDF9EE] border border-[#2D3E99]/15 rounded-xl px-4 py-2.5 flex items-center gap-2 text-xs font-semibold text-[#2D3E99]">
                <ShieldCheck className="w-4 h-4 text-[#E61E64] shrink-0" />
                <span>
                  {biText(
                    lang,
                    'Copyright Protection Active: Read-only study guides in the Resource Library cannot be downloaded.',
                    'Bảo vệ Bản quyền: Giáo trình chỉ đọc trong Thư viện Học liệu được bảo vệ chống tải xuống.'
                  )}
                </span>
              </div>

              {geminiNotes.map((note) => (
                <div key={note.id} className="bg-white border border-[#2D3E99]/12 rounded-xl p-6 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-[#E61E64]">
                        Week {note.weekNumber} · {note.programTitle}
                      </div>
                      <h4 className="font-display text-lg font-bold text-[#2D3E99] mt-0.5">{note.title}</h4>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setActiveReadOnlyNote(note)}
                        className="px-3 py-1.5 rounded-lg bg-[#2D3E99] text-white text-xs font-semibold hover:bg-[#22307a] flex items-center gap-1.5 cursor-pointer"
                      >
                        <Lock className="w-3.5 h-3.5 text-[#FFD41D]" />
                        {biText(lang, 'Read-Only', 'Chỉ đọc')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteDoc('gemini_notes', note.id)}
                        className="p-1.5 text-[#E61E64] hover:bg-[#E61E64]/10 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-[#172154]/85 leading-relaxed">
                    {lang === 'vi' ? note.summaryVi : note.summaryEn}
                  </p>
                  <div className="text-xs text-[#172154]/70 border-t border-[#2D3E99]/10 pt-3 space-y-1">
                    <div><strong className="text-[#2D3E99]">Key English:</strong> {note.keyVocabulary?.join(', ')}</div>
                    {note.phonicsFocus && <div><strong className="text-[#E61E64]">Phonics:</strong> {note.phonicsFocus}</div>}
                    {note.grammarFocus && <div><strong className="text-[#56BEB8]">Grammar:</strong> {note.grammarFocus}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: ACCOUNTS & BANKING COMMAND CENTER */}
      {activeTab === 'finance' && (
        <AdminAccountsBankingDashboard
          lang={lang}
          currentUser={safeCurrentUser}
          adminUids={adminUids}
          students={students}
          teachers={teachers}
          programs={programs}
          invoices={invoices}
          pendingPayments={pendingPayments}
          payables={payables}
          paymentMethods={paymentMethods}
          academyBankConfigs={academyBankConfigs}
          zaloDispatching={zaloDispatching}
          zaloDispatchResults={zaloDispatchResults}
          onClearZaloResults={() => setZaloDispatchResults([])}
          onSendAutomatedZaloReminders={sendAutomatedZaloPaymentReminders}
          onFlash={flash}
        />
      )}

      {/* TAB 7: OPERATIONS (Modular lazy-loaded panel) */}
      {activeTab === 'operations' && (
        <AdminOperationsPanel
          lang={lang}
          currentUser={safeCurrentUser}
          isSuperAdmin={isSuperAdmin}
          counts={{
            students: students.length,
            teachers: teachers.length,
            classes: classes.length,
            assessments: assessments.length,
            programs: programs.length,
            geminiNotes: geminiNotes.length,
            invoices: invoices.length,
            users: users.length,
          }}
          onFlash={flash}
          onAfterResetAll={handleAfterResetAll}
        />
      )}

      {activeTab === 'certificates' && (
        <CertificatesTab
          lang={lang}
          roleMode="admin"
          currentUser={safeCurrentUser}
          students={students}
          assessments={assessments}
          selectedStudentId={focusedStudentId || selectedAssessment?.studentId || students[0]?.id}
          onSelectStudentId={(id) => setFocusedStudentId(id)}
          isLoading={!studentsLoaded || !assessmentsLoaded}
        />
      )}
        </Suspense>
      </ErrorBoundary>

      {activeReadOnlyNote && (
        <Suspense fallback={null}>
          <ReadOnlyMaterialViewer
            lang={lang}
            noteId={activeReadOnlyNote.id}
            note={activeReadOnlyNote}
            viewerLabel={safeCurrentUser.email}
            onClose={() => setActiveReadOnlyNote(null)}
          />
        </Suspense>
      )}
    </div>
  );
};
