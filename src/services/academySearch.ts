import { collection, getDocs, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { formatVnd } from '../i18n';
import { isSuperAdminEmail } from './seedData';
import {
  formatCefrLabel,
  type AcademyClass,
  type ClassSchedule,
  type GeminiNote,
  type PayableRecord,
  type ProgramCourse,
  type StudentAssessment,
  type StudentProfile,
  type TeacherProfile,
  type TuitionInvoice,
  type UserProfile,
} from '../types';

export interface AcademySnapshot {
  students: StudentProfile[];
  teachers: TeacherProfile[];
  classes: AcademyClass[];
  schedules: ClassSchedule[];
  assessments: StudentAssessment[];
  geminiNotes: GeminiNote[];
  invoices: TuitionInvoice[];
  payables: PayableRecord[];
  programs: ProgramCourse[];
}

export interface SearchHit {
  category: string;
  title: string;
  detail: string;
}

// V2 cost control: reuse the assistant's snapshot for 5 minutes instead of re-reading
// every collection each time the drawer opens (each Firestore document read is billed).
const SNAPSHOT_TTL_MS = 5 * 60 * 1000;
const snapshotCache = new Map<string, { at: number; snap: Promise<AcademySnapshot> }>();

export function fetchAuthorizedAcademySnapshot(user: UserProfile): Promise<AcademySnapshot> {
  const cacheKey = `${user.uid}:${user.role}`;
  const hit = snapshotCache.get(cacheKey);
  if (hit && Date.now() - hit.at < SNAPSHOT_TTL_MS) return hit.snap;
  const snap = loadAuthorizedAcademySnapshot(user).catch((err) => {
    snapshotCache.delete(cacheKey);
    throw err;
  });
  snapshotCache.set(cacheKey, { at: Date.now(), snap });
  return snap;
}

async function loadAuthorizedAcademySnapshot(user: UserProfile): Promise<AcademySnapshot> {
  const email = user.email.toLowerCase();
  const isSuperAdmin = isSuperAdminEmail(email);
  const isAdmin = isSuperAdmin || user.role === 'admin';
  const isTeacher = user.role === 'teacher';

  const safeGet = async <T,>(
    colName: string,
    qRef: ReturnType<typeof query> | ReturnType<typeof collection>
  ): Promise<T[]> => {
    try {
      const snap = await getDocs(qRef);
      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) } as T));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, colName);
    }
  };

  const [programs, geminiNotes] = await Promise.all([
    safeGet<ProgramCourse>(
      'programs',
      query(collection(db, 'programs'), where('isActive', 'in', [true, false]))
    ),
    safeGet<GeminiNote>(
      'gemini_notes',
      query(collection(db, 'gemini_notes'), where('weekNumber', '>=', 1))
    ),
  ]);

  if (isSuperAdmin) {
    const [students, teachers, classes, schedules, assessments, invoices, payables] = await Promise.all([
      safeGet<StudentProfile>('students', collection(db, 'students')),
      safeGet<TeacherProfile>('teachers', collection(db, 'teachers')),
      safeGet<AcademyClass>('classes', collection(db, 'classes')),
      safeGet<ClassSchedule>('schedules', collection(db, 'schedules')),
      safeGet<StudentAssessment>('assessments', collection(db, 'assessments')),
      safeGet<TuitionInvoice>('invoices', collection(db, 'invoices')),
      safeGet<PayableRecord>('payables', collection(db, 'payables')),
    ]);
    return { students, teachers, classes, schedules, assessments, geminiNotes, invoices, payables, programs };
  }

  if (isAdmin) {
    const adminFilter = where('adminUids', 'array-contains', user.uid);
    const [students, teachers, classes, schedules, assessments, invoices, payables] = await Promise.all([
      safeGet<StudentProfile>('students', query(collection(db, 'students'), adminFilter)),
      safeGet<TeacherProfile>('teachers', query(collection(db, 'teachers'), adminFilter)),
      safeGet<AcademyClass>('classes', query(collection(db, 'classes'), adminFilter)),
      safeGet<ClassSchedule>('schedules', query(collection(db, 'schedules'), adminFilter)),
      safeGet<StudentAssessment>('assessments', query(collection(db, 'assessments'), adminFilter)),
      safeGet<TuitionInvoice>('invoices', query(collection(db, 'invoices'), adminFilter)),
      safeGet<PayableRecord>('payables', query(collection(db, 'payables'), adminFilter)),
    ]);
    return { students, teachers, classes, schedules, assessments, geminiNotes, invoices, payables, programs };
  }

  if (isTeacher) {
    const [students, teachers, classes, schedules, assessments] = await Promise.all([
      safeGet<StudentProfile>(
        'students',
        query(collection(db, 'students'), where('assignedTeacherEmails', 'array-contains', email))
      ),
      safeGet<TeacherProfile>(
        'teachers',
        query(collection(db, 'teachers'), where('teacherEmail', '==', email))
      ),
      safeGet<AcademyClass>(
        'classes',
        query(collection(db, 'classes'), where('teacherEmail', '==', email))
      ),
      safeGet<ClassSchedule>(
        'schedules',
        query(collection(db, 'schedules'), where('teacherEmail', '==', email))
      ),
      safeGet<StudentAssessment>(
        'assessments',
        query(collection(db, 'assessments'), where('teacherEmail', '==', email))
      ),
    ]);
    return { students, teachers, classes, schedules, assessments, geminiNotes, invoices: [], payables: [], programs };
  }

  // Parent or Student
  const studentField = user.role === 'student' ? 'studentEmail' : 'parentEmail';
  const [students, assessments, invoices, classes, schedules] = await Promise.all([
    safeGet<StudentProfile>('students', query(collection(db, 'students'), where(studentField, '==', email))),
    safeGet<StudentAssessment>('assessments', query(collection(db, 'assessments'), where(studentField, '==', email))),
    safeGet<TuitionInvoice>('invoices', query(collection(db, 'invoices'), where('parentEmail', '==', email))),
    safeGet<AcademyClass>(
      'classes',
      query(collection(db, 'classes'), where('status', 'in', ['active', 'upcoming', 'completed']))
    ),
    safeGet<ClassSchedule>(
      'schedules',
      query(collection(db, 'schedules'), where('status', 'in', ['scheduled', 'completed', 'cancelled']))
    ),
  ]);

  return { students, teachers: [], classes, schedules, assessments, geminiNotes, invoices, payables: [], programs };
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function searchAcademySnapshot(rawQuery: string, data: AcademySnapshot): SearchHit[] {
  const qNorm = normalize(rawQuery.trim());
  if (!qNorm) return [];

  const tokens = qNorm.split(/\s+/).filter((t) => t.length >= 2);
  if (tokens.length === 0) return [];

  const matches = (haystack: string): boolean => {
    const h = normalize(haystack);
    return tokens.some((tok) => h.includes(tok));
  };

  const hits: SearchHit[] = [];

  for (const s of data.students) {
    const text = `${s.fullName} ${s.parentName} ${s.parentEmail} ${s.cefrLevel} ${s.cefrModifier} ${s.activitiesNote || ''}`;
    if (matches(text)) {
      hits.push({
        category: 'Student',
        title: `${s.fullName} (${formatCefrLabel(s.cefrLevel, s.cefrModifier)})`,
        detail: `Age ${s.age} · Parent: ${s.parentName} (${s.parentEmail}) · Status: ${s.status}`,
      });
    }
  }

  for (const t of data.teachers) {
    const text = `${t.fullName} ${t.teacherEmail} ${t.specialty} ${t.cefrCertification} ${t.payStatus}`;
    if (matches(text)) {
      hits.push({
        category: 'Teacher',
        title: t.fullName,
        detail: `${t.teacherEmail} · ${t.specialty} · ${t.cefrCertification} · Monthly: ${formatVnd(t.monthlyBaseVnd)}`,
      });
    }
  }

  for (const c of data.classes) {
    const text = `${c.name} ${c.programTitle} ${c.teacherName} ${c.cefrLevel} ${c.room} ${c.scheduleText}`;
    if (matches(text)) {
      hits.push({
        category: 'Class',
        title: c.name,
        detail: `${c.programTitle} · Teacher: ${c.teacherName} · ${c.scheduleText} · ${c.room}`,
      });
    }
  }

  for (const sch of data.schedules) {
    const text = `${sch.dayOfWeek} ${sch.className} ${sch.teacherName} ${sch.topicEn} ${sch.topicVi} ${sch.room}`;
    if (matches(text)) {
      hits.push({
        category: 'Schedule',
        title: `${sch.dayOfWeek} ${sch.startTime}-${sch.endTime} · ${sch.className}`,
        detail: `Week ${sch.weekNumber}: ${sch.topicEn} / ${sch.topicVi} · Teacher: ${sch.teacherName}`,
      });
    }
  }

  for (const a of data.assessments) {
    const text = `${a.studentName} ${a.className} ${a.termLabel} ${a.cefrLevel} ${a.teacherCommentEn} ${a.teacherCommentVi}`;
    if (matches(text)) {
      hits.push({
        category: 'Assessment',
        title: `${a.studentName} · ${formatCefrLabel(a.cefrLevel, a.cefrModifier)}`,
        detail: `${a.termLabel} · Eng: ${a.speakingScore}/${a.readingScore}/${a.writingScore}/${a.vocabularyScore ?? 0}/${a.comprehensionScore ?? 0} · SEM: ${a.socialScore}/${a.emotionalScore}/${a.mentalScore}`,
      });
    }
  }

  for (const n of data.geminiNotes) {
    const text = `${n.title} week ${n.weekNumber} ${n.programTitle} ${n.summaryEn} ${n.summaryVi} ${(n.keyVocabulary || []).join(' ')} ${n.phonicsFocus || ''}`;
    if (matches(text)) {
      hits.push({
        category: 'Gemini Note',
        title: `Week ${n.weekNumber}: ${n.title}`,
        detail: n.summaryEn.slice(0, 140),
      });
    }
  }

  for (const inv of data.invoices) {
    const text = `${inv.invoiceNumber} ${inv.studentName} ${inv.parentEmail} ${inv.programTitle} ${inv.status} ${inv.paymentMethod}`;
    if (matches(text)) {
      hits.push({
        category: 'Invoice',
        title: `${inv.invoiceNumber} · ${inv.studentName}`,
        detail: `${formatVnd(inv.amountVnd)} · Due ${inv.dueDate} · Status: ${inv.status} (${inv.paymentMethod})`,
      });
    }
  }

  for (const pay of data.payables) {
    const text = `${pay.recipientName} ${pay.bankName} ${pay.bankAccountNumber} ${pay.recordType} ${pay.status}`;
    if (matches(text)) {
      hits.push({
        category: 'Finance / Bank',
        title: `${pay.recipientName} (${pay.recordType})`,
        detail: `${pay.bankName} ${pay.bankAccountNumber} · ${formatVnd(pay.amountVnd)} · ${pay.status}`,
      });
    }
  }

  for (const p of data.programs) {
    const text = `${p.code} ${p.titleEn} ${p.titleVi} ${p.descriptionEn} ${p.descriptionVi} ${p.cefrTarget}`;
    if (matches(text)) {
      hits.push({
        category: 'Program',
        title: `${p.code}: ${p.titleEn}`,
        detail: `${p.titleVi} · ${p.cefrTarget} · ${formatVnd(p.tuitionVnd)}`,
      });
    }
  }

  return hits.slice(0, 8);
}

