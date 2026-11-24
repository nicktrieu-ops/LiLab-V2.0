import React, { lazy, Suspense, useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import {
  CheckCircle2,
  Lock,
  Printer,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { biText } from '../i18n';
import { isSuperAdminEmail } from '../services/seedData';
import type { StudentTab } from '../config/portalNavigation';
import { ErrorBoundary } from './ErrorBoundary';
import { HistoricalProgress } from './HistoricalProgress';
import { ProfileAvatar } from './ProfileAvatar';
import { StudentSummaryWidget } from './StudentSummaryWidget';
import { PortalLoader } from './ui/Primitives';

const AcademyEventCalendar = lazy(() =>
  import('./AcademyEventCalendar').then((m) => ({ default: m.AcademyEventCalendar }))
);
const CertificatesTab = lazy(() =>
  import('./CertificatesTab').then((m) => ({ default: m.CertificatesTab }))
);
const KidsAnimationStudio = lazy(() =>
  import('./KidsAnimationStudio').then((m) => ({ default: m.KidsAnimationStudio }))
);
const KidsVibeCodingLab = lazy(() =>
  import('./KidsVibeCodingLab').then((m) => ({ default: m.KidsVibeCodingLab }))
);
const LearningResourceLibrary = lazy(() =>
  import('./LearningResourceLibrary').then((m) => ({ default: m.LearningResourceLibrary }))
);
const ReadOnlyMaterialViewer = lazy(() =>
  import('./ReadOnlyMaterialViewer').then((m) => ({ default: m.ReadOnlyMaterialViewer }))
);
const StudentMindMapStudio = lazy(() =>
  import('./StudentMindMapStudio').then((m) => ({ default: m.StudentMindMapStudio }))
);
const StudentSpeakingLab = lazy(() =>
  import('./StudentSpeakingLab').then((m) => ({ default: m.StudentSpeakingLab }))
);
const StudentStudyNotes = lazy(() =>
  import('./StudentStudyNotes').then((m) => ({ default: m.StudentStudyNotes }))
);
import {
  assessmentToVisualScores,
  formatAssessmentDateOption,
  sortAssessmentsChronological,
  StudentVisualAnalytics,
  type VisualComparisonOverlay,
} from './StudentVisualAnalytics';
import {
  formatCefrLabel,
  type GeminiNote,
  type LangCode,
  type MindMapSeedPayload,
  type StudentAssessment,
  type StudentProfile,
  type UserProfile,
} from '../types';

interface StudentPortalProps {
  lang: LangCode;
  currentUser: UserProfile;
  activeTab?: StudentTab;
  onTabChange?: (tab: StudentTab) => void;
}

export const StudentPortal: React.FC<StudentPortalProps> = ({
  lang,
  currentUser,
  activeTab: controlledTab,
  onTabChange,
}) => {
  const [internalTab, setInternalTab] = useState<StudentTab>('studio');
  const activeTab: StudentTab = controlledTab ?? internalTab;
  const setActiveTab = (next: StudentTab) => {
    setInternalTab(next);
    onTabChange?.(next);
  };
  const [pendingMindMapSeed, setPendingMindMapSeed] = useState<MindMapSeedPayload | null>(null);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [assessments, setAssessments] = useState<StudentAssessment[]>([]);
  const [studentsLoaded, setStudentsLoaded] = useState(false);
  const [assessmentsLoaded, setAssessmentsLoaded] = useState(false);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('');
  const [compareMode, setCompareMode] = useState(false);
  const [compareFromId, setCompareFromId] = useState('');
  const [compareToId, setCompareToId] = useState('');
  const [geminiNotes, setGeminiNotes] = useState<GeminiNote[]>([]);
  const [activeReadOnlyNote, setActiveReadOnlyNote] = useState<{
    noteId: string;
    note?: GeminiNote | null;
    fallbackTitle?: string;
  } | null>(null);

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
    const isAdminPreview =
      isSuperAdmin || currentUser.role === 'super_admin' || currentUser.role === 'admin';
    const unsubs: Array<() => void> = [];

    const stuQuery = isAdminPreview
      ? collection(db, 'students')
      : query(collection(db, 'students'), where('studentEmail', '==', email));

    setStudentsLoaded(false);
    setAssessmentsLoaded(false);

    unsubs.push(
      onSnapshot(
        stuQuery,
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as StudentProfile));
          setStudents(list);
          if (list.length > 0 && !selectedStudentId) {
            setSelectedStudentId(list[0].id);
          }
          setStudentsLoaded(true);
        },
        (err) => {
          setStudentsLoaded(true);
          handleFirestoreError(err, OperationType.LIST, 'students');
        }
      )
    );

    const asmQuery = isAdminPreview
      ? collection(db, 'assessments')
      : query(collection(db, 'assessments'), where('studentEmail', '==', email));

    unsubs.push(
      onSnapshot(
        asmQuery,
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
      const fallback =
        studentAssessments.find((a) => a.id !== (hasTo ? compareToId : newest.id)) || earlier;
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

  const handlePrintStudentPdf = async () => {
    const { buildPrintableReportFromAssessment, exportStudentReportPdf } = await import(
      '../services/pdfReportGenerator'
    );
    const targetAssessment = isComparingValid && compareToReport ? compareToReport : latestReport;
    const studentName = activeStudent ? activeStudent.fullName : currentUser.displayName;
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
  };

  const companionImg =
    activeStudent?.gender === 'boy' ? '/assets/media/lila_boy.webp' : '/assets/media/lila_girl.webp';

  return (
    <div className="space-y-6">
      {/* Slim Student Switcher only when multiple profiles exist (top navigation lives in the unified header) */}
      {students.length > 1 && (
        <div className="flex flex-wrap items-center justify-end gap-3 pb-3 border-b border-[#172154]/10 no-print">
          {activeStudent && (
            <ProfileAvatar
              src={activeStudent.photoUrl}
              fallbackSrc={companionImg}
              name={activeStudent.fullName}
              size="sm"
            />
          )}
          <label className="text-xs font-semibold text-[#525E80]">
            {biText(lang, 'Student Profile:', 'Hồ sơ Học viên:')}
          </label>
          <select
            value={activeStudent?.id || ''}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-[#172154]/15 bg-white text-xs font-semibold text-[#172154]"
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName} · {formatCefrLabel(s.cefrLevel, s.cefrModifier)}
              </option>
            ))}
          </select>
        </div>
      )}

      <ErrorBoundary
        key={activeTab}
        variant="section"
        sectionLabel={biText(lang, 'Student Portal', 'Cổng Học viên')}
      >
        <Suspense
          fallback={
            <PortalLoader
              label={biText(lang, 'Loading student view…', 'Đang tải mục học viên…')}
            />
          }
        >
      {/* TAB: INTERACTIVE CEFR SPEAKING LAB */}
      {activeTab === 'speaking' && (
        <StudentSpeakingLab
          lang={lang}
          currentUser={currentUser}
          student={activeStudent}
        />
      )}

      {/* TAB: KIDS ANIMATION STUDIO */}
      {activeTab === 'studio' && (
        <KidsAnimationStudio
          lang={lang}
          currentUser={currentUser}
          student={activeStudent}
        />
      )}

      {/* TAB: VIBE CODING LAB (BUILD REAL APPS) */}
      {activeTab === 'vibe' && (
        <KidsVibeCodingLab
          lang={lang}
          currentUser={currentUser}
          student={activeStudent}
        />
      )}

      {/* TAB: INTERACTIVE MIND MAP STUDIO */}
      {activeTab === 'mindmap' && (
        <StudentMindMapStudio
          lang={lang}
          currentUser={currentUser}
          student={activeStudent}
          incomingSeed={pendingMindMapSeed}
          onConsumeSeed={() => setPendingMindMapSeed(null)}
        />
      )}

      {/* TAB: SLEEK LESSON NOTE-TAKING TOOL (MY STUDY NOTES) */}
      {activeTab === 'notes' && (
        <StudentStudyNotes
          lang={lang}
          currentUser={currentUser}
          student={activeStudent}
          onConvertToMindMap={(seed) => {
            setPendingMindMapSeed(seed);
            setActiveTab('mindmap');
          }}
        />
      )}

      {/* Clean Compact Student Strip (shown on Resources / Calendar / Reports tabs only) */}
      {(activeTab === 'resources' || activeTab === 'calendar' || activeTab === 'reports') && (
        <div className="bg-white border border-[#172154]/10 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-4">
            <ProfileAvatar
              src={activeStudent?.photoUrl}
              fallbackSrc={companionImg}
              name={activeStudent ? activeStudent.fullName : currentUser.displayName}
              size="lg"
            />
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#FF6B00]">
                {biText(lang, 'LiLab Student Portal', 'Cổng Học viên LiLab')}
              </div>
              <h2 className="font-display text-lg sm:text-xl font-bold text-[#172154]">
                {activeStudent
                  ? activeStudent.fullName
                  : biText(lang, 'My Class Materials & Reports', 'Tài liệu Lớp học & Báo cáo')}
              </h2>
              <p className="text-xs text-[#525E80] mt-0.5 font-mono-num">
                {activeStudent
                  ? formatCefrLabel(activeStudent.cefrLevel, activeStudent.cefrModifier)
                  : 'Pre-A1 Starters'}{' '}
                · {biText(lang, 'Focus, create & grow every day', 'Tập trung, sáng tạo & tiến bộ mỗi ngày')}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setActiveReadOnlyNote({
                  noteId: 'note_be_whole_week_01',
                  fallbackTitle: biText(
                    lang,
                    'Week 01 · Kindness Class Workbook (Read-Only)',
                    'Giáo trình Lớp học Tuần 01 · Lòng Tốt (Chỉ đọc)'
                  ),
                })
              }
              className="px-4 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#E05A00] text-white text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              {biText(lang, 'Open Class Workbook', 'Mở Giáo trình Lớp học')}
            </button>
          </div>
        </div>
      )}

      {/* TAB 1: RESOURCE LIBRARY & ASSIGNED HOMEWORK */}
      {activeTab === 'resources' && (
        <div className="space-y-6">
          <LearningResourceLibrary
            lang={lang}
            student={activeStudent}
            geminiNotes={geminiNotes}
            currentUser={currentUser}
            portalRole="student"
            onOpenReadOnlyNote={setActiveReadOnlyNote}
          />

          {/* Synthesized Class Workbooks & Home Practice Checklist */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-4 border-t border-[#2D3E99]/12">
            <div className="lg:col-span-5 bg-white border border-[#2D3E99]/12 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#E61E64]">
                  {biText(lang, 'WEEK 01 · HOME PRACTICE', 'TUẦN 01 · THỰC HÀNH TẠI NHÀ')}
                </span>
                <span className="font-mono-num text-xs font-semibold px-2.5 py-1 rounded bg-[#FFD41D]/30 text-[#172154]">
                  Pre-A1 → A1
                </span>
              </div>
              <h3 className="font-display text-xl font-bold text-[#2D3E99]">
                {biText(
                  lang,
                  'Kindness · The Lion and the Mouse',
                  'Lòng Tốt (Kindness) · Sư Tử và Chuột Nhắt'
                )}
              </h3>
              <p className="text-xs text-[#172154]/75 leading-relaxed">
                {biText(
                  lang,
                  'Check off each activity as you practice English and Kindness values at home this week.',
                  'Đánh dấu từng hoạt động khi em luyện tập Tiếng Anh và giá trị Lòng Tốt tại nhà trong tuần này.'
                )}
              </p>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() =>
                    setActiveReadOnlyNote({
                      noteId: 'note_be_whole_week_01',
                      fallbackTitle: biText(
                        lang,
                        'Week 01 · Kindness (Be Whole)',
                        'Tuần 01 · Lòng Tốt (Be Whole)'
                      ),
                    })
                  }
                  className="w-full py-2.5 px-4 rounded-xl bg-[#2D3E99] text-white text-xs font-semibold hover:bg-[#22317d] transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5 text-[#FFD41D]" />
                  {biText(
                    lang,
                    'Open Full Week 01 Material (Read-Only)',
                    'Mở Toàn bộ Giáo trình Tuần 01 (Chỉ đọc)'
                  )}
                </button>
              </div>

              <div className="space-y-2.5 pt-2">
                {[
                  {
                    key: 'story',
                    en: 'Story Retelling: Act out "The Lion and the Mouse" in English',
                    vi: 'Kể chuyện: Đóng vai "Sư Tử và Chuột Nhắt" bằng tiếng Anh',
                  },
                  {
                    key: 'song',
                    en: 'Sing the Kindness Song & practice polite offers ("Can I help you?")',
                    vi: 'Hát bài ca Lòng Tốt & thực hành câu đề nghị lịch sự ("Can I help you?")',
                  },
                  {
                    key: 'phonics',
                    en: 'Phonics Drill: Short vowels /æ/, /e/, /ɪ/ & sight words',
                    vi: 'Luyện ngữ âm: Nguyên âm ngắn /æ/, /e/, /ɪ/ & từ vựng cốt lõi',
                  },
                  {
                    key: 'house',
                    en: 'Daily Kindness Log: Complete 3 kind actions at home',
                    vi: 'Nhật ký Việc tốt: Thực hiện 3 hành động tử tế giúp đỡ gia đình',
                  },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex items-start gap-3 p-3 rounded-lg bg-[#FDF9EE] border border-[#2D3E99]/10 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(completedChecklist[item.key])}
                      onChange={(e) =>
                        setCompletedChecklist((prev) => ({
                          ...prev,
                          [item.key]: e.target.checked,
                        }))
                      }
                      className="mt-0.5 rounded"
                    />
                    <span className="text-xs font-medium text-[#172154]">
                      {biText(lang, item.en, item.vi)}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="lg:col-span-7 bg-white border border-[#2D3E99]/12 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-bold text-[#2D3E99]">
                  {biText(
                    lang,
                    'Class Study Notes & Read-Only Workbooks',
                    'Tài liệu Bài giảng & Giáo trình Lớp học (Chỉ đọc)'
                  )}
                </h3>
                <span className="text-xs font-mono-num font-semibold text-[#E61E64]">
                  {geminiNotes.length} {biText(lang, 'modules', 'chuyên đề')}
                </span>
              </div>

              {geminiNotes.length === 0 ? (
                <p className="text-sm text-[#172154]/60">
                  {biText(
                    lang,
                    'No synthesized class study notes uploaded yet.',
                    'Chưa có tài liệu bài giảng nào được tải lên.'
                  )}
                </p>
              ) : (
                <div className="space-y-4">
                  {geminiNotes.map((n) => (
                    <div
                      key={n.id}
                      className="p-4 rounded-xl bg-[#FDF9EE] border border-[#2D3E99]/12 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-[#2D3E99]">
                          Week {n.weekNumber}: {n.title}
                        </span>
                        <span className="text-xs font-mono-num text-[#E61E64]">
                          {n.programTitle}
                        </span>
                      </div>
                      <p className="text-xs text-[#172154]/80">
                        {biText(lang, n.summaryEn || '', n.summaryVi || '')}
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {n.keyVocabulary?.map((w, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded bg-white border border-[#2D3E99]/15 text-[11px] font-medium"
                          >
                            {w}
                          </span>
                        ))}
                      </div>
                      <div className="text-xs text-[#172154]/70 pt-1">
                        <strong>{lang === 'vi' ? 'Hoạt động:' : 'Activities:'}</strong>{' '}
                        {biText(lang, n.activitiesEn || '', n.activitiesVi || '')}
                      </div>
                      <div className="pt-2 flex items-center justify-between border-t border-[#2D3E99]/10">
                        <span className="text-[11px] text-[#172154]/60 flex items-center gap-1 font-medium">
                          <CheckCircle2 className="w-3 h-3 text-[#2D3E99]" />
                          {biText(
                            lang,
                            'Protected Read-Only Class Material',
                            'Tài liệu lớp học bảo vệ bản quyền (Chỉ đọc)'
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveReadOnlyNote({
                              noteId: n.id,
                              note: n,
                            })
                          }
                          className="px-3 py-1.5 rounded-lg bg-[#2D3E99] text-white text-xs font-semibold hover:bg-[#22317d] transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <Lock className="w-3 h-3 text-[#FFD41D]" />
                          {biText(lang, 'View Read-Only Material', 'Xem Tài liệu (Chỉ đọc)')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ACADEMY EVENT CALENDAR */}
      {activeTab === 'calendar' && (
        <AcademyEventCalendar
          lang={lang}
          portalMode="parent_student"
          currentUser={currentUser}
          student={activeStudent}
          students={students}
          assessments={studentAssessments}
        />
      )}

      {/* TAB 3: STUDENT REPORTS */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
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
            programs={[]}
            geminiNotes={geminiNotes}
            invoices={[]}
            completedChecklist={completedChecklist}
            onNavigateTab={(tab) =>
              setActiveTab(tab === 'activities' || tab === 'resources' ? 'resources' : 'reports')
            }
          />

          <div className="bg-white border border-[#2D3E99]/12 rounded-2xl p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#2D3E99]/10 pb-4 no-print">
              <div className="flex items-center gap-3.5">
                <ProfileAvatar
                  src={activeStudent?.photoUrl}
                  fallbackSrc={
                    activeStudent?.gender === 'boy' ? '/assets/lila_boy.png' : '/assets/lila_girl.png'
                  }
                  name={activeStudent ? activeStudent.fullName : currentUser.displayName}
                  size="lg"
                />
                <div>
                  <div className="text-xs font-semibold text-[#E61E64]">
                    {biText(
                      lang,
                      'Official Cambridge CEFR & Be Whole Progress Report',
                      'Báo cáo Tiến độ Chính thức Cambridge CEFR & Be Whole'
                    )}
                  </div>
                  <h2 className="font-display text-xl sm:text-2xl font-bold text-[#2D3E99]">
                    {activeStudent ? activeStudent.fullName : currentUser.displayName}
                  </h2>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {studentAssessments.length > 0 && (
                  <select
                    value={latestReport?.id || ''}
                    onChange={(e) => setSelectedAssessmentId(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-[#2D3E99]/20 bg-[#FDF9EE] text-xs font-semibold"
                  >
                    {studentAssessments.map((a) => (
                      <option key={a.id} value={a.id}>
                        {formatAssessmentDateOption(a, lang)} ·{' '}
                        {formatCefrLabel(a.cefrLevel, a.cefrModifier)}
                      </option>
                    ))}
                  </select>
                )}

                {studentAssessments.length >= 2 && (
                  <button
                    type="button"
                    onClick={() => setCompareMode((v) => !v)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                      compareMode
                        ? 'bg-[#E61E64] text-white border-[#E61E64]'
                        : 'bg-white text-[#2D3E99] border-[#2D3E99]/25 hover:bg-[#FDF9EE]'
                    }`}
                  >
                    {biText(lang, 'Compare Assessments', 'So sánh Đánh giá')}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => void handlePrintStudentPdf()}
                  className="px-3.5 py-2 rounded-lg bg-[#2D3E99] text-white text-xs font-semibold hover:bg-[#22317d] transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  {biText(lang, 'Print / Export PDF', 'In / Xuất PDF')}
                </button>
              </div>
            </div>

            {(() => {
              const displayReport = isComparingValid && compareToReport ? compareToReport : latestReport;
              const liveScores = displayReport
                ? assessmentToVisualScores(displayReport)
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
              const liveCefr = displayReport
                ? formatCefrLabel(displayReport.cefrLevel, displayReport.cefrModifier)
                : activeStudent
                  ? formatCefrLabel(activeStudent.cefrLevel, activeStudent.cefrModifier)
                  : 'Pre-A1 Starters';
              const liveTermLabel =
                isComparingValid && compareFromReport && compareToReport
                  ? `${formatAssessmentDateOption(compareFromReport, lang)} → ${formatAssessmentDateOption(compareToReport, lang)}`
                  : displayReport
                    ? `${displayReport.className} · ${displayReport.termLabel}`
                    : biText(lang, 'Awaiting First Report', 'Chờ báo cáo đầu tiên');

              return (
                <StudentVisualAnalytics
                  lang={lang}
                  studentName={activeStudent ? activeStudent.fullName : currentUser.displayName}
                  cefrDisplay={liveCefr}
                  termLabel={liveTermLabel}
                  scores={liveScores}
                  comparisonOverlay={visualComparisonOverlay}
                  isBaseline={!isComparingValid && !latestReport}
                />
              );
            })()}

            {latestReport ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-[#2D3E99]/10">
                <div className="p-4 rounded-xl bg-[#FDF9EE] border border-[#2D3E99]/12 space-y-1.5">
                  <div className="text-xs font-semibold text-[#2D3E99]">
                    {biText(
                      lang,
                      `Teacher Feedback (${latestReport.teacherName})`,
                      `Nhận xét của Giáo viên (${latestReport.teacherName})`
                    )}
                  </div>
                  <p className="text-sm text-[#172154]/85 leading-relaxed">
                    {lang === 'vi'
                      ? latestReport.teacherCommentVi || latestReport.teacherCommentEn
                      : latestReport.teacherCommentEn || latestReport.teacherCommentVi}
                  </p>
                </div>

                {(latestReport.aiInsightEn || latestReport.aiInsightVi) && (
                  <div className="p-4 rounded-xl bg-[#56BEB8]/12 border border-[#56BEB8]/40 space-y-1.5">
                    <div className="text-xs font-semibold text-[#172154]">
                      {biText(lang, 'Personalized Study Coach Insight', 'Gợi ý Học tập Cá nhân hóa')}
                    </div>
                    <p className="text-sm text-[#172154]/85 leading-relaxed">
                      {lang === 'vi'
                        ? latestReport.aiInsightVi || latestReport.aiInsightEn
                        : latestReport.aiInsightEn || latestReport.aiInsightVi}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-[#FDF9EE] border border-[#2D3E99]/12 text-xs text-[#172154]/80">
                {biText(
                  lang,
                  'No published CEFR evaluation reports yet. Once your teacher publishes an assessment, your scores and feedback will appear here.',
                  'Chưa có báo cáo đánh giá CEFR nào được xuất bản. Khi giáo viên xuất bản đánh giá, điểm số và nhận xét sẽ hiển thị tại đây.'
                )}
              </div>
            )}
          </div>

          <HistoricalProgress
            lang={lang}
            currentUser={currentUser}
            scopeRole="student"
            studentId={activeStudent?.id}
            studentName={activeStudent ? activeStudent.fullName : currentUser.displayName}
            studentPhotoUrl={activeStudent?.photoUrl}
            studentGender={activeStudent?.gender}
          />
        </div>
      )}

      {activeTab === 'certificates' && (
        <CertificatesTab
          lang={lang}
          roleMode="student"
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
