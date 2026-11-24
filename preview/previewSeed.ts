// Sample academy for the preview build. All people, numbers and records are invented.
import { __previewSeed as put } from './mockFirestore';
import { PREVIEW_ACCOUNTS } from './previewAccounts';
import { seedAcademyBaseline, seedLilabMasterSchedule } from '../src/services/seedData';

const A = PREVIEW_ACCOUNTS;
const adminUids = [A.admin.uid];
const now = new Date();
const iso = (offsetDays: number) => {
  const d = new Date(now);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

export async function seedPreviewAcademy(): Promise<void> {
  for (const acc of Object.values(A)) {
    put('users', acc.uid, {
      uid: acc.uid,
      email: acc.email,
      displayName: acc.displayName,
      role: acc.role,
      preferredLang: 'vi',
      status: 'active',
    });
  }
  put('admins', A.admin.uid, { uid: A.admin.uid, email: A.admin.email, level: 'admin' });

  put('teachers', 'pv_t_hannah', {
    teacherUid: A.teacher.uid,
    teacherEmail: A.teacher.email,
    fullName: 'Hannah Brooks',
    specialty: 'Young learners, phonics and storytelling',
    cefrCertification: 'CELTA, Cambridge YL examiner',
    bioEn: 'Sample teacher profile for the preview.',
    bioVi: 'Hồ sơ giáo viên mẫu cho bản xem trước.',
    hourlyRateVnd: 450000,
    monthlyBaseVnd: 0,
    payStatus: 'active',
    status: 'active',
    adminUids,
  });
  put('teachers', 'pv_t_minh', {
    teacherEmail: 'minh.preview@lilab.example',
    fullName: 'Nguyễn Minh Tú',
    specialty: 'Music, poetry and MC skills',
    cefrCertification: 'TESOL',
    hourlyRateVnd: 380000,
    monthlyBaseVnd: 0,
    payStatus: 'pending_payout',
    status: 'active',
    adminUids,
  });

  const classes = [
    { id: 'pv_c_starters', name: 'Starters Sunflowers', level: 'Pre-A1 Starters', schedule: 'Tue & Thu 17:30–19:00', room: 'Phòng 1' },
    { id: 'pv_c_movers', name: 'Movers Dolphins', level: 'A1 Movers', schedule: 'Sat 08:30–10:00', room: 'Phòng 2' },
  ];
  for (const c of classes) {
    put('classes', c.id, {
      name: c.name,
      programId: 'prog_be_whole_01',
      programTitle: 'Be Whole · 13-week values English',
      teacherUid: A.teacher.uid,
      teacherEmail: A.teacher.email,
      teacherName: 'Hannah Brooks',
      cefrLevel: c.level,
      cefrModifier: 'standard',
      room: c.room,
      scheduleText: c.schedule,
      maxStudents: 10,
      studentIds: c.id === 'pv_c_starters' ? ['pv_s_bao', 'pv_s_khanh'] : ['pv_s_an'],
      status: 'active',
      adminUids,
    });
  }

  const students = [
    { id: 'pv_s_bao', name: 'Trần Gia Bảo', age: 8, gender: 'boy', level: 'Pre-A1 Starters', mod: '+', cls: 'pv_c_starters', studentEmail: A.student.email, parent: true },
    { id: 'pv_s_an', name: 'Trần Minh An', age: 10, gender: 'girl', level: 'A1 Movers', mod: 'standard', cls: 'pv_c_movers', parent: true },
    { id: 'pv_s_khanh', name: 'Lê Bảo Khánh', age: 7, gender: 'girl', level: 'Pre-A1 Starters', mod: '-', cls: 'pv_c_starters' },
  ];
  for (const s of students) {
    put('students', s.id, {
      fullName: s.name,
      studentEmail: s.studentEmail || '',
      parentName: s.parent ? 'Nguyễn Thị Lan' : 'Lê Văn Hùng',
      parentEmail: s.parent ? A.parent.email : 'hung.preview@lilab.example',
      parentUid: s.parent ? A.parent.uid : '',
      studentUid: s.studentEmail ? A.student.uid : '',
      age: s.age,
      gender: s.gender,
      cefrLevel: s.level,
      cefrModifier: s.mod,
      enrolledClassIds: [s.cls],
      assignedTeacherEmails: [A.teacher.email],
      status: 'active',
      adminUids,
    });
  }

  const terms = ['Term 1 · 2026', 'Term 2 · 2026'];
  students.forEach((s, si) => {
    terms.forEach((term, ti) => {
      const base = 58 + si * 6 + ti * 9;
      put('assessments', `pv_a_${s.id}_${ti}`, {
        studentId: s.id,
        studentName: s.name,
        classId: s.cls,
        className: classes.find((c) => c.id === s.cls)?.name,
        teacherUid: A.teacher.uid,
        teacherEmail: A.teacher.email,
        teacherName: 'Hannah Brooks',
        parentEmail: s.parent ? A.parent.email : 'hung.preview@lilab.example',
        studentEmail: s.studentEmail || '',
        termLabel: term,
        cefrLevel: s.level,
        cefrModifier: s.mod,
        speakingScore: Math.min(98, base + 8),
        readingScore: Math.min(98, base + 3),
        writingScore: Math.min(98, base - 2),
        vocabularyScore: Math.min(98, base + 5),
        comprehensionScore: Math.min(98, base + 1),
        socialScore: Math.min(98, base + 10),
        emotionalScore: Math.min(98, base + 7),
        mentalScore: Math.min(98, base + 4),
        teacherCommentEn: ti === 0 ? 'Settling in well and joining class games with confidence.' : 'Speaks in full sentences now and helps classmates during pair work.',
        teacherCommentVi: ti === 0 ? 'Bé hoà nhập tốt và tự tin tham gia trò chơi trên lớp.' : 'Bé đã nói được câu hoàn chỉnh và hay giúp bạn khi làm việc nhóm.',
        activitiesCompleted: ['Story time', 'Phonics song', 'Sentence House'],
        adminUids,
      });
    });
  });

  put('invoices', 'pv_inv_1', {
    invoiceNumber: 'LL-2026-0412',
    studentId: 'pv_s_bao',
    studentName: 'Trần Gia Bảo',
    parentEmail: A.parent.email,
    parentUid: A.parent.uid,
    programId: 'prog_be_whole_01',
    programTitle: 'Be Whole · Term 2',
    amountVnd: 5400000,
    dueDate: iso(-20),
    status: 'paid',
    paymentMethod: 'qr_transfer',
    paidAt: iso(-24),
    adminUids,
  });
  put('invoices', 'pv_inv_2', {
    invoiceNumber: 'LL-2026-0588',
    studentId: 'pv_s_an',
    studentName: 'Trần Minh An',
    parentEmail: A.parent.email,
    parentUid: A.parent.uid,
    programId: 'prog_be_whole_01',
    programTitle: 'Movers · Term 3',
    amountVnd: 2000000,
    dueDate: iso(9),
    status: 'pending',
    paymentMethod: 'unselected',
    adminUids,
  });

  put('academy_banking', 'pv_bank', {
    bankName: 'Sample Bank (preview)',
    bankCode: 'VCB',
    accountNumber: '0000000000',
    accountHolder: 'LILAB ACADEMY (SAMPLE)',
    paymentInstructionsEn: 'Preview only. No real account.',
    paymentInstructionsVi: 'Chỉ dùng cho bản xem trước. Không phải tài khoản thật.',
    useDynamicVietQr: false,
    isActive: true,
  });

  put('academy_events', 'pv_ev_1', {
    titleEn: 'Parents’ open class',
    titleVi: 'Buổi học mở cho phụ huynh',
    eventDate: iso(5),
    startTime: '17:30',
    endTime: '18:30',
    eventType: 'parent_workshop',
    status: 'scheduled',
    location: 'Phòng 1',
    classId: 'pv_c_starters',
    className: 'Starters Sunflowers',
  });

  const days = ['Tuesday', 'Thursday', 'Saturday'] as const;
  days.forEach((day, i) => {
    put('schedules', `pv_sch_${i}`, {
      classId: i < 2 ? 'pv_c_starters' : 'pv_c_movers',
      className: i < 2 ? 'Starters Sunflowers' : 'Movers Dolphins',
      teacherUid: A.teacher.uid,
      teacherEmail: A.teacher.email,
      teacherName: 'Hannah Brooks',
      dayOfWeek: day,
      startTime: i < 2 ? '17:30' : '08:30',
      endTime: i < 2 ? '19:00' : '10:00',
      room: i < 2 ? 'Phòng 1' : 'Phòng 2',
      weekNumber: 3,
      topicEn: 'Week 3 · Sharing',
      topicVi: 'Tuần 3 · Biết chia sẻ',
      status: 'scheduled',
      adminUids,
    });
  });

  put('quick_notes', 'pv_qn_1', {
    studentId: 'pv_s_bao',
    studentName: 'Trần Gia Bảo',
    teacherUid: A.teacher.uid,
    teacherEmail: A.teacher.email,
    observationDate: iso(-2),
    noteEn: 'Read the whole Lion and the Mouse page aloud without help.',
    noteVi: 'Bé tự đọc to cả trang Sư tử và Chuột.',
  });

  // Sign-ups waiting for approval (CRM tab)
  put('users', 'pv_pending_1', {
    uid: 'pv_pending_1',
    email: 'thao.nguyen.preview@lilab.example',
    displayName: 'Nguyễn Phương Thảo',
    role: 'parent',
    preferredLang: 'vi',
    status: 'pending',
  });
  put('users', 'pv_pending_2', {
    uid: 'pv_pending_2',
    email: 'minh.khoa.preview@lilab.example',
    displayName: 'Minh Khoa',
    role: 'student',
    preferredLang: 'en',
    status: 'pending',
  });

  // CRM sample: contacts, deals across the pipeline, activity and tasks
  const crmContacts = [
    { id: 'e_parent_preview', fullName: 'Nguyễn Thị Lan', email: A.parent.email, phone: '0901 234 567', contactType: 'parent', lifecycleStage: 'customer', leadSource: 'referral', childNames: 'Trần Gia Bảo (8), Trần Minh An (10)', tags: ['siblings'] },
    { id: 'ct_huong', fullName: 'Phạm Thu Hương', email: 'huong.preview@lilab.example', phone: '0912 555 010', contactType: 'lead', lifecycleStage: 'opportunity', leadSource: 'zalo', childNames: 'Bé Na (7)', tags: ['Thu Duc'] },
    { id: 'ct_david', fullName: 'David Tran', email: 'david.preview@lilab.example', phone: '0938 777 222', contactType: 'lead', lifecycleStage: 'qualified', leadSource: 'facebook', childNames: 'Ethan (9)', tags: [] },
    { id: 'ct_mai', fullName: 'Lê Ngọc Mai', email: 'mai.preview@lilab.example', phone: '0976 333 444', contactType: 'lead', lifecycleStage: 'lead', leadSource: 'walk_in', childNames: 'Bin (6)', tags: ['Saturday'] },
  ];
  crmContacts.forEach((c, i) =>
    put('crm_contacts', c.id, { ...c, ownerEmail: A.admin.email, createdByEmail: A.admin.email, lastActivityAt: new Date(Date.now() - i * 86400000).toISOString() })
  );
  const crmDeals = [
    { id: 'deal_huong', title: 'Bé Na · Music & Poetry', contactId: 'ct_huong', contactName: 'Phạm Thu Hương', amountVnd: 2400000, stage: 'trial_booked', expectedCloseDate: iso(6) },
    { id: 'deal_david', title: 'Ethan · Movers term', contactId: 'ct_david', contactName: 'David Tran', amountVnd: 5400000, stage: 'contacted', expectedCloseDate: iso(14) },
    { id: 'deal_mai', title: 'Bin · Starters', contactId: 'ct_mai', contactName: 'Lê Ngọc Mai', amountVnd: 2000000, stage: 'new' },
    { id: 'deal_lan', title: 'Minh An · Movers term 3', contactId: 'e_parent_preview', contactName: 'Nguyễn Thị Lan', amountVnd: 2000000, stage: 'won', expectedCloseDate: iso(-3) },
  ];
  crmDeals.forEach((d) => put('crm_deals', d.id, { ...d, ownerEmail: A.admin.email, createdByEmail: A.admin.email }));
  put('crm_activities', 'act_1', { contactId: 'ct_huong', activityType: 'zalo', body: 'Mum asked about Saturday morning classes. Booked a free trial for next Saturday 9:00.', occurredAt: new Date(Date.now() - 86400000).toISOString(), authorEmail: A.admin.email });
  put('crm_activities', 'act_2', { contactId: 'ct_david', activityType: 'call', body: 'Dad wants a placement test before choosing a level.', occurredAt: new Date(Date.now() - 2 * 86400000).toISOString(), authorEmail: A.admin.email });
  put('crm_tasks', 'task_1', { title: 'Confirm trial time with Hương', contactId: 'ct_huong', contactName: 'Phạm Thu Hương', dueDate: iso(1), ownerEmail: A.admin.email, done: false, createdByEmail: A.admin.email });
  put('crm_tasks', 'task_2', { title: 'Send placement test link', contactId: 'ct_david', contactName: 'David Tran', dueDate: iso(-1), ownerEmail: A.admin.email, done: false, createdByEmail: A.admin.email });

  // The app's own baseline: programs, Week 01 curriculum note, master group schedule
  await seedAcademyBaseline(A.admin.uid, A.admin.email);
  await seedLilabMasterSchedule(A.admin.uid, A.admin.email, false);
}
