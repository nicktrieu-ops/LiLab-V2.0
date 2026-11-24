import { and, eq, ne, notInArray } from 'drizzle-orm';
import { db } from './index.ts';
import {
  academyClasses,
  assessments,
  enrollments,
  geminiNotes,
  invoices,
  mediaAssets,
  payables,
  paymentMethods,
  programs,
  protectedMaterials,
  quickNotes,
  schedules,
  students,
  teachers,
  userInvites,
  users,
} from './schema.ts';
import { getOrCreateUser } from './users.ts';

export type AcademyCollectionName =
  | 'users'
  | 'user_invites'
  | 'teachers'
  | 'students'
  | 'programs'
  | 'classes'
  | 'schedules'
  | 'assessments'
  | 'gemini_notes'
  | 'learning_resources'
  | 'resource_submissions'
  | 'academy_events'
  | 'invoices'
  | 'payables'
  | 'enrollments'
  | 'payment_methods'
  | 'quick_notes';

const asStr = (val: unknown, fallback = ''): string =>
  typeof val === 'string' ? val : val == null ? fallback : String(val);

const asInt = (val: unknown, fallback = 0): number => {
  const n = Number(val);
  return Number.isFinite(n) ? Math.round(n) : fallback;
};

const asBool = (val: unknown, fallback = false): boolean =>
  typeof val === 'boolean' ? val : fallback;

const asStrArray = (val: unknown): string[] =>
  Array.isArray(val) ? val.map((item) => String(item)) : [];

