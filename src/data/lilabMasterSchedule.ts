import type { ClassSchedule } from '../types';

export interface LilabMasterClassSpec {
  classId: string;
  code: string;
  classNameVi: string;
  classNameEn: string;
  groupVi: string;
  groupEn: string;
  scheduleTypeVi: 'Cố định' | 'Đề xuất';
  scheduleTypeEn: 'Fixed' | 'Proposed';
  pairLabelVi: string;
  pairLabelEn: string;
  days: Array<{ dayOfWeek: ClassSchedule['dayOfWeek']; suffix: string }>;
  startTime: string;
  endTime: string;
  room: string;
}

/**
 * Official LiLab Master Weekly Group Schedule (13 Classes = 26 Weekly Sessions across Phòng 1, 2, 3)
 * Source: Lilab_update schedule - Group.pdf
 * Note: Phòng 4 – Coach 1:1 is reserved for individual coaching by appointment (Theo lịch hẹn).
 */
export const LILAB_MASTER_CLASSES: LilabMasterClassSpec[] = [
  {
    classId: 'cls_lilab_eng_a',
    code: 'ENG-A',
    classNameVi: 'Tiếng Anh A – Ca 1',
    classNameEn: 'English A – Shift 1',
    groupVi: 'Tiếng Anh',
    groupEn: 'English',
    scheduleTypeVi: 'Cố định',
    scheduleTypeEn: 'Fixed',
    pairLabelVi: 'Cặp T2/T6 · Ca 1',
    pairLabelEn: 'Mon/Fri Pair · Shift 1',
    days: [
      { dayOfWeek: 'Monday', suffix: 'mon' },
      { dayOfWeek: 'Friday', suffix: 'fri' },
    ],
    startTime: '18:00',
    endTime: '19:30',
    room: 'Phòng 1',
  },
  {
    classId: 'cls_lilab_eng_b',
    code: 'ENG-B',
    classNameVi: 'Tiếng Anh B – Ca 2',
    classNameEn: 'English B – Shift 2',
    groupVi: 'Tiếng Anh',
    groupEn: 'English',
    scheduleTypeVi: 'Cố định',
    scheduleTypeEn: 'Fixed',
    pairLabelVi: 'Cặp T2/T6 · Ca 2',
    pairLabelEn: 'Mon/Fri Pair · Shift 2',
    days: [
      { dayOfWeek: 'Monday', suffix: 'mon' },
      { dayOfWeek: 'Friday', suffix: 'fri' },
    ],
    startTime: '19:45',
    endTime: '21:15',
    room: 'Phòng 1',
  },
  {
    classId: 'cls_lilab_eng_c',
    code: 'ENG-C',
    classNameVi: 'Tiếng Anh C – Ca 1',
    classNameEn: 'English C – Shift 1',
    groupVi: 'Tiếng Anh',
    groupEn: 'English',
    scheduleTypeVi: 'Cố định',
    scheduleTypeEn: 'Fixed',
    pairLabelVi: 'Cặp T3/T5 · Ca 1',
    pairLabelEn: 'Tue/Thu Pair · Shift 1',
    days: [
      { dayOfWeek: 'Tuesday', suffix: 'tue' },
      { dayOfWeek: 'Thursday', suffix: 'thu' },
    ],
    startTime: '18:00',
    endTime: '19:30',
    room: 'Phòng 1',
  },
  {
    classId: 'cls_lilab_eng_d',
    code: 'ENG-D',
    classNameVi: 'Tiếng Anh D – Ca 2',
    classNameEn: 'English D – Shift 2',
    groupVi: 'Tiếng Anh',
    groupEn: 'English',
    scheduleTypeVi: 'Cố định',
    scheduleTypeEn: 'Fixed',
    pairLabelVi: 'Cặp T3/T5 · Ca 2',
    pairLabelEn: 'Tue/Thu Pair · Shift 2',
    days: [
      { dayOfWeek: 'Tuesday', suffix: 'tue' },
      { dayOfWeek: 'Thursday', suffix: 'thu' },
    ],
    startTime: '19:45',
    endTime: '21:15',
    room: 'Phòng 1',
  },
  {
    classId: 'cls_lilab_mc_adult',
    code: 'MC-ADULT',
    classNameVi: 'MC người lớn – Ca 1',
    classNameEn: 'Adult MC & Public Speaking – Shift 1',
    groupVi: 'MC',
    groupEn: 'MC',
    scheduleTypeVi: 'Cố định',
    scheduleTypeEn: 'Fixed',
    pairLabelVi: 'Cặp T2/T3 · Ca 1',
    pairLabelEn: 'Mon/Tue Pair · Shift 1',
    days: [
      { dayOfWeek: 'Monday', suffix: 'mon' },
      { dayOfWeek: 'Tuesday', suffix: 'tue' },
    ],
    startTime: '18:00',
    endTime: '19:30',
    room: 'Phòng 2',
  },
  {
    classId: 'cls_lilab_mc_kids_wk',
    code: 'MC-KIDS-WK',
    classNameVi: 'MC nhí – Ca 2',
    classNameEn: 'Kids MC – Shift 2',
    groupVi: 'MC',
    groupEn: 'MC',
    scheduleTypeVi: 'Cố định',
    scheduleTypeEn: 'Fixed',
    pairLabelVi: 'Cặp T2/T3 · Ca 2',
    pairLabelEn: 'Mon/Tue Pair · Shift 2',
    days: [
      { dayOfWeek: 'Monday', suffix: 'mon' },
      { dayOfWeek: 'Tuesday', suffix: 'tue' },
    ],
    startTime: '19:45',
    endTime: '21:15',
    room: 'Phòng 2',
  },
  {
    classId: 'cls_lilab_mc_kids_we',
    code: 'MC-KIDS-WE',
    classNameVi: 'MC nhí – Cuối tuần',
    classNameEn: 'Kids MC – Weekend',
    groupVi: 'MC',
    groupEn: 'MC',
    scheduleTypeVi: 'Cố định',
    scheduleTypeEn: 'Fixed',
    pairLabelVi: 'Cuối tuần T7/CN',
    pairLabelEn: 'Sat/Sun Weekend',
    days: [
      { dayOfWeek: 'Saturday', suffix: 'sat' },
      { dayOfWeek: 'Sunday', suffix: 'sun' },
    ],
    startTime: '14:30',
    endTime: '16:15',
    room: 'Phòng 2',
  },
  {
    classId: 'cls_lilab_drawing',
    code: 'ART-DRAW',
    classNameVi: 'Vẽ – Ca 1',
    classNameEn: 'Drawing & Visual Art – Shift 1',
    groupVi: 'Nghệ thuật',
    groupEn: 'Arts',
    scheduleTypeVi: 'Đề xuất',
    scheduleTypeEn: 'Proposed',
    pairLabelVi: 'Cặp T2/T4 · Ca 1',
    pairLabelEn: 'Mon/Wed Pair · Shift 1',
    days: [
      { dayOfWeek: 'Monday', suffix: 'mon' },
      { dayOfWeek: 'Wednesday', suffix: 'wed' },
    ],
    startTime: '18:00',
    endTime: '19:30',
    room: 'Phòng 3',
  },
  {
    classId: 'cls_lilab_etiquette',
    code: 'SKILL-ETIQ',
    classNameVi: 'Lễ nghi – Ca 1',
    classNameEn: 'Etiquette & Grace – Shift 1',
    groupVi: 'Kỹ năng',
    groupEn: 'Life Skills',
    scheduleTypeVi: 'Đề xuất',
    scheduleTypeEn: 'Proposed',
    pairLabelVi: 'Cặp T3/T5 · Ca 1',
    pairLabelEn: 'Tue/Thu Pair · Shift 1',
    days: [
      { dayOfWeek: 'Tuesday', suffix: 'tue' },
      { dayOfWeek: 'Thursday', suffix: 'thu' },
    ],
    startTime: '18:00',
    endTime: '19:30',
    room: 'Phòng 3',
  },
  {
    classId: 'cls_lilab_violin',
    code: 'ART-VIOLIN',
    classNameVi: 'Violin – Ca 2',
    classNameEn: 'Violin – Shift 2',
    groupVi: 'Nghệ thuật',
    groupEn: 'Arts',
    scheduleTypeVi: 'Đề xuất',
    scheduleTypeEn: 'Proposed',
    pairLabelVi: 'Cặp T2/T4 · Ca 2',
    pairLabelEn: 'Mon/Wed Pair · Shift 2',
    days: [
      { dayOfWeek: 'Monday', suffix: 'mon' },
      { dayOfWeek: 'Wednesday', suffix: 'wed' },
    ],
    startTime: '19:45',
    endTime: '21:15',
    room: 'Phòng 3',
  },
  {
    classId: 'cls_lilab_creative',
    code: 'SKILL-CREA',
    classNameVi: 'Tư duy sáng tạo – Ca 2',
    classNameEn: 'Creative Thinking – Shift 2',
    groupVi: 'Kỹ năng',
    groupEn: 'Life Skills',
    scheduleTypeVi: 'Đề xuất',
    scheduleTypeEn: 'Proposed',
    pairLabelVi: 'Cặp T3/T5 · Ca 2',
    pairLabelEn: 'Tue/Thu Pair · Shift 2',
    days: [
      { dayOfWeek: 'Tuesday', suffix: 'tue' },
      { dayOfWeek: 'Thursday', suffix: 'thu' },
    ],
    startTime: '19:45',
    endTime: '21:15',
    room: 'Phòng 3',
  },
  {
    classId: 'cls_lilab_writing',
    code: 'SKILL-WRIT',
    classNameVi: 'Viết & trình bày – Ca 1',
    classNameEn: 'Writing & Presentation – Shift 1',
    groupVi: 'Kỹ năng',
    groupEn: 'Life Skills',
    scheduleTypeVi: 'Đề xuất',
    scheduleTypeEn: 'Proposed',
    pairLabelVi: 'Cặp T4/T6 · Ca 1',
    pairLabelEn: 'Wed/Fri Pair · Shift 1',
    days: [
      { dayOfWeek: 'Wednesday', suffix: 'wed' },
      { dayOfWeek: 'Friday', suffix: 'fri' },
    ],
    startTime: '18:00',
    endTime: '19:30',
    room: 'Phòng 2',
  },
  {
    classId: 'cls_lilab_go',
    code: 'MIND-GO',
    classNameVi: 'Cờ vây – Ca 2',
    classNameEn: 'Go (Baduk / Cờ vây) – Shift 2',
    groupVi: 'Tư duy',
    groupEn: 'Strategy',
    scheduleTypeVi: 'Đề xuất',
    scheduleTypeEn: 'Proposed',
    pairLabelVi: 'Cặp T4/T6 · Ca 2',
    pairLabelEn: 'Wed/Fri Pair · Shift 2',
    days: [
      { dayOfWeek: 'Wednesday', suffix: 'wed' },
      { dayOfWeek: 'Friday', suffix: 'fri' },
    ],
    startTime: '19:45',
    endTime: '21:15',
    room: 'Phòng 2',
  },
];