export function buildAcademyContextSummary(data: AcademySnapshot): string {
  const lines: string[] = [
    `Totals visible to user: ${data.students.length} students, ${data.teachers.length} teachers, ${data.classes.length} classes, ${data.schedules.length} schedules, ${data.assessments.length} assessments, ${data.geminiNotes.length} Gemini Notes, ${data.invoices.length} invoices, ${data.payables.length} finance/bank records, ${data.programs.length} programs.`,
  ];

  if (data.students.length > 0) {
    lines.push(
      'Students: ' +
        data.students
          .slice(0, 20)
          .map((s) => `${s.fullName} (${formatCefrLabel(s.cefrLevel, s.cefrModifier)}, parent ${s.parentEmail})`)
          .join('; ')
    );
  }
  if (data.teachers.length > 0) {
    lines.push(
      'Teachers: ' +
        data.teachers
          .slice(0, 15)
          .map((t) => `${t.fullName} (${t.teacherEmail}, ${t.cefrCertification})`)
          .join('; ')
    );
  }
  if (data.classes.length > 0) {
    lines.push(
      'Classes: ' +
        data.classes
          .slice(0, 15)
          .map((c) => `${c.name} by ${c.teacherName} (${c.scheduleText}, ${c.room})`)
          .join('; ')
    );
  }
  if (data.invoices.length > 0) {
    lines.push(
      'Invoices: ' +
        data.invoices
          .slice(0, 15)
          .map((i) => `${i.invoiceNumber} ${i.studentName} ${formatVnd(i.amountVnd)} [${i.status}]`)
          .join('; ')
    );
  }
  if (data.geminiNotes.length > 0) {
    lines.push(
      'Gemini Notes: ' +
        data.geminiNotes
          .slice(0, 10)
          .map((n) => `Week ${n.weekNumber} ${n.title} (Vocab: ${(n.keyVocabulary || []).slice(0, 8).join(', ')})`)
          .join('; ')
    );
  }
  if (data.payables.length > 0) {
    lines.push(
      'Banking/Payables: ' +
        data.payables
          .slice(0, 10)
          .map((p) => `${p.recordType}: ${p.recipientName} ${p.bankName} ${p.bankAccountNumber} (${formatVnd(p.amountVnd)}, ${p.status})`)
          .join('; ')
    );
  }

  return lines.join('\n');
}