export async function upsertAcademyRecord(
  col: AcademyCollectionName,
  id: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    const now = new Date();
    switch (col) {
      case 'users': {
        await getOrCreateUser({
          uid: asStr(data.uid, id),
          email: asStr(data.email),
          displayName: asStr(data.displayName),
          role: asStr(data.role, 'parent'),
          phone: asStr(data.phone),
          photoUrl: data.photoUrl !== undefined ? asStr(data.photoUrl) : undefined,
          preferredLang: asStr(data.preferredLang, 'vi'),
          claimedInviteId: asStr(data.claimedInviteId),
          status: asStr(data.status, 'active'),
        });
        return;
      }
      case 'user_invites': {
        await db
          .insert(userInvites)
          .values({
            id,
            email: asStr(data.email).toLowerCase(),
            displayName: asStr(data.displayName),
            role: asStr(data.role, 'parent'),
            phone: asStr(data.phone),
            status: asStr(data.status, 'pending'),
            createdByUid: asStr(data.createdByUid),
          })
          .onConflictDoUpdate({
            target: userInvites.id,
            set: {
              email: asStr(data.email).toLowerCase(),
              displayName: asStr(data.displayName),
              role: asStr(data.role, 'parent'),
              phone: asStr(data.phone),
              status: asStr(data.status, 'pending'),
              updatedAt: now,
            },
          });
        return;
      }
      case 'teachers': {
        await db
          .insert(teachers)
          .values({
            id,
            teacherUid: asStr(data.teacherUid),
            teacherEmail: asStr(data.teacherEmail).toLowerCase(),
            fullName: asStr(data.fullName),
            phone: asStr(data.phone),
            photoUrl: asStr(data.photoUrl),
            specialty: asStr(data.specialty),
            cefrCertification: asStr(data.cefrCertification),
            bioEn: asStr(data.bioEn),
            bioVi: asStr(data.bioVi),
            hourlyRateVnd: asInt(data.hourlyRateVnd),
            monthlyBaseVnd: asInt(data.monthlyBaseVnd),
            bankName: asStr(data.bankName),
            bankAccountNumber: asStr(data.bankAccountNumber),
            bankAccountHolder: asStr(data.bankAccountHolder),
            payStatus: asStr(data.payStatus, 'active'),
            payNotes: asStr(data.payNotes),
            status: asStr(data.status, 'active'),
          })
          .onConflictDoUpdate({
            target: teachers.id,
            set: {
              teacherUid: asStr(data.teacherUid),
              teacherEmail: asStr(data.teacherEmail).toLowerCase(),
              fullName: asStr(data.fullName),
              phone: asStr(data.phone),
              photoUrl: asStr(data.photoUrl),
              specialty: asStr(data.specialty),
              cefrCertification: asStr(data.cefrCertification),
              bioEn: asStr(data.bioEn),
              bioVi: asStr(data.bioVi),
              hourlyRateVnd: asInt(data.hourlyRateVnd),
              monthlyBaseVnd: asInt(data.monthlyBaseVnd),
              bankName: asStr(data.bankName),
              bankAccountNumber: asStr(data.bankAccountNumber),
              bankAccountHolder: asStr(data.bankAccountHolder),
              payStatus: asStr(data.payStatus, 'active'),
              payNotes: asStr(data.payNotes),
              status: asStr(data.status, 'active'),
              updatedAt: now,
            },
          });
        return;
      }
      case 'students': {
        await db
          .insert(students)
          .values({
            id,
            fullName: asStr(data.fullName),
            studentEmail: asStr(data.studentEmail),
            parentName: asStr(data.parentName),
            parentEmail: asStr(data.parentEmail).toLowerCase(),
            parentPhone: asStr(data.parentPhone),
            photoUrl: asStr(data.photoUrl),
            parentUid: asStr(data.parentUid),
            studentUid: asStr(data.studentUid),
            age: asInt(data.age, 7),
            gender: asStr(data.gender, 'girl'),
            cefrLevel: asStr(data.cefrLevel, 'Pre-A1 Starters'),
            cefrModifier: asStr(data.cefrModifier, 'standard'),
            enrolledClassIds: asStrArray(data.enrolledClassIds),
            assignedTeacherEmails: asStrArray(data.assignedTeacherEmails),
            activitiesNote: asStr(data.activitiesNote),
            status: asStr(data.status, 'active'),
          })
          .onConflictDoUpdate({
            target: students.id,
            set: {
              fullName: asStr(data.fullName),
              studentEmail: asStr(data.studentEmail),
              parentName: asStr(data.parentName),
              parentEmail: asStr(data.parentEmail).toLowerCase(),
              parentPhone: asStr(data.parentPhone),
              photoUrl: asStr(data.photoUrl),
              parentUid: asStr(data.parentUid),
              studentUid: asStr(data.studentUid),
              age: asInt(data.age, 7),
              gender: asStr(data.gender, 'girl'),
              cefrLevel: asStr(data.cefrLevel, 'Pre-A1 Starters'),
              cefrModifier: asStr(data.cefrModifier, 'standard'),
              enrolledClassIds: asStrArray(data.enrolledClassIds),
              assignedTeacherEmails: asStrArray(data.assignedTeacherEmails),
              activitiesNote: asStr(data.activitiesNote),
              status: asStr(data.status, 'active'),
              updatedAt: now,
            },
          });
        return;
      }
      case 'programs': {
        await db
          .insert(programs)
          .values({
            id,
            code: asStr(data.code),
            titleEn: asStr(data.titleEn),
            titleVi: asStr(data.titleVi),
            descriptionEn: asStr(data.descriptionEn),
            descriptionVi: asStr(data.descriptionVi),
            cefrTarget: asStr(data.cefrTarget),
            ageRange: asStr(data.ageRange, '6 - 14 years'),
            weeksCount: asInt(data.weeksCount, 13),
            tuitionVnd: asInt(data.tuitionVnd),
            scheduleSummary: asStr(data.scheduleSummary),
            isActive: asBool(data.isActive, true),
          })
          .onConflictDoUpdate({
            target: programs.id,
            set: {
              code: asStr(data.code),
              titleEn: asStr(data.titleEn),
              titleVi: asStr(data.titleVi),
              descriptionEn: asStr(data.descriptionEn),
              descriptionVi: asStr(data.descriptionVi),
              cefrTarget: asStr(data.cefrTarget),
              ageRange: asStr(data.ageRange, '6 - 14 years'),
              weeksCount: asInt(data.weeksCount, 13),
              tuitionVnd: asInt(data.tuitionVnd),
              scheduleSummary: asStr(data.scheduleSummary),
              isActive: asBool(data.isActive, true),
              updatedAt: now,
            },
          });
        return;
      }
      case 'classes': {
        await db
          .insert(academyClasses)
          .values({
            id,
            name: asStr(data.name),
            programId: asStr(data.programId),
            programTitle: asStr(data.programTitle),
            teacherUid: asStr(data.teacherUid),
            teacherEmail: asStr(data.teacherEmail).toLowerCase(),
            teacherName: asStr(data.teacherName),
            cefrLevel: asStr(data.cefrLevel, 'Pre-A1 Starters'),
            cefrModifier: asStr(data.cefrModifier, 'standard'),
            room: asStr(data.room),
            scheduleText: asStr(data.scheduleText),
            maxStudents: asInt(data.maxStudents, 16),
            studentIds: asStrArray(data.studentIds),
            status: asStr(data.status, 'active'),
          })
          .onConflictDoUpdate({
            target: academyClasses.id,
            set: {
              name: asStr(data.name),
              programId: asStr(data.programId),
              programTitle: asStr(data.programTitle),
              teacherUid: asStr(data.teacherUid),
              teacherEmail: asStr(data.teacherEmail).toLowerCase(),
              teacherName: asStr(data.teacherName),
              cefrLevel: asStr(data.cefrLevel, 'Pre-A1 Starters'),
              cefrModifier: asStr(data.cefrModifier, 'standard'),
              room: asStr(data.room),
              scheduleText: asStr(data.scheduleText),
              maxStudents: asInt(data.maxStudents, 16),
              studentIds: asStrArray(data.studentIds),
              status: asStr(data.status, 'active'),
              updatedAt: now,
            },
          });
        return;
      }
      case 'schedules': {
        await db
          .insert(schedules)
          .values({
            id,
            classId: asStr(data.classId),
            className: asStr(data.className),
            teacherUid: asStr(data.teacherUid),
            teacherEmail: asStr(data.teacherEmail).toLowerCase(),
            teacherName: asStr(data.teacherName),
            dayOfWeek: asStr(data.dayOfWeek, 'Saturday'),
            startTime: asStr(data.startTime, '09:00'),
            endTime: asStr(data.endTime, '10:30'),
            room: asStr(data.room),
            weekNumber: asInt(data.weekNumber, 1),
            topicEn: asStr(data.topicEn),
            topicVi: asStr(data.topicVi),
            status: asStr(data.status, 'scheduled'),
          })
          .onConflictDoUpdate({
            target: schedules.id,
            set: {
              classId: asStr(data.classId),
              className: asStr(data.className),
              teacherUid: asStr(data.teacherUid),
              teacherEmail: asStr(data.teacherEmail).toLowerCase(),
              teacherName: asStr(data.teacherName),
              dayOfWeek: asStr(data.dayOfWeek, 'Saturday'),
              startTime: asStr(data.startTime, '09:00'),
              endTime: asStr(data.endTime, '10:30'),
              room: asStr(data.room),
              weekNumber: asInt(data.weekNumber, 1),
              topicEn: asStr(data.topicEn),
              topicVi: asStr(data.topicVi),
              status: asStr(data.status, 'scheduled'),
              updatedAt: now,
            },
          });
        return;
      }
      case 'assessments': {
        await db
          .insert(assessments)
          .values({
            id,
            studentId: asStr(data.studentId),
            studentName: asStr(data.studentName),
            classId: asStr(data.classId),
            className: asStr(data.className),
            teacherUid: asStr(data.teacherUid),
            teacherEmail: asStr(data.teacherEmail).toLowerCase(),
            teacherName: asStr(data.teacherName),
            parentEmail: asStr(data.parentEmail).toLowerCase(),
            studentEmail: asStr(data.studentEmail),
            termLabel: asStr(data.termLabel),
            cefrLevel: asStr(data.cefrLevel, 'Pre-A1 Starters'),
            cefrModifier: asStr(data.cefrModifier, 'standard'),
            speakingScore: asInt(data.speakingScore),
            readingScore: asInt(data.readingScore),
            writingScore: asInt(data.writingScore),
            vocabularyScore: asInt(data.vocabularyScore),
            comprehensionScore: asInt(data.comprehensionScore),
            socialScore: asInt(data.socialScore),
            emotionalScore: asInt(data.emotionalScore),
            mentalScore: asInt(data.mentalScore),
            teacherCommentEn: asStr(data.teacherCommentEn),
            teacherCommentVi: asStr(data.teacherCommentVi),
            aiInsightEn: asStr(data.aiInsightEn),
            aiInsightVi: asStr(data.aiInsightVi),
            activitiesCompleted: asStrArray(data.activitiesCompleted),
          })
          .onConflictDoUpdate({
            target: assessments.id,
            set: {
              termLabel: asStr(data.termLabel),
              cefrLevel: asStr(data.cefrLevel, 'Pre-A1 Starters'),
              cefrModifier: asStr(data.cefrModifier, 'standard'),
              speakingScore: asInt(data.speakingScore),
              readingScore: asInt(data.readingScore),
              writingScore: asInt(data.writingScore),
              vocabularyScore: asInt(data.vocabularyScore),
              comprehensionScore: asInt(data.comprehensionScore),
              socialScore: asInt(data.socialScore),
              emotionalScore: asInt(data.emotionalScore),
              mentalScore: asInt(data.mentalScore),
              teacherCommentEn: asStr(data.teacherCommentEn),
              teacherCommentVi: asStr(data.teacherCommentVi),
              aiInsightEn: asStr(data.aiInsightEn),
              aiInsightVi: asStr(data.aiInsightVi),
              activitiesCompleted: asStrArray(data.activitiesCompleted),
              updatedAt: now,
            },
          });
        return;
      }
      case 'gemini_notes': {
        await db
          .insert(geminiNotes)
          .values({
            id,
            title: asStr(data.title),
            weekNumber: asInt(data.weekNumber, 1),
            programTitle: asStr(data.programTitle),
            sourceFileName: asStr(data.sourceFileName),
            summaryEn: asStr(data.summaryEn),
            summaryVi: asStr(data.summaryVi),
            keyVocabulary: asStrArray(data.keyVocabulary),
            phonicsFocus: asStr(data.phonicsFocus),
            grammarFocus: asStr(data.grammarFocus),
            activitiesEn: asStr(data.activitiesEn),
            activitiesVi: asStr(data.activitiesVi),
            uploadedByUid: asStr(data.uploadedByUid),
            uploadedByEmail: asStr(data.uploadedByEmail),
          })
          .onConflictDoUpdate({
            target: geminiNotes.id,
            set: {
              title: asStr(data.title),
              weekNumber: asInt(data.weekNumber, 1),
              programTitle: asStr(data.programTitle),
              sourceFileName: asStr(data.sourceFileName),
              summaryEn: asStr(data.summaryEn),
              summaryVi: asStr(data.summaryVi),
              keyVocabulary: asStrArray(data.keyVocabulary),
              phonicsFocus: asStr(data.phonicsFocus),
              grammarFocus: asStr(data.grammarFocus),
              activitiesEn: asStr(data.activitiesEn),
              activitiesVi: asStr(data.activitiesVi),
              updatedAt: now,
            },
          });
        return;
      }
      case 'invoices': {
        await db
          .insert(invoices)
          .values({
            id,
            invoiceNumber: asStr(data.invoiceNumber),
            studentId: asStr(data.studentId),
            studentName: asStr(data.studentName),
            parentEmail: asStr(data.parentEmail).toLowerCase(),
            parentUid: asStr(data.parentUid),
            programTitle: asStr(data.programTitle),
            amountVnd: asInt(data.amountVnd),
            dueDate: asStr(data.dueDate),
            status: asStr(data.status, 'pending'),
            paymentMethod: asStr(data.paymentMethod, 'unselected'),
            paymentReference: asStr(data.paymentReference),
            reminderNote: asStr(data.reminderNote),
          })
          .onConflictDoUpdate({
            target: invoices.id,
            set: {
              status: asStr(data.status, 'pending'),
              paymentMethod: asStr(data.paymentMethod, 'unselected'),
              paymentReference: asStr(data.paymentReference),
              reminderNote: asStr(data.reminderNote),
              parentUid: asStr(data.parentUid),
              updatedAt: now,
            },
          });
        return;
      }
      case 'payables': {
        await db
          .insert(payables)
          .values({
            id,
            recordType: asStr(data.recordType),
            recipientName: asStr(data.recipientName),
            recipientEmail: asStr(data.recipientEmail),
            bankName: asStr(data.bankName),
            bankAccountNumber: asStr(data.bankAccountNumber),
            bankAccountHolder: asStr(data.bankAccountHolder),
            amountVnd: asInt(data.amountVnd),
            dueDate: asStr(data.dueDate),
            status: asStr(data.status, 'active'),
            notes: asStr(data.notes),
          })
          .onConflictDoUpdate({
            target: payables.id,
            set: {
              recordType: asStr(data.recordType),
              recipientName: asStr(data.recipientName),
              recipientEmail: asStr(data.recipientEmail),
              bankName: asStr(data.bankName),
              bankAccountNumber: asStr(data.bankAccountNumber),
              bankAccountHolder: asStr(data.bankAccountHolder),
              amountVnd: asInt(data.amountVnd),
              dueDate: asStr(data.dueDate),
              status: asStr(data.status, 'active'),
              notes: asStr(data.notes),
              updatedAt: now,
            },
          });
        return;
      }
      case 'enrollments': {
        await db
          .insert(enrollments)
          .values({
            id,
            studentId: asStr(data.studentId),
            studentName: asStr(data.studentName),
            parentUid: asStr(data.parentUid),
            parentEmail: asStr(data.parentEmail).toLowerCase(),
            programId: asStr(data.programId),
            programTitle: asStr(data.programTitle),
            preferredSchedule: asStr(data.preferredSchedule),
            notes: asStr(data.notes),
            status: asStr(data.status, 'pending'),
          })
          .onConflictDoUpdate({
            target: enrollments.id,
            set: {
              status: asStr(data.status, 'pending'),
              notes: asStr(data.notes),
              updatedAt: now,
            },
          });
        return;
      }
      case 'payment_methods': {
        await db
          .insert(paymentMethods)
          .values({
            id,
            parentUid: asStr(data.parentUid),
            parentEmail: asStr(data.parentEmail).toLowerCase(),
            methodType: asStr(data.methodType),
            providerLabel: asStr(data.providerLabel),
            accountLast4: asStr(data.accountLast4),
            accountHolderName: asStr(data.accountHolderName),
            autoPayEnabled: asBool(data.autoPayEnabled, false),
          })
          .onConflictDoUpdate({
            target: paymentMethods.id,
            set: {
              methodType: asStr(data.methodType),
              providerLabel: asStr(data.providerLabel),
              accountLast4: asStr(data.accountLast4),
              accountHolderName: asStr(data.accountHolderName),
              autoPayEnabled: asBool(data.autoPayEnabled, false),
              updatedAt: now,
            },
          });
        return;
      }
      case 'quick_notes': {
        await db
          .insert(quickNotes)
          .values({
            id,
            studentId: asStr(data.studentId),
            studentName: asStr(data.studentName),
            classId: asStr(data.classId),
            className: asStr(data.className),
            teacherUid: asStr(data.teacherUid),
            teacherEmail: asStr(data.teacherEmail).toLowerCase(),
            teacherName: asStr(data.teacherName),
            observationDate: asStr(data.observationDate),
            category: asStr(data.category, 'general'),
            noteText: asStr(data.noteText),
            includeInReport: asBool(data.includeInReport, true),
          })
          .onConflictDoUpdate({
            target: quickNotes.id,
            set: {
              observationDate: asStr(data.observationDate),
              category: asStr(data.category, 'general'),
              noteText: asStr(data.noteText),
              includeInReport: asBool(data.includeInReport, true),
              updatedAt: now,
            },
          });
        return;
      }
    }
  } catch (error) {
    console.error(`Database upsert failed for ${col}/${id}:`, error);
    throw new Error(`Failed to save ${col} record to SQL storage.`, { cause: error });
  }
}

