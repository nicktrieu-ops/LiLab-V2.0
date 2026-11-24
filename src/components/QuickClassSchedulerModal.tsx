import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  GraduationCap,
  MapPin,
  Plus,
  Repeat,
  Search,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  arrayUnion,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { biText } from '../i18n';
import type { PceLevelCourse } from '../data/pceCurriculumData';
import { ProfileAvatar } from './ProfileAvatar';
import {
  CEFR_LEVELS,
  formatCefrLabel,
  type AcademyClass,
  type LangCode,
  type ProgramCourse,
  type StudentProfile,
  type TeacherProfile,
  type UserProfile,
} from '../types';

export interface CourseOption {
  id: string;
  source: 'program' | 'big_skills' | 'pce' | 'class';
  titleEn: string;
  titleVi: string;
  cefrLevel: string;
  defaultDurationMinutes: number;
  suggestedSessions: number;
  descriptionEn: string;
  descriptionVi: string;
  classId?: string;
  className?: string;
  defaultTeacherEmail?: string;
  defaultStudentIds?: string[];
  defaultRoom?: string;
}

const BIG_SKILLS_COURSES: CourseOption[] = [
  {
    id: 'bsbh_intro',
    source: 'big_skills',
    titleEn: 'Big Skills, Big Heart — Introduction',
    titleVi: 'Big Skills, Big Heart — Lớp Nhập Môn',
    cefrLevel: 'Pre-A1 Starters',
    defaultDurationMinutes: 60,
    suggestedSessions: 4,
    descriptionEn:
      '4 thematic sessions (1h each) exploring Reading, Storytelling, Role-play, Music & Cultural Expression with 100% foreign teachers.',
    descriptionVi:
      '4 buổi chuyên đề × 1 giờ khám phá Đọc truyện, Kể chuyện, Nhập vai, Âm nhạc và Văn hoá cùng 100% giáo viên nước ngoài.',
  },
  {
    id: 'bsbh_found_1',
    source: 'big_skills',
    titleEn: 'Big Skills, Big Heart — Foundation Level 1',
    titleVi: 'Big Skills, Big Heart — Foundation Cấp Độ 1',
    cefrLevel: 'A1 Movers',
    defaultDurationMinutes: 90,
    suggestedSessions: 8,
    descriptionEn:
      '8 sessions (1.5h each) building expressive English communication, poetry, cultural exploration, and creative life skills.',
    descriptionVi:
      '8 buổi × 1,5 giờ xây dựng giao tiếp tiếng Anh tự tin, thơ ca, khám phá văn hoá và kỹ năng sống sáng tạo.',
  },
  {
    id: 'bsbh_found_2',
    source: 'big_skills',
    titleEn: 'Big Skills, Big Heart — Foundation Level 2',
    titleVi: 'Big Skills, Big Heart — Foundation Cấp Độ 2',
    cefrLevel: 'A2 Flyers',
    defaultDurationMinutes: 90,
    suggestedSessions: 8,
    descriptionEn:
      '8 sessions (1.5h each) deepening comprehension, dramatic storytelling, cross-cultural projects, and confident presentation.',
    descriptionVi:
      '8 buổi × 1,5 giờ nâng cao đọc hiểu, kể chuyện sáng tạo, dự án văn hoá và kỹ năng thuyết trình tự tin.',
  },
  {
    id: 'bsbh_found_3',
    source: 'big_skills',
    titleEn: 'Big Skills, Big Heart — Foundation Level 3',
    titleVi: 'Big Skills, Big Heart — Foundation Cấp Độ 3',
    cefrLevel: 'A2 Key',
    defaultDurationMinutes: 90,
    suggestedSessions: 8,
    descriptionEn:
      '8 sessions (1.5h each) mastering critical thinking, expressive writing, collaborative leadership, and showcase performance.',
    descriptionVi:
      '8 buổi × 1,5 giờ làm chủ tư duy phản biện, viết biểu đạt, làm việc nhóm và biểu diễn tổng kết.',
  },
  {
    id: 'talent_music_poetry',
    source: 'big_skills',
    titleEn: 'Music & Poetry Studio (MP-01)',
    titleVi: 'Âm Nhạc & Thơ Ca – Tiếng Anh Qua Giai Điệu (MP-01)',
    cefrLevel: 'A1 Movers',
    defaultDurationMinutes: 90,
    suggestedSessions: 8,
    descriptionEn:
      '8 sessions (1.5h each) mastering English pronunciation, rhythm, choral singing, classic children’s poetry, and a mini stage recital (2,400,000 VND).',
    descriptionVi:
      '8 buổi × 1,5 giờ cảm thụ phát âm, nhịp điệu tiếng Anh qua ca hát, đọc thơ thiếu nhi và biểu diễn mini cuối khoá (2.400.000 VNĐ).',
  },
  {
    id: 'talent_cultural_exploration',
    source: 'big_skills',
    titleEn: 'Cultural Exploration Lab (CE-01)',
    titleVi: 'Khám Phá Văn Hoá Thế Giới (CE-01)',
    cefrLevel: 'A2 Flyers',
    defaultDurationMinutes: 90,
    suggestedSessions: 8,
    descriptionEn:
      '8 sessions (1.5h each) exploring 8 world cultures, global festivals, folklore, international etiquette, crafts, and World Passport Expo (2,600,000 VND).',
    descriptionVi:
      '8 buổi × 1,5 giờ du hành qua 8 nền văn hoá thế giới, lễ hội, truyện dân gian, nghi thức giao tiếp và dự án Hộ Chiếu Văn Hoá (2.600.000 VNĐ).',
  },
  {
    id: 'talent_mc_skills',
    source: 'big_skills',
    titleEn: 'Junior MC & Stage Skills (MC-01)',
    titleVi: 'Kỹ Năng MC Nhí Song Ngữ & Thuyết Trình (MC-01)',
    cefrLevel: 'A2 Key',
    defaultDurationMinutes: 90,
    suggestedSessions: 10,
    descriptionEn:
      '10 sessions (1.5h each) training microphone mastery, voice projection, bilingual EN-VI hosting, live interviews, and a filmed Junior MC Gala (3,200,000 VND).',
    descriptionVi:
      '10 buổi × 1,5 giờ rèn luyện làm chủ micro, giọng nói, dẫn kịch bản song ngữ Anh-Việt, phỏng vấn và ghi hình Gala MC Nhí (3.200.000 VNĐ).',
  },
];

