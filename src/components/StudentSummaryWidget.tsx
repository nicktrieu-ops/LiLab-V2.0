import React from 'react';
import {
  ArrowRight,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Flag,
  GraduationCap,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { biText, formatVnd } from '../i18n';
import { formatAssessmentDateOption } from './StudentVisualAnalytics';
import {
  CEFR_LEVELS,
  formatCefrLabel,
  type GeminiNote,
  type LangCode,
  type ProgramCourse,
  type StudentAssessment,
  type StudentProfile,
  type TuitionInvoice,
} from '../types';

interface StudentSummaryWidgetProps {
  lang: LangCode;
  student: StudentProfile | null;
  studentNameFallback: string;
  assessments: StudentAssessment[];
  selectedAssessmentId: string;
  onSelectAssessment: (assessmentId: string) => void;
  programs: ProgramCourse[];
  geminiNotes: GeminiNote[];
  invoices: TuitionInvoice[];
  completedChecklist: Record<string, boolean>;
  onNavigateTab: (tab: 'dashboard' | 'calendar' | 'activities' | 'resources' | 'enroll' | 'billing') => void;
}

interface MilestoneDeadlineItem {
  id: string;
  titleEn: string;
  titleVi: string;
  subtitleEn: string;
  subtitleVi: string;
  dueDateStr: string;
  daysUntil: number;
  category: 'cefr' | 'curriculum' | 'project' | 'billing';
  status: 'completed' | 'upcoming' | 'urgent';
  actionTab?: 'dashboard' | 'calendar' | 'activities' | 'resources' | 'enroll' | 'billing';
  actionLabelEn?: string;
  actionLabelVi?: string;
}

function addDaysToIso(baseDate: Date, daysToAdd: number): string {
  const d = new Date(baseDate.getTime());
  d.setDate(d.getDate() + daysToAdd);
  return d.toISOString().slice(0, 10);
}

function computeAssessmentAverages(a: StudentAssessment) {
  const eng = Math.round(
    (a.speakingScore +
      a.readingScore +
      a.writingScore +
      (a.vocabularyScore ?? 0) +
      (a.comprehensionScore ?? 0)) /
      5
  );
  const whole = Math.round((a.socialScore + a.emotionalScore + a.mentalScore) / 3);
  const composite = Math.round((eng + whole) / 2);
  return { eng, whole, composite };
}

export const StudentSummaryWidget: React.FC<StudentSummaryWidgetProps> = ({
  lang,
  student,
  studentNameFallback,
  assessments,
  selectedAssessmentId,
  onSelectAssessment,
  programs,
  geminiNotes,
  invoices,
  completedChecklist,
  onNavigateTab,
}) => {
  const latest =
    assessments.find((a) => a.id === selectedAssessmentId) || assessments[0] || null;
  const latestIdx = latest ? assessments.findIndex((a) => a.id === latest.id) : -1;
  const previous =
    latestIdx >= 0 && latestIdx + 1 < assessments.length ? assessments[latestIdx + 1] : null;

  const currentCefrLevel = latest?.cefrLevel || student?.cefrLevel || 'Pre-A1 Starters';
  const currentCefrMod = latest?.cefrModifier || student?.cefrModifier || 'standard';
  const currentCefrDisplay = formatCefrLabel(currentCefrLevel, currentCefrMod);

  const cefrIndex = Math.max(
    0,
    CEFR_LEVELS.indexOf(currentCefrLevel as (typeof CEFR_LEVELS)[number])
  );
  const nextCefrLevel =
    cefrIndex < CEFR_LEVELS.length - 1
      ? CEFR_LEVELS[cefrIndex + 1]
      : CEFR_LEVELS[CEFR_LEVELS.length - 1];
  const cefrProgressPct = Math.min(
    100,
    Math.max(
      12,
      Math.round(
        ((cefrIndex + (currentCefrMod === '+' ? 0.85 : currentCefrMod === 'standard' ? 0.5 : 0.25)) /
          CEFR_LEVELS.length) *
          100
      )
    )
  );

  const latestAvgs = latest ? computeAssessmentAverages(latest) : null;
  const prevAvgs = previous ? computeAssessmentAverages(previous) : null;
  const compositeDelta =
    latestAvgs && prevAvgs ? latestAvgs.composite - prevAvgs.composite : null;
  const engDelta = latestAvgs && prevAvgs ? latestAvgs.eng - prevAvgs.eng : null;
  const wholeDelta = latestAvgs && prevAvgs ? latestAvgs.whole - prevAvgs.whole : null;

  // Build upcoming milestone deadlines
  const now = new Date();
  const checklistTotal = Object.keys(completedChecklist).length || 4;
  const checklistDoneCount = Object.values(completedChecklist).filter(Boolean).length;
  const allWeek01Done = checklistDoneCount >= checklistTotal;

  const nextCurriculumNote: GeminiNote | undefined =
    geminiNotes.find((n) => n.weekNumber > 1) || geminiNotes[0];

  const unpaidInvoices = invoices.filter(
    (inv) => inv.status === 'pending' || inv.status === 'overdue' || inv.status === 'reminder_sent'
  );

  const milestones: MilestoneDeadlineItem[] = [
    {
      id: 'ms-week01-tasks',
      titleEn: `Week 01 Be Whole Portfolio (${checklistDoneCount}/${checklistTotal} tasks)`,
      titleVi: `Bài tập Tuần 01 Be Whole (${checklistDoneCount}/${checklistTotal} nhiệm vụ)`,
      subtitleEn: allWeek01Done
        ? 'All Week 01 Kindness story, song & phonics tasks completed!'
        : 'Complete Story, Kindness Song, Phonics /k/ /h/ /sh/ & Sentence House',
      subtitleVi: allWeek01Done
        ? 'Đã hoàn thành trọn vẹn Truyện, Bài hát, Ngữ âm & Ngôi nhà Câu Tuần 01!'
        : 'Hoàn thành Truyện đọc, Bài hát Lòng Tốt, Ngữ âm & Ngôi nhà Câu',
      dueDateStr: addDaysToIso(now, 4),
      daysUntil: 4,
      category: 'curriculum',
      status: allWeek01Done ? 'completed' : 'upcoming',
      actionTab: 'activities',
      actionLabelEn: allWeek01Done ? 'Review Week 01' : 'Finish Tasks',
      actionLabelVi: allWeek01Done ? 'Xem lại Tuần 01' : 'Làm bài tập',
    },
    {
      id: 'ms-oral-Check',
      titleEn: nextCurriculumNote
        ? `Week 0${nextCurriculumNote.weekNumber} Reading & Oral Storytelling Check`
        : 'Cambridge Speaking & Phonics Milestone Check',
      titleVi: nextCurriculumNote
        ? `Kiểm tra Kể chuyện & Ngữ âm Tuần 0${nextCurriculumNote.weekNumber}`
        : 'Cột mốc Đánh giá Nói & Ngữ âm Cambridge',
      subtitleEn: `Target fluency benchmark for ${currentCefrDisplay} class cohort`,
      subtitleVi: `Đánh giá kỹ năng nói & phản xạ từ vựng cấp độ ${currentCefrDisplay}`,
      dueDateStr: addDaysToIso(now, 11),
      daysUntil: 11,
      category: 'project',
      status: 'upcoming',
      actionTab: 'resources',
      actionLabelEn: 'Resource Library',
      actionLabelVi: 'Thư viện Học liệu',
    },
    {
      id: 'ms-cefr-benchmark',
      titleEn: `Mid-Term CEFR Progression Evaluation → ${nextCefrLevel}`,
      titleVi: `Đánh giá Tiến độ CEFR Giữa kỳ → ${nextCefrLevel}`,
      subtitleEn: `8-Axis Cambridge English & Whole-Child Values Rubric evaluation`,
      subtitleVi: `Đánh giá toàn diện 8 trục Tiếng Anh Cambridge & Giá trị Sống`,
      dueDateStr: addDaysToIso(now, 21),
      daysUntil: 21,
      category: 'cefr',
      status: 'upcoming',
    },
  ];

  if (unpaidInvoices.length > 0) {
    const nextInv = unpaidInvoices[0];
    const parsedDue = Date.parse(nextInv.dueDate);
    const diffDays = !Number.isNaN(parsedDue)
      ? Math.max(0, Math.ceil((parsedDue - now.getTime()) / (1000 * 60 * 60 * 24)))
      : 7;
    milestones.push({
      id: `ms-inv-${nextInv.id}`,
      titleEn: `Tuition Milestone: ${nextInv.programTitle}`,
      titleVi: `Hạn đóng Học phí: ${nextInv.programTitle}`,
      subtitleEn: `Invoice ${nextInv.invoiceNumber} · ${formatVnd(nextInv.amountVnd)}`,
      subtitleVi: `Hóa đơn ${nextInv.invoiceNumber} · ${formatVnd(nextInv.amountVnd)}`,
      dueDateStr: nextInv.dueDate || addDaysToIso(now, 7),
      daysUntil: diffDays,
      category: 'billing',
      status: nextInv.status === 'overdue' || diffDays <= 3 ? 'urgent' : 'upcoming',
      actionTab: 'billing',
      actionLabelEn: 'Pay Invoice',
      actionLabelVi: 'Thanh toán',
    });
  } else {
    const nextProg = programs[0];
    milestones.push({
      id: 'ms-term-showcase',
      titleEn: nextProg
        ? `End-of-Term Be Whole Showcase (${nextProg.code})`
        : 'End-of-Term Whole-Child Values Showcase',
      titleVi: nextProg
        ? `Ngày hội Tổng kết Học kỳ (${nextProg.code})`
        : 'Ngày hội Tổng kết Giá trị Sống Cuối kỳ',
      subtitleEn: 'Parent-student bilingual presentation & certificate ceremony',
      subtitleVi: 'Thuyết trình song ngữ cùng Phụ huynh & Trao chứng nhận CEFR',
      dueDateStr: addDaysToIso(now, 35),
      daysUntil: 35,
      category: 'project',
      status: 'upcoming',
      actionTab: 'enroll',
      actionLabelEn: 'View Courses',
      actionLabelVi: 'Xem khóa học',
    });
  }

  const skillPills = latest
    ? [
        { label: biText(lang, 'Speaking', 'Nói'), score: latest.speakingScore, group: 'eng' },
        { label: biText(lang, 'Reading', 'Đọc'), score: latest.readingScore, group: 'eng' },
        { label: biText(lang, 'Writing', 'Viết'), score: latest.writingScore, group: 'eng' },
        { label: biText(lang, 'Vocabulary', 'Từ vựng'), score: latest.vocabularyScore ?? 0, group: 'eng' },
        { label: biText(lang, 'Listening', 'Nghe hiểu'), score: latest.comprehensionScore ?? 0, group: 'eng' },
        { label: biText(lang, 'Social', 'Xã hội'), score: latest.socialScore, group: 'whole' },
        { label: biText(lang, 'Emotional', 'Cảm xúc'), score: latest.emotionalScore, group: 'whole' },
        { label: biText(lang, 'Mental', 'Tinh thần'), score: latest.mentalScore, group: 'whole' },
      ]
    : [];

  return (
    <section
      aria-label="Student Summary Widget"
      className="bg-white border border-[#2D3E99]/15 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5 no-print"
    >
      {/* Top Widget Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#2D3E99]/10 pb-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#E61E64]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>
              {biText(
                lang,
                'Student Summary Widget · Live CEFR & Milestone Tracker',
                'Tóm tắt Học viên · Điểm CEFR Gần đây & Cột mốc Sắp tới'
              )}
            </span>
          </div>
          <h3 className="font-display text-xl sm:text-2xl font-extrabold text-[#2D3E99]">
            {student ? student.fullName : studentNameFallback}
          </h3>
        </div>

        {/* CEFR Progression Pill & Ladder Bar */}
        <div className="flex flex-wrap items-center gap-3 bg-[#FDF9EE] border border-[#2D3E99]/15 rounded-xl px-4 py-2.5">
          <div>
            <div className="text-[11px] font-semibold text-[#172154]/65">
              {biText(lang, 'Current CEFR → Next Target', 'Cấp độ CEFR Hiện tại → Mục tiêu Tiếp theo')}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-mono-num text-sm font-extrabold text-[#E61E64]">
                {currentCefrDisplay}
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-[#172154]/50" />
              <span className="font-mono-num text-sm font-bold text-[#2D3E99]">
                {nextCefrLevel}
              </span>
            </div>
          </div>
          <div className="w-24 sm:w-28">
            <div className="flex items-center justify-between text-[10px] font-mono-num font-bold text-[#172154]/70 mb-1">
              <span>CEFR Path</span>
              <span>{cefrProgressPct}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-[#2D3E99]/12 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#E61E64] via-[#FFD41D] to-[#2D3E99]"
                style={{ width: `${cefrProgressPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main 2-Column Summary Box: Recent CEFR Scores (Left) + Upcoming Milestone Deadlines (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (7 cols): RECENT CEFR ASSESSMENT SCORES */}
        <div className="lg:col-span-7 bg-[#FDF9EE]/70 border border-[#2D3E99]/12 rounded-xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-[#E61E64]" />
              <h4 className="font-display text-base font-bold text-[#2D3E99]">
                {biText(
                  lang,
                  'Recent CEFR Assessment Scores',
                  'Điểm Đánh giá CEFR Gần đây'
                )}
              </h4>
            </div>
            {latest && (
              <span className="text-xs font-semibold text-[#172154]/70">
                {latest.className} · {latest.termLabel}
              </span>
            )}
          </div>

          {latest && latestAvgs ? (
            <>
              {/* 3 Headline Score KPI Boxes */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white border border-[#2D3E99]/12 rounded-xl p-3">
                  <div className="text-[11px] font-semibold text-[#172154]/65">
                    {biText(lang, 'Composite Avg', 'Điểm Tổng hợp')}
                  </div>
                  <div className="flex items-baseline justify-between gap-1 mt-1">
                    <span className="font-mono-num text-xl sm:text-2xl font-extrabold text-[#2D3E99]">
                      {latestAvgs.composite}
                      <span className="text-xs font-normal text-[#172154]/50">/100</span>
                    </span>
                    {compositeDelta !== null && (
                      <span
                        className={`text-xs font-mono-num font-bold flex items-center gap-0.5 ${
                          compositeDelta >= 0 ? 'text-[#0F766E]' : 'text-[#E61E64]'
                        }`}
                      >
                        <TrendingUp className="w-3 h-3" />
                        {compositeDelta >= 0 ? `+${compositeDelta}` : compositeDelta}
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-white border border-[#2D3E99]/12 rounded-xl p-3">
                  <div className="text-[11px] font-semibold text-[#172154]/65">
                    {biText(lang, '5-Skill English', '5 Kỹ năng Anh ngữ')}
                  </div>
                  <div className="flex items-baseline justify-between gap-1 mt-1">
                    <span className="font-mono-num text-xl sm:text-2xl font-extrabold text-[#E61E64]">
                      {latestAvgs.eng}
                      <span className="text-xs font-normal text-[#172154]/50">/100</span>
                    </span>
                    {engDelta !== null && (
                      <span
                        className={`text-xs font-mono-num font-bold ${
                          engDelta >= 0 ? 'text-[#0F766E]' : 'text-[#E61E64]'
                        }`}
                      >
                        {engDelta >= 0 ? `+${engDelta}` : engDelta}
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-white border border-[#2D3E99]/12 rounded-xl p-3">
                  <div className="text-[11px] font-semibold text-[#172154]/65">
                    {biText(lang, '3-Pillar Wellbeing', '3 Trụ cột Giá trị')}
                  </div>
                  <div className="flex items-baseline justify-between gap-1 mt-1">
                    <span className="font-mono-num text-xl sm:text-2xl font-extrabold text-[#0F766E]">
                      {latestAvgs.whole}
                      <span className="text-xs font-normal text-[#172154]/50">/100</span>
                    </span>
                    {wholeDelta !== null && (
                      <span
                        className={`text-xs font-mono-num font-bold ${
                          wholeDelta >= 0 ? 'text-[#0F766E]' : 'text-[#E61E64]'
                        }`}
                      >
                        {wholeDelta >= 0 ? `+${wholeDelta}` : wholeDelta}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 8-Skill Compact Progress Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {skillPills.map((sk) => (
                  <div
                    key={sk.label}
                    className="bg-white border border-[#2D3E99]/10 rounded-lg px-3 py-2 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#172154]/80 truncate">{sk.label}</span>
                      <span
                        className={`font-mono-num font-bold ${
                          sk.group === 'whole' ? 'text-[#0F766E]' : 'text-[#2D3E99]'
                        }`}
                      >
                        {sk.score}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          sk.group === 'whole' ? 'bg-[#56BEB8]' : 'bg-[#2D3E99]'
                        }`}
                        style={{ width: `${Math.max(6, Math.min(100, sk.score))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Recent Assessment Checkpoints Strip (up to 3 recent reports) */}
              {assessments.length > 0 && (
                <div className="pt-2 border-t border-[#2D3E99]/10 space-y-2">
                  <div className="text-[11px] font-bold text-[#172154]/65 uppercase tracking-wider">
                    {biText(
                      lang,
                      `Recent Published Checkpoints (${Math.min(3, assessments.length)} of ${assessments.length})`,
                      `Các kỳ đánh giá gần đây (${Math.min(3, assessments.length)}/${assessments.length})`
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {assessments.slice(0, 3).map((rep) => {
                      const avgs = computeAssessmentAverages(rep);
                      const isSelected = rep.id === latest.id;
                      return (
                        <button
                          key={rep.id}
                          type="button"
                          onClick={() => onSelectAssessment(rep.id)}
                          className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-[#2D3E99] text-white border-[#2D3E99]'
                              : 'bg-white text-[#172154] border-[#2D3E99]/15 hover:bg-[#FDF9EE]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 text-xs font-bold">
                            <span className="truncate">{rep.termLabel}</span>
                            <span
                              className={`font-mono-num px-1.5 py-0.5 rounded text-[11px] ${
                                isSelected
                                  ? 'bg-[#FFD41D] text-[#172154]'
                                  : 'bg-[#E61E64]/10 text-[#E61E64]'
                              }`}
                            >
                              {avgs.composite}%
                            </span>
                          </div>
                          <div
                            className={`text-[11px] font-mono-num mt-1 truncate ${
                              isSelected ? 'text-white/85' : 'text-[#172154]/65'
                            }`}
                          >
                            {formatCefrLabel(rep.cefrLevel, rep.cefrModifier)} ·{' '}
                            {formatAssessmentDateOption(rep, lang).split('·')[0]}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white border border-[#2D3E99]/12 rounded-xl p-4 space-y-2">
              <div className="text-sm font-bold text-[#2D3E99]">
                {biText(
                  lang,
                  `Baseline Level: ${currentCefrDisplay}`,
                  `Cấp độ Khởi điểm: ${currentCefrDisplay}`
                )}
              </div>
              <p className="text-xs text-[#172154]/75 leading-relaxed">
                {biText(
                  lang,
                  'No formal CEFR assessment scores have been published for this student yet. As soon as your LiLab teacher submits the first evaluation, all 8 skill & wellbeing scores will appear here.',
                  'Chưa có điểm đánh giá CEFR chính thức. Ngay khi giáo viên LiLab xuất bản báo cáo đầu tiên, điểm số 8 kỹ năng & giá trị sống sẽ hiển thị tại đây.'
                )}
              </p>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN (5 cols): UPCOMING MILESTONE DEADLINES */}
        <div className="lg:col-span-5 bg-[#FDF9EE]/70 border border-[#2D3E99]/12 rounded-xl p-4 sm:p-5 space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#2D3E99]" />
              <h4 className="font-display text-base font-bold text-[#2D3E99]">
                {biText(
                  lang,
                  'Upcoming Milestone Deadlines',
                  'Các Cột mốc & Thời hạn Sắp tới'
                )}
              </h4>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('calendar')}
              className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-[#2D3E99] text-white hover:bg-[#1f2c73] flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Calendar className="w-3 h-3 text-[#FFD41D]" />
              {biText(lang, 'Monthly Calendar', 'Lịch Tháng')}
            </button>
          </div>

          <div className="space-y-2.5">
            {milestones.map((ms) => {
              const badgeStyle =
                ms.status === 'completed'
                  ? 'bg-[#0F766E]/15 text-[#0F766E] border-[#0F766E]/30'
                  : ms.status === 'urgent'
                    ? 'bg-[#E61E64]/15 text-[#E61E64] border-[#E61E64]/30'
                    : 'bg-[#FFD41D]/30 text-[#172154] border-[#FFD41D]';

              const categoryIcon =
                ms.category === 'cefr' ? (
                  <Flag className="w-3.5 h-3.5 text-[#E61E64] shrink-0" />
                ) : ms.category === 'curriculum' ? (
                  <BookOpen className="w-3.5 h-3.5 text-[#2D3E99] shrink-0" />
                ) : (
                  <GraduationCap className="w-3.5 h-3.5 text-[#0F766E] shrink-0" />
                );

              return (
                <div
                  key={ms.id}
                  className="bg-white border border-[#2D3E99]/12 rounded-xl p-3.5 space-y-2 hover:border-[#2D3E99]/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {ms.status === 'completed' ? (
                        <CheckCircle2 className="w-4 h-4 text-[#0F766E] shrink-0" />
                      ) : (
                        categoryIcon
                      )}
                      <span className="text-xs sm:text-sm font-bold text-[#172154] leading-snug">
                        {biText(lang, ms.titleEn, ms.titleVi)}
                      </span>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-md text-[11px] font-mono-num font-bold border shrink-0 flex items-center gap-1 ${badgeStyle}`}
                    >
                      <Clock className="w-3 h-3" />
                      {ms.status === 'completed'
                        ? biText(lang, 'Done', 'Hoàn tất')
                        : biText(lang, `${ms.daysUntil}d left`, `Còn ${ms.daysUntil} ngày`)}
                    </span>
                  </div>

                  <p className="text-xs text-[#172154]/70 leading-relaxed">
                    {biText(lang, ms.subtitleEn, ms.subtitleVi)}
                  </p>

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 text-[11px]">
                    <span className="font-mono-num font-semibold text-[#172154]/60">
                      {biText(lang, 'Deadline:', 'Hạn mục tiêu:')} {ms.dueDateStr}
                    </span>

                    {ms.actionTab && ms.actionLabelEn && ms.actionLabelVi && (
                      <button
                        type="button"
                        onClick={() => onNavigateTab(ms.actionTab!)}
                        className="font-bold text-[#2D3E99] hover:text-[#E61E64] flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <span>{biText(lang, ms.actionLabelEn, ms.actionLabelVi)}</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