export async function deleteAcademyRecord(col: AcademyCollectionName, id: string): Promise<void> {
  try {
    switch (col) {
      case 'users':
        await db.delete(users).where(eq(users.uid, id));
        return;
      case 'user_invites':
        await db.delete(userInvites).where(eq(userInvites.id, id));
        return;
      case 'teachers':
        await db.delete(teachers).where(eq(teachers.id, id));
        return;
      case 'students':
        await db.delete(students).where(eq(students.id, id));
        return;
      case 'programs':
        await db.delete(programs).where(eq(programs.id, id));
        return;
      case 'classes':
        await db.delete(academyClasses).where(eq(academyClasses.id, id));
        return;
      case 'schedules':
        await db.delete(schedules).where(eq(schedules.id, id));
        return;
      case 'assessments':
        await db.delete(assessments).where(eq(assessments.id, id));
        return;
      case 'gemini_notes':
        await db.delete(protectedMaterials).where(eq(protectedMaterials.noteId, id));
        await db.delete(geminiNotes).where(eq(geminiNotes.id, id));
        return;
      case 'invoices':
        await db.delete(invoices).where(eq(invoices.id, id));
        return;
      case 'payables':
        await db.delete(payables).where(eq(payables.id, id));
        return;
      case 'enrollments':
        await db.delete(enrollments).where(eq(enrollments.id, id));
        return;
      case 'payment_methods':
        await db.delete(paymentMethods).where(eq(paymentMethods.id, id));
        return;
      case 'quick_notes':
        await db.delete(quickNotes).where(eq(quickNotes.id, id));
        return;
    }
  } catch (error) {
    console.error(`Database delete failed for ${col}/${id}:`, error);
    throw new Error(`Failed to remove ${col} record from SQL storage.`, { cause: error });
  }
}

