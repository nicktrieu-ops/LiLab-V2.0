import React, { lazy, Suspense, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Plus,
  Trash2,
  CalendarClock,
  Award,
  BookOpen,
  Sparkles,
  Users,
  CheckCircle2,
  X,
  Filter,
  Edit3,
  MoveRight,
  Eye,
  ArrowRight,
  RefreshCw,
  Repeat,
  GripVertical,
  RotateCcw,
  LayoutGrid,
  Columns3,
  Rows3,
  Maximize2,
  List
} from 'lucide-react';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { biText } from '../i18n';
import { isSuperAdminEmail, seedLilabMasterSchedule } from '../services/seedData';
import { buildLilabMasterSchedules } from '../data/lilabMasterSchedule';
import {
  CalendarTimeGridView,
  getWeekDaysForYmd,
  minutesToTimeStr,
  parseTimeToMinutes
} from './CalendarTimeGridView';
const QuickClassSchedulerModal = lazy(() =>
  import('./QuickClassSchedulerModal').then((m) => ({ default: m.QuickClassSchedulerModal }))
);
import {
  CEFR_LEVELS,
  type LangCode,
  type UserProfile,
  type StudentProfile,
  type TeacherProfile,
  type ProgramCourse,
  type AcademyClass,
  type ClassSchedule,
  type StudentAssessment,
  type AcademyEventRecord,
  type AcademyEventType
} from '../types';

const HIDDEN_EVENT_MARKER = '__hidden__';
const WEEKDAY_OPTIONS: ClassSchedule['dayOfWeek'][] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

export interface DisplayCalendarEvent {
  id: string;
  titleEn: string;
  titleVi: string;
  eventDate: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  eventType: AcademyEventType;
  status: 'scheduled' | 'rescheduled' | 'completed' | 'cancelled';
  location: string;
  classId?: string;
  className?: string;
  programId?: string;
  programTitle?: string;
  cefrLevel?: string;
  teacherEmail?: string;
  teacherName?: string;
  studentIds?: string[];
  studentNames?: string[];
  studentEmails?: string[];
  parentEmails?: string[];
  seriesId?: string;
  descriptionEn: string;
  descriptionVi: string;
  previousDate?: string;
  source: 'firestore' | 'schedule' | 'curated';
  createdByName?: string;
  // Recurring weekly schedule metadata (when source === 'schedule')
  scheduleId?: string;
  scheduleDayOfWeek?: ClassSchedule['dayOfWeek'];
  scheduleWeekNumber?: number;
  scheduleTopicEn?: string;
  scheduleTopicVi?: string;
  scheduleAdminUids?: string[];
}

const WEEKDAY_MAP: Record<string, number> = {
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
  sunday: 0,
  sun: 0
};