function formatYmd(year: number, monthZeroIndexed: number, day: number): string {
  return `${year}-${String(monthZeroIndexed + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function addDaysToYmd(ymd: string, days: number): string {
  const parts = ymd.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return ymd;
  const dt = new Date(parts[0], parts[1] - 1, parts[2] + days);
  return formatYmd(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

function addMinutesToTime(hhmm: string, minutesToAdd: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return '19:00';
  const total = (h * 60 + m + minutesToAdd) % (24 * 60);
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

interface QuickClassSchedulerModalProps {
  lang: LangCode;
  currentUser: UserProfile;
  initialDate: string;
  programs: ProgramCourse[];
  classes: AcademyClass[];
  teachers: TeacherProfile[];
  students: StudentProfile[];
  onClose: () => void;
  onScheduled: (summary: {
    firstDate: string;
    count: number;
    courseTitle: string;
    teacherName: string;
    studentCount: number;
  }) => void;
}

export const QuickClassSchedulerModal: React.FC<QuickClassSchedulerModalProps> = ({
  lang,
  currentUser,
  initialDate,
  programs,
  classes,
  teachers,
  students,
  onClose,
  onScheduled,
}) => {
  const [pceLevels, setPceLevels] = useState<PceLevelCourse[]>([]);

  useEffect(() => {
    let active = true;
    void import('../data/pceCurriculumData').then((mod) => {
      if (active) setPceLevels(mod.PCE_KIDS_CURRICULUM);
    });
    return () => {
      active = false;
    };
  }, []);

  const courseOptions = useMemo<CourseOption[]>(() => {
    const classOpts: CourseOption[] = classes.map((cls) => ({
      id: `cls_${cls.id}`,
      source: 'class',
      titleEn: `${cls.name} (${cls.programTitle})`,
      titleVi: `${cls.name} (${cls.programTitle})`,
      cefrLevel: cls.cefrLevel || 'A1 Movers',
      defaultDurationMinutes: 90,
      suggestedSessions: 4,
      descriptionEn: `Scheduled class session for cohort ${cls.name} · ${cls.programTitle}.`,
      descriptionVi: `Buổi học theo lịch cho lớp ${cls.name} · ${cls.programTitle}.`,
      classId: cls.id,
      className: cls.name,
      defaultTeacherEmail: cls.teacherEmail,
      defaultStudentIds: cls.studentIds || [],
      defaultRoom: cls.room,
    }));

    const programOpts: CourseOption[] = programs.map((prog) => ({
      id: prog.id,
      source: 'program',
      titleEn: prog.titleEn,
      titleVi: prog.titleVi || prog.titleEn,
      cefrLevel: prog.cefrTarget || 'A1 Movers',
      defaultDurationMinutes: 90,
      suggestedSessions: Math.min(12, Math.max(4, prog.weeksCount || 4)),
      descriptionEn: prog.descriptionEn || `${prog.titleEn} class session.`,
      descriptionVi: prog.descriptionVi || prog.descriptionEn || `Buổi học ${prog.titleVi}.`,
    }));

    const pceOpts: CourseOption[] = pceLevels.map((lvl) => ({
      id: `pce_lvl_${lvl.levelNumber}`,
      source: 'pce',
      titleEn: `PCE-Kids L${lvl.levelNumber}: ${lvl.titleEn}`,
      titleVi: `PCE-Kids Cấp ${lvl.levelNumber}: ${lvl.titleVi}`,
      cefrLevel: lvl.mappedCefrLevel,
      defaultDurationMinutes: Math.round((lvl.hoursPerSession || 1.5) * 60),
      suggestedSessions: 4,
      descriptionEn: `${lvl.divisionNameEn} · ${lvl.cefrBand} · ${lvl.cambridgeMilestoneEn}`,
      descriptionVi: `${lvl.divisionNameVi} · ${lvl.cefrBand} · ${lvl.cambridgeMilestoneVi}`,
    }));

    return [...BIG_SKILLS_COURSES, ...programOpts, ...classOpts, ...pceOpts];
  }, [programs, classes, pceLevels]);

  const [courseFilterTab, setCourseFilterTab] = useState<'all' | 'big_skills' | 'pce' | 'class'>('all');
  const [selectedCourseId, setSelectedCourseId] = useState<string>(courseOptions[0]?.id || '');
  const selectedCourse = useMemo(
    () => courseOptions.find((c) => c.id === selectedCourseId) || courseOptions[0] || null,
    [courseOptions, selectedCourseId]
  );

  // Selected Dates (Multi-Date Picker)
  const [selectedDates, setSelectedDates] = useState<string[]>([initialDate]);
  const initParts = initialDate.split('-').map(Number);
  const [pickerYear, setPickerYear] = useState<number>(
    initParts.length === 3 && !Number.isNaN(initParts[0]) ? initParts[0] : new Date().getFullYear()
  );
  const [pickerMonth, setPickerMonth] = useState<number>(
    initParts.length === 3 && !Number.isNaN(initParts[1]) ? initParts[1] - 1 : new Date().getMonth()
  );

  // Time, Room, CEFR, Title
  const [startTime, setStartTime] = useState('17:30');
  const [endTime, setEndTime] = useState(() =>
    addMinutesToTime('17:30', courseOptions[0]?.defaultDurationMinutes || 90)
  );
  const [room, setRoom] = useState(courseOptions[0]?.defaultRoom || 'LiLab Room A1');
  const [cefrLevel, setCefrLevel] = useState(courseOptions[0]?.cefrLevel || 'A1 Movers');
  const [customTitleEn, setCustomTitleEn] = useState(courseOptions[0]?.titleEn || '');
  const [customTitleVi, setCustomTitleVi] = useState(courseOptions[0]?.titleVi || '');
  const [notesEn, setNotesEn] = useState(courseOptions[0]?.descriptionEn || '');
  const [notesVi, setNotesVi] = useState(courseOptions[0]?.descriptionVi || '');

  // Teacher selection
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(teachers[0]?.id || '');
  const [customTeacherName, setCustomTeacherName] = useState('');
  const [customTeacherEmail, setCustomTeacherEmail] = useState('');

  // Student multi-selection
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(() =>
    courseOptions[0]?.defaultStudentIds?.length ? courseOptions[0].defaultStudentIds : []
  );
  const [studentSearch, setStudentSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const visibleCourses = useMemo(() => {
    if (courseFilterTab === 'all') return courseOptions;
    if (courseFilterTab === 'class') {
      return courseOptions.filter((c) => c.source === 'class' || c.source === 'program');
    }
    return courseOptions.filter((c) => c.source === courseFilterTab);
  }, [courseOptions, courseFilterTab]);

  const handleChooseCourse = (course: CourseOption) => {
    setSelectedCourseId(course.id);
    setCustomTitleEn(course.titleEn);
    setCustomTitleVi(course.titleVi);
    setCefrLevel(course.cefrLevel);
    setEndTime(addMinutesToTime(startTime, course.defaultDurationMinutes));
    setNotesEn(course.descriptionEn);
    setNotesVi(course.descriptionVi);
    if (course.defaultRoom) setRoom(course.defaultRoom);
    if (course.defaultTeacherEmail) {
      const matchedT = teachers.find(
        (t) => t.teacherEmail.toLowerCase() === course.defaultTeacherEmail?.toLowerCase()
      );
      if (matchedT) setSelectedTeacherId(matchedT.id);
    }
    if (course.defaultStudentIds && course.defaultStudentIds.length > 0) {
      setSelectedStudentIds(course.defaultStudentIds);
    }
  };

  // Mini Calendar Grid cells (Monday-first)
  const miniCells = useMemo(() => {
    const first = new Date(pickerYear, pickerMonth, 1);
    const daysInMonth = new Date(pickerYear, pickerMonth + 1, 0).getDate();
    const startOffset = (first.getDay() + 6) % 7;
    const prevMonthDays = new Date(pickerYear, pickerMonth, 0).getDate();

    const list: Array<{ dateStr: string; day: number; inMonth: boolean }> = [];
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const dt = new Date(pickerYear, pickerMonth - 1, d);
      list.push({ dateStr: formatYmd(dt.getFullYear(), dt.getMonth(), dt.getDate()), day: d, inMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      list.push({ dateStr: formatYmd(pickerYear, pickerMonth, d), day: d, inMonth: true });
    }
    const target = list.length > 35 ? 42 : 35;
    const rem = target - list.length;
    for (let d = 1; d <= rem; d++) {
      const dt = new Date(pickerYear, pickerMonth + 1, d);
      list.push({ dateStr: formatYmd(dt.getFullYear(), dt.getMonth(), dt.getDate()), day: d, inMonth: false });
    }
    return list;
  }, [pickerYear, pickerMonth]);

  const toggleDate = (dateStr: string) => {
    setSelectedDates((prev) => {
      if (prev.includes(dateStr)) {
        return prev.filter((d) => d !== dateStr);
      }
      return [...prev, dateStr].sort();
    });
  };

  const applyWeeklyRepeat = (weeksCount: number) => {
    const anchor = selectedDates[0] || initialDate;
    const next = new Set(selectedDates);
    for (let i = 0; i < weeksCount; i++) {
      next.add(addDaysToYmd(anchor, i * 7));
    }
    setSelectedDates(Array.from(next).sort());
  };

  const toggleStudent = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.fullName.toLowerCase().includes(q) ||
        s.cefrLevel.toLowerCase().includes(q) ||
        (s.parentName || '').toLowerCase().includes(q) ||
        (s.studentEmail || '').toLowerCase().includes(q)
    );
  }, [students, studentSearch]);

  const activeTeacher = useMemo(
    () => teachers.find((t) => t.id === selectedTeacherId) || null,
    [teachers, selectedTeacherId]
  );

  const selectedStudents = useMemo(
    () => students.filter((s) => selectedStudentIds.includes(s.id)),
    [students, selectedStudentIds]
  );

  const handleMatchCefrStudents = () => {
    const target = (cefrLevel || '').toLowerCase();
    const matched = students
      .filter((s) => target.includes(s.cefrLevel.toLowerCase()) || s.cefrLevel.toLowerCase().includes(target))
      .map((s) => s.id);
    if (matched.length > 0) {
      setSelectedStudentIds(matched);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!customTitleEn.trim()) {
      setErrorMsg(biText(lang, 'Please select or enter a course title.', 'Vui lòng chọn hoặc nhập tên khoá học.'));
      return;
    }
    if (selectedDates.length === 0) {
      setErrorMsg(biText(lang, 'Please pick at least one date on the calendar.', 'Vui lòng chọn ít nhất một ngày trên lịch.'));
      return;
    }

    const teacherEmail = (activeTeacher?.teacherEmail || customTeacherEmail).trim().toLowerCase();
    const teacherName = (activeTeacher?.fullName || customTeacherName).trim();

    if (!teacherEmail && teachers.length > 0) {
      setErrorMsg(biText(lang, 'Please select a teacher for this class.', 'Vui lòng chọn giáo viên phụ trách lớp học.'));
      return;
    }

    setIsSaving(true);
    try {
      const sortedDates = [...selectedDates].sort();
      const seriesId = `series_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const studentIds = selectedStudents.map((s) => s.id).slice(0, 30);
      const studentNames = selectedStudents.map((s) => s.fullName.slice(0, 120)).slice(0, 30);
      const studentEmails = Array.from(
        new Set(
          selectedStudents
            .map((s) => (s.studentEmail || '').trim().toLowerCase())
            .filter(Boolean)
        )
      ).slice(0, 30);
      const parentEmails = Array.from(
        new Set(
          selectedStudents
            .map((s) => (s.parentEmail || '').trim().toLowerCase())
            .filter(Boolean)
        )
      ).slice(0, 30);

      // Write 1 targeted calendar event per selected date
      await Promise.all(
        sortedDates.map(async (dateStr, idx) => {
          const sessionSuffixEn = sortedDates.length > 1 ? ` · Session ${idx + 1}/${sortedDates.length}` : '';
          const sessionSuffixVi = sortedDates.length > 1 ? ` · Buổi ${idx + 1}/${sortedDates.length}` : '';
          const eventId = `cls_evt_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`;

          const descPartsEn = [
            notesEn.trim() || `${customTitleEn.trim()} class session.`,
            teacherName ? `Teacher: ${teacherName}` : '',
            studentNames.length > 0 ? `Students (${studentNames.length}): ${studentNames.join(', ')}` : '',
          ].filter(Boolean);

          const descPartsVi = [
            notesVi.trim() || notesEn.trim() || `Buổi học ${customTitleVi.trim() || customTitleEn.trim()}.`,
            teacherName ? `Giáo viên: ${teacherName}` : '',
            studentNames.length > 0 ? `Học viên (${studentNames.length}): ${studentNames.join(', ')}` : '',
          ].filter(Boolean);

          await setDoc(doc(db, 'academy_events', eventId), {
            titleEn: `${customTitleEn.trim()}${sessionSuffixEn}`.slice(0, 160),
            titleVi: `${(customTitleVi.trim() || customTitleEn.trim())}${sessionSuffixVi}`.slice(0, 160),
            eventDate: dateStr.slice(0, 20),
            startTime: (startTime || '17:30').slice(0, 20),
            endTime: (endTime || '19:00').slice(0, 20),
            eventType: 'class_session',
            status: 'scheduled',
            location: (room.trim() || 'LiLab Room A1').slice(0, 120),
            ...(selectedCourse?.classId
              ? {
                  classId: selectedCourse.classId.slice(0, 128),
                  className: (selectedCourse.className || customTitleEn.trim()).slice(0, 120),
                }
              : {
                  className: customTitleEn.trim().slice(0, 120),
                }),
            ...(selectedCourse ? { programId: selectedCourse.id.slice(0, 128), programTitle: selectedCourse.titleEn.slice(0, 160) } : {}),
            cefrLevel: (cefrLevel || 'A1 Movers').slice(0, 60),
            ...(teacherEmail ? { teacherEmail: teacherEmail.slice(0, 160) } : {}),
            ...(teacherName ? { teacherName: teacherName.slice(0, 120) } : {}),
            ...(studentIds.length > 0 ? { studentIds } : {}),
            ...(studentNames.length > 0 ? { studentNames } : {}),
            ...(studentEmails.length > 0 ? { studentEmails } : {}),
            ...(parentEmails.length > 0 ? { parentEmails } : {}),
            seriesId,
            descriptionEn: descPartsEn.join(' · ').slice(0, 1000),
            descriptionVi: descPartsVi.join(' · ').slice(0, 1000),
            createdByUid: currentUser.uid,
            createdByEmail: currentUser.email.slice(0, 160),
            createdByName: (currentUser.displayName || currentUser.email).slice(0, 120),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        })
      );

      // Sync teacher assignment onto selected students so teacher sees them in Teacher Portal roster too
      if (teacherEmail && selectedStudents.length > 0) {
        await Promise.all(
          selectedStudents.map(async (stu) => {
            const existingTeachers = (stu.assignedTeacherEmails || []).map((e) => e.toLowerCase());
            if (!existingTeachers.includes(teacherEmail) && existingTeachers.length < 12) {
              try {
                await updateDoc(doc(db, 'students', stu.id), {
                  assignedTeacherEmails: arrayUnion(teacherEmail),
                  updatedAt: serverTimestamp(),
                });
              } catch {
                // Best-effort sync; calendar event already saved
              }
            }
          })
        );
      }

      onScheduled({
        firstDate: sortedDates[0],
        count: sortedDates.length,
        courseTitle: lang === 'vi' ? customTitleVi.trim() || customTitleEn.trim() : customTitleEn.trim(),
        teacherName: teacherName || biText(lang, 'Assigned Faculty', 'Giáo viên'),
        studentCount: studentIds.length,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to save schedule.';
      setErrorMsg(
        biText(
          lang,
          `Could not schedule class: ${msg}`,
          `Không thể tạo lịch học: ${msg}`
        )
      );
    } finally {
      setIsSaving(false);
    }
  };

  const monthHeading = useMemo(() => {
    const dt = new Date(pickerYear, pickerMonth, 1);
    return lang === 'vi'
      ? `Tháng ${pickerMonth + 1}, ${pickerYear}`
      : dt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [pickerYear, pickerMonth, lang]);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-5xl w-full shadow-2xl border border-[#2D3E99]/15 overflow-hidden my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#172154] via-[#213075] to-[#2D3E99] text-white px-6 py-4 flex items-center justify-between gap-4 shrink-0">
          <div>
            <div className="text-[11px] font-semibold text-[#FFD41D]">
              {biText(
                lang,
                'Quick Class Scheduler · Syncs to Teacher & Student Calendars',
                'Xếp Lịch Lớp Nhanh · Tự Động Đồng Bộ Lịch Giáo Viên & Học Viên'
              )}
            </div>
            <h3 className="font-display text-lg sm:text-xl font-bold text-white mt-0.5">
              {biText(
                lang,
                'Pop a Course into the Calendar',
                'Đưa Khoá Học Vào Lịch Giảng Dạy'
              )}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-5 sm:p-6 space-y-6">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEFT 7 COLS: 1. Course Selection + 2. Multi-Date Picker & Time */}
            <div className="lg:col-span-7 space-y-5">
              {/* STEP 1: PICK COURSE */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-[#2D3E99] flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-[#E61E64]" />
                    <span>{biText(lang, '1. Choose Course or Program', '1. Chọn Khoá Học / Chương Trình')}</span>
                  </h4>
                  <div className="flex items-center gap-1 p-0.5 bg-[#FDF9EE] border border-[#2D3E99]/15 rounded-lg">
                    {(
                      [
                        { id: 'all', label: biText(lang, 'All', 'Tất cả') },
                        { id: 'big_skills', label: 'Big Skills' },
                        { id: 'pce', label: 'PCE-Kids' },
                        { id: 'class', label: biText(lang, 'Classes', 'Lớp sẵn có') },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setCourseFilterTab(tab.id)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer transition-colors ${
                          courseFilterTab === tab.id
                            ? 'bg-[#2D3E99] text-white'
                            : 'text-[#172154]/70 hover:text-[#172154]'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
                  {visibleCourses.map((course) => {
                    const isPicked = course.id === selectedCourseId;
                    return (
                      <button
                        key={course.id}
                        type="button"
                        onClick={() => handleChooseCourse(course)}
                        className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                          isPicked
                            ? 'bg-[#EEF2FF] border-[#2D3E99] ring-1 ring-[#2D3E99]'
                            : 'bg-white border-[#2D3E99]/15 hover:bg-[#FDF9EE]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="text-xs font-bold text-[#172154] leading-snug line-clamp-2">
                            {lang === 'vi' ? course.titleVi : course.titleEn}
                          </div>
                          {isPicked && <Check className="w-4 h-4 text-[#2D3E99] shrink-0 mt-0.5" />}
                        </div>
                        <div className="text-[11px] text-[#172154]/65 mt-1 font-mono-num tabular-nums">
                          {course.cefrLevel} · {course.defaultDurationMinutes}m
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Editable Session Title & CEFR */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-[#172154]/70 mb-1">
                      {biText(lang, 'Class Title on Calendar *', 'Tên Lớp Hiển Thị Trên Lịch *')}
                    </label>
                    <input
                      type="text"
                      required
                      value={customTitleEn}
                      onChange={(e) => {
                        setCustomTitleEn(e.target.value);
                        if (!customTitleVi || customTitleVi === customTitleEn) {
                          setCustomTitleVi(e.target.value);
                        }
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-[#2D3E99]/20 text-xs font-semibold text-[#172154]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#172154]/70 mb-1">
                      {biText(lang, 'CEFR Level', 'Trình Độ CEFR')}
                    </label>
                    <select
                      value={cefrLevel}
                      onChange={(e) => setCefrLevel(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-xl border border-[#2D3E99]/20 text-xs font-semibold text-[#172154] bg-white"
                    >
                      {CEFR_LEVELS.map((lvl) => (
                        <option key={lvl} value={lvl}>
                          {lvl}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* STEP 2: PICK ONE OR MULTIPLE DATES + TIME */}
              <div className="space-y-3 pt-4 border-t border-[#2D3E99]/10">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-[#2D3E99] flex items-center gap-1.5">
                    <CalendarIcon className="w-4 h-4 text-[#E61E64]" />
                    <span>
                      {biText(
                        lang,
                        `2. Pick Date(s) on Calendar (${selectedDates.length} selected)`,
                        `2. Chọn Ngày Học Trên Lịch (đã chọn ${selectedDates.length} buổi)`
                      )}
                    </span>
                  </h4>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => applyWeeklyRepeat(4)}
                      className="px-2.5 py-1 rounded-lg bg-[#FDF9EE] hover:bg-[#FFD41D]/40 border border-[#2D3E99]/18 text-[11px] font-bold text-[#2D3E99] flex items-center gap-1 cursor-pointer"
                    >
                      <Repeat className="w-3 h-3" />
                      <span>+4 {biText(lang, 'Weeks', 'Tuần')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => applyWeeklyRepeat(8)}
                      className="px-2.5 py-1 rounded-lg bg-[#FDF9EE] hover:bg-[#FFD41D]/40 border border-[#2D3E99]/18 text-[11px] font-bold text-[#2D3E99] flex items-center gap-1 cursor-pointer"
                    >
                      <Repeat className="w-3 h-3" />
                      <span>+8 {biText(lang, 'Weeks', 'Tuần')}</span>
                    </button>
                    {selectedDates.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setSelectedDates([selectedDates[0]])}
                        className="px-2 py-1 rounded-lg text-[11px] font-semibold text-rose-700 hover:bg-rose-50 cursor-pointer"
                      >
                        {biText(lang, 'Reset', 'Đặt lại')}
                      </button>
                    )}
                  </div>
                </div>

                {/* Mini Click-to-Toggle Calendar + Time/Room Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-start">
                  <div className="sm:col-span-7 bg-[#FDF9EE]/70 rounded-2xl border border-[#2D3E99]/12 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (pickerMonth === 0) {
                            setPickerYear((y) => y - 1);
                            setPickerMonth(11);
                          } else {
                            setPickerMonth((m) => m - 1);
                          }
                        }}
                        className="p-1 rounded-lg hover:bg-white text-[#2D3E99] cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-bold text-[#172154]">{monthHeading}</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (pickerMonth === 11) {
                            setPickerYear((y) => y + 1);
                            setPickerMonth(0);
                          } else {
                            setPickerMonth((m) => m + 1);
                          }
                        }}
                        className="p-1 rounded-lg hover:bg-white text-[#2D3E99] cursor-pointer"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-[#172154]/55 mb-1">
                      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                        <div key={i}>{d}</div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                      {miniCells.map((cell) => {
                        const isPicked = selectedDates.includes(cell.dateStr);
                        return (
                          <button
                            key={cell.dateStr}
                            type="button"
                            onClick={() => toggleDate(cell.dateStr)}
                            className={`h-8 rounded-lg text-xs font-mono-num tabular-nums font-bold transition-colors cursor-pointer ${
                              isPicked
                                ? 'bg-[#2D3E99] text-white shadow-xs'
                                : cell.inMonth
                                  ? 'bg-white text-[#172154] hover:bg-indigo-100 border border-[#2D3E99]/10'
                                  : 'text-[#172154]/35 hover:bg-white/70'
                            }`}
                          >
                            {cell.day}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Time & Room Column */}
                  <div className="sm:col-span-5 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-[#172154]/70 mb-1">
                          <Clock className="w-3 h-3 inline mr-1 text-[#2D3E99]" />
                          {biText(lang, 'Start', 'Bắt đầu')}
                        </label>
                        <input
                          type="time"
                          value={startTime}
                          onChange={(e) => {
                            setStartTime(e.target.value);
                            setEndTime(
                              addMinutesToTime(
                                e.target.value,
                                selectedCourse?.defaultDurationMinutes || 90
                              )
                            );
                          }}
                          className="w-full px-2.5 py-2 rounded-xl border border-[#2D3E99]/20 text-xs font-mono-num tabular-nums font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#172154]/70 mb-1">
                          {biText(lang, 'End', 'Kết thúc')}
                        </label>
                        <input
                          type="time"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="w-full px-2.5 py-2 rounded-xl border border-[#2D3E99]/20 text-xs font-mono-num tabular-nums font-bold"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#172154]/70 mb-1">
                        <MapPin className="w-3 h-3 inline mr-1 text-[#E61E64]" />
                        {biText(lang, 'Room / Campus', 'Phòng Học')}
                      </label>
                      <input
                        type="text"
                        value={room}
                        onChange={(e) => setRoom(e.target.value)}
                        placeholder="LiLab Room A1"
                        className="w-full px-3 py-2 rounded-xl border border-[#2D3E99]/20 text-xs font-semibold text-[#172154]"
                      />
                    </div>

                    {/* Selected Dates Readout */}
                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold text-[#172154]/65">
                        {biText(lang, 'Scheduled Dates:', 'Các Ngày Đã Chọn:')}
                      </div>
                      <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                        {selectedDates.map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => toggleDate(d)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#EEF2FF] text-[#2D3E99] text-[11px] font-mono-num tabular-nums font-bold hover:bg-rose-100 hover:text-rose-800 cursor-pointer"
                            title={biText(lang, 'Click to remove date', 'Nhấp để bỏ ngày')}
                          >
                            <span>{d}</span>
                            <X className="w-3 h-3" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT 5 COLS: 3. Choose Teacher + 4. Choose Students */}
            <div className="lg:col-span-5 space-y-5 lg:border-l lg:border-[#2D3E99]/10 lg:pl-5">
              {/* STEP 3: CHOOSE TEACHER */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold text-[#2D3E99] flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-[#E61E64]" />
                  <span>{biText(lang, '3. Assign Teacher', '3. Chọn Giáo Viên Phụ Trách')}</span>
                </h4>

                {teachers.length > 0 ? (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {teachers.map((t) => {
                      const isSelected = t.id === selectedTeacherId;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSelectedTeacherId(t.id)}
                          className={`w-full p-2 rounded-xl border text-left transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                            isSelected
                              ? 'bg-[#EEF2FF] border-[#2D3E99]'
                              : 'bg-white border-[#2D3E99]/12 hover:bg-[#FDF9EE]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <ProfileAvatar
                              src={t.photoUrl}
                              fallbackSrc="/assets/lila_girl.png"
                              name={t.fullName}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-[#172154] truncate">
                                {t.fullName}
                              </div>
                              <div className="text-[11px] text-[#172154]/65 truncate">
                                {t.teacherEmail} · {t.cefrCertification}
                              </div>
                            </div>
                          </div>
                          {isSelected && <UserCheck className="w-4 h-4 text-[#2D3E99] shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    <input
                      type="text"
                      value={customTeacherName}
                      onChange={(e) => setCustomTeacherName(e.target.value)}
                      placeholder={biText(lang, 'Teacher Full Name', 'Họ tên Giáo viên')}
                      className="w-full px-3 py-2 rounded-xl border border-[#2D3E99]/20 text-xs"
                    />
                    <input
                      type="email"
                      value={customTeacherEmail}
                      onChange={(e) => setCustomTeacherEmail(e.target.value)}
                      placeholder={biText(lang, 'Teacher Email (for calendar sync)', 'Email Giáo viên (để đồng bộ lịch)')}
                      className="w-full px-3 py-2 rounded-xl border border-[#2D3E99]/20 text-xs"
                    />
                  </div>
                )}
              </div>

              {/* STEP 4: CHOOSE STUDENTS */}
              <div className="space-y-2.5 pt-4 border-t border-[#2D3E99]/10">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-[#2D3E99] flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-[#E61E64]" />
                    <span>
                      {biText(
                        lang,
                        `4. Assign Students (${selectedStudentIds.length} / ${students.length})`,
                        `4. Chọn Học Viên (${selectedStudentIds.length} / ${students.length})`
                      )}
                    </span>
                  </h4>

                  <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={handleMatchCefrStudents}
                      className="text-[#2D3E99] hover:underline cursor-pointer"
                    >
                      {biText(lang, 'Match CEFR', 'Cùng CEFR')}
                    </button>
                    <span className="text-[#172154]/30">·</span>
                    <button
                      type="button"
                      onClick={() => setSelectedStudentIds(students.map((s) => s.id))}
                      className="text-[#2D3E99] hover:underline cursor-pointer"
                    >
                      {biText(lang, 'All', 'Tất cả')}
                    </button>
                    <span className="text-[#172154]/30">·</span>
                    <button
                      type="button"
                      onClick={() => setSelectedStudentIds([])}
                      className="text-rose-700 hover:underline cursor-pointer"
                    >
                      {biText(lang, 'Clear', 'Bỏ chọn')}
                    </button>
                  </div>
                </div>

                {students.length > 4 && (
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#172154]/45 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      placeholder={biText(lang, 'Search student by name or CEFR...', 'Tìm tên học viên hoặc CEFR...')}
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-[#2D3E99]/18 text-xs focus:outline-none focus:border-[#2D3E99]"
                    />
                  </div>
                )}

                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {filteredStudents.length === 0 ? (
                    <div className="p-4 rounded-xl bg-[#FDF9EE] text-xs text-[#172154]/70 text-center">
                      {biText(lang, 'No student profiles found.', 'Chưa tìm thấy hồ sơ học viên.')}
                    </div>
                  ) : (
                    filteredStudents.map((stu) => {
                      const checked = selectedStudentIds.includes(stu.id);
                      return (
                        <button
                          key={stu.id}
                          type="button"
                          onClick={() => toggleStudent(stu.id)}
                          className={`w-full p-2 rounded-xl border text-left transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                            checked
                              ? 'bg-[#EEF2FF] border-[#2D3E99]'
                              : 'bg-white border-[#2D3E99]/10 hover:bg-[#FDF9EE]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                                checked
                                  ? 'bg-[#2D3E99] border-[#2D3E99] text-white'
                                  : 'border-[#2D3E99]/30 bg-white'
                              }`}
                            >
                              {checked && <Check className="w-3 h-3" />}
                            </div>
                            <ProfileAvatar
                              src={stu.photoUrl}
                              fallbackSrc={
                                stu.gender === 'boy' ? '/assets/lila_boy.png' : '/assets/lila_girl.png'
                              }
                              name={stu.fullName}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-[#172154] truncate">
                                {stu.fullName}
                              </div>
                              <div className="text-[11px] text-[#172154]/65 truncate">
                                {formatCefrLabel(stu.cefrLevel, stu.cefrModifier)} · {stu.parentName}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#2D3E99]/12">
            <div className="text-xs text-[#172154]/75">
              {biText(
                lang,
                `Will publish ${selectedDates.length} class session(s) directly to ${
                  activeTeacher?.fullName || customTeacherName || 'assigned teacher'
                }'s calendar and ${selectedStudentIds.length} student/parent calendar(s).`,
                `Sẽ đồng bộ ${selectedDates.length} buổi học trực tiếp lên lịch của giáo viên ${
                  activeTeacher?.fullName || customTeacherName || 'phụ trách'
                } và ${selectedStudentIds.length} học viên / phụ huynh.`
              )}
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-[#172154] text-xs font-bold cursor-pointer"
              >
                {biText(lang, 'Cancel', 'Huỷ')}
              </button>
              <button
                type="submit"
                disabled={isSaving || selectedDates.length === 0}
                className="px-5 py-2.5 rounded-xl bg-[#2D3E99] hover:bg-[#1f2d78] text-white text-xs sm:text-sm font-bold shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>
                  {isSaving
                    ? biText(lang, 'Scheduling...', 'Đang xếp lịch...')
                    : biText(
                        lang,
                        `Add ${selectedDates.length} Session${selectedDates.length === 1 ? '' : 's'} to Calendars`,
                        `Lưu ${selectedDates.length} Buổi Học Lên Lịch`
                      )}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