export async function getSqlAcademySnapshotForAdmin() {
  try {
    const [
      userRows,
      inviteRows,
      teacherRows,
      studentRows,
      programRows,
      classRows,
      scheduleRows,
      assessmentRows,
      noteRows,
      invoiceRows,
      payableRows,
      enrollmentRows,
      paymentMethodRows,
      quickNoteRows,
    ] = await Promise.all([
      db.select().from(users),
      db.select().from(userInvites),
      db.select().from(teachers),
      db.select().from(students),
      db.select().from(programs),
      db.select().from(academyClasses),
      db.select().from(schedules),
      db.select().from(assessments),
      db.select().from(geminiNotes),
      db.select().from(invoices),
      db.select().from(payables),
      db.select().from(enrollments),
      db.select().from(paymentMethods),
      db.select().from(quickNotes),
    ]);

    return {
      users: userRows,
      user_invites: inviteRows,
      teachers: teacherRows,
      students: studentRows,
      programs: programRows,
      classes: classRows,
      schedules: scheduleRows,
      assessments: assessmentRows,
      gemini_notes: noteRows,
      invoices: invoiceRows,
      payables: payableRows,
      enrollments: enrollmentRows,
      payment_methods: paymentMethodRows,
      quick_notes: quickNoteRows,
    };
  } catch (error) {
    console.error('Failed to query SQL academy snapshot:', error);
    throw new Error('Failed to load academy records from SQL storage.', { cause: error });
  }
}