function formatYmd(year: number, monthZeroIndexed: number, day: number): string {
  const m = String(monthZeroIndexed + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

function addDaysToYmd(ymd: string, daysToAdd: number): string {
  const parts = ymd.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return ymd;
  const dt = new Date(parts[0], parts[1] - 1, parts[2] + daysToAdd);
  return formatYmd(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

const JS_DOW_TO_SCHEDULE_DAY: ClassSchedule['dayOfWeek'][] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
];

function getDayOfWeekFromYmd(ymd: string): ClassSchedule['dayOfWeek'] {
  const parts = ymd.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return 'Monday';
  const dt = new Date(parts[0], parts[1] - 1, parts[2]);
  return JS_DOW_TO_SCHEDULE_DAY[dt.getDay()] || 'Monday';
}

function buildCuratedMonthEvents(year: number, monthZeroIndexed: number): DisplayCalendarEvent[] {
  return [
    {
      id: `curated_w1_orient_${year}_${monthZeroIndexed + 1}`,
      titleEn: 'Monthly Be Whole Values & Goal-Setting Assembly',
      titleVi: 'Sinh hoạt Chuyên đề Giá trị Be Whole & Đặt Mục tiêu Tháng',
      eventDate: formatYmd(year, monthZeroIndexed, 5),
      startTime: '09:00',
      endTime: '10:30',
      eventType: 'academy_milestone',
      status: 'scheduled',
      location: 'LiLab Main Hall · Room A1',
      cefrLevel: 'All CEFR Levels',
      descriptionEn:
        'Students set monthly Mind-Heart-Body learning intentions and practice mindful public speaking introductions.',
      descriptionVi:
        'Học viên thiết lập mục tiêu Tâm - Trí - Thân trong tháng và thực hành thuyết trình chào hỏi chánh niệm.',
      source: 'curated'
    },
    {
      id: `curated_mid_cefr_${year}_${monthZeroIndexed + 1}`,
      titleEn: 'Cambridge CEFR Speaking & Listening Checkpoint',
      titleVi: 'Kỳ Đánh giá Định kỳ Kỹ năng Nói & Nghe Cambridge CEFR',
      eventDate: formatYmd(year, monthZeroIndexed, 14),
      startTime: '14:00',
      endTime: '16:30',
      eventType: 'cefr_assessment',
      status: 'scheduled',
      location: 'Assessment Studio B2',
      cefrLevel: 'Pre-A1 Starters – B2 First',
      descriptionEn:
        'Formal 1-on-1 and paired speaking & listening diagnostic to track CEFR +/- modifier progression.',
      descriptionVi:
        'Bài kiểm tra vấn đáp 1-1 và theo cặp nhằm theo dõi sự tiến bộ chuẩn thang Cambridge CEFR (+/-).',
      source: 'curated'
    },
    {
      id: `curated_parent_wk_${year}_${monthZeroIndexed + 1}`,
      titleEn: 'Bilingual Parent-Teacher Tea & Portfolio Review',
      titleVi: 'Trà chiều Phụ huynh - Giáo viên & Triển lãm Hồ sơ Học tập',
      eventDate: formatYmd(year, monthZeroIndexed, 21),
      startTime: '15:30',
      endTime: '17:00',
      eventType: 'parent_workshop',
      status: 'scheduled',
      location: 'LiLab Reading Garden',
      cefrLevel: 'All Families',
      descriptionEn:
        'Parents review student writing journals, 8-skill radar progress, and home reading strategies with faculty.',
      descriptionVi:
        'Phụ huynh cùng giáo viên xem lại nhật ký viết, biểu đồ 8 kỹ năng và phương pháp đồng hành đọc sách tại nhà.',
      source: 'curated'
    },
    {
      id: `curated_final_cefr_${year}_${monthZeroIndexed + 1}`,
      titleEn: 'End-of-Month CEFR Reading, Writing & Values Milestone',
      titleVi: 'Đánh giá Tổng kết Tháng: Đọc, Viết & Giá trị Sống Be Whole',
      eventDate: formatYmd(year, monthZeroIndexed, 27),
      startTime: '09:30',
      endTime: '11:30',
      eventType: 'cefr_assessment',
      status: 'scheduled',
      location: 'LiLab Academic Wing',
      cefrLevel: 'All CEFR Cohorts',
      descriptionEn:
        'Comprehensive monthly checkpoint for Reading, Writing, Vocabulary, and Be Whole reflection journals.',
      descriptionVi:
        'Bài đánh giá tổng hợp cuối tháng cho các kỹ năng Đọc, Viết, Từ vựng và nhật ký phản tư Be Whole.',
      source: 'curated'
    }
  ];
}

interface AcademyEventCalendarProps {
  lang: LangCode;
  currentUser?: UserProfile | null;
  portalMode?: 'parent_student' | 'teacher' | 'admin';
  student?: StudentProfile | null;
  students?: StudentProfile[];
  teachers?: TeacherProfile[];
  programs?: ProgramCourse[];
  classes?: AcademyClass[];
  schedules?: ClassSchedule[];
  assessments?: StudentAssessment[];
}

export const AcademyEventCalendar: React.FC<AcademyEventCalendarProps> = ({
  lang,
  currentUser,
  portalMode = 'parent_student',
  student,
  students = [],
  teachers = [],
  programs = [],
  classes: propClasses,
  schedules: propSchedules
}) => {
  const safeEmail = (currentUser?.email || auth.currentUser?.email || '').trim().toLowerCase();
  const now = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState<number>(now.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(now.getMonth()); // 0-11
  const [selectedDate, setSelectedDate] = useState<string>(
    formatYmd(now.getFullYear(), now.getMonth(), now.getDate())
  );
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | AcademyEventType>('all');
  const [myClassesOnly, setMyClassesOnly] = useState<boolean>(false);
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string>('all');
  const [adminTeacherFilter, setAdminTeacherFilter] = useState<string>('all');
  const [adminStudentFilter, setAdminStudentFilter] = useState<string>('all');
  const [showQuickClassModal, setShowQuickClassModal] = useState(false);
  const [quickClassInitialDate, setQuickClassInitialDate] = useState<string>(
    formatYmd(now.getFullYear(), now.getMonth(), now.getDate())
  );
  const [isSyncingMaster, setIsSyncingMaster] = useState(false);
  const [confirmDeleteEventId, setConfirmDeleteEventId] = useState<string | null>(null);
  const autoSeedAttemptedRef = useRef(false);

  // Firestore `academy_events`
  const [firestoreEvents, setFirestoreEvents] = useState<AcademyEventRecord[]>([]);
  // Live `schedules` & `classes` listeners (when not passed as props)
  const [fetchedSchedules, setFetchedSchedules] = useState<ClassSchedule[]>([]);
  const [fetchedClasses, setFetchedClasses] = useState<AcademyClass[]>([]);
  const [schedulesLoaded, setSchedulesLoaded] = useState(false);

  const isAdminUser = Boolean(
    portalMode === 'admin' &&
      (currentUser?.role === 'super_admin' ||
        currentUser?.role === 'admin' ||
        isSuperAdminEmail(safeEmail))
  );
  const isTeacherUser = Boolean(portalMode === 'teacher');
  const showMyClassesToggle = portalMode === 'teacher' || portalMode === 'parent_student';
  const isMyClassesActive = showMyClassesToggle && myClassesOnly;
  const canManageCalendar = isAdminUser;

  const toggleMyClassesOnly = () => {
    setMyClassesOnly((prev) => {
      const next = !prev;
      if (next) {
        setSelectedTypeFilter('all');
      }
      return next;
    });
  };

  // Calendar view mode & Admin Drag-and-Drop scope
  const [calendarView, setCalendarView] = useState<'month' | 'week' | 'day'>('month');
  const [dragScope, setDragScope] = useState<'single_date' | 'weekly_schedule'>('single_date');

  // Double-click Day View Popup Modal state (for inspecting packed days in full room/hour detail)
  const [dayPopupDate, setDayPopupDate] = useState<string | null>(null);
  const [dayPopupTab, setDayPopupTab] = useState<'timeline' | 'list'>('timeline');

  // Event Preview Window state (shown when clicking any event in any view)
  const [previewEvent, setPreviewEvent] = useState<DisplayCalendarEvent | null>(null);
  const [quickMoveTargetDate, setQuickMoveTargetDate] = useState<string>('');
  const [quickMoveStartTime, setQuickMoveStartTime] = useState<string>('18:00');
  const [quickMoveEndTime, setQuickMoveEndTime] = useState<string>('19:30');

  // Interactive "Click a Date on Calendar Grid to Move Event" & Drag-and-Drop state for Admin
  const [movingEvent, setMovingEvent] = useState<DisplayCalendarEvent | null>(null);
  const [draggedEvent, setDraggedEvent] = useState<DisplayCalendarEvent | null>(null);
  const [dragOverDateStr, setDragOverDateStr] = useState<string | null>(null);
  const [lastMoveUndo, setLastMoveUndo] = useState<{
    kind: 'academy_event_created' | 'academy_event_updated' | 'weekly_schedule_updated';
    docId: string;
    label: string;
    previousData?: Record<string, unknown>;
  } | null>(null);

  // Admin Add / Edit / Reschedule Form Modal state
  const [showEventModal, setShowEventModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'reschedule'>('create');
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingEventSource, setEditingEventSource] = useState<'firestore' | 'schedule' | 'curated' | null>(null);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [editingScheduleMeta, setEditingScheduleMeta] = useState<{
    classId: string;
    adminUids: string[];
  } | null>(null);
  const [editScope, setEditScope] = useState<'single_date' | 'weekly_schedule'>('single_date');
  const [originalDateForReschedule, setOriginalDateForReschedule] = useState<string>('');
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formTitleEn, setFormTitleEn] = useState('');
  const [formTitleVi, setFormTitleVi] = useState('');
  const [formEventDate, setFormEventDate] = useState(selectedDate);
  const [formDayOfWeek, setFormDayOfWeek] = useState<ClassSchedule['dayOfWeek']>('Monday');
  const [formWeekNumber, setFormWeekNumber] = useState<number>(1);
  const [formStartTime, setFormStartTime] = useState('09:00');
  const [formEndTime, setFormEndTime] = useState('10:30');
  const [formEventType, setFormEventType] = useState<AcademyEventType>('cefr_assessment');
  const [formStatus, setFormStatus] = useState<'scheduled' | 'rescheduled' | 'completed' | 'cancelled'>('scheduled');
  const [formLocation, setFormLocation] = useState('Phòng 1');
  const [formClassId, setFormClassId] = useState('');
  const [formCefrLevel, setFormCefrLevel] = useState<string>(student?.cefrLevel || 'A1 Movers');
  const [formTeacherEmail, setFormTeacherEmail] = useState('');
  const [formTeacherName, setFormTeacherName] = useState('');
  const [formStudentIds, setFormStudentIds] = useState<string[]>([]);
  const [formDescriptionEn, setFormDescriptionEn] = useState('');
  const [formDescriptionVi, setFormDescriptionVi] = useState('');

  // Subscribe to `academy_events`
  useEffect(() => {
    const q = query(collection(db, 'academy_events'), orderBy('eventDate', 'asc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: AcademyEventRecord[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as Omit<AcademyEventRecord, 'id'>;
          list.push({
            ...data,
            id: docSnap.id
          });
        });
        setFirestoreEvents(list);
      },
      (err) => {
        console.warn('AcademyEventCalendar listener warning:', err);
      }
    );
    return () => unsub();
  }, []);

  // Subscribe to `schedules` if propSchedules not supplied
  useEffect(() => {
    if (propSchedules !== undefined) {
      setSchedulesLoaded(true);
      return;
    }
    const unsub = onSnapshot(
      collection(db, 'schedules'),
      (snap) => {
        const list: ClassSchedule[] = [];
        snap.forEach((d) => {
          list.push({ ...(d.data() as Omit<ClassSchedule, 'id'>), id: d.id });
        });
        setFetchedSchedules(list);
        setSchedulesLoaded(true);
      },
      () => {
        setSchedulesLoaded(true);
      }
    );
    return () => unsub();
  }, [propSchedules]);

  // Subscribe to `classes` if propClasses not supplied (used for parent/student & teacher class matching)
  useEffect(() => {
    if (propClasses !== undefined) return;
    const unsub = onSnapshot(
      collection(db, 'classes'),
      (snap) => {
        const list: AcademyClass[] = [];
        snap.forEach((d) => {
          list.push({ ...(d.data() as Omit<AcademyClass, 'id'>), id: d.id });
        });
        setFetchedClasses(list);
      },
      () => {
        // Ignore non-critical listener errors
      }
    );
    return () => unsub();
  }, [propClasses]);

  const rawSchedules = useMemo(
    () => (propSchedules !== undefined ? propSchedules : fetchedSchedules),
    [propSchedules, fetchedSchedules]
  );

  const classes = useMemo(
    () => (propClasses !== undefined ? propClasses : fetchedClasses),
    [propClasses, fetchedClasses]
  );

  // Auto-seed the 13 LiLab PDF group classes (26 weekly sessions) into Firestore once for Admins
  useEffect(() => {
    if (!canManageCalendar || !schedulesLoaded || autoSeedAttemptedRef.current) return;
    const hasMasterSchedule = rawSchedules.some((s) => s.id.startsWith('sched_lilab_'));
    if (hasMasterSchedule) {
      autoSeedAttemptedRef.current = true;
      return;
    }
    const seededFlag = typeof window !== 'undefined' ? window.localStorage.getItem('lilab_master_sched_seeded_v1') : null;
    if (seededFlag === '1') {
      autoSeedAttemptedRef.current = true;
      return;
    }
    autoSeedAttemptedRef.current = true;
    const uid = currentUser?.uid || auth.currentUser?.uid || 'admin';
    const email = safeEmail || 'lilabvietnam@gmail.com';
    void seedLilabMasterSchedule(uid, email, false).then(({ created }) => {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('lilab_master_sched_seeded_v1', '1');
      }
      if (created > 0) {
        setStatusBanner(
          biText(
            lang,
            `Synced ${created} LiLab weekly group sessions (13 classes across Phòng 1–3) to the calendar. Click any class to edit!`,
            `Đã đồng bộ ${created} buổi học từ Lịch nhóm LiLab (13 lớp tại Phòng 1–3) vào lịch. Nhấp vào bất kỳ buổi nào để chỉnh sửa!`
          )
        );
      }
    });
  }, [canManageCalendar, schedulesLoaded, rawSchedules, currentUser?.uid, safeEmail, lang]);

  const viewerEmail = safeEmail;
  const viewerUid = currentUser?.uid || auth.currentUser?.uid || '';

  // Unified class & student assignment scope for Teacher / Parent / Student filtering
  const viewerAssignmentScope = useMemo(() => {
    const assignedTeacherClassIds = new Set<string>();
    const targetStudentIds = new Set<string>();
    const targetEmails = new Set<string>();
    const enrolledClassIds = new Set<string>();

    if (viewerEmail) targetEmails.add(viewerEmail);

    if (portalMode === 'teacher') {
      classes.forEach((c) => {
        const clsTeacherEmail = (c.teacherEmail || '').trim().toLowerCase();
        if (
          (viewerEmail && clsTeacherEmail === viewerEmail) ||
          (viewerUid && c.teacherUid && c.teacherUid === viewerUid)
        ) {
          assignedTeacherClassIds.add(c.id);
        }
      });
    }

    if (student) {
      targetStudentIds.add(student.id);
      if (student.studentEmail) targetEmails.add(student.studentEmail.trim().toLowerCase());
      if (student.parentEmail) targetEmails.add(student.parentEmail.trim().toLowerCase());
      (student.enrolledClassIds || []).forEach((cid) => enrolledClassIds.add(cid));
    } else if (students.length > 0 && portalMode === 'parent_student') {
      students.forEach((s) => {
        targetStudentIds.add(s.id);
        if (s.studentEmail) targetEmails.add(s.studentEmail.trim().toLowerCase());
        if (s.parentEmail) targetEmails.add(s.parentEmail.trim().toLowerCase());
        (s.enrolledClassIds || []).forEach((cid) => enrolledClassIds.add(cid));
      });
    }

    if (portalMode === 'parent_student' && targetStudentIds.size > 0) {
      classes.forEach((c) => {
        if ((c.studentIds || []).some((sid) => targetStudentIds.has(sid))) {
          enrolledClassIds.add(c.id);
        }
      });
    }

    return {
      assignedTeacherClassIds,
      targetStudentIds,
      targetEmails,
      enrolledClassIds
    };
  }, [portalMode, viewerEmail, viewerUid, classes, student, students]);

  const activeSchedules = useMemo(() => {
    // If Firestore schedules hasn't received the LiLab schedule yet and we are in admin view, show master slots immediately
    const sourceList =
      rawSchedules.length > 0
        ? rawSchedules
        : portalMode === 'admin'
          ? buildLilabMasterSchedules(currentUser?.uid || 'admin', safeEmail || 'lilabvietnam@gmail.com')
          : rawSchedules;

    if (portalMode === 'teacher') {
      return sourceList.filter((s) => {
        const schedTeacherEmail = (s.teacherEmail || '').trim().toLowerCase();
        return (
          (Boolean(viewerEmail) && schedTeacherEmail === viewerEmail) ||
          (Boolean(viewerUid) && s.teacherUid === viewerUid) ||
          viewerAssignmentScope.assignedTeacherClassIds.has(s.classId)
        );
      });
    }
    if (portalMode === 'parent_student') {
      if (viewerAssignmentScope.enrolledClassIds.size === 0) return [];
      return sourceList.filter((s) => viewerAssignmentScope.enrolledClassIds.has(s.classId));
    }
    return sourceList;
  }, [
    rawSchedules,
    portalMode,
    viewerEmail,
    viewerUid,
    viewerAssignmentScope.assignedTeacherClassIds,
    viewerAssignmentScope.enrolledClassIds,
    currentUser?.uid,
    safeEmail
  ]);

  const availableRooms = useMemo(() => {
    const set = new Set<string>(['Phòng 1', 'Phòng 2', 'Phòng 3', 'Phòng 4']);
    activeSchedules.forEach((s) => {
      if (s.room) set.add(s.room);
    });
    firestoreEvents.forEach((e) => {
      if (e.location && e.location !== HIDDEN_EVENT_MARKER) set.add(e.location);
    });
    return Array.from(set);
  }, [activeSchedules, firestoreEvents]);

  const handleSyncLilabMasterSchedule = async () => {
    if (!canManageCalendar || isSyncingMaster) return;
    setIsSyncingMaster(true);
    try {
      const uid = currentUser?.uid || auth.currentUser?.uid || 'admin';
      const email = safeEmail || 'lilabvietnam@gmail.com';
      const { created, skipped } = await seedLilabMasterSchedule(uid, email, false);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('lilab_master_sched_seeded_v1', '1');
      }
      flash(
        created > 0
          ? biText(
              lang,
              `Added ${created} LiLab master schedule sessions to the calendar (${skipped} already present). All items are editable!`,
              `Đã thêm ${created} buổi học từ Lịch chuẩn LiLab vào lịch (${skipped} buổi đã tồn tại). Quản trị viên có thể chỉnh sửa tất cả!`
            )
          : biText(
              lang,
              `All 13 LiLab classes (${skipped} weekly sessions) are already on the calendar and ready to edit.`,
              `Cả 13 lớp LiLab (${skipped} buổi/tuần) đã có đầy đủ trên lịch và sẵn sàng chỉnh sửa.`
            )
      );
    } catch (err) {
      console.error('Failed to sync LiLab master schedule:', err);
      flash(biText(lang, 'Could not sync master schedule. Please try again.', 'Không thể đồng bộ lịch chuẩn. Vui lòng thử lại.'));
    } finally {
      setIsSyncingMaster(false);
    }
  };

  const flash = (msg: string) => {
    setStatusBanner(msg);
    setTimeout(() => {
      setStatusBanner((prev) => (prev === msg ? null : prev));
    }, 7500);
  };

  // Helper to check if a Firestore event is strictly an assigned class for the current Teacher / Parent / Student
  const isEventStrictlyAssignedClass = useCallback(
    (e: AcademyEventRecord): boolean => {
      if (e.location === HIDDEN_EVENT_MARKER) return false;
      if (e.eventType !== 'class_session') return false;

      if (portalMode === 'teacher') {
        const assignedTeacher = (e.teacherEmail || '').trim().toLowerCase();
        if (viewerEmail && assignedTeacher === viewerEmail) return true;
        if (e.classId && viewerAssignmentScope.assignedTeacherClassIds.has(e.classId)) return true;
        return false;
      }

      if (portalMode === 'parent_student') {
        const matchesId = (e.studentIds || []).some((sid) =>
          viewerAssignmentScope.targetStudentIds.has(sid)
        );
        const matchesStuEmail = (e.studentEmails || []).some((em) =>
          viewerAssignmentScope.targetEmails.has(em.trim().toLowerCase())
        );
        const matchesParEmail = (e.parentEmails || []).some((em) =>
          viewerAssignmentScope.targetEmails.has(em.trim().toLowerCase())
        );
        const matchesClass = e.classId ? viewerAssignmentScope.enrolledClassIds.has(e.classId) : false;
        return matchesId || matchesStuEmail || matchesParEmail || matchesClass;
      }

      return false;
    },
    [portalMode, viewerEmail, viewerAssignmentScope]
  );

  // Combine Firestore events + recurring class schedules for the viewed month + curated milestones
  const monthEvents = useMemo<DisplayCalendarEvent[]>(() => {
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const fsIds = new Set(firestoreEvents.map((e) => e.id));
    const {
      assignedTeacherClassIds,
      targetStudentIds,
      targetEmails,
      enrolledClassIds
    } = viewerAssignmentScope;

    // 1. Firestore events with strict teacher / student calendar targeting (skip hidden/deleted overrides)
    const mappedFirestore: DisplayCalendarEvent[] = firestoreEvents
      .filter((e) => {
        if (e.location === HIDDEN_EVENT_MARKER) return false;

        // When "My Classes" toggle is ON for Teacher / Parent / Student, ONLY show strictly assigned class sessions
        if (isMyClassesActive) {
          return isEventStrictlyAssignedClass(e);
        }

        const assignedTeacher = (e.teacherEmail || '').trim().toLowerCase();
        const hasAssignedStudents =
          (e.studentIds && e.studentIds.length > 0) ||
          (e.studentEmails && e.studentEmails.length > 0) ||
          (e.parentEmails && e.parentEmails.length > 0);

        if (portalMode === 'teacher') {
          if (assignedTeacher) {
            return (
              assignedTeacher === viewerEmail ||
              (e.classId ? assignedTeacherClassIds.has(e.classId) : false)
            );
          }
          if (e.eventType === 'class_session' && e.classId) {
            const matchedClass = classes.find((c) => c.id === e.classId);
            if (matchedClass && matchedClass.teacherEmail.toLowerCase() !== viewerEmail) {
              return false;
            }
          }
          return true;
        }

        if (portalMode === 'parent_student') {
          if (hasAssignedStudents) {
            const matchesId = (e.studentIds || []).some((sid) => targetStudentIds.has(sid));
            const matchesStuEmail = (e.studentEmails || []).some((em) =>
              targetEmails.has(em.trim().toLowerCase())
            );
            const matchesParEmail = (e.parentEmails || []).some((em) =>
              targetEmails.has(em.trim().toLowerCase())
            );
            const matchesClass = e.classId ? enrolledClassIds.has(e.classId) : false;
            return matchesId || matchesStuEmail || matchesParEmail || matchesClass;
          }
          if (e.eventType === 'class_session' && e.classId) {
            return enrolledClassIds.has(e.classId);
          }
          return true;
        }

        if (adminTeacherFilter !== 'all') {
          if (assignedTeacher && assignedTeacher !== adminTeacherFilter) return false;
          if (!assignedTeacher && e.eventType === 'class_session') return false;
        }
        if (adminStudentFilter !== 'all') {
          if (hasAssignedStudents && !(e.studentIds || []).includes(adminStudentFilter)) {
            return false;
          }
          if (!hasAssignedStudents && e.eventType === 'class_session') return false;
        }
        return true;
      })
      .map((e) => ({
        id: e.id,
        titleEn: e.titleEn,
        titleVi: e.titleVi || e.titleEn,
        eventDate: e.eventDate,
        startTime: e.startTime,
        endTime: e.endTime,
        eventType: e.eventType,
        status: e.status,
        location: e.location,
        classId: e.classId,
        className: e.className,
        programId: e.programId,
        programTitle: e.programTitle,
        cefrLevel: e.cefrLevel,
        teacherEmail: e.teacherEmail,
        teacherName: e.teacherName,
        studentIds: e.studentIds,
        studentNames: e.studentNames,
        studentEmails: e.studentEmails,
        parentEmails: e.parentEmails,
        seriesId: e.seriesId,
        descriptionEn: e.descriptionEn,
        descriptionVi: e.descriptionVi || e.descriptionEn,
        previousDate: e.previousDate,
        createdByName: e.createdByName,
        source: 'firestore'
      }));

    // 2. Recurring weekly class schedules projected across all visible month cells + active week dates
    const projectionDates = new Map<string, Date>();
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
    const startOffset = (firstDayOfMonth.getDay() + 6) % 7;
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
      const dt = new Date(viewYear, viewMonth - 1, prevMonthDays - i);
      projectionDates.set(formatYmd(dt.getFullYear(), dt.getMonth(), dt.getDate()), dt);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const dt = new Date(viewYear, viewMonth, day);
      projectionDates.set(formatYmd(viewYear, viewMonth, day), dt);
    }
    const gridTotal = projectionDates.size > 35 ? 42 : 35;
    const trailing = gridTotal - projectionDates.size;
    for (let d = 1; d <= trailing; d++) {
      const dt = new Date(viewYear, viewMonth + 1, d);
      projectionDates.set(formatYmd(dt.getFullYear(), dt.getMonth(), dt.getDate()), dt);
    }
    const activeWeekDays = getWeekDaysForYmd(
      selectedDate,
      formatYmd(now.getFullYear(), now.getMonth(), now.getDate())
    );
    activeWeekDays.forEach((wd) => {
      if (!projectionDates.has(wd.dateStr)) {
        const parts = wd.dateStr.split('-').map(Number);
        if (parts.length === 3 && !parts.some(Number.isNaN)) {
          projectionDates.set(wd.dateStr, new Date(parts[0], parts[1] - 1, parts[2]));
        }
      }
    });

    const projectedSchedules: DisplayCalendarEvent[] = [];
    activeSchedules.forEach((sched) => {
      if (sched.status === 'cancelled') return;
      if (
        portalMode === 'admin' &&
        adminTeacherFilter !== 'all' &&
        (sched.teacherEmail || '').toLowerCase() !== adminTeacherFilter
      ) {
        return;
      }
      if (portalMode === 'admin' && adminStudentFilter !== 'all') {
        const cls = classes.find((c) => c.id === sched.classId);
        if (!cls || !(cls.studentIds || []).includes(adminStudentFilter)) return;
      }

      const targetDow = WEEKDAY_MAP[(sched.dayOfWeek || '').trim().toLowerCase()];
      if (targetDow === undefined) return;

      projectionDates.forEach((dateObj, dateStr) => {
        if (dateObj.getDay() === targetDow) {
          const syntheticId = `sched_${sched.id}_${dateStr}`;
          if (fsIds.has(syntheticId)) return;

          const cls = classes.find((c) => c.id === sched.classId);
          projectedSchedules.push({
            id: syntheticId,
            titleEn: sched.topicEn ? `${sched.className} · ${sched.room || 'Phòng 1'}` : sched.className,
            titleVi: `${sched.className} · ${sched.room || 'Phòng 1'}`,
            eventDate: dateStr,
            startTime: sched.startTime || '18:00',
            endTime: sched.endTime || '19:30',
            eventType: 'class_session',
            status: sched.status === 'completed' ? 'completed' : 'scheduled',
            location: sched.room || 'Phòng 1',
            classId: sched.classId,
            className: sched.className,
            cefrLevel: cls?.cefrLevel || 'Group Class',
            teacherEmail: sched.teacherEmail,
            teacherName: sched.teacherName,
            studentIds: cls?.studentIds,
            descriptionEn: sched.topicEn || `Week ${sched.weekNumber} Class Session · Teacher: ${sched.teacherName}`,
            descriptionVi: sched.topicVi || sched.topicEn || `Buổi học Tuần ${sched.weekNumber} · Giáo viên: ${sched.teacherName}`,
            source: 'schedule',
            scheduleId: sched.id,
            scheduleDayOfWeek: sched.dayOfWeek,
            scheduleWeekNumber: sched.weekNumber || 1,
            scheduleTopicEn: sched.topicEn || '',
            scheduleTopicVi: sched.topicVi || '',
            scheduleAdminUids: sched.adminUids
          });
        }
      });
    });

    // 3. Curated Academy Milestones & CEFR Assessment Checkpoints (hidden when "My Classes" filter is active)
    const curated = isMyClassesActive
      ? []
      : buildCuratedMonthEvents(viewYear, viewMonth).filter((c) => !fsIds.has(c.id));

    const combined = [...mappedFirestore, ...projectedSchedules, ...curated];
    return combined
      .filter((ev) => {
        if (!isMyClassesActive && selectedTypeFilter !== 'all' && ev.eventType !== selectedTypeFilter) {
          return false;
        }
        if (selectedRoomFilter !== 'all' && ev.location !== selectedRoomFilter) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.eventDate !== b.eventDate) return a.eventDate.localeCompare(b.eventDate);
        if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
        return a.location.localeCompare(b.location);
      });
  }, [
    firestoreEvents,
    activeSchedules,
    viewYear,
    viewMonth,
    selectedDate,
    now,
    selectedTypeFilter,
    selectedRoomFilter,
    isMyClassesActive,
    isEventStrictlyAssignedClass,
    viewerAssignmentScope,
    portalMode,
    viewerEmail,
    classes,
    adminTeacherFilter,
    adminStudentFilter
  ]);

  // Live count of strictly assigned class sessions in the currently viewed month (for the "My Classes" button badge)
  const myAssignedClassMonthCount = useMemo(() => {
    if (!showMyClassesToggle) return 0;
    const prefix = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
    const fsIds = new Set(firestoreEvents.map((e) => e.id));
    let count = firestoreEvents.filter(
      (e) => e.eventDate.startsWith(prefix) && isEventStrictlyAssignedClass(e)
    ).length;

    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    activeSchedules.forEach((sched) => {
      if (sched.status === 'cancelled') return;
      const targetDow = WEEKDAY_MAP[(sched.dayOfWeek || '').trim().toLowerCase()];
      if (targetDow === undefined) return;
      for (let day = 1; day <= daysInMonth; day++) {
        const dt = new Date(viewYear, viewMonth, day);
        if (dt.getDay() === targetDow) {
          const dateStr = formatYmd(viewYear, viewMonth, day);
          if (!fsIds.has(`sched_${sched.id}_${dateStr}`)) {
            count += 1;
          }
        }
      }
    });
    return count;
  }, [
    showMyClassesToggle,
    viewYear,
    viewMonth,
    firestoreEvents,
    activeSchedules,
    isEventStrictlyAssignedClass
  ]);

  // Build 35 or 42 cell (Monday-first) calendar grid for viewYear & viewMonth
  const calendarCells = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const startOffset = (firstDayOfMonth.getDay() + 6) % 7;

    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();
    const cells: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      events: DisplayCalendarEvent[];
    }> = [];

    const todayStr = formatYmd(now.getFullYear(), now.getMonth(), now.getDate());

    for (let i = startOffset - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const prevDate = new Date(viewYear, viewMonth - 1, d);
      const dateStr = formatYmd(prevDate.getFullYear(), prevDate.getMonth(), prevDate.getDate());
      cells.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        events: monthEvents.filter((e) => e.eventDate === dateStr)
      });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = formatYmd(viewYear, viewMonth, d);
      cells.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        events: monthEvents.filter((e) => e.eventDate === dateStr)
      });
    }

    const totalCells = cells.length > 35 ? 42 : 35;
    const remaining = totalCells - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(viewYear, viewMonth + 1, d);
      const dateStr = formatYmd(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate());
      cells.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        events: monthEvents.filter((e) => e.eventDate === dateStr)
      });
    }

    return cells;
  }, [viewYear, viewMonth, monthEvents, now]);

  const selectedDayEvents = useMemo(
    () => monthEvents.filter((e) => e.eventDate === selectedDate),
    [monthEvents, selectedDate]
  );

  const upcomingMonthEvents = useMemo(() => {
    const prefix = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
    return monthEvents.filter((e) => e.eventDate.startsWith(prefix));
  }, [monthEvents, viewYear, viewMonth]);

  const syncDateSelection = (dateStr: string) => {
    setSelectedDate(dateStr);
    const parts = dateStr.split('-').map(Number);
    if (parts.length === 3 && !parts.some(Number.isNaN)) {
      setViewYear(parts[0]);
      setViewMonth(parts[1] - 1);
    }
  };

  const openDayViewPopup = (dateStr: string) => {
    syncDateSelection(dateStr);
    setDayPopupDate(dateStr);
  };

  // Close top-most modal on Escape key
  useEffect(() => {
    if (!dayPopupDate && !previewEvent && !showEventModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showEventModal) {
        setShowEventModal(false);
      } else if (previewEvent) {
        setPreviewEvent(null);
      } else if (dayPopupDate) {
        setDayPopupDate(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dayPopupDate, previewEvent, showEventModal]);

  const dayPopupEvents = useMemo(
    () => (dayPopupDate ? monthEvents.filter((e) => e.eventDate === dayPopupDate) : []),
    [dayPopupDate, monthEvents]
  );

  const handlePrevPeriod = () => {
    if (calendarView === 'week') {
      syncDateSelection(addDaysToYmd(selectedDate, -7));
      return;
    }
    if (calendarView === 'day') {
      syncDateSelection(addDaysToYmd(selectedDate, -1));
      return;
    }
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextPeriod = () => {
    if (calendarView === 'week') {
      syncDateSelection(addDaysToYmd(selectedDate, 7));
      return;
    }
    if (calendarView === 'day') {
      syncDateSelection(addDaysToYmd(selectedDate, 1));
      return;
    }
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleJumpToday = () => {
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();
    setViewYear(y);
    setViewMonth(m);
    setSelectedDate(formatYmd(y, m, d));
  };

  const openEventPreview = (ev: DisplayCalendarEvent) => {
    setSelectedDate(ev.eventDate);
    setQuickMoveTargetDate(ev.eventDate);
    setQuickMoveStartTime(ev.startTime || '18:00');
    setQuickMoveEndTime(ev.endTime || '19:30');
    setPreviewEvent(ev);
  };

  const openQuickClassScheduler = (prefillDate?: string) => {
    const targetDate = prefillDate || selectedDate;
    setQuickClassInitialDate(targetDate);
    setShowQuickClassModal(true);
  };

  const openCreateEventModal = (
    prefillDate?: string,
    prefillStartTime?: string,
    prefillEndTime?: string,
    prefillLocation?: string
  ) => {
    const targetDate = prefillDate || selectedDate;
    setModalMode('create');
    setEditingEventId(null);
    setEditingEventSource(null);
    setEditingScheduleId(null);
    setEditingScheduleMeta(null);
    setEditScope('single_date');
    setOriginalDateForReschedule('');
    setFormTitleEn('');
    setFormTitleVi('');
    setFormEventDate(targetDate);
    setFormDayOfWeek(getDayOfWeekFromYmd(targetDate));
    setFormWeekNumber(1);
    setFormStartTime(prefillStartTime || '18:00');
    setFormEndTime(prefillEndTime || '19:30');
    setFormEventType('class_session');
    setFormStatus('scheduled');
    setFormLocation(prefillLocation || 'Phòng 1');
    setFormClassId(classes[0]?.id || '');
    setFormCefrLevel(student?.cefrLevel || 'All CEFR Levels');
    setFormTeacherEmail('');
    setFormTeacherName('');
    setFormStudentIds([]);
    setFormDescriptionEn('');
    setFormDescriptionVi('');
    setShowEventModal(true);
  };

  const openRescheduleModal = (ev: DisplayCalendarEvent) => {
    setPreviewEvent(null);
    setConfirmDeleteEventId(null);
    setModalMode('reschedule');
    setEditingEventId(ev.id);
    setEditingEventSource(ev.source);
    setEditingScheduleId(ev.scheduleId || null);
    setEditingScheduleMeta(
      ev.source === 'schedule'
        ? {
            classId: ev.classId || `cls_${Date.now()}`,
            adminUids: ev.scheduleAdminUids && ev.scheduleAdminUids.length > 0
              ? ev.scheduleAdminUids
              : [currentUser?.uid || auth.currentUser?.uid || 'admin']
          }
        : null
    );
    setEditScope(ev.source === 'schedule' ? 'weekly_schedule' : 'single_date');
    setOriginalDateForReschedule(ev.eventDate);
    setFormTitleEn(ev.source === 'schedule' ? ev.className || ev.titleEn : ev.titleEn);
    setFormTitleVi(ev.source === 'schedule' ? ev.className || ev.titleVi : ev.titleVi);
    setFormEventDate(ev.eventDate);
    setFormDayOfWeek(ev.scheduleDayOfWeek || 'Monday');
    setFormWeekNumber(ev.scheduleWeekNumber || 1);
    setFormStartTime(ev.startTime);
    setFormEndTime(ev.endTime);
    setFormEventType(ev.eventType);
    setFormStatus(ev.status);
    setFormLocation(ev.location);
    setFormClassId(ev.classId || '');
    setFormCefrLevel(ev.cefrLevel || 'All CEFR Levels');
    setFormTeacherEmail(ev.teacherEmail || '');
    setFormTeacherName(ev.teacherName || '');
    setFormStudentIds(ev.studentIds || []);
    setFormDescriptionEn(ev.source === 'schedule' ? ev.scheduleTopicEn || ev.descriptionEn : ev.descriptionEn);
    setFormDescriptionVi(ev.source === 'schedule' ? ev.scheduleTopicVi || ev.descriptionVi : ev.descriptionVi);
    setShowEventModal(true);
  };

  // Unified 1-step reschedule via Drag-and-Drop (Days / Times / Rooms), Click-to-Move, Bottom Resize, or Preview Quick Move
  const handleRescheduleEventDrop = async (
    ev: DisplayCalendarEvent,
    updates: {
      eventDate?: string;
      startTime?: string;
      endTime?: string;
      location?: string;
    },
    scopeOverride?: 'single_date' | 'weekly_schedule'
  ) => {
    if (!canManageCalendar) {
      setMovingEvent(null);
      return;
    }

    const nextDate = (updates.eventDate || ev.eventDate).slice(0, 20);
    const nextStart = (updates.startTime || ev.startTime || '09:00').slice(0, 20);
    let nextEnd = (updates.endTime || ev.endTime || '10:30').slice(0, 20);
    // Preserve duration automatically if only startTime was supplied
    if (updates.startTime && !updates.endTime) {
      const oldStartMin = parseTimeToMinutes(ev.startTime, 9 * 60);
      const oldEndMin = parseTimeToMinutes(ev.endTime, oldStartMin + 90);
      const dur = Math.max(30, oldEndMin - oldStartMin);
      const newStartMin = parseTimeToMinutes(updates.startTime, oldStartMin);
      nextEnd = minutesToTimeStr(Math.min(22 * 60, newStartMin + dur));
    }
    const nextLocation = (updates.location || ev.location || 'Phòng 1').slice(0, 120);

    const hasChanged =
      nextDate !== ev.eventDate ||
      nextStart !== ev.startTime ||
      nextEnd !== ev.endTime ||
      nextLocation !== ev.location;

    if (!hasChanged) {
      setMovingEvent(null);
      return;
    }

    const effectiveScope = scopeOverride || dragScope;
    const actorUid = auth.currentUser?.uid || currentUser?.uid || 'admin';
    const actorEmail = (auth.currentUser?.email || currentUser?.email || 'admin@lilab.edu.vn').slice(0, 160);
    const actorName = (
      currentUser?.displayName ||
      auth.currentUser?.displayName ||
      currentUser?.email ||
      auth.currentUser?.email ||
      'Admin'
    ).slice(0, 120);

    setIsSaving(true);
    try {
      // CASE 1: Weekly Recurring Schedule slot update (updates dayOfWeek, startTime, endTime, room across all weeks)
      if (ev.source === 'schedule' && ev.scheduleId && effectiveScope === 'weekly_schedule') {
        const existingSched = activeSchedules.find((s) => s.id === ev.scheduleId);
        const safeClassId = (existingSched?.classId || ev.classId || `cls_${Date.now()}`)
          .replace(/[^a-zA-Z0-9_-]/g, '_')
          .slice(0, 128);
        const newDayOfWeek = getDayOfWeekFromYmd(nextDate);
        const schedulePayload = {
          classId: safeClassId,
          className: (existingSched?.className || ev.className || ev.titleEn).slice(0, 120),
          teacherEmail: (existingSched?.teacherEmail || ev.teacherEmail || actorEmail)
            .trim()
            .toLowerCase()
            .slice(0, 160),
          teacherName: (existingSched?.teacherName || ev.teacherName || 'LiLab Faculty').slice(0, 120),
          dayOfWeek: newDayOfWeek,
          startTime: nextStart,
          endTime: nextEnd,
          room: nextLocation.slice(0, 60),
          weekNumber: Math.min(52, Math.max(1, Number(existingSched?.weekNumber || ev.scheduleWeekNumber) || 1)),
          topicEn: (existingSched?.topicEn || ev.scheduleTopicEn || ev.descriptionEn || ev.titleEn).slice(0, 200),
          topicVi: (existingSched?.topicVi || ev.scheduleTopicVi || ev.descriptionVi || ev.titleVi).slice(0, 200),
          status: (existingSched?.status || 'scheduled') as ClassSchedule['status'],
          adminUids:
            existingSched?.adminUids && existingSched.adminUids.length > 0
              ? existingSched.adminUids
              : ev.scheduleAdminUids && ev.scheduleAdminUids.length > 0
                ? ev.scheduleAdminUids
                : [actorUid]
        };

        const prevScheduleSnapshot = {
          ...schedulePayload,
          dayOfWeek: existingSched?.dayOfWeek || ev.scheduleDayOfWeek || getDayOfWeekFromYmd(ev.eventDate),
          startTime: existingSched?.startTime || ev.startTime,
          endTime: existingSched?.endTime || ev.endTime,
          room: (existingSched?.room || ev.location || 'Phòng 1').slice(0, 60)
        };

        const existsInFirestoreSchedules = rawSchedules.some((s) => s.id === ev.scheduleId);
        if (existsInFirestoreSchedules) {
          await updateDoc(doc(db, 'schedules', ev.scheduleId), {
            ...schedulePayload,
            updatedAt: serverTimestamp()
          });
        } else {
          await setDoc(doc(db, 'schedules', ev.scheduleId), {
            ...schedulePayload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }

        setLastMoveUndo({
          kind: 'weekly_schedule_updated',
          docId: ev.scheduleId,
          label: schedulePayload.className,
          previousData: prevScheduleSnapshot
        });

        syncDateSelection(nextDate);
        setMovingEvent(null);
        setPreviewEvent(null);
        flash(
          biText(
            lang,
            `Moved weekly class "${schedulePayload.className}" to ${newDayOfWeek} · ${nextStart}–${nextEnd} (${schedulePayload.room}).`,
            `Đã chuyển lịch hàng tuần "${schedulePayload.className}" sang ${newDayOfWeek} · ${nextStart}–${nextEnd} (${schedulePayload.room})!`
          )
        );
        return;
      }

      // CASE 2: Single-Date Event Move / Override in `academy_events`
      const safeId = /^[a-zA-Z0-9_-]+$/.test(ev.id)
        ? ev.id
        : `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const existingFsEvent = firestoreEvents.find((f) => f.id === safeId);

      const movePayload = {
        titleEn: ev.titleEn.slice(0, 160),
        titleVi: (ev.titleVi || ev.titleEn).slice(0, 160),
        eventDate: nextDate,
        startTime: nextStart,
        endTime: nextEnd,
        eventType: ev.eventType,
        status: 'rescheduled' as const,
        location: nextLocation,
        ...(ev.classId ? { classId: ev.classId.slice(0, 128) } : {}),
        ...(ev.className ? { className: ev.className.slice(0, 120) } : {}),
        ...(ev.programId ? { programId: ev.programId.slice(0, 128) } : {}),
        ...(ev.programTitle ? { programTitle: ev.programTitle.slice(0, 160) } : {}),
        ...(ev.cefrLevel ? { cefrLevel: ev.cefrLevel.slice(0, 60) } : {}),
        ...(ev.teacherEmail ? { teacherEmail: ev.teacherEmail.slice(0, 160) } : {}),
        ...(ev.teacherName ? { teacherName: ev.teacherName.slice(0, 120) } : {}),
        ...(ev.studentIds && ev.studentIds.length > 0 ? { studentIds: ev.studentIds.slice(0, 30) } : {}),
        ...(ev.studentNames && ev.studentNames.length > 0 ? { studentNames: ev.studentNames.slice(0, 30) } : {}),
        ...(ev.studentEmails && ev.studentEmails.length > 0 ? { studentEmails: ev.studentEmails.slice(0, 30) } : {}),
        ...(ev.parentEmails && ev.parentEmails.length > 0 ? { parentEmails: ev.parentEmails.slice(0, 30) } : {}),
        ...(ev.seriesId ? { seriesId: ev.seriesId.slice(0, 128) } : {}),
        descriptionEn: (ev.descriptionEn || `${ev.titleEn} moved to ${nextDate} (${nextStart}–${nextEnd}).`).slice(0, 1000),
        descriptionVi: (
          ev.descriptionVi ||
          ev.descriptionEn ||
          `Đã dời lịch sang ngày ${nextDate} (${nextStart}–${nextEnd}).`
        ).slice(0, 1000),
        previousDate: (nextDate !== ev.eventDate ? ev.eventDate : ev.previousDate || ev.eventDate).slice(0, 20)
      };

      if (existingFsEvent) {
        const prevEventSnapshot = {
          ...movePayload,
          eventDate: existingFsEvent.eventDate,
          startTime: existingFsEvent.startTime,
          endTime: existingFsEvent.endTime,
          location: existingFsEvent.location,
          status: existingFsEvent.status,
          ...(existingFsEvent.previousDate ? { previousDate: existingFsEvent.previousDate } : {})
        };
        await updateDoc(doc(db, 'academy_events', safeId), {
          ...movePayload,
          updatedAt: serverTimestamp()
        });
        setLastMoveUndo({
          kind: 'academy_event_updated',
          docId: safeId,
          label: ev.titleEn,
          previousData: prevEventSnapshot
        });
      } else {
        await setDoc(doc(db, 'academy_events', safeId), {
          ...movePayload,
          createdByUid: actorUid,
          createdByEmail: actorEmail,
          createdByName: actorName,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        setLastMoveUndo({
          kind: 'academy_event_created',
          docId: safeId,
          label: ev.titleEn
        });
      }

      syncDateSelection(nextDate);
      setMovingEvent(null);
      setPreviewEvent(null);
      flash(
        biText(
          lang,
          `Rescheduled "${ev.titleEn}" → ${nextDate} · ${nextStart}–${nextEnd} (${nextLocation})`,
          `Đã dời lịch "${ev.titleVi}" → ${nextDate} · ${nextStart}–${nextEnd} (${nextLocation})`
        )
      );
    } catch (err: any) {
      console.error('Failed to reschedule event:', err);
      flash(
        biText(
          lang,
          `Error rescheduling event: ${err?.message || 'Please try again'}`,
          `Lỗi khi dời lịch sự kiện: ${err?.message || 'Vui lòng thử lại'}`
        )
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleMoveEventToDate = (ev: DisplayCalendarEvent, newDateStr: string) =>
    handleRescheduleEventDrop(ev, { eventDate: newDateStr });

  const handleUndoLastMove = async () => {
    if (!canManageCalendar || !lastMoveUndo) return;
    setIsSaving(true);
    try {
      if (lastMoveUndo.kind === 'academy_event_created') {
        await deleteDoc(doc(db, 'academy_events', lastMoveUndo.docId));
      } else if (lastMoveUndo.kind === 'academy_event_updated' && lastMoveUndo.previousData) {
        await updateDoc(doc(db, 'academy_events', lastMoveUndo.docId), {
          ...lastMoveUndo.previousData,
          updatedAt: serverTimestamp()
        });
      } else if (lastMoveUndo.kind === 'weekly_schedule_updated' && lastMoveUndo.previousData) {
        await updateDoc(doc(db, 'schedules', lastMoveUndo.docId), {
          ...lastMoveUndo.previousData,
          updatedAt: serverTimestamp()
        });
      }
      const restoredName = lastMoveUndo.label;
      setLastMoveUndo(null);
      flash(
        biText(
          lang,
          `Undid last move for "${restoredName}".`,
          `Đã hoàn tác thao tác dời lịch cho "${restoredName}".`
        )
      );
    } catch (err: any) {
      console.error('Failed to undo move:', err);
      flash(
        biText(
          lang,
          `Could not undo move: ${err?.message || 'Please try again'}`,
          `Không thể hoàn tác: ${err?.message || 'Vui lòng thử lại'}`
        )
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageCalendar) return;
    if (!formTitleEn.trim()) return;
    if (editScope === 'single_date' && !formEventDate) return;

    setIsSaving(true);
    try {
      const selectedTeacherObj = teachers.find(
        (t) => t.teacherEmail.toLowerCase() === formTeacherEmail.trim().toLowerCase()
      );

      // CASE A: Editing a weekly recurring schedule in `schedules/{scheduleId}`
      if (editingEventSource === 'schedule' && editingScheduleId && editScope === 'weekly_schedule') {
        const safeClassId = (editingScheduleMeta?.classId || formClassId || `cls_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
        const resolvedTeacherEmail = (
          formTeacherEmail.trim() ||
          safeEmail ||
          'lilabvietnam@gmail.com'
        )
          .toLowerCase()
          .slice(0, 160);
        const resolvedTeacherName = (
          selectedTeacherObj?.fullName ||
          formTeacherName.trim() ||
          'LiLab Faculty'
        ).slice(0, 120);
        const schedStatus: ClassSchedule['status'] =
          formStatus === 'completed'
            ? 'completed'
            : formStatus === 'cancelled'
              ? 'cancelled'
              : 'scheduled';

        const schedulePayload = {
          classId: safeClassId,
          className: formTitleEn.trim().slice(0, 120),
          teacherEmail: resolvedTeacherEmail,
          teacherName: resolvedTeacherName,
          dayOfWeek: formDayOfWeek,
          startTime: (formStartTime.trim() || '18:00').slice(0, 20),
          endTime: (formEndTime.trim() || '19:30').slice(0, 20),
          room: (formLocation.trim() || 'Phòng 1').slice(0, 60),
          weekNumber: Math.min(52, Math.max(1, Number(formWeekNumber) || 1)),
          topicEn: (formDescriptionEn.trim() || formTitleEn.trim()).slice(0, 200),
          topicVi: (formDescriptionVi.trim() || formTitleVi.trim() || formTitleEn.trim()).slice(0, 200),
          status: schedStatus,
          adminUids:
            editingScheduleMeta?.adminUids && editingScheduleMeta.adminUids.length > 0
              ? editingScheduleMeta.adminUids
              : [currentUser?.uid || auth.currentUser?.uid || 'admin']
        };

        const existsInFirestoreSchedules = rawSchedules.some((s) => s.id === editingScheduleId);
        if (existsInFirestoreSchedules) {
          await updateDoc(doc(db, 'schedules', editingScheduleId), {
            ...schedulePayload,
            updatedAt: serverTimestamp()
          });
        } else {
          await setDoc(doc(db, 'schedules', editingScheduleId), {
            ...schedulePayload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
        setShowEventModal(false);
        flash(
          biText(
            lang,
            `Updated weekly class "${schedulePayload.className}" (${schedulePayload.dayOfWeek} · ${schedulePayload.startTime}–${schedulePayload.endTime} · ${schedulePayload.room}).`,
            `Đã cập nhật lịch cố định hàng tuần "${schedulePayload.className}" (${schedulePayload.dayOfWeek} · ${schedulePayload.startTime}–${schedulePayload.endTime} · ${schedulePayload.room})!`
          )
        );
        return;
      }

      // CASE B: Creating or editing an `academy_events` item (including single-date schedule overrides & curated milestone overrides)
      const eventId =
        editingEventId && /^[a-zA-Z0-9_-]+$/.test(editingEventId)
          ? editingEventId
          : `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      const selectedCls = classes.find((c) => c.id === formClassId);
      const selectedStuObjs = students.filter((s) => formStudentIds.includes(s.id));
      const isExistingInFirestore = firestoreEvents.some((f) => f.id === eventId);

      const basePayload = {
        titleEn: formTitleEn.trim().slice(0, 160),
        titleVi: (formTitleVi.trim() || formTitleEn.trim()).slice(0, 160),
        eventDate: formEventDate.trim().slice(0, 20),
        startTime: (formStartTime.trim() || '09:00').slice(0, 20),
        endTime: (formEndTime.trim() || '10:30').slice(0, 20),
        eventType: formEventType,
        status:
          modalMode === 'reschedule' &&
          originalDateForReschedule &&
          originalDateForReschedule !== formEventDate &&
          formStatus === 'scheduled'
            ? ('rescheduled' as const)
            : formStatus,
        location: (formLocation.trim() || 'Phòng 1').slice(0, 120),
        ...(selectedCls ? { classId: selectedCls.id, className: selectedCls.name.slice(0, 120) } : {}),
        ...(formCefrLevel ? { cefrLevel: formCefrLevel.slice(0, 60) } : {}),
        ...(formTeacherEmail.trim()
          ? {
              teacherEmail: formTeacherEmail.trim().toLowerCase().slice(0, 160),
              teacherName: (selectedTeacherObj?.fullName || formTeacherName.trim() || formTeacherEmail.trim()).slice(0, 120),
            }
          : {}),
        ...(selectedStuObjs.length > 0
          ? {
              studentIds: selectedStuObjs.map((s) => s.id).slice(0, 30),
              studentNames: selectedStuObjs.map((s) => s.fullName.slice(0, 120)).slice(0, 30),
              studentEmails: Array.from(
                new Set(selectedStuObjs.map((s) => (s.studentEmail || '').trim().toLowerCase()).filter(Boolean))
              ).slice(0, 30),
              parentEmails: Array.from(
                new Set(selectedStuObjs.map((s) => (s.parentEmail || '').trim().toLowerCase()).filter(Boolean))
              ).slice(0, 30),
            }
          : {}),
        descriptionEn: (
          formDescriptionEn.trim() ||
          `${formEventType.replace('_', ' ')} scheduled at ${formLocation.trim() || 'LiLab Academy'}.`
        ).slice(0, 1000),
        descriptionVi: (
          formDescriptionVi.trim() ||
          formDescriptionEn.trim() ||
          `Sự kiện học viện diễn ra tại ${formLocation.trim() || 'LiLab Academy'}.`
        ).slice(0, 1000),
        ...(modalMode === 'reschedule' && originalDateForReschedule && originalDateForReschedule !== formEventDate
          ? { previousDate: originalDateForReschedule.slice(0, 20) }
          : {})
      };

      if (isExistingInFirestore) {
        await updateDoc(doc(db, 'academy_events', eventId), {
          ...basePayload,
          updatedAt: serverTimestamp()
        });
      } else {
        await setDoc(doc(db, 'academy_events', eventId), {
          ...basePayload,
          createdByUid: currentUser?.uid || auth.currentUser?.uid || 'admin',
          createdByEmail: (currentUser?.email || auth.currentUser?.email || 'admin@lilab.edu.vn').slice(0, 160),
          createdByName: (currentUser?.displayName || currentUser?.email || auth.currentUser?.displayName || auth.currentUser?.email || 'Admin').slice(0, 120),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      const parts = formEventDate.split('-').map(Number);
      if (parts.length === 3 && !parts.some(isNaN)) {
        setViewYear(parts[0]);
        setViewMonth(parts[1] - 1);
      }
      setSelectedDate(formEventDate);
      setShowEventModal(false);
      flash(
        modalMode === 'reschedule'
          ? biText(
              lang,
              `Updated "${basePayload.titleEn}" (${basePayload.eventDate} · ${basePayload.startTime}–${basePayload.endTime}).`,
              `Đã cập nhật "${basePayload.titleVi}" (${basePayload.eventDate} · ${basePayload.startTime}–${basePayload.endTime})!`
            )
          : biText(
              lang,
              `Added "${basePayload.titleEn}" on ${basePayload.eventDate} to the Academy Event Calendar.`,
              `Đã thêm sự kiện "${basePayload.titleVi}" ngày ${basePayload.eventDate} vào Lịch Học viện!`
            )
      );
    } catch (err: any) {
      console.error('Failed to save academy event:', err);
      flash(
        biText(
          lang,
          `Error saving event: ${err?.message || 'Please try again'}`,
          `Lỗi khi lưu sự kiện: ${err?.message || 'Vui lòng thử lại'}`
        )
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEvent = async (
    ev: DisplayCalendarEvent,
    deleteMode: 'single_date' | 'weekly_series' = 'single_date'
  ) => {
    if (!canManageCalendar) return;
    setIsSaving(true);
    try {
      if (ev.source === 'firestore') {
        await deleteDoc(doc(db, 'academy_events', ev.id));
        flash(
          biText(
            lang,
            `Deleted "${ev.titleEn}" from the calendar.`,
            `Đã xóa "${ev.titleVi}" khỏi lịch học viện.`
          )
        );
      } else if (ev.source === 'schedule' && deleteMode === 'weekly_series' && ev.scheduleId) {
        await deleteDoc(doc(db, 'schedules', ev.scheduleId));
        flash(
          biText(
            lang,
            `Deleted weekly schedule "${ev.className || ev.titleEn}" (${ev.scheduleDayOfWeek || ''}) from all weeks.`,
            `Đã xóa lịch hàng tuần "${ev.className || ev.titleVi}" khỏi tất cả các tuần.`
          )
        );
      } else {
        // Hide single date occurrence of a recurring schedule OR delete a curated milestone by writing a hidden override
        const safeId = /^[a-zA-Z0-9_-]+$/.test(ev.id) ? ev.id : `hidden_${Date.now()}`;
        await setDoc(doc(db, 'academy_events', safeId), {
          titleEn: ev.titleEn.slice(0, 160),
          titleVi: (ev.titleVi || ev.titleEn).slice(0, 160),
          eventDate: ev.eventDate.slice(0, 20),
          startTime: (ev.startTime || '09:00').slice(0, 20),
          endTime: (ev.endTime || '10:30').slice(0, 20),
          eventType: ev.eventType,
          status: 'cancelled',
          location: HIDDEN_EVENT_MARKER,
          descriptionEn: 'Removed by Admin from calendar.',
          descriptionVi: 'Đã được Quản trị viên xóa khỏi lịch.',
          createdByUid: currentUser?.uid || auth.currentUser?.uid || 'admin',
          createdByEmail: (currentUser?.email || auth.currentUser?.email || 'admin@lilab.edu.vn').slice(0, 160),
          createdByName: (currentUser?.displayName || currentUser?.email || auth.currentUser?.displayName || auth.currentUser?.email || 'Admin').slice(0, 120),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        flash(
          biText(
            lang,
            `Removed "${ev.titleEn}" on ${ev.eventDate} from the calendar.`,
            `Đã xóa "${ev.titleVi}" ngày ${ev.eventDate} khỏi lịch.`
          )
        );
      }

      if (previewEvent?.id === ev.id) {
        setPreviewEvent(null);
      }
      setConfirmDeleteEventId(null);
    } catch (err: any) {
      console.error('Failed to delete calendar item:', err);
      flash(
        biText(
          lang,
          `Error removing item: ${err?.message || 'Please try again'}`,
          `Lỗi khi xóa mục khỏi lịch: ${err?.message || 'Vui lòng thử lại'}`
        )
      );
    } finally {
      setIsSaving(false);
    }
  };

  const eventTypeStyle = (type: AcademyEventType) => {
    switch (type) {
      case 'class_session':
        return {
          labelEn: 'Class Schedule',
          labelVi: 'Lịch Học Lớp',
          pillBg: 'bg-indigo-100 text-indigo-950 border-indigo-300 hover:bg-indigo-200/80',
          dotBg: 'bg-indigo-600',
          cardBorder: 'border-l-4 border-l-indigo-600 bg-indigo-50/40',
          icon: BookOpen
        };
      case 'cefr_assessment':
        return {
          labelEn: 'CEFR Assessment',
          labelVi: 'Đánh giá CEFR',
          pillBg: 'bg-rose-100 text-rose-950 border-rose-300 hover:bg-rose-200/80',
          dotBg: 'bg-[#E61E64]',
          cardBorder: 'border-l-4 border-l-[#E61E64] bg-rose-50/40',
          icon: Award
        };
      case 'academy_milestone':
        return {
          labelEn: 'Academy Milestone',
          labelVi: 'Cột mốc Học viện',
          pillBg: 'bg-amber-100 text-amber-950 border-amber-300 hover:bg-amber-200/80',
          dotBg: 'bg-amber-500',
          cardBorder: 'border-l-4 border-l-amber-500 bg-amber-50/40',
          icon: Sparkles
        };
      case 'parent_workshop':
        return {
          labelEn: 'Parent Workshop',
          labelVi: 'Hội thảo Phụ huynh',
          pillBg: 'bg-emerald-100 text-emerald-950 border-emerald-300 hover:bg-emerald-200/80',
          dotBg: 'bg-emerald-600',
          cardBorder: 'border-l-4 border-l-emerald-600 bg-emerald-50/40',
          icon: Users
        };
      case 'holiday':
        return {
          labelEn: 'Academy Holiday',
          labelVi: 'Lịch Nghỉ Lễ',
          pillBg: 'bg-stone-200 text-stone-800 border-stone-300 hover:bg-stone-300/80',
          dotBg: 'bg-stone-500',
          cardBorder: 'border-l-4 border-l-stone-500 bg-stone-50',
          icon: CalendarIcon
        };
    }
  };

  const todayStr = useMemo(
    () => formatYmd(now.getFullYear(), now.getMonth(), now.getDate()),
    [now]
  );

  const monthTitle = useMemo(() => {
    if (calendarView === 'week') {
      const days = getWeekDaysForYmd(selectedDate, todayStr);
      const first = days[0];
      const last = days[6];
      if (first && last) {
        return `${first.monthLabel} ${first.dayNumber} – ${last.monthLabel} ${last.dayNumber}, ${selectedDate.slice(0, 4)}`;
      }
    }
    if (calendarView === 'day') {
      return `${getDayOfWeekFromYmd(selectedDate)} · ${selectedDate}`;
    }
    const d = new Date(viewYear, viewMonth, 1);
    const en = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const vi = `Tháng ${viewMonth + 1}, ${viewYear}`;
    return lang === 'vi' ? vi : lang === 'en' ? en : `${en} · ${vi}`;
  }, [calendarView, selectedDate, todayStr, viewYear, viewMonth, lang]);

  const weekdayHeaders = [
    { en: 'Mon', vi: 'T2' },
    { en: 'Tue', vi: 'T3' },
    { en: 'Wed', vi: 'T4' },
    { en: 'Thu', vi: 'T5' },
    { en: 'Fri', vi: 'T6' },
    { en: 'Sat', vi: 'T7' },
    { en: 'Sun', vi: 'CN' }
  ];

  return (
    <div className="bg-white rounded-2xl border border-[#172154]/10 overflow-hidden">
      {/* Top Header */}
      <div className="bg-white px-6 py-6 border-b border-[#172154]/10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-semibold uppercase tracking-wider text-[#172154]/60">
              <span className="inline-flex items-center gap-1.5 text-[#FF6B00]">
                <CalendarIcon className="w-3.5 h-3.5" />
                {biText(lang, 'Academy Event Calendar', 'Lịch Học & Sự kiện LiLab')}
              </span>
              {canManageCalendar ? (
                <>
                  <span className="text-[#172154]/25">·</span>
                  <span className="normal-case text-[#0F766E]">
                    {biText(lang, 'Admin Schedule Controls Active', 'Quản trị Lịch đang bật')}
                  </span>
                </>
              ) : isTeacherUser ? (
                <>
                  <span className="text-[#172154]/25">·</span>
                  <span className="normal-case text-[#172154]/70">
                    {biText(lang, 'Faculty View', 'Lịch Giáo viên')}
                  </span>
                </>
              ) : null}
            </div>

            <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#172154]">
              {biText(
                lang,
                'Monthly Class Schedules, CEFR Assessments & Milestones',
                'Lịch Học Hàng tháng, Đánh giá CEFR & Cột mốc Học viện'
              )}
            </h2>
            <p className="text-xs sm:text-sm text-[#172154]/65 max-w-3xl">
              {canManageCalendar
                ? biText(
                    lang,
                    'Switch between Day, Week, and Month views, drag classes across days/times, or double-click any date to pop open a full Day View.',
                    'Chuyển đổi giữa chế độ Ngày, Tuần và Tháng, kéo thả lớp qua ngày/giờ, hoặc nhấp đúp vào bất kỳ ngày nào để mở cửa sổ Xem Ngày chi tiết.'
                  )
                : biText(
                    lang,
                    'Switch between Day, Week, and Month views, click any event for details, or double-click any date to open a full Day View popup.',
                    'Chuyển đổi giữa chế độ Ngày, Tuần và Tháng, nhấp vào sự kiện để xem chi tiết, hoặc nhấp đúp vào ngày bất kỳ để mở cửa sổ Xem Ngày.'
                  )}
            </p>
          </div>

          {/* View Switcher (Day / Week / Month), Navigation (< >) & Admin Add Buttons */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
            {canManageCalendar && (
              <>
                <button
                  type="button"
                  disabled={isSyncingMaster}
                  onClick={() => void handleSyncLilabMasterSchedule()}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#FAF5FF] hover:bg-[#6B21A8] text-[#6B21A8] hover:text-white border border-[#6B21A8]/25 flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                  title={biText(
                    lang,
                    'Sync all 13 LiLab group classes (26 weekly sessions across Phòng 1–3)',
                    'Đồng bộ đầy đủ 13 lớp nhóm LiLab (26 buổi/tuần tại Phòng 1–3)'
                  )}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingMaster ? 'animate-spin' : ''}`} />
                  {isSyncingMaster
                    ? biText(lang, 'Syncing…', 'Đang đồng bộ…')
                    : biText(lang, 'Sync 13 Classes', 'Đồng bộ 13 Lớp')}
                </button>
                <button
                  type="button"
                  onClick={() => openQuickClassScheduler(selectedDate)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#FF6B00] hover:bg-[#E05A00] text-white flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  {biText(lang, '+ Schedule Class', '+ Xếp Lịch Lớp')}
                </button>
                <button
                  type="button"
                  onClick={() => openCreateEventModal(selectedDate)}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-white hover:bg-[#F8F9FB] text-[#172154] border border-[#172154]/15 flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {biText(lang, 'Add Event', 'Thêm Sự kiện')}
                </button>
              </>
            )}

            {/* Teacher / Parent / Student "My Classes" Quick Toggle Button */}
            {showMyClassesToggle && (
              <button
                type="button"
                onClick={toggleMyClassesOnly}
                aria-pressed={isMyClassesActive}
                title={
                  isTeacherUser
                    ? biText(
                        lang,
                        'Show only classes assigned to you',
                        'Chỉ hiển thị các lớp được phân công cho bạn'
                      )
                    : biText(
                        lang,
                        'Show only your assigned / enrolled classes',
                        'Chỉ hiển thị các lớp học bạn đã được xếp'
                      )
                }
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  isMyClassesActive
                    ? 'bg-[#2D3E99] text-white border-[#2D3E99] shadow-sm'
                    : 'bg-[#EEF2FF] hover:bg-[#2D3E99] text-[#2D3E99] hover:text-white border-[#2D3E99]/25'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>{biText(lang, 'My Classes', 'Lớp của tôi')}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono-num font-bold tabular-nums ${
                    isMyClassesActive
                      ? 'bg-[#FFD41D] text-[#172154]'
                      : 'bg-white/90 text-[#2D3E99]'
                  }`}
                >
                  {myAssignedClassMonthCount}
                </span>
              </button>
            )}

            {/* Top Header Day / Week / Month View Switcher */}
            <div className="inline-flex items-center bg-[#F2F4F8] p-1 rounded-xl border border-[#172154]/10">
              {(
                [
                  { id: 'day', labelEn: 'Day', labelVi: 'Ngày' },
                  { id: 'week', labelEn: 'Week', labelVi: 'Tuần' },
                  { id: 'month', labelEn: 'Month', labelVi: 'Tháng' }
                ] as const
              ).map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setCalendarView(v.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    calendarView === v.id
                      ? 'bg-[#172154] text-white shadow-2xs'
                      : 'text-[#172154]/70 hover:text-[#172154]'
                  }`}
                >
                  {lang === 'vi' ? v.labelVi : v.labelEn}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 bg-[#F2F4F8] p-1 rounded-xl border border-[#172154]/8">
              <button
                type="button"
                onClick={handlePrevPeriod}
                className="px-2 py-1.5 rounded-lg hover:bg-white text-[#172154] font-semibold text-xs flex items-center transition-colors cursor-pointer"
                title={biText(lang, 'Previous', 'Trước')}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2.5 text-xs sm:text-sm font-semibold text-[#172154] min-w-[140px] text-center">
                {monthTitle}
              </span>
              <button
                type="button"
                onClick={handleNextPeriod}
                className="px-2 py-1.5 rounded-lg hover:bg-white text-[#172154] font-semibold text-xs flex items-center transition-colors cursor-pointer"
                title={biText(lang, 'Next', 'Tiếp theo')}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleJumpToday}
                className="ml-1 px-2.5 py-1.5 rounded-lg bg-white border border-[#172154]/12 hover:border-[#FF6B00]/50 text-[11px] font-semibold text-[#172154] whitespace-nowrap cursor-pointer"
              >
                {biText(lang, 'Today', 'Hôm nay')}
              </button>
            </div>
          </div>
        </div>

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-[#172154]/8">
          <div className="bg-[#F8F9FB] rounded-xl px-4 py-3 border border-[#172154]/8">
            <div className="text-[11px] font-medium text-[#172154]/60">
              {biText(lang, 'Events This Month', 'Sự kiện Trong Tháng')}
            </div>
            <div className="text-lg font-mono-num font-bold text-[#172154] mt-0.5 tabular-nums">
              {upcomingMonthEvents.length}
            </div>
          </div>
          <div className="bg-[#F8F9FB] rounded-xl px-4 py-3 border border-[#172154]/8">
            <div className="text-[11px] font-medium text-[#172154]/60">
              {biText(lang, 'Class Sessions', 'Buổi Học Lớp')}
            </div>
            <div className="text-lg font-mono-num font-bold text-[#2D3E99] mt-0.5 tabular-nums">
              {upcomingMonthEvents.filter((e) => e.eventType === 'class_session').length}
            </div>
          </div>
          <div className="bg-[#F8F9FB] rounded-xl px-4 py-3 border border-[#172154]/8">
            <div className="text-[11px] font-medium text-[#172154]/60">
              {biText(lang, 'CEFR Assessments', 'Kỳ Đánh giá CEFR')}
            </div>
            <div className="text-lg font-mono-num font-bold text-[#FF6B00] mt-0.5 tabular-nums">
              {upcomingMonthEvents.filter((e) => e.eventType === 'cefr_assessment').length}
            </div>
          </div>
          <div className="bg-[#F8F9FB] rounded-xl px-4 py-3 border border-[#172154]/8">
            <div className="text-[11px] font-medium text-[#172154]/60">
              {biText(lang, 'Milestones & Workshops', 'Cột mốc & Hội thảo')}
            </div>
            <div className="text-lg font-mono-num font-bold text-[#0F766E] mt-0.5 tabular-nums">
              {
                upcomingMonthEvents.filter(
                  (e) => e.eventType === 'academy_milestone' || e.eventType === 'parent_workshop'
                ).length
              }
            </div>
          </div>
        </div>
      </div>

      {/* Status Notification (with 1-click Undo after drag-and-drop moves) */}
      {statusBanner && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-3 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-emerald-900">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusBanner}</span>
          </div>
          <div className="flex items-center gap-2">
            {canManageCalendar && lastMoveUndo && (
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void handleUndoLastMove()}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-100 border border-emerald-300 text-emerald-900 text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className="w-3 h-3" />
                {biText(lang, 'Undo Move', 'Hoàn tác')}
              </button>
            )}
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="text-emerald-700 hover:text-emerald-950 p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Admin Active "Click a Date on Calendar to Move Event" Banner */}
      {canManageCalendar && movingEvent && (
        <div className="bg-amber-100 border-b-2 border-amber-400 px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-950">
          <div className="flex items-center gap-2 font-bold">
            <MoveRight className="w-4 h-4 text-[#E61E64] animate-pulse shrink-0" />
            <span>
              {biText(
                lang,
                `Moving "${movingEvent.titleEn}" (from ${movingEvent.eventDate}): Click any date cell on the calendar grid below to move it there!`,
                `Đang dời lịch "${movingEvent.titleVi}" (từ ${movingEvent.eventDate}): Hãy nhấp vào bất kỳ ô ngày nào trên lưới lịch bên dưới để chuyển đến ngày đó!`
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMovingEvent(null)}
            className="px-3 py-1 rounded-lg bg-white border border-amber-300 text-amber-900 font-bold hover:bg-amber-50 cursor-pointer"
          >
            {biText(lang, 'Cancel Move', 'Hủy dời ngày')}
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="px-6 py-3.5 bg-[#FDF9EE] border-b border-[#2D3E99]/12 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#172154]/60 flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5" />
            {biText(lang, 'Filter:', 'Lọc:')}
          </span>
          {showMyClassesToggle && (
            <button
              type="button"
              onClick={toggleMyClassesOnly}
              aria-pressed={isMyClassesActive}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                isMyClassesActive
                  ? 'bg-[#FF6B00] text-white border-[#FF6B00] shadow-xs'
                  : 'bg-[#EEF2FF] text-[#2D3E99] border-[#2D3E99]/25 hover:bg-[#2D3E99] hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>{biText(lang, 'My Classes', 'Lớp của tôi')}</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono-num tabular-nums ${
                  isMyClassesActive ? 'bg-white/25 text-white' : 'bg-white text-[#2D3E99]'
                }`}
              >
                {myAssignedClassMonthCount}
              </span>
            </button>
          )}
          {(
            [
              { id: 'all', labelEn: 'All Events', labelVi: 'Tất cả', dot: 'bg-[#2D3E99]' },
              { id: 'class_session', labelEn: 'Class Schedules', labelVi: 'Lịch học Lớp', dot: 'bg-indigo-600' },
              { id: 'cefr_assessment', labelEn: 'CEFR Assessments', labelVi: 'Đánh giá CEFR', dot: 'bg-[#E61E64]' },
              { id: 'academy_milestone', labelEn: 'Academy Milestones', labelVi: 'Cột mốc Học viện', dot: 'bg-amber-500' },
              { id: 'parent_workshop', labelEn: 'Parent Workshops', labelVi: 'Hội thảo Phụ huynh', dot: 'bg-emerald-600' }
            ] as const
          ).map((f) => {
            const isChipActive = !isMyClassesActive && selectedTypeFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setMyClassesOnly(false);
                  setSelectedTypeFilter(f.id);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 border cursor-pointer ${
                  isChipActive
                    ? 'bg-[#2D3E99] text-white border-[#2D3E99] shadow-xs'
                    : 'bg-white text-[#172154]/80 border-[#2D3E99]/15 hover:bg-stone-50'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isChipActive ? 'bg-[#FFD41D]' : f.dot
                  }`}
                />
                {lang === 'vi' ? f.labelVi : f.labelEn}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedRoomFilter}
            onChange={(e) => setSelectedRoomFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-white border border-[#2D3E99]/20 text-xs font-semibold text-[#172154]"
            title={biText(lang, 'Filter calendar by room', 'Lọc lịch theo phòng học')}
          >
            <option value="all">{biText(lang, 'All Rooms (Phòng 1–4)', 'Tất cả Phòng (Phòng 1–4)')}</option>
            {availableRooms.map((room) => (
              <option key={room} value={room}>
                {room}
              </option>
            ))}
          </select>
          {canManageCalendar && teachers.length > 0 && (
            <select
              value={adminTeacherFilter}
              onChange={(e) => setAdminTeacherFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-white border border-[#2D3E99]/20 text-xs font-semibold text-[#172154]"
              title={biText(lang, 'Preview calendar for a specific teacher', 'Xem lịch theo từng giáo viên')}
            >
              <option value="all">{biText(lang, 'All Teachers', 'Tất cả Giáo viên')}</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.teacherEmail.toLowerCase()}>
                  {biText(lang, 'Teacher:', 'GV:')} {t.fullName}
                </option>
              ))}
            </select>
          )}
          {canManageCalendar && students.length > 0 && (
            <select
              value={adminStudentFilter}
              onChange={(e) => setAdminStudentFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-white border border-[#2D3E99]/20 text-xs font-semibold text-[#172154]"
              title={biText(lang, 'Preview calendar for a specific student', 'Xem lịch theo từng học viên')}
            >
              <option value="all">{biText(lang, 'All Students', 'Tất cả Học viên')}</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {biText(lang, 'Student:', 'HV:')} {s.fullName}
                </option>
              ))}
            </select>
          )}
          <span className="text-[11px] font-medium text-[#6B21A8] bg-[#FAF5FF] border border-[#6B21A8]/15 px-2.5 py-1 rounded-lg">
            {biText(lang, 'Phòng 4: Coach 1:1 (By Appt)', 'Phòng 4: Coach 1:1 (Theo lịch hẹn)')}
          </span>
          <div className="text-xs text-[#172154]/70 font-medium">
            {biText(lang, 'Selected Date:', 'Ngày đang chọn:')}{' '}
            <strong className="font-mono-num text-[#2D3E99]">{selectedDate}</strong>
          </div>
        </div>
      </div>

      {/* Active "My Classes" Filter Indicator Banner */}
      {isMyClassesActive && (
        <div className="px-6 py-2.5 bg-[#EEF2FF] border-b border-[#2D3E99]/15 flex flex-wrap items-center justify-between gap-2 text-xs text-[#172154]">
          <div className="flex items-center gap-2 font-semibold">
            <BookOpen className="w-4 h-4 text-[#2D3E99] shrink-0" />
            {upcomingMonthEvents.length > 0 ? (
              <span>
                {isTeacherUser
                  ? biText(
                      lang,
                      `My Classes view active — showing only classes assigned to you (${upcomingMonthEvents.length} sessions this month).`,
                      `Đang bật chế độ Lớp của tôi — chỉ hiển thị các lớp được phân công cho bạn (${upcomingMonthEvents.length} buổi trong tháng này).`
                    )
                  : biText(
                      lang,
                      `My Classes view active — showing only your assigned classes (${upcomingMonthEvents.length} sessions this month).`,
                      `Đang bật chế độ Lớp của tôi — chỉ hiển thị các lớp bạn đã được xếp (${upcomingMonthEvents.length} buổi trong tháng này).`
                    )}
              </span>
            ) : (
              <span>
                {isTeacherUser
                  ? biText(
                      lang,
                      'My Classes view active — no classes are currently assigned to your account for this month.',
                      'Đang bật chế độ Lớp của tôi — hiện chưa có lớp nào được phân công cho tài khoản của bạn trong tháng này.'
                    )
                  : biText(
                      lang,
                      'My Classes view active — no assigned classes were found for this month yet.',
                      'Đang bật chế độ Lớp của tôi — hiện chưa có lớp học nào được xếp trong tháng này.'
                    )}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setMyClassesOnly(false)}
            className="px-2.5 py-1 rounded-lg bg-white hover:bg-[#2D3E99] text-[#2D3E99] hover:text-white border border-[#2D3E99]/25 text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap"
          >
            {biText(lang, 'Show All Events', 'Xem tất cả sự kiện')}
          </button>
        </div>
      )}

      {/* Main Grid + Selected Day / Upcoming Inspector Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 divide-y xl:divide-y-0 xl:divide-x divide-[#2D3E99]/12">
        {/* LEFT 8 COLS: MONTH / WEEK (TIME GRID) / DAY (ROOMS) CALENDAR */}
        <div className="xl:col-span-8 p-4 sm:p-6">
          {/* Grid Navigation, View Switcher & Admin Drag Scope Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-[#2D3E99]/12">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handlePrevPeriod}
                className="px-3 py-1.5 rounded-xl bg-[#FDF9EE] hover:bg-[#2D3E99] text-[#2D3E99] hover:text-white border border-[#2D3E99]/20 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                title={biText(lang, 'Previous', 'Trước')}
              >
                <ChevronLeft className="w-4 h-4" />
                <span>{biText(lang, 'Prev', 'Trước')}</span>
              </button>

              <h3 className="font-display text-sm sm:text-base font-extrabold text-[#2D3E99] px-1.5">
                {monthTitle}
              </h3>

              <button
                type="button"
                onClick={handleNextPeriod}
                className="px-3 py-1.5 rounded-xl bg-[#FDF9EE] hover:bg-[#2D3E99] text-[#2D3E99] hover:text-white border border-[#2D3E99]/20 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                title={biText(lang, 'Next', 'Tiếp')}
              >
                <span>{biText(lang, 'Next', 'Tiếp')}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* View Switcher: Day / Week / Month */}
              <div className="inline-flex items-center bg-[#F2F4F8] p-0.5 rounded-xl border border-[#172154]/10">
                <button
                  type="button"
                  onClick={() => setCalendarView('day')}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                    calendarView === 'day'
                      ? 'bg-[#6B21A8] text-white shadow-2xs'
                      : 'text-[#172154]/65 hover:text-[#172154]'
                  }`}
                >
                  <Rows3 className="w-3.5 h-3.5" />
                  <span>{biText(lang, 'Day', 'Ngày')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarView('week')}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                    calendarView === 'week'
                      ? 'bg-[#6B21A8] text-white shadow-2xs'
                      : 'text-[#172154]/65 hover:text-[#172154]'
                  }`}
                >
                  <Columns3 className="w-3.5 h-3.5" />
                  <span>{biText(lang, 'Week', 'Tuần')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarView('month')}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                    calendarView === 'month'
                      ? 'bg-white text-[#2D3E99] shadow-2xs'
                      : 'text-[#172154]/65 hover:text-[#172154]'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>{biText(lang, 'Month', 'Tháng')}</span>
                </button>
              </div>

              {/* Admin Drag-and-Drop Scope Toggle */}
              {canManageCalendar && (
                <div
                  className="inline-flex items-center bg-[#FAF5FF] p-0.5 rounded-xl border border-[#6B21A8]/25 text-[11px]"
                  title={biText(
                    lang,
                    'Choose whether dragging a recurring class moves only that date or updates the weekly recurring slot',
                    'Chọn phạm vi khi kéo thả lớp định kỳ: chỉ đổi 1 ngày hoặc đổi cố định hàng tuần'
                  )}
                >
                  <span className="px-2 font-bold text-[#6B21A8] hidden sm:inline-flex items-center gap-1">
                    <GripVertical className="w-3 h-3" />
                    {biText(lang, 'Drag:', 'Kéo:')}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDragScope('single_date')}
                    className={`px-2 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                      dragScope === 'single_date'
                        ? 'bg-[#6B21A8] text-white'
                        : 'text-[#6B21A8] hover:bg-purple-100/70'
                    }`}
                  >
                    {biText(lang, 'This Date', '1 Ngày')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDragScope('weekly_schedule')}
                    className={`px-2 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                      dragScope === 'weekly_schedule'
                        ? 'bg-[#6B21A8] text-white'
                        : 'text-[#6B21A8] hover:bg-purple-100/70'
                    }`}
                  >
                    {biText(lang, 'Weekly Slot', 'Cả Tuần')}
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={handleJumpToday}
                className="px-3 py-1.5 rounded-xl bg-[#2D3E99]/10 hover:bg-[#2D3E99] text-[#2D3E99] hover:text-white text-xs font-bold transition-colors cursor-pointer"
              >
                {biText(lang, 'Today', 'Hôm nay')}
              </button>
            </div>
          </div>

          {/* Active Dragging Indicator Banner for Admins */}
          {canManageCalendar && draggedEvent && (
            <div className="mb-3 px-3.5 py-2 rounded-xl bg-[#FAF5FF] border border-dashed border-[#6B21A8] text-xs font-semibold text-[#6B21A8] flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <GripVertical className="w-4 h-4 shrink-0" />
                {biText(
                  lang,
                  `Dragging "${draggedEvent.titleEn}" (${draggedEvent.startTime}–${draggedEvent.endTime}) — drop onto any ${calendarView === 'month' ? 'day cell' : calendarView === 'week' ? 'day & time slot' : 'room & time slot'} to reschedule.`,
                  `Đang kéo "${draggedEvent.titleVi}" (${draggedEvent.startTime}–${draggedEvent.endTime}) — thả vào ${calendarView === 'month' ? 'ô ngày' : calendarView === 'week' ? 'khung ngày & giờ' : 'phòng & khung giờ'} bất kỳ để đổi lịch.`
                )}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-[#6B21A8] text-white text-[10px] font-bold">
                {dragScope === 'weekly_schedule' && draggedEvent.source === 'schedule'
                  ? biText(lang, 'Updates Weekly Slot', 'Đổi Lịch Cố Định Hàng Tuần')
                  : biText(lang, 'Single-Date Move', 'Chỉ Đổi Ngày Này')}
              </span>
            </div>
          )}

          {calendarView === 'month' ? (
            <>
              {/* Weekday Header Row */}
              <div className="grid grid-cols-7 gap-1.5 mb-2">
                {weekdayHeaders.map((w) => (
                  <div
                    key={w.en}
                    className="text-center py-2 rounded-lg bg-[#FDF9EE] border border-[#2D3E99]/10 text-[11px] font-bold uppercase tracking-wider text-[#2D3E99]"
                  >
                    {lang === 'vi' ? w.vi : lang === 'en' ? w.en : `${w.en} / ${w.vi}`}
                  </div>
                ))}
              </div>

              {/* 7-Column Calendar Matrix */}
              <div className="grid grid-cols-7 gap-1.5">
                {calendarCells.map((cell) => {
                  const isSelected = cell.dateStr === selectedDate;
                  const isDragTarget = dragOverDateStr === cell.dateStr && Boolean(draggedEvent);
                  return (
                    <div
                      key={cell.dateStr}
                      onClick={() => {
                        if (canManageCalendar && movingEvent) {
                          void handleMoveEventToDate(movingEvent, cell.dateStr);
                          return;
                        }
                        setSelectedDate(cell.dateStr);
                      }}
                      onDoubleClick={() => {
                        if (canManageCalendar && movingEvent) return;
                        openDayViewPopup(cell.dateStr);
                      }}
                      title={biText(
                        lang,
                        `${cell.dateStr} — Double-click to open full Day View popup`,
                        `${cell.dateStr} — Nhấp đúp để mở cửa sổ Xem Chi tiết Ngày`
                      )}
                      onDragOver={(e) => {
                        if (!canManageCalendar || !draggedEvent) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        if (dragOverDateStr !== cell.dateStr) {
                          setDragOverDateStr(cell.dateStr);
                        }
                      }}
                      onDragLeave={(e) => {
                        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                        if (dragOverDateStr === cell.dateStr) {
                          setDragOverDateStr(null);
                        }
                      }}
                      onDrop={(e) => {
                        if (!canManageCalendar || !draggedEvent) return;
                        e.preventDefault();
                        setDragOverDateStr(null);
                        const evToMove = draggedEvent;
                        setDraggedEvent(null);
                        void handleMoveEventToDate(evToMove, cell.dateStr);
                      }}
                      className={`group min-h-[108px] sm:min-h-[124px] rounded-xl border p-2 flex flex-col justify-between transition-all cursor-pointer ${
                        movingEvent
                          ? 'hover:ring-2 hover:ring-[#E61E64] hover:bg-amber-50/60 border-amber-300'
                          : isDragTarget
                            ? 'ring-2 ring-dashed ring-[#6B21A8] bg-[#FAF5FF] border-[#6B21A8] scale-[1.01] shadow-sm'
                            : isSelected
                              ? 'ring-2 ring-[#2D3E99] border-[#2D3E99] bg-indigo-50/30 shadow-xs'
                              : cell.isToday
                                ? 'border-[#E61E64]/60 bg-rose-50/20'
                                : cell.isCurrentMonth
                                  ? 'border-stone-200/90 bg-white hover:border-[#2D3E99]/40 hover:bg-stone-50/50'
                                  : 'border-stone-100 bg-stone-50/50 opacity-55'
                      }`}
                    >
                      {/* Top Row of Cell: Day Number + Admin Quick Add / Drop Badge */}
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-xs font-mono-num font-bold ${
                            cell.isToday
                              ? 'bg-[#E61E64] text-white'
                              : isSelected
                                ? 'bg-[#2D3E99] text-white'
                                : cell.isCurrentMonth
                                  ? 'text-[#172154]'
                                  : 'text-stone-400'
                          }`}
                        >
                          {cell.dayNumber}
                        </span>

                        <div className="flex items-center gap-1">
                          {isDragTarget && (
                            <span className="px-1.5 py-0.5 rounded bg-[#6B21A8] text-white text-[9px] font-bold">
                              {biText(lang, 'Drop here', 'Thả đây')}
                            </span>
                          )}
                          {movingEvent && !isDragTarget && (
                            <span className="text-[9px] font-bold text-[#E61E64] opacity-0 group-hover:opacity-100">
                              {biText(lang, 'Move here', 'Chuyển tới')}
                            </span>
                          )}
                          {cell.events.length > 0 && !movingEvent && !isDragTarget && (
                            <span className="text-[10px] font-mono-num font-bold text-[#172154]/55">
                              {cell.events.length}
                            </span>
                          )}
                          {canManageCalendar && !movingEvent && !isDragTarget && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDate(cell.dateStr);
                                openQuickClassScheduler(cell.dateStr);
                              }}
                              className="opacity-0 group-hover:opacity-100 px-1.5 py-0.5 rounded bg-[#2D3E99]/10 hover:bg-[#2D3E99] text-[#2D3E99] hover:text-white text-[9px] font-bold flex items-center gap-0.5 transition-all cursor-pointer"
                              title={biText(lang, `Pop a course onto ${cell.dateStr}`, `Xếp lớp vào ngày ${cell.dateStr}`)}
                            >
                              <Plus className="w-2.5 h-2.5" />
                              <span>{biText(lang, 'Class', 'Lớp')}</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Event Pills inside Grid Cell — Draggable by Admin, Click to Preview/Edit */}
                      <div className="space-y-1 mt-1.5 flex-1">
                        {cell.events.slice(0, 4).map((ev) => {
                          const st = eventTypeStyle(ev.eventType);
                          const isBeingDragged = draggedEvent?.id === ev.id;
                          return (
                            <button
                              key={ev.id}
                              type="button"
                              draggable={canManageCalendar}
                              onDragStart={(e) => {
                                if (!canManageCalendar) return;
                                e.stopPropagation();
                                e.dataTransfer.setData('text/plain', ev.id);
                                e.dataTransfer.effectAllowed = 'move';
                                setDraggedEvent(ev);
                              }}
                              onDragEnd={() => {
                                setDraggedEvent(null);
                                setDragOverDateStr(null);
                              }}
                              onDoubleClick={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (canManageCalendar && movingEvent) {
                                  void handleMoveEventToDate(movingEvent, cell.dateStr);
                                  return;
                                }
                                openEventPreview(ev);
                              }}
                              className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] font-semibold border truncate flex items-center gap-1 transition-all shadow-2xs ${st.pillBg} ${
                                canManageCalendar ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                              } ${isBeingDragged ? 'opacity-35 scale-95' : ''}`}
                              title={biText(
                                lang,
                                `${canManageCalendar ? 'Drag to move date or click to edit: ' : 'Click to preview: '}${ev.startTime}–${ev.endTime} · ${ev.titleEn}`,
                                `${canManageCalendar ? 'Kéo thả để dời ngày hoặc nhấp để sửa: ' : 'Nhấp để xem: '}${ev.startTime}–${ev.endTime} · ${ev.titleVi}`
                              )}
                            >
                              {canManageCalendar ? (
                                <GripVertical className="w-2.5 h-2.5 opacity-45 shrink-0 -ml-0.5" />
                              ) : (
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${st.dotBg}`} />
                              )}
                              <span className="font-mono-num text-[9px] opacity-80 shrink-0">{ev.startTime}</span>
                              <span className="truncate">{lang === 'vi' ? ev.titleVi : ev.titleEn}</span>
                            </button>
                          );
                        })}
                        {cell.events.length > 4 && (
                          <button
                            type="button"
                            onDoubleClick={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              openDayViewPopup(cell.dateStr);
                            }}
                            className="w-full text-left text-[10px] font-bold text-[#6B21A8] hover:text-[#2D3E99] hover:underline pl-1 cursor-pointer"
                            title={biText(lang, 'Click to open full Day View popup', 'Nhấp để mở cửa sổ Xem Chi tiết Ngày')}
                          >
                            +{cell.events.length - 4} {lang === 'vi' ? 'buổi khác · Xem ngày' : 'more · Day View'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#172154]/65 px-1">
                <span>
                  {canManageCalendar
                    ? biText(
                        lang,
                        'Tip: Double-click any date cell to open a full Day View popup, or drag classes onto another date/time.',
                        'Mẹo: Nhấp đúp vào bất kỳ ô ngày nào để mở cửa sổ Xem Ngày đầy đủ, hoặc kéo thả lớp sang ngày/giờ khác.'
                      )
                    : biText(
                        lang,
                        'Tip: Double-click any date cell (or click "+ more") to open a spacious Day View popup.',
                        'Mẹo: Nhấp đúp vào bất kỳ ô ngày nào (hoặc "+ buổi khác") để mở cửa sổ Xem Ngày chi tiết.'
                      )}
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => openDayViewPopup(selectedDate)}
                    className="font-bold text-[#2D3E99] hover:underline cursor-pointer"
                  >
                    {biText(lang, 'Open Day Popup', 'Mở Cửa sổ Ngày')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalendarView('week')}
                    className="font-bold text-[#6B21A8] hover:underline cursor-pointer"
                  >
                    {biText(lang, 'Week View →', 'Xem Tuần →')}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <CalendarTimeGridView
              mode={calendarView}
              lang={lang}
              canManageCalendar={canManageCalendar}
              selectedDate={selectedDate}
              todayStr={todayStr}
              events={monthEvents}
              draggedEvent={draggedEvent}
              onSelectDate={(d) => syncDateSelection(d)}
              onDateDoubleClick={(d) => openDayViewPopup(d)}
              onEventClick={openEventPreview}
              onDragEventChange={setDraggedEvent}
              onDropReschedule={(ev, updates) => {
                void handleRescheduleEventDrop(ev, updates);
              }}
              onEmptySlotClick={
                canManageCalendar
                  ? (dateStr, startTime, endTime, room) => {
                      openCreateEventModal(dateStr, startTime, endTime, room);
                    }
                  : undefined
              }
            />
          )}
        </div>

        {/* RIGHT 4 COLS: SELECTED DATE DETAILS & UPCOMING AGENDA */}
        <div className="xl:col-span-4 p-5 sm:p-6 bg-stone-50/60 flex flex-col justify-between space-y-6">
          {/* Selected Date Panel */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#2D3E99]/12">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#E61E64]">
                  {biText(lang, 'Selected Day Schedule', 'Chi tiết Ngày Đang chọn')}
                </div>
                <h3 className="font-display text-lg font-bold text-[#2D3E99] font-mono-num mt-0.5">
                  {selectedDate}
                </h3>
              </div>

              {canManageCalendar && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openQuickClassScheduler(selectedDate)}
                    className="px-3 py-1.5 rounded-xl bg-[#2D3E99] hover:bg-[#22317d] text-white text-xs font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    {biText(lang, '+ Class', '+ Lớp học')}
                  </button>
                  <button
                    type="button"
                    onClick={() => openCreateEventModal(selectedDate)}
                    className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#FDF9EE] border border-[#2D3E99]/20 text-[#2D3E99] text-xs font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {biText(lang, 'Event', 'Sự kiện')}
                  </button>
                </div>
              )}
            </div>

            {selectedDayEvents.length === 0 ? (
              <div className="p-5 rounded-2xl bg-white border border-dashed border-stone-300 text-center space-y-2.5">
                <CalendarIcon className="w-7 h-7 text-stone-300 mx-auto" />
                <p className="text-xs font-semibold text-stone-600">
                  {biText(
                    lang,
                    'No classes or academy events scheduled on this date.',
                    'Không có lịch học hoặc sự kiện nào vào ngày này.'
                  )}
                </p>
                {canManageCalendar && (
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => openQuickClassScheduler(selectedDate)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#2D3E99] text-white text-xs font-bold cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      {biText(lang, 'Pop Course Here', 'Xếp Lớp Vào Ngày Này')}
                    </button>
                    <button
                      type="button"
                      onClick={() => openCreateEventModal(selectedDate)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#FFD41D] text-[#172154] text-xs font-bold cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {biText(lang, 'Add Event', 'Thêm Sự kiện')}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDayEvents.map((ev) => {
                  const st = eventTypeStyle(ev.eventType);
                  const IconComp = st.icon;
                  return (
                    <div
                      key={ev.id}
                      draggable={canManageCalendar}
                      onDragStart={(e) => {
                        if (!canManageCalendar) return;
                        e.dataTransfer.setData('text/plain', ev.id);
                        e.dataTransfer.effectAllowed = 'move';
                        setDraggedEvent(ev);
                      }}
                      onDragEnd={() => {
                        setDraggedEvent(null);
                        setDragOverDateStr(null);
                      }}
                      onClick={() => openEventPreview(ev)}
                      className={`p-4 rounded-xl bg-white border border-[#172154]/10 hover:border-[#6B21A8]/40 space-y-2.5 transition-all ${
                        canManageCalendar ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                      } ${draggedEvent?.id === ev.id ? 'opacity-40 scale-[0.98]' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-[#172154]/75">
                          {canManageCalendar && (
                            <GripVertical className="w-3.5 h-3.5 text-[#6B21A8]/60 shrink-0 -ml-1" />
                          )}
                          <IconComp className="w-3.5 h-3.5 text-[#FF6B00] shrink-0" />
                          <span>{lang === 'vi' ? st.labelVi : st.labelEn}</span>
                          {ev.status === 'rescheduled' && (
                            <>
                              <span className="text-[#172154]/25">·</span>
                              <span className="text-[#B45309] font-semibold">
                                {biText(lang, 'Rescheduled', 'Đã đổi lịch')}
                              </span>
                            </>
                          )}
                        </span>

                        <span className="font-mono-num font-semibold text-[#172154] flex items-center gap-1 tabular-nums shrink-0">
                          <Clock className="w-3 h-3 text-[#172154]/45" />
                          {ev.startTime}–{ev.endTime}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-display text-sm font-bold text-[#172154] leading-snug">
                          {lang === 'vi' ? ev.titleVi : ev.titleEn}
                        </h4>
                        {lang === 'bi' && (
                          <div className="text-xs text-[#172154]/55 mt-0.5">{ev.titleVi}</div>
                        )}
                      </div>

                      <p className="text-xs text-[#172154]/70 leading-relaxed line-clamp-2">
                        {lang === 'vi' ? ev.descriptionVi : ev.descriptionEn}
                      </p>

                      {(ev.teacherName || (ev.studentNames && ev.studentNames.length > 0)) && (
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-[#172154]/65">
                          {ev.teacherName && (
                            <span className="font-medium text-[#172154]">
                              {biText(lang, 'Teacher:', 'GV:')} {ev.teacherName}
                            </span>
                          )}
                          {ev.studentNames && ev.studentNames.length > 0 && (
                            <span>
                              · {biText(lang, 'Students:', 'Học viên:')} {ev.studentNames.length}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-[#172154]/8 text-[11px] text-[#172154]/65">
                        <span className="flex items-center gap-1 font-medium">
                          <MapPin className="w-3 h-3 text-[#172154]/45" />
                          {ev.location}
                        </span>
                        <span className="inline-flex items-center gap-1 font-semibold text-[#FF6B00]">
                          <Eye className="w-3 h-3" />
                          {biText(lang, 'Preview', 'Xem chi tiết')}
                        </span>
                      </div>

                      {/* Admin Quick Move / Edit / Delete Controls (Universal for ALL event types) */}
                      {canManageCalendar && (
                        <div
                          className="space-y-2 pt-2 border-t border-[#172154]/8"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setMovingEvent(movingEvent?.id === ev.id ? null : ev)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border flex items-center gap-1 cursor-pointer ${
                                movingEvent?.id === ev.id
                                  ? 'bg-[#FF6B00] text-white border-[#FF6B00]'
                                  : 'bg-white hover:bg-[#F8F9FB] text-[#172154] border-[#172154]/15'
                              }`}
                            >
                              <MoveRight className="w-3.5 h-3.5" />
                              {movingEvent?.id === ev.id
                                ? biText(lang, 'Click a Day…', 'Chọn ô ngày…')
                                : biText(lang, 'Move', 'Dời ngày')}
                            </button>
                            <button
                              type="button"
                              onClick={() => openRescheduleModal(ev)}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#FAF5FF] hover:bg-[#6B21A8] text-[#6B21A8] hover:text-white border border-[#6B21A8]/25 flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              {biText(lang, 'Edit', 'Sửa')}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (ev.source === 'schedule') {
                                  setConfirmDeleteEventId(confirmDeleteEventId === ev.id ? null : ev.id);
                                } else {
                                  void handleDeleteEvent(ev, 'single_date');
                                }
                              }}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white hover:bg-[#E61E64]/8 text-[#E61E64] border border-[#E61E64]/20 flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              {biText(lang, 'Delete', 'Xóa')}
                            </button>
                          </div>

                          {ev.source === 'schedule' && confirmDeleteEventId === ev.id && (
                            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                              <span className="font-semibold text-rose-900">
                                {biText(lang, 'Delete which?', 'Xóa phạm vi nào?')}
                              </span>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={isSaving}
                                  onClick={() => void handleDeleteEvent(ev, 'single_date')}
                                  className="px-2 py-1 rounded-md bg-white hover:bg-rose-100 text-rose-800 border border-rose-300 font-bold cursor-pointer"
                                >
                                  {biText(lang, 'This Date Only', 'Chỉ ngày này')}
                                </button>
                                <button
                                  type="button"
                                  disabled={isSaving}
                                  onClick={() => void handleDeleteEvent(ev, 'weekly_series')}
                                  className="px-2 py-1 rounded-md bg-[#E61E64] hover:bg-[#c51754] text-white font-bold cursor-pointer"
                                >
                                  {biText(lang, 'All Weeks', 'Cả lịch tuần')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteEventId(null)}
                                  className="px-2 py-1 rounded-md text-stone-600 hover:bg-white font-semibold cursor-pointer"
                                >
                                  {biText(lang, 'Cancel', 'Hủy')}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Upcoming Assessments & Milestones List for the Month */}
          <div className="space-y-3 pt-4 border-t border-[#2D3E99]/12">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#2D3E99] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#E61E64]" />
                {biText(
                  lang,
                  'Key Assessments & Milestones This Month',
                  'Lịch Đánh giá & Cột mốc Trọng tâm Tháng'
                )}
              </h4>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {upcomingMonthEvents
                .filter((e) => e.eventType !== 'class_session' || e.source === 'firestore')
                .slice(0, 8)
                .map((ev) => {
                  const st = eventTypeStyle(ev.eventType);
                  return (
                    <div
                      key={ev.id}
                      onClick={() => openEventPreview(ev)}
                      className="p-3 rounded-xl bg-white border border-stone-200 hover:border-[#2D3E99]/40 transition-all cursor-pointer flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${st.dotBg}`} />
                          <span className="font-mono-num text-[11px] font-bold text-[#2D3E99]">
                            {ev.eventDate} · {ev.startTime}
                          </span>
                          {ev.status === 'rescheduled' && (
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 bg-amber-100 text-amber-900 rounded">
                              {biText(lang, 'Rescheduled', 'Đổi lịch')}
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-bold text-[#172154] truncate mt-0.5">
                          {lang === 'vi' ? ev.titleVi : ev.titleEn}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => openEventPreview(ev)}
                          className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-[#2D3E99] cursor-pointer"
                          title={biText(lang, 'Preview Event', 'Xem chi tiết')}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {canManageCalendar && (
                          <>
                            <button
                              type="button"
                              onClick={() => openRescheduleModal(ev)}
                              className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 cursor-pointer"
                              title={biText(lang, 'Edit / Reschedule Event', 'Sửa / Đổi lịch sự kiện')}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteEvent(ev, 'single_date')}
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 cursor-pointer"
                              title={biText(lang, 'Delete Event', 'Xóa sự kiện')}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>

      {/* DOUBLE-CLICK DAY VIEW POPUP MODAL — Spacious Rooms × Hours & Agenda List for Packed Days */}
      {dayPopupDate && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
          onClick={() => setDayPopupDate(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-5xl w-full max-h-[92vh] shadow-2xl border border-stone-200 overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Popup Header */}
            <div className="bg-gradient-to-r from-[#172154] to-[#2D3E99] text-white px-5 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1 bg-white/10 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => openDayViewPopup(addDaysToYmd(dayPopupDate, -1))}
                    className="p-1.5 rounded-lg hover:bg-white/20 text-white cursor-pointer"
                    title={biText(lang, 'Previous Day', 'Ngày trước')}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openDayViewPopup(todayStr)}
                    className="px-2 py-1 rounded-lg hover:bg-white/20 text-[11px] font-bold text-white cursor-pointer"
                  >
                    {biText(lang, 'Today', 'Hôm nay')}
                  </button>
                  <button
                    type="button"
                    onClick={() => openDayViewPopup(addDaysToYmd(dayPopupDate, 1))}
                    className="p-1.5 rounded-lg hover:bg-white/20 text-white cursor-pointer"
                    title={biText(lang, 'Next Day', 'Ngày tiếp theo')}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-[#FFD41D] text-[#172154] text-[10px] font-bold uppercase tracking-wider">
                      {biText(lang, 'Day View Popup', 'Chi Tiết Cả Ngày')}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-white/15 text-white font-mono-num text-[11px] font-bold">
                      {dayPopupEvents.length}{' '}
                      {dayPopupEvents.length === 1
                        ? biText(lang, 'session', 'buổi')
                        : biText(lang, 'sessions', 'buổi')}
                    </span>
                  </div>
                  <h3 className="font-display text-lg sm:text-xl font-bold text-white mt-0.5">
                    {getDayOfWeekFromYmd(dayPopupDate)} ·{' '}
                    <span className="font-mono-num">{dayPopupDate}</span>
                  </h3>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Timeline vs Agenda List Toggle */}
                <div className="inline-flex items-center bg-white/10 p-0.5 rounded-xl text-[11px]">
                  <button
                    type="button"
                    onClick={() => setDayPopupTab('timeline')}
                    className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                      dayPopupTab === 'timeline'
                        ? 'bg-white text-[#172154]'
                        : 'text-white/85 hover:text-white'
                    }`}
                  >
                    <Rows3 className="w-3.5 h-3.5" />
                    <span>{biText(lang, 'Rooms × Times', 'Phòng × Giờ')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDayPopupTab('list')}
                    className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                      dayPopupTab === 'list'
                        ? 'bg-white text-[#172154]'
                        : 'text-white/85 hover:text-white'
                    }`}
                  >
                    <List className="w-3.5 h-3.5" />
                    <span>{biText(lang, 'All Sessions List', 'Danh sách')}</span>
                  </button>
                </div>

                {canManageCalendar && (
                  <>
                    <button
                      type="button"
                      onClick={() => openQuickClassScheduler(dayPopupDate)}
                      className="px-3 py-1.5 rounded-xl bg-[#FF6B00] hover:bg-[#e55f00] text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      {biText(lang, '+ Class', '+ Lớp')}
                    </button>
                    <button
                      type="button"
                      onClick={() => openCreateEventModal(dayPopupDate)}
                      className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {biText(lang, 'Event', 'Sự kiện')}
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => {
                    syncDateSelection(dayPopupDate);
                    setCalendarView('day');
                    setDayPopupDate(null);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                  title={biText(lang, 'Switch main calendar to full Day View', 'Mở chế độ Xem Ngày toàn màn hình')}
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{biText(lang, 'Full View', 'Toàn lịch')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDayPopupDate(null)}
                  className="p-1.5 rounded-xl bg-white/10 hover:bg-white/25 text-white cursor-pointer"
                  title={biText(lang, 'Close Day View Popup (Esc)', 'Đóng cửa sổ (Esc)')}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Admin Drag Scope Strip inside Day Popup */}
            {canManageCalendar && dayPopupTab === 'timeline' && (
              <div className="px-5 py-2.5 bg-[#FAF5FF] border-b border-[#6B21A8]/15 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
                <span className="text-[#6B21A8] font-semibold flex items-center gap-1.5">
                  <GripVertical className="w-3.5 h-3.5" />
                  {biText(
                    lang,
                    'Drag classes vertically to reschedule time, horizontally to change room (Phòng 1–4), or drag bottom edge to resize.',
                    'Kéo thả lớp theo chiều dọc để đổi giờ, kéo ngang để đổi phòng (Phòng 1–4), hoặc kéo cạnh dưới để chỉnh thời lượng.'
                  )}
                </span>
                <div className="inline-flex items-center bg-white p-0.5 rounded-lg border border-[#6B21A8]/25 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setDragScope('single_date')}
                    className={`px-2 py-0.5 rounded-md font-bold cursor-pointer ${
                      dragScope === 'single_date'
                        ? 'bg-[#6B21A8] text-white'
                        : 'text-[#6B21A8] hover:bg-purple-50'
                    }`}
                  >
                    {biText(lang, 'This Date', '1 Ngày')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDragScope('weekly_schedule')}
                    className={`px-2 py-0.5 rounded-md font-bold cursor-pointer ${
                      dragScope === 'weekly_schedule'
                        ? 'bg-[#6B21A8] text-white'
                        : 'text-[#6B21A8] hover:bg-purple-50'
                    }`}
                  >
                    {biText(lang, 'Weekly Slot', 'Cả Tuần')}
                  </button>
                </div>
              </div>
            )}

            {/* Popup Body */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 bg-stone-50/50">
              {dayPopupTab === 'timeline' ? (
                <CalendarTimeGridView
                  mode="day"
                  lang={lang}
                  canManageCalendar={canManageCalendar}
                  selectedDate={dayPopupDate}
                  todayStr={todayStr}
                  events={monthEvents}
                  draggedEvent={draggedEvent}
                  onSelectDate={(d) => openDayViewPopup(d)}
                  onEventClick={openEventPreview}
                  onDragEventChange={setDraggedEvent}
                  onDropReschedule={(ev, updates) => {
                    void handleRescheduleEventDrop(ev, updates);
                  }}
                  onEmptySlotClick={
                    canManageCalendar
                      ? (dateStr, startTime, endTime, room) => {
                          openCreateEventModal(dateStr, startTime, endTime, room);
                        }
                      : undefined
                  }
                  maxHeightClass="max-h-[60vh]"
                />
              ) : dayPopupEvents.length === 0 ? (
                <div className="py-12 px-6 rounded-2xl bg-white border border-dashed border-stone-300 text-center space-y-3">
                  <CalendarIcon className="w-9 h-9 text-stone-300 mx-auto" />
                  <p className="text-sm font-semibold text-stone-600">
                    {biText(
                      lang,
                      `No classes or events scheduled on ${dayPopupDate}.`,
                      `Chưa có lớp học hoặc sự kiện nào vào ngày ${dayPopupDate}.`
                    )}
                  </p>
                  {canManageCalendar && (
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => openQuickClassScheduler(dayPopupDate)}
                        className="px-4 py-2 rounded-xl bg-[#2D3E99] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        {biText(lang, 'Schedule Class on This Day', 'Xếp Lớp Vào Ngày Này')}
                      </button>
                      <button
                        type="button"
                        onClick={() => openCreateEventModal(dayPopupDate)}
                        className="px-4 py-2 rounded-xl bg-[#FFD41D] text-[#172154] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {biText(lang, 'Add Event', 'Thêm Sự kiện')}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {dayPopupEvents.map((ev) => {
                    const st = eventTypeStyle(ev.eventType);
                    const IconComp = st.icon;
                    return (
                      <div
                        key={ev.id}
                        onClick={() => openEventPreview(ev)}
                        className={`p-4 rounded-2xl bg-white border border-stone-200 hover:border-[#6B21A8]/45 shadow-2xs transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${st.cardBorder}`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="inline-flex items-center gap-1.5 font-bold text-[#172154]/80">
                              <IconComp className="w-3.5 h-3.5 text-[#FF6B00]" />
                              {lang === 'vi' ? st.labelVi : st.labelEn}
                              {ev.status === 'rescheduled' && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-bold">
                                  {biText(lang, 'Rescheduled', 'Đã đổi lịch')}
                                </span>
                              )}
                            </span>
                            <span className="font-mono-num font-bold text-[#2D3E99] bg-white px-2 py-0.5 rounded-lg border border-[#2D3E99]/15 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {ev.startTime}–{ev.endTime}
                            </span>
                          </div>

                          <div>
                            <h4 className="font-display text-sm font-bold text-[#172154]">
                              {lang === 'vi' ? ev.titleVi : ev.titleEn}
                            </h4>
                            <p className="text-xs text-[#172154]/70 mt-0.5 line-clamp-2">
                              {lang === 'vi' ? ev.descriptionVi : ev.descriptionEn}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-200/80 text-[11px]">
                          <div className="flex flex-wrap items-center gap-2 text-[#172154]/75 font-semibold">
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-[#6B21A8]" />
                              {ev.location}
                            </span>
                            {ev.teacherName && (
                              <span className="text-[#172154]/60">· {ev.teacherName}</span>
                            )}
                          </div>

                          <div
                            className="flex items-center gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => openEventPreview(ev)}
                              className="px-2.5 py-1 rounded-lg bg-white hover:bg-stone-100 border border-stone-200 text-[#2D3E99] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3 h-3" />
                              {biText(lang, 'Details', 'Xem')}
                            </button>
                            {canManageCalendar && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openRescheduleModal(ev)}
                                  className="px-2.5 py-1 rounded-lg bg-[#FAF5FF] hover:bg-[#6B21A8] text-[#6B21A8] hover:text-white border border-[#6B21A8]/25 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  {biText(lang, 'Edit', 'Sửa')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteEvent(ev, 'single_date')}
                                  className="px-2 py-1 rounded-lg bg-white hover:bg-rose-50 text-[#E61E64] border border-[#E61E64]/20 font-bold cursor-pointer"
                                  title={biText(lang, 'Remove from this date', 'Xóa khỏi ngày này')}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* EVENT PREVIEW WINDOW (MODAL) — Opens whenever any user clicks an event */}
      {previewEvent && (
        <div
          className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setPreviewEvent(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-stone-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Preview Header */}
            <div className="bg-gradient-to-r from-[#172154] to-[#2D3E99] text-white px-6 py-5 flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-[#FFD41D] text-[#172154] text-[11px] font-bold uppercase tracking-wider">
                    {lang === 'vi'
                      ? eventTypeStyle(previewEvent.eventType).labelVi
                      : eventTypeStyle(previewEvent.eventType).labelEn}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md bg-white/15 text-white font-mono-num text-xs font-bold">
                    {previewEvent.eventDate}
                  </span>
                  {previewEvent.status === 'rescheduled' && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-400/25 text-amber-200 border border-amber-300/40 text-[11px] font-bold">
                      {biText(lang, 'Rescheduled', 'Đã đổi lịch')}
                    </span>
                  )}
                </div>
                <h3 className="font-display text-lg sm:text-xl font-bold text-white leading-snug pt-0.5">
                  {previewEvent.titleEn}
                </h3>
                {previewEvent.titleVi && previewEvent.titleVi !== previewEvent.titleEn && (
                  <p className="text-xs sm:text-sm text-indigo-100/90 font-medium">{previewEvent.titleVi}</p>
                )}
              </div>

              <button
                type="button"
                onClick={() => setPreviewEvent(null)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Preview Body */}
            <div className="p-6 space-y-5">
              {/* Key Info Grid */}
              <div className="grid grid-cols-2 gap-3 bg-[#FDF9EE] p-4 rounded-2xl border border-[#2D3E99]/15 text-xs">
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#172154]/60">
                    {biText(lang, 'Date & Time', 'Ngày & Giờ')}
                  </div>
                  <div className="font-mono-num font-bold text-[#2D3E99] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#E61E64]" />
                    <span>
                      {previewEvent.eventDate} · {previewEvent.startTime}–{previewEvent.endTime}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#172154]/60">
                    {biText(lang, 'Location / Room', 'Địa điểm / Phòng')}
                  </div>
                  <div className="font-bold text-[#172154] flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#2D3E99]" />
                    <span>{previewEvent.location}</span>
                  </div>
                </div>

                {previewEvent.cefrLevel && (
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#172154]/60">
                      {biText(lang, 'Target Level / Group', 'Cấp độ CEFR / Nhóm')}
                    </div>
                    <div className="font-bold text-[#E61E64]">{previewEvent.cefrLevel}</div>
                  </div>
                )}

                {previewEvent.className && (
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#172154]/60">
                      {biText(lang, 'Course / Class', 'Khoá học / Lớp')}
                    </div>
                    <div className="font-bold text-[#172154]">{previewEvent.className}</div>
                  </div>
                )}

                {previewEvent.teacherName && (
                  <div className="space-y-1 col-span-2 pt-2 border-t border-[#2D3E99]/10">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#172154]/60">
                      {biText(lang, 'Assigned Teacher', 'Giáo viên Phụ trách')}
                    </div>
                    <div className="font-bold text-[#2D3E99]">
                      {previewEvent.teacherName}
                      {previewEvent.teacherEmail ? (
                        <span className="font-normal text-[#172154]/65"> · {previewEvent.teacherEmail}</span>
                      ) : null}
                    </div>
                  </div>
                )}

                {previewEvent.studentNames && previewEvent.studentNames.length > 0 && (
                  <div className="space-y-1 col-span-2 pt-2 border-t border-[#2D3E99]/10">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#172154]/60">
                      {biText(
                        lang,
                        `Assigned Students (${previewEvent.studentNames.length})`,
                        `Học viên Tham gia (${previewEvent.studentNames.length})`
                      )}
                    </div>
                    <div className="font-semibold text-[#172154] leading-relaxed">
                      {previewEvent.studentNames.join(' · ')}
                    </div>
                  </div>
                )}
              </div>

              {previewEvent.previousDate && (
                <div className="px-3.5 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2 font-medium">
                  <CalendarClock className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>
                    {biText(
                      lang,
                      `Previously scheduled on ${previewEvent.previousDate}`,
                      `Đã được dời từ ngày cũ: ${previewEvent.previousDate}`
                    )}
                  </span>
                </div>
              )}

              {/* Bilingual Descriptions */}
              <div className="space-y-2.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#2D3E99]">
                  {biText(lang, 'Event Details & Notes', 'Chi tiết Sự kiện & Hướng dẫn')}
                </div>
                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2 text-xs sm:text-sm text-[#172154] leading-relaxed">
                  <p>{previewEvent.descriptionEn}</p>
                  {previewEvent.descriptionVi && previewEvent.descriptionVi !== previewEvent.descriptionEn && (
                    <p className="text-xs text-[#172154]/75 pt-2 border-t border-stone-200/80 italic">
                      {previewEvent.descriptionVi}
                    </p>
                  )}
                </div>
              </div>

              {/* ADMIN QUICK MOVE DATE & TIME CONTROLS */}
              {canManageCalendar && (
                <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#172154] flex items-center gap-1.5">
                      <CalendarClock className="w-4 h-4 text-[#E61E64]" />
                      {biText(
                        lang,
                        'Admin Quick Reschedule (Date & Time)',
                        'Dời Nhanh Ngày & Giờ Sự kiện (Admin)'
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const ev = previewEvent;
                        setPreviewEvent(null);
                        setMovingEvent(ev);
                      }}
                      className="text-[11px] font-bold text-[#2D3E99] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <MoveRight className="w-3.5 h-3.5" />
                      {biText(lang, 'Or click a date on grid', 'Hoặc chọn ô trên lưới lịch')}
                    </button>
                  </div>

                  {/* Quick Shift Pills (-30m, +30m, -1d, +1d, +7d) */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => {
                        const s = Math.max(8 * 60, parseTimeToMinutes(previewEvent.startTime, 9 * 60) - 30);
                        void handleRescheduleEventDrop(previewEvent, {
                          eventDate: previewEvent.eventDate,
                          startTime: minutesToTimeStr(s)
                        });
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-purple-100 border border-[#6B21A8]/25 text-[11px] font-bold text-[#6B21A8] cursor-pointer"
                    >
                      -30m
                    </button>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => {
                        const s = Math.min(21 * 60, parseTimeToMinutes(previewEvent.startTime, 9 * 60) + 30);
                        void handleRescheduleEventDrop(previewEvent, {
                          eventDate: previewEvent.eventDate,
                          startTime: minutesToTimeStr(s)
                        });
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-purple-100 border border-[#6B21A8]/25 text-[11px] font-bold text-[#6B21A8] cursor-pointer"
                    >
                      +30m
                    </button>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() =>
                        void handleMoveEventToDate(previewEvent, addDaysToYmd(previewEvent.eventDate, -1))
                      }
                      className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-indigo-100 border border-indigo-200 text-[11px] font-bold text-[#172154] cursor-pointer"
                    >
                      -1 {biText(lang, 'Day', 'Ngày')}
                    </button>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() =>
                        void handleMoveEventToDate(previewEvent, addDaysToYmd(previewEvent.eventDate, 1))
                      }
                      className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-indigo-100 border border-indigo-200 text-[11px] font-bold text-[#172154] cursor-pointer"
                    >
                      +1 {biText(lang, 'Day', 'Ngày')}
                    </button>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() =>
                        void handleMoveEventToDate(previewEvent, addDaysToYmd(previewEvent.eventDate, 7))
                      }
                      className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-indigo-100 border border-indigo-200 text-[11px] font-bold text-[#172154] cursor-pointer"
                    >
                      +1 {biText(lang, 'Week', 'Tuần')}
                    </button>
                  </div>

                  {/* Direct Date + Start/End Time Pickers */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <input
                      type="date"
                      value={quickMoveTargetDate}
                      onChange={(e) => setQuickMoveTargetDate(e.target.value)}
                      className="flex-1 min-w-[130px] px-2.5 py-1.5 rounded-lg border border-indigo-300 bg-white text-xs font-mono-num font-bold text-[#2D3E99]"
                    />
                    <input
                      type="time"
                      value={quickMoveStartTime}
                      onChange={(e) => setQuickMoveStartTime(e.target.value)}
                      className="w-[100px] px-2 py-1.5 rounded-lg border border-indigo-300 bg-white text-xs font-mono-num font-semibold text-[#172154]"
                    />
                    <span className="text-xs font-bold text-stone-400">–</span>
                    <input
                      type="time"
                      value={quickMoveEndTime}
                      onChange={(e) => setQuickMoveEndTime(e.target.value)}
                      className="w-[100px] px-2 py-1.5 rounded-lg border border-indigo-300 bg-white text-xs font-mono-num font-semibold text-[#172154]"
                    />
                    <button
                      type="button"
                      disabled={
                        isSaving ||
                        (!quickMoveTargetDate && !quickMoveStartTime) ||
                        (quickMoveTargetDate === previewEvent.eventDate &&
                          quickMoveStartTime === previewEvent.startTime &&
                          quickMoveEndTime === previewEvent.endTime)
                      }
                      onClick={() =>
                        void handleRescheduleEventDrop(previewEvent, {
                          eventDate: quickMoveTargetDate || previewEvent.eventDate,
                          startTime: quickMoveStartTime || previewEvent.startTime,
                          endTime: quickMoveEndTime || previewEvent.endTime
                        })
                      }
                      className="px-3 py-1.5 rounded-lg bg-[#2D3E99] hover:bg-[#1f2c73] text-white text-xs font-bold flex items-center gap-1 disabled:opacity-40 cursor-pointer"
                    >
                      <span>{biText(lang, 'Move', 'Dời')}</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Preview Footer */}
            <div className="px-6 py-4 bg-stone-50 border-t border-stone-200 flex flex-wrap items-center justify-between gap-2">
              {canManageCalendar ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openRescheduleModal(previewEvent)}
                    className="px-4 py-2 rounded-xl bg-[#FFD41D] hover:bg-[#f5c800] text-[#172154] text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    {biText(lang, 'Edit Event / Schedule', 'Chỉnh sửa Thông tin / Lịch')}
                  </button>
                  {previewEvent.source === 'schedule' ? (
                    <>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => void handleDeleteEvent(previewEvent, 'single_date')}
                        className="px-3 py-2 rounded-xl bg-white hover:bg-rose-50 text-rose-800 border border-rose-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {biText(lang, 'Remove This Date', 'Xóa ngày này')}
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => void handleDeleteEvent(previewEvent, 'weekly_series')}
                        className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {biText(lang, 'Delete Weekly Slot', 'Xóa lịch tuần')}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => void handleDeleteEvent(previewEvent, 'single_date')}
                      className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {biText(lang, 'Delete', 'Xóa')}
                    </button>
                  )}
                </div>
              ) : (
                <div />
              )}

              <button
                type="button"
                onClick={() => setPreviewEvent(null)}
                className="px-4 py-2 rounded-xl bg-[#172154] hover:bg-[#2D3E99] text-white text-xs font-bold cursor-pointer"
              >
                {biText(lang, 'Close Preview', 'Đóng Cửa sổ')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN ADD / EDIT / RESCHEDULE EVENT MODAL */}
      {canManageCalendar && showEventModal && (
        <div className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-stone-200 overflow-hidden">
            <div className="bg-[#172154] text-white px-6 py-4 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#FFD41D]">
                  {modalMode === 'reschedule'
                    ? biText(
                        lang,
                        'EDIT & RESCHEDULE ACADEMY EVENT',
                        'CHỈNH SỬA & ĐỔI LỊCH SỰ KIỆN HỌC VIỆN'
                      )
                    : biText(lang, 'CREATE NEW ACADEMY CALENDAR EVENT', 'THÊM SỰ KIỆN MỚI VÀO LỊCH HỌC VIỆN')}
                </div>
                <h3 className="font-display text-lg font-bold text-white mt-0.5">
                  {modalMode === 'reschedule'
                    ? biText(lang, 'Edit Event Information, Date & Time', 'Sửa Thông tin, Ngày & Giờ Sự kiện')
                    : biText(
                        lang,
                        'Add Class, Assessment Date or Milestone',
                        'Thêm Lịch học, Ngày Đánh giá CEFR hoặc Cột mốc'
                      )}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowEventModal(false)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="p-6 space-y-4">
              {/* Recurring Schedule Scope Selector when editing a weekly class schedule */}
              {modalMode === 'reschedule' && editingEventSource === 'schedule' && (
                <div className="p-3.5 rounded-2xl bg-[#FAF5FF] border border-[#6B21A8]/20 space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#6B21A8] flex items-center gap-1.5">
                    <Repeat className="w-3.5 h-3.5" />
                    {biText(lang, 'Recurring Weekly Class — Choose Edit Scope', 'Lịch Học Định Kỳ Hàng Tuần — Chọn Phạm Vi Sửa')}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditScope('weekly_schedule')}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border text-left cursor-pointer transition-colors ${
                        editScope === 'weekly_schedule'
                          ? 'bg-[#6B21A8] text-white border-[#6B21A8]'
                          : 'bg-white text-[#172154] border-[#6B21A8]/20 hover:bg-purple-50'
                      }`}
                    >
                      <div>{biText(lang, 'Edit Weekly Recurring Slot', 'Sửa Lịch Cố Định Hàng Tuần')}</div>
                      <div className={`text-[10px] font-normal mt-0.5 ${editScope === 'weekly_schedule' ? 'text-purple-100' : 'text-stone-500'}`}>
                        {biText(lang, 'Updates day, time, room & title every week', 'Cập nhật thứ, giờ, phòng & tên lớp cho mọi tuần')}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditScope('single_date')}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border text-left cursor-pointer transition-colors ${
                        editScope === 'single_date'
                          ? 'bg-[#6B21A8] text-white border-[#6B21A8]'
                          : 'bg-white text-[#172154] border-[#6B21A8]/20 hover:bg-purple-50'
                      }`}
                    >
                      <div>{biText(lang, `Edit Only ${originalDateForReschedule}`, `Chỉ Sửa Ngày ${originalDateForReschedule}`)}</div>
                      <div className={`text-[10px] font-normal mt-0.5 ${editScope === 'single_date' ? 'text-purple-100' : 'text-stone-500'}`}>
                        {biText(lang, 'Overrides this single date only', 'Chỉ thay đổi riêng buổi học ngày này')}
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {modalMode === 'reschedule' && originalDateForReschedule && editScope === 'single_date' && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-center justify-between">
                  <span>
                    {biText(lang, 'Original Scheduled Date:', 'Ngày theo lịch ban đầu:')}{' '}
                    <strong className="font-mono-num">{originalDateForReschedule}</strong>
                  </span>
                  <span className="font-bold text-amber-800">
                    {biText(lang, 'Update date, time or details below', 'Cập nhật ngày, giờ hoặc nội dung bên dưới')}
                  </span>
                </div>
              )}

              {editScope === 'weekly_schedule' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">
                      {biText(lang, 'Day of Week *', 'Thứ Trong Tuần *')}
                    </label>
                    <select
                      value={formDayOfWeek}
                      onChange={(e) => setFormDayOfWeek(e.target.value as ClassSchedule['dayOfWeek'])}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-bold text-[#6B21A8] bg-white"
                    >
                      {WEEKDAY_OPTIONS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">
                      {biText(lang, 'Week Number', 'Tuần Học')}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={52}
                      value={formWeekNumber}
                      onChange={(e) => setFormWeekNumber(Number(e.target.value) || 1)}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-mono-num font-bold text-[#2D3E99]"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">
                      {biText(lang, 'Event Type *', 'Loại Sự kiện *')}
                    </label>
                    <select
                      value={formEventType}
                      onChange={(e) => setFormEventType(e.target.value as AcademyEventType)}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-bold text-[#172154]"
                    >
                      <option value="cefr_assessment">CEFR Assessment Date (Lịch Đánh giá CEFR)</option>
                      <option value="academy_milestone">Academy Milestone (Cột mốc Học viện)</option>
                      <option value="class_session">Class Schedule Session (Buổi Học Lớp)</option>
                      <option value="parent_workshop">Parent-Teacher Workshop (Hội thảo Phụ huynh)</option>
                      <option value="holiday">Academy Holiday / Break (Lịch Nghỉ Lễ)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">
                      {biText(lang, 'Event Date (YYYY-MM-DD) *', 'Ngày Diễn ra (YYYY-MM-DD) *')}
                    </label>
                    <input
                      type="date"
                      required
                      value={formEventDate}
                      onChange={(e) => setFormEventDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-mono-num font-bold text-[#2D3E99]"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    {biText(lang, 'Start Time', 'Giờ Bắt đầu')}
                  </label>
                  <input
                    type="time"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-mono-num font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    {biText(lang, 'End Time', 'Giờ Kết thúc')}
                  </label>
                  <input
                    type="time"
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-mono-num font-semibold"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    {biText(lang, 'Target CEFR / Cohort', 'Cấp độ CEFR / Nhóm')}
                  </label>
                  <select
                    value={formCefrLevel}
                    onChange={(e) => setFormCefrLevel(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border border-stone-300 text-xs font-semibold"
                  >
                    <option value="All CEFR Levels">All CEFR Levels</option>
                    <option value="Group Class">Group Class (Lớp Nhóm)</option>
                    {CEFR_LEVELS.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    {editScope === 'weekly_schedule'
                      ? biText(lang, 'Class Name *', 'Tên Lớp Học *')
                      : biText(lang, 'Title (English) *', 'Tiêu đề Sự kiện (Tiếng Anh) *')}
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitleEn}
                    onChange={(e) => setFormTitleEn(e.target.value)}
                    placeholder="e.g., Tiếng Anh A – Ca 1"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    {editScope === 'weekly_schedule'
                      ? biText(lang, 'Teacher Name (display)', 'Tên Giáo Viên Phụ Trách')
                      : biText(lang, 'Title (Vietnamese)', 'Tiêu đề Sự kiện (Tiếng Việt)')}
                  </label>
                  {editScope === 'weekly_schedule' ? (
                    <input
                      type="text"
                      value={formTeacherName}
                      onChange={(e) => setFormTeacherName(e.target.value)}
                      placeholder="LiLab Faculty"
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-semibold"
                    />
                  ) : (
                    <input
                      type="text"
                      value={formTitleVi}
                      onChange={(e) => setFormTitleVi(e.target.value)}
                      placeholder="VD: Kỳ thi Nói chuẩn Cambridge CEFR Giữa kỳ"
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-semibold"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    {biText(lang, 'Room / Campus Location', 'Phòng học / Địa điểm')}
                  </label>
                  <input
                    type="text"
                    list="lilab-room-suggestions"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="Phòng 1 / Phòng 2 / Phòng 3 / Phòng 4"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs"
                  />
                  <datalist id="lilab-room-suggestions">
                    <option value="Phòng 1" />
                    <option value="Phòng 2" />
                    <option value="Phòng 3" />
                    <option value="Phòng 4 – Coach 1:1" />
                  </datalist>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    {biText(lang, 'Status', 'Trạng thái')}
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) =>
                      setFormStatus(
                        e.target.value as 'scheduled' | 'rescheduled' | 'completed' | 'cancelled'
                      )
                    }
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-semibold"
                  >
                    <option value="scheduled">Scheduled (Đúng lịch)</option>
                    {editScope === 'single_date' && (
                      <option value="rescheduled">Rescheduled (Đã đổi lịch)</option>
                    )}
                    <option value="completed">Completed (Đã hoàn thành)</option>
                    <option value="cancelled">Cancelled (Đã hủy)</option>
                  </select>
                </div>
              </div>

              {formEventType === 'class_session' && (teachers.length > 0 || students.length > 0) && (
                <div className="p-3.5 rounded-2xl bg-[#FDF9EE] border border-[#2D3E99]/15 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#2D3E99]">
                      {biText(
                        lang,
                        'Calendar Visibility: Assigned Teacher & Students',
                        'Hiển thị trên Lịch: Giáo viên & Học viên phụ trách'
                      )}
                    </div>
                    <span className="text-[11px] font-semibold text-[#172154]/70 font-mono-num">
                      {formStudentIds.length} {biText(lang, 'students', 'học viên')}
                    </span>
                  </div>

                  {teachers.length > 0 && (
                    <div>
                      <label className="block text-[11px] font-bold text-stone-700 mb-1">
                        {biText(lang, 'Assigned Teacher (syncs to Teacher Portal)', 'Giáo viên phụ trách (đồng bộ Lịch Giáo viên)')}
                      </label>
                      <select
                        value={formTeacherEmail}
                        onChange={(e) => setFormTeacherEmail(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs font-semibold text-[#172154]"
                      >
                        <option value="">
                          {biText(lang, '— All Teachers / Unassigned —', '— Tất cả Giáo viên / Chưa gán —')}
                        </option>
                        {teachers.map((tc) => (
                          <option key={tc.id} value={tc.teacherEmail.toLowerCase()}>
                            {tc.fullName} ({tc.teacherEmail})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {students.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-bold text-stone-700">
                          {biText(
                            lang,
                            'Assigned Students (syncs to Student & Parent Calendars)',
                            'Học viên tham gia (đồng bộ Lịch Học viên & Phụ huynh)'
                          )}
                        </label>
                        {formStudentIds.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setFormStudentIds([])}
                            className="text-[10px] font-bold text-[#E61E64] hover:underline cursor-pointer"
                          >
                            {biText(lang, 'Clear all', 'Bỏ chọn tất cả')}
                          </button>
                        )}
                      </div>
                      <div className="max-h-32 overflow-y-auto rounded-xl border border-stone-200 bg-white divide-y divide-stone-100">
                        {students.map((st) => {
                          const checked = formStudentIds.includes(st.id);
                          return (
                            <label
                              key={st.id}
                              className={`flex items-center justify-between gap-2 px-3 py-1.5 text-xs cursor-pointer transition ${
                                checked ? 'bg-indigo-50/70' : 'hover:bg-stone-50'
                              }`}
                            >
                              <span className="flex items-center gap-2 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    setFormStudentIds((prev) =>
                                      prev.includes(st.id)
                                        ? prev.filter((id) => id !== st.id)
                                        : [...prev, st.id]
                                    )
                                  }
                                  className="rounded border-stone-300 text-[#2D3E99] focus:ring-[#2D3E99]"
                                />
                                <span className="font-semibold text-[#172154] truncate">
                                  {st.fullName}
                                </span>
                              </span>
                              <span className="text-[10px] font-mono-num text-stone-500 shrink-0">
                                {st.cefrLevel}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    {biText(lang, 'Description / Notes (English)', 'Ghi chú / Nội dung (Tiếng Anh)')}
                  </label>
                  <textarea
                    rows={2}
                    value={formDescriptionEn}
                    onChange={(e) => setFormDescriptionEn(e.target.value)}
                    placeholder="Details for parents, students, and teachers..."
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    {biText(lang, 'Description / Notes (Vietnamese)', 'Ghi chú / Nội dung (Tiếng Việt)')}
                  </label>
                  <textarea
                    rows={2}
                    value={formDescriptionVi}
                    onChange={(e) => setFormDescriptionVi(e.target.value)}
                    placeholder="Hướng dẫn chi tiết dành cho phụ huynh và học viên..."
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowEventModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-stone-300 text-stone-700 hover:bg-stone-100 cursor-pointer"
                >
                  {biText(lang, 'Cancel', 'Hủy')}
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#2D3E99] hover:bg-[#1f2c73] text-white shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#FFD41D]" />
                  {isSaving
                    ? biText(lang, 'Saving...', 'Đang lưu...')
                    : modalMode === 'reschedule'
                      ? biText(lang, 'Save Changes & Schedule', 'Lưu Thay đổi & Lịch Mới')
                      : biText(lang, 'Add Event to Calendar', 'Thêm vào Lịch Học viện')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADMIN QUICK CLASS SCHEDULER MODAL (POP COURSE INTO CALENDAR WITH TEACHER & STUDENTS) */}
      {canManageCalendar && showQuickClassModal && (
        <Suspense fallback={null}>
          <QuickClassSchedulerModal
            lang={lang}
            currentUser={currentUser || { uid: auth.currentUser?.uid || 'admin-root', email: auth.currentUser?.email || 'admin@lilab.edu.vn', displayName: auth.currentUser?.displayName || 'Admin', role: 'super_admin', status: 'active', preferredLang: 'en' }}
            initialDate={quickClassInitialDate}
            programs={programs}
            classes={classes}
            teachers={teachers}
            students={students}
            onClose={() => setShowQuickClassModal(false)}
            onScheduled={({ firstDate, count, courseTitle, teacherName, studentCount }) => {
              setShowQuickClassModal(false);
              const parts = firstDate.split('-').map(Number);
              if (parts.length === 3 && !parts.some(Number.isNaN)) {
                setViewYear(parts[0]);
                setViewMonth(parts[1] - 1);
              }
              setSelectedDate(firstDate);
              flash(
                biText(
                  lang,
                  `Scheduled ${count} session${count === 1 ? '' : 's'} of "${courseTitle}" for ${teacherName} and ${studentCount} student${studentCount === 1 ? '' : 's'} — now synced to their calendars!`,
                  `Đã xếp ${count} buổi học "${courseTitle}" cho GV ${teacherName} và ${studentCount} học viên — đã tự động hiển thị trên lịch của giáo viên và học viên!`
                )
              );
            }}
          />
        </Suspense>
      )}
    </div>
  );
};
