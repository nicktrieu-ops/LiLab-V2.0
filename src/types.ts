export type UserRole = 'super_admin' | 'admin' | 'teacher' | 'parent' | 'student';
export type LangCode = 'vi' | 'en' | 'bi';

export const CEFR_LEVELS = [
  'Pre-A1 Starters',
  'A1 Movers',
  'A2 Flyers',
  'A2 Key',
  'B1 Preliminary',
  'B2 First',
  'C1 Advanced',
  'C2 Proficiency',
] as const;

export type CefrLevel = (typeof CEFR_LEVELS)[number];
export type CefrModifier = '-' | 'standard' | '+';

export function formatCefrLabel(level: CefrLevel | string, modifier: CefrModifier): string {
  if (modifier === 'standard') return level;
  return `${level}${modifier}`;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  phone?: string;
  photoUrl?: string;
  preferredLang: LangCode;
  claimedInviteId?: string;
  /** pending = signed up and waiting for admin approval; declined = refused by an admin */
  status: 'active' | 'inactive' | 'pending' | 'declined';
  /** Set by the admin who approved or declined the account */
  reviewedByEmail?: string;
  reviewedAt?: string;
  reviewNote?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserInvite {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'teacher' | 'parent' | 'student';
  phone?: string;
  status: 'pending' | 'claimed';
  createdByUid: string;
  adminUids: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TeacherProfile {
  id: string;
  teacherUid?: string;
  teacherEmail: string;
  fullName: string;
  phone?: string;
  photoUrl?: string;
  specialty: string;
  cefrCertification: string;
  bioEn?: string;
  bioVi?: string;
  hourlyRateVnd: number;
  monthlyBaseVnd: number;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountHolder?: string;
  payStatus: 'active' | 'pending_payout' | 'paid';
  payNotes?: string;
  status: 'active' | 'inactive';
  adminUids: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface StudentProfile {
  id: string;
  fullName: string;
  studentEmail?: string;
  parentName: string;
  parentEmail: string;
  parentPhone?: string;
  photoUrl?: string;
  parentUid?: string;
  studentUid?: string;
  age: number;
  gender: 'girl' | 'boy';
  cefrLevel: CefrLevel;
  cefrModifier: CefrModifier;
  enrolledClassIds: string[];
  assignedTeacherEmails: string[];
  activitiesNote?: string;
  status: 'active' | 'paused' | 'graduated';
  adminUids: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ProgramCourse {
  id: string;
  code: string;
  titleEn: string;
  titleVi: string;
  descriptionEn: string;
  descriptionVi: string;
  cefrTarget: string;
  ageRange: string;
  weeksCount: number;
  tuitionVnd: number;
  scheduleSummary?: string;
  teacherName?: string;
  teacherId?: string;
  enrollmentDate?: string;
  startDate?: string;
  maxClassSize?: number;
  maxCapacity?: number;
  location?: string;
  showInPromoPopup?: boolean;
  promoBadgeEn?: string;
  promoBadgeVi?: string;
  isActive: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AcademyClass {
  id: string;
  name: string;
  programId: string;
  programTitle: string;
  teacherUid?: string;
  teacherEmail: string;
  teacherName: string;
  cefrLevel: string;
  cefrModifier: CefrModifier;
  room: string;
  scheduleText: string;
  maxStudents: number;
  studentIds: string[];
  status: 'active' | 'upcoming' | 'completed';
  adminUids: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ClassSchedule {
  id: string;
  classId: string;
  className: string;
  teacherUid?: string;
  teacherEmail: string;
  teacherName: string;
  dayOfWeek: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  startTime: string;
  endTime: string;
  room: string;
  weekNumber: number;
  topicEn: string;
  topicVi: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  adminUids: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface StudentAssessment {
  id: string;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  teacherUid?: string;
  teacherEmail: string;
  teacherName: string;
  parentEmail: string;
  studentEmail?: string;
  termLabel: string;
  cefrLevel: CefrLevel;
  cefrModifier: CefrModifier;
  speakingScore: number;
  readingScore: number;
  writingScore: number;
  vocabularyScore?: number;
  comprehensionScore?: number;
  socialScore: number;
  emotionalScore: number;
  mentalScore: number;
  teacherCommentEn: string;
  teacherCommentVi: string;
  aiInsightEn?: string;
  aiInsightVi?: string;
  activitiesCompleted: string[];
  adminUids: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface GeminiNote {
  id: string;
  title: string;
  weekNumber: number;
  programTitle: string;
  sourceFileName?: string;
  summaryEn: string;
  summaryVi: string;
  keyVocabulary: string[];
  phonicsFocus?: string;
  grammarFocus?: string;
  activitiesEn?: string;
  activitiesVi?: string;
  uploadedByUid: string;
  uploadedByEmail: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TuitionInvoice {
  id: string;
  invoiceNumber: string;
  studentId: string;
  studentName: string;
  parentEmail: string;
  parentUid?: string;
  parentPhone?: string;
  programId?: string;
  programTitle: string;
  amountVnd: number;
  dueDate: string;
  status: 'pending' | 'paid' | 'overdue' | 'reminder_sent';
  paymentMethod: 'unselected' | 'direct_debit' | 'credit_card' | 'qr_transfer';
  paymentReference?: string;
  payerBankName?: string;
  payerAccountHolder?: string;
  paidAt?: string;
  reminderNote?: string;
  reminderChannel?: 'email' | 'zalo' | 'both';
  lastReminderAt?: string;
  adminUids: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PayableRecord {
  id: string;
  recordType: 'teacher_payroll' | 'vendor_expense' | 'academy_bank_config';
  recipientName: string;
  recipientEmail?: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  amountVnd: number;
  dueDate: string;
  status: 'scheduled' | 'paid' | 'pending' | 'active';
  notes?: string;
  adminUids: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AcademyBankConfig {
  id: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountHolder: string;
  branchName?: string;
  zaloHotline?: string;
  paymentInstructionsEn?: string;
  paymentInstructionsVi?: string;
  qrImageDataUrl?: string;
  useDynamicVietQr?: boolean;
  isActive: boolean;
  updatedByEmail?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PaymentReminderLog {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  studentId: string;
  studentName: string;
  parentEmail: string;
  parentPhone?: string;
  programTitle: string;
  amountVnd: number;
  channel: 'email' | 'zalo';
  deliveryMode: string;
  messagePreview: string;
  sentByUid: string;
  sentByEmail: string;
  sentAt: string;
  adminUids: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface EnrollmentRequest {
  id: string;
  studentId: string;
  studentName: string;
  parentUid: string;
  parentEmail: string;
  programId: string;
  programTitle: string;
  preferredSchedule?: string;
  notes?: string;
  status: 'pending' | 'approved' | 'enrolled' | 'waitlist' | 'rejected';
  adminUids: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ParentPaymentMethod {
  id: string;
  parentUid: string;
  parentEmail: string;
  parentPhone?: string;
  methodType: 'direct_debit' | 'credit_card' | 'qr_transfer';
  providerLabel: string;
  bankName?: string;
  accountLast4: string;
  accountNumberMasked?: string;
  accountHolderName: string;
  branchOrNotes?: string;
  autoPayEnabled: boolean;
  adminUids: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type QuickNoteCategory =
  | 'general'
  | 'speaking'
  | 'reading'
  | 'writing'
  | 'vocabulary'
  | 'comprehension'
  | 'social'
  | 'emotional'
  | 'mental';

export interface StudentQuickNote {
  id: string;
  studentId: string;
  studentName: string;
  classId?: string;
  className?: string;
  teacherUid: string;
  teacherEmail: string;
  teacherName: string;
  observationDate: string;
  category: QuickNoteCategory;
  noteText: string;
  includeInReport: boolean;
  adminUids: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface LearningResourceRecord {
  id: string;
  code: string;
  weekNumber: number;
  weekThemeEn: string;
  weekThemeVi: string;
  cefrLevel: CefrLevel;
  category: 'pdf_handout' | 'practice_worksheet' | 'supplemental_reading';
  skillFocus:
    | 'Speaking'
    | 'Reading'
    | 'Writing'
    | 'Phonics & Vocabulary'
    | 'Listening'
    | 'Be Whole Values';
  estimatedMinutes: number;
  titleEn: string;
  titleVi: string;
  summaryEn: string;
  summaryVi: string;
  keyVocabulary: string[];
  phonicsOrGrammar: string;
  readingPassageEn?: string;
  readingPassageVi?: string;
  fileName?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  fileBase64?: string;
  assignedScope?: 'all' | 'class' | 'student';
  assignedClassIds?: string[];
  assignedClassNames?: string[];
  assignedStudentIds?: string[];
  assignedStudentNames?: string[];
  materialLinkUrl?: string;
  worksheetPromptsJson?: string;
  uploadedByUid: string;
  uploadedByEmail: string;
  uploadedByName: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ResourceSubmissionAnswerItem {
  questionIndex: number;
  questionEn: string;
  questionVi: string;
  selectedAnswer: string;
  answerKey: string;
  isCorrect: boolean;
}

export interface ResourceSubmissionRecord {
  id: string;
  resourceId: string;
  resourceCode: string;
  resourceTitleEn: string;
  resourceTitleVi: string;
  weekNumber: number;
  cefrLevel: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  parentEmail: string;
  classId: string;
  className: string;
  teacherEmail: string;
  teacherName: string;
  answersJson: string;
  studentNotes: string;
  autoScorePercent: number;
  status: 'submitted' | 'graded';
  gradeScore?: number;
  teacherFeedbackEn?: string;
  teacherFeedbackVi?: string;
  gradedByEmail?: string;
  gradedByName?: string;
  submittedAt: string;
  gradedAt?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type AcademyEventType =
  | 'class_session'
  | 'cefr_assessment'
  | 'academy_milestone'
  | 'parent_workshop'
  | 'holiday';

export interface AcademyEventRecord {
  id: string;
  titleEn: string;
  titleVi: string;
  eventDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
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
  createdByUid: string;
  createdByEmail: string;
  createdByName: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type CertificateThemeIdType = 'royal_gold' | 'rose_celebration' | 'heritage_teal';
export type CertificateHonorTierKey = 'distinction' | 'merit' | 'commended' | 'growth';

export interface IssuedCertificate {
  id: string;
  studentId: string;
  studentName: string;
  studentAge: number;
  studentGender: 'girl' | 'boy';
  studentPhotoUrl?: string;
  parentEmail: string;
  parentUid?: string;
  studentEmail?: string;
  assessmentId?: string;
  serialId: string;
  cefrLevel: CefrLevel;
  cefrModifier: CefrModifier;
  cefrDisplay: string;
  pceLevelNumber: number;
  className: string;
  termLabel: string;
  teacherName: string;
  directorName: string;
  directorTitleEn: string;
  directorTitleVi: string;
  awardTitleEn: string;
  awardTitleVi: string;
  citationEn: string;
  citationVi: string;
  issueDate: string; // YYYY-MM-DD
  certLang: LangCode;
  theme: CertificateThemeIdType;
  showScores: boolean;
  showStudentPhoto: boolean;
  hasScores: boolean;
  speakingScore: number;
  readingScore: number;
  writingScore: number;
  vocabularyScore: number;
  comprehensionScore: number;
  socialScore: number;
  emotionalScore: number;
  mentalScore: number;
  englishAvg: number;
  wholeChildAvg: number;
  compositeScore: number;
  honorTierKey: CertificateHonorTierKey;
  issuedByUid: string;
  issuedByEmail: string;
  issuedByName: string;
  adminUids?: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type MindMapBranchColor =
  | '#FF6B00'
  | '#2563EB'
  | '#0D9488'
  | '#E61E64'
  | '#D97706'
  | '#7C3AED';

export interface MindMapNode {
  id: string;
  parentId: string | null;
  label: string;
  x: number;
  y: number;
  color: MindMapBranchColor;
  note?: string;
}

export interface StudentMindMapRecord {
  id: string;
  studentId: string;
  studentName: string;
  ownerUid: string;
  studentEmail?: string;
  parentEmail?: string;
  title: string;
  topicTag: string;
  cefrLevel: string;
  nodesJson: string;
  nodeCount: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type StudyNoteBlockType = 'heading' | 'paragraph' | 'bullet' | 'checklist';

export interface StudyNoteBlock {
  id: string;
  type: StudyNoteBlockType;
  text: string;
  checked?: boolean;
  bold?: boolean;
  highlight?: boolean;
  selectedForMap?: boolean;
}

export interface StudyVocabItem {
  id: string;
  word: string;
  meaning: string;
  example?: string;
}

export interface StudentStudyNoteRecord {
  id: string;
  studentId: string;
  studentName: string;
  ownerUid: string;
  studentEmail?: string;
  parentEmail?: string;
  title: string;
  subjectTag: string;
  cefrLevel: string;
  blocksJson: string;
  vocabJson: string;
  excerpt: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface MindMapSeedPayload {
  seedId: string;
  title: string;
  topicTag: string;
  cefrLevel: string;
  points: string[];
  vocabWords?: Array<{ word: string; meaning: string }>;
}

export interface StudentCodeProgressRecord {
  id: string;
  studentId: string;
  studentName: string;
  ownerUid: string;
  studentEmail?: string;
  parentEmail?: string;
  xpPoints: number;
  completedChallengeIds: string[];
  earnedBadgeIds: string[];
  currentStreak: number;
  lastCompletedAt?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}



// ---------------------------------------------------------------------------
// CRM (admin only)
// ---------------------------------------------------------------------------

export type CrmContactType = 'lead' | 'parent' | 'student' | 'teacher' | 'partner';

export type CrmLifecycleStage = 'subscriber' | 'lead' | 'qualified' | 'opportunity' | 'customer' | 'alumni';

export type CrmLeadSource =
  | 'website'
  | 'signup'
  | 'zalo'
  | 'facebook'
  | 'referral'
  | 'walk_in'
  | 'event'
  | 'roster'
  | 'other';

export interface CrmContact {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  contactType: CrmContactType;
  lifecycleStage: CrmLifecycleStage;
  leadSource: CrmLeadSource;
  ownerEmail?: string;
  tags: string[];
  childNames?: string;
  notes?: string;
  linkedUid?: string;
  lastActivityAt?: string;
  createdByEmail: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type CrmDealStage = 'new' | 'contacted' | 'trial_booked' | 'trial_done' | 'offer' | 'won' | 'lost';

export interface CrmDeal {
  id: string;
  title: string;
  contactId: string;
  contactName: string;
  programId?: string;
  programTitle?: string;
  amountVnd: number;
  stage: CrmDealStage;
  expectedCloseDate?: string;
  ownerEmail?: string;
  lostReason?: string;
  createdByEmail: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type CrmActivityType = 'note' | 'call' | 'zalo' | 'email' | 'meeting' | 'stage_change' | 'approval';

export interface CrmActivity {
  id: string;
  contactId: string;
  dealId?: string;
  activityType: CrmActivityType;
  body: string;
  occurredAt: string;
  authorEmail: string;
  createdAt?: unknown;
}

export interface CrmTask {
  id: string;
  title: string;
  contactId?: string;
  contactName?: string;
  dealId?: string;
  dueDate: string;
  ownerEmail?: string;
  done: boolean;
  createdByEmail: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}