export async function resetAllAcademySqlRecords(
  preserveUid?: string,
  superAdminEmails: readonly string[] = []
): Promise<void> {
  try {
    await db.delete(quickNotes);
    await db.delete(assessments);
    await db.delete(enrollments);
    await db.delete(invoices);
    await db.delete(payables);
    await db.delete(paymentMethods);
    await db.delete(schedules);
    await db.delete(academyClasses);
    await db.delete(programs);
    await db.delete(protectedMaterials).where(ne(protectedMaterials.noteId, 'note_be_whole_week_01'));
    await db.delete(geminiNotes);
    await db.delete(students);
    await db.delete(teachers);
    await db.delete(userInvites);

    const conditions = [];
    if (preserveUid) {
      conditions.push(ne(users.uid, preserveUid));
    }
    if (superAdminEmails.length > 0) {
      conditions.push(notInArray(users.email, [...superAdminEmails]));
    }
    if (conditions.length > 0) {
      await db.delete(users).where(and(...conditions));
    }
  } catch (error) {
    console.error('Failed to reset SQL academy records:', error);
    throw new Error('Failed to reset academy records in SQL storage.', { cause: error });
  }
}

export interface ProtectedMaterialInput {
  noteId: string;
  fileName: string;
  mimeType: string;
  contentBase64?: string;
  rawText?: string;
  uploadedByUid?: string;
}