export function buildLilabMasterSchedules(
  adminUid = 'admin',
  adminEmail = 'lilabvietnam@gmail.com'
): ClassSchedule[] {
  const safeEmail = (adminEmail || 'lilabvietnam@gmail.com').trim().toLowerCase();
  const safeUids = adminUid ? [adminUid] : ['admin'];
  const items: ClassSchedule[] = [];

  for (const spec of LILAB_MASTER_CLASSES) {
    for (const d of spec.days) {
      items.push({
        id: `sched_lilab_${spec.classId.replace(/^cls_lilab_/, '')}_${d.suffix}`,
        classId: spec.classId,
        className: spec.classNameVi,
        teacherEmail: safeEmail,
        teacherName: 'LiLab Faculty',
        dayOfWeek: d.dayOfWeek,
        startTime: spec.startTime,
        endTime: spec.endTime,
        room: spec.room,
        weekNumber: 1,
        topicEn: `${spec.classNameEn} · ${spec.pairLabelEn} · ${spec.scheduleTypeEn} (${spec.groupEn})`.slice(0, 200),
        topicVi: `${spec.pairLabelVi} · ${spec.scheduleTypeVi} · Nhóm ${spec.groupVi}`.slice(0, 200),
        status: 'scheduled',
        adminUids: safeUids,
      });
    }
  }

  return items;
}