export async function upsertProtectedMaterial(input: ProtectedMaterialInput): Promise<void> {
  const now = new Date();
  await db
    .insert(protectedMaterials)
    .values({
      noteId: input.noteId,
      fileName: input.fileName || 'Curriculum Material',
      mimeType: input.mimeType || 'application/pdf',
      contentBase64: input.contentBase64 || '',
      rawText: input.rawText || '',
      uploadedByUid: input.uploadedByUid || '',
    })
    .onConflictDoUpdate({
      target: protectedMaterials.noteId,
      set: {
        fileName: input.fileName || 'Curriculum Material',
        mimeType: input.mimeType || 'application/pdf',
        contentBase64: input.contentBase64 || '',
        rawText: input.rawText || '',
        updatedAt: now,
      },
    });
}

export async function getProtectedMaterial(noteId: string) {
  const rows = await db
    .select()
    .from(protectedMaterials)
    .where(eq(protectedMaterials.noteId, noteId))
    .limit(1);
  return rows[0] ?? null;
}

export interface MediaAssetInput {
  key: string;
  mimeType: string;
  sizeBytes: number;
  etag: string;
  dataBase64: string;
}

export async function upsertMediaAsset(input: MediaAssetInput): Promise<void> {
  const now = new Date();
  await db
    .insert(mediaAssets)
    .values({
      key: input.key,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      etag: input.etag,
      dataBase64: input.dataBase64,
    })
    .onConflictDoUpdate({
      target: mediaAssets.key,
      set: {
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        etag: input.etag,
        dataBase64: input.dataBase64,
        updatedAt: now,
      },
    });
}

export async function getMediaAsset(key: string) {
  const rows = await db
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.key, key))
    .limit(1);
  return rows[0] ?? null;
}
