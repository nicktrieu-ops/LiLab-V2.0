import React, { useEffect } from 'react';
import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Globe,
  GraduationCap,
  Layers,
  MapPin,
  Mic,
  Music,
  QrCode,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { biText, formatVnd } from '../i18n';
import type { PceLevelCourse } from '../data/pceCurriculumData';
import type { EnrollmentRequest, LangCode, ProgramCourse, StudentProfile } from '../types';

export interface CourseDetailSelection {
  program: ProgramCourse;
  pceLevel?: PceLevelCourse | null;
  categoryLabelEn?: string;
  categoryLabelVi?: string;
  highlightsEn?: string[];
  highlightsVi?: string[];
  showcaseEn?: string;
  showcaseVi?: string;
}

interface ParentCourseDetailModalProps {
  lang: LangCode;
  selection: CourseDetailSelection;
  activeStudent: StudentProfile | null;
  existingEnrollment: EnrollmentRequest | null;
  enrollNotes: string;
  onChangeEnrollNotes: (value: string) => void;
  onClose: () => void;
  onProceedToCheckout: (program: ProgramCourse) => void;
  busy?: boolean;
}

export const ParentCourseDetailModal: React.FC<ParentCourseDetailModalProps> = ({
  lang,
  selection,
  activeStudent,
  existingEnrollment,
  enrollNotes,
  onChangeEnrollNotes,
  onClose,
  onProceedToCheckout,
  busy = false,
}) => {
  const { program, pceLevel } = selection;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const titleDisplay =
    lang === 'vi'
      ? program.titleVi || program.titleEn
      : lang === 'en'
        ? program.titleEn
        : `${program.titleVi || program.titleEn} / ${program.titleEn}`;

  const descEn = program.descriptionEn || pceLevel?.summaryEn || '';
  const descVi = program.descriptionVi || pceLevel?.summaryVi || '';

  const perSessionVnd =
    program.weeksCount > 0
      ? Math.round(
          program.tuitionVnd /
            (pceLevel ? pceLevel.durationWeeks * pceLevel.sessionsPerWeek : program.weeksCount)
        )
      : null;

  const isMusic = program.code === 'MP-01' || program.id === 'prog_music_poetry';
  const isCulture = program.code === 'CE-01' || program.id === 'prog_cultural_exploration';
  const isMc = program.code === 'MC-01' || program.id === 'prog_mc_skills';

  const headerIcon = isMusic ? (
    <Music className="w-5 h-5 text-[#FF6B00]" />
  ) : isCulture ? (
    <Globe className="w-5 h-5 text-[#0D9488]" />
  ) : isMc ? (
    <Mic className="w-5 h-5 text-[#E61E64]" />
  ) : (
    <GraduationCap className="w-5 h-5 text-[#2D3E99]" />
  );

  const highlightsEn =
    selection.highlightsEn && selection.highlightsEn.length > 0
      ? selection.highlightsEn
      : pceLevel
        ? [
            `Cambridge & CEFR alignment: ${pceLevel.cefrBand} (${pceLevel.cambridgeMilestoneEn})`,
            `Structured ${pceLevel.durationWeeks}-week progression (${pceLevel.hoursPerLevel} guided classroom hours)`,
            `Official curriculum textbooks: ${pceLevel.textbooks.map((t) => t.title).join(' + ')}`,
            `Small-group interactive coaching with ongoing parent progress reports & 9-Pillar character growth`,
          ]
        : [
            `Small-group interactive learning (max ${program.maxClassSize || 10} students per class)`,
            `Target proficiency level: ${program.cefrTarget}`,
            `Recommended age group: ${program.ageRange}`,
            `Continuous teacher feedback and bilingual parent updates in the LiLab Portal`,
          ];

  const highlightsVi =
    selection.highlightsVi && selection.highlightsVi.length > 0
      ? selection.highlightsVi
      : pceLevel
        ? [
            `Chuẩn Cambridge & CEFR: ${pceLevel.cefrBand} (${pceLevel.cambridgeMilestoneVi})`,
            `Lộ trình chuẩn ${pceLevel.durationWeeks} tuần (${pceLevel.hoursPerLevel} giờ học tương tác trực tiếp)`,
            `Giáo trình bản quyền: ${pceLevel.textbooks.map((t) => t.title).join(' + ')}`,
            `Lớp sĩ số nhỏ kèm báo cáo tiến độ định kỳ & phát triển 9 phẩm chất tích cực cho phụ huynh`,
          ]
        : [
            `Lớp học sĩ số nhỏ tương tác sâu (tối đa ${program.maxClassSize || 10} học viên/lớp)`,
            `Mục tiêu trình độ: ${program.cefrTarget}`,
            `Độ tuổi phù hợp: ${program.ageRange}`,
            `Cập nhật tiến độ học tập song ngữ định kỳ trên Cổng Phụ huynh LiLab`,
          ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#172154]/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="course-detail-modal-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-[#172154]/12 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Header */}
        <div className="bg-[#172154] text-white px-5 sm:px-7 py-5 flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-start gap-3.5 min-w-0">
            {pceLevel?.lilabCharacterImg ? (
              <img
                src={pceLevel.lilabCharacterImg}
                alt={program.titleEn}
                className="w-14 h-14 rounded-xl bg-white/95 p-1.5 object-contain shrink-0 border border-white/25"
              />
            ) : (
              <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm">
                {headerIcon}
              </div>
            )}

            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wider">
                <span className="px-2 py-0.5 rounded-md bg-white/15 text-white font-mono">
                  {program.code}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-[#FF6B00] text-white">
                  {selection.categoryLabelEn
                    ? biText(
                        lang,
                        selection.categoryLabelEn,
                        selection.categoryLabelVi || selection.categoryLabelEn
                      )
                    : program.promoBadgeEn
                      ? biText(
                          lang,
                          program.promoBadgeEn,
                          program.promoBadgeVi || program.promoBadgeEn
                        )
                      : biText(lang, 'LILAB OFFICIAL COURSE', 'KHÓA HỌC CHÍNH THỨC LILAB')}
                </span>
                {program.cefrTarget && (
                  <span className="text-white/80 font-semibold normal-case tracking-normal">
                    {program.cefrTarget}
                  </span>
                )}
              </div>

              <h3
                id="course-detail-modal-title"
                className="font-display text-lg sm:text-xl font-extrabold leading-snug text-white"
              >
                {titleDisplay}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={biText(lang, 'Close course details', 'Đóng chi tiết khóa học')}
            className="w-9 h-9 rounded-full bg-white/12 hover:bg-white/22 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-5 space-y-5 bg-[#FAFBFD]">
          {/* Tuition & Core Specs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
            <div className="sm:col-span-5 bg-white rounded-xl p-4 border border-[#172154]/10 flex flex-col justify-between">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#525E80]">
                {biText(lang, 'Course Tuition', 'Học Phí Trọn Khóa')}
              </div>
              <div className="mt-1">
                <div className="font-display text-2xl font-extrabold text-[#E61E64] tabular-nums">
                  {formatVnd(program.tuitionVnd)}
                </div>
                <div className="text-xs text-[#525E80] mt-0.5 tabular-nums">
                  {program.weeksCount} {biText(lang, 'weeks', 'tuần')}
                  {pceLevel ? ` · ${pceLevel.hoursPerLevel}h` : ''}
                  {perSessionVnd
                    ? ` · ~${formatVnd(perSessionVnd)}/${biText(lang, 'session', 'buổi')}`
                    : ''}
                </div>
              </div>
            </div>

            <div className="sm:col-span-7 bg-white rounded-xl p-4 border border-[#172154]/10 grid grid-cols-2 gap-3 text-xs">
              <div className="flex items-start gap-2">
                <Users className="w-4 h-4 text-[#0D9488] shrink-0 mt-0.5" />
                <div>
                  <div className="text-[11px] text-[#525E80] font-medium">
                    {biText(lang, 'Age & Class Size', 'Độ tuổi & Sĩ số')}
                  </div>
                  <div className="font-bold text-[#172154]">
                    {pceLevel ? biText(lang, pceLevel.ageRangeEn, pceLevel.ageRangeVi) : program.ageRange}
                    {' · '}
                    {biText(
                      lang,
                      `Max ${program.maxClassSize || 10}`,
                      `Tối đa ${program.maxClassSize || 10} HV`
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-[#2D3E99] shrink-0 mt-0.5" />
                <div>
                  <div className="text-[11px] text-[#525E80] font-medium">
                    {biText(lang, 'Schedule', 'Lịch học')}
                  </div>
                  <div className="font-bold text-[#172154]">
                    {program.scheduleSummary ||
                      (pceLevel
                        ? `${pceLevel.sessionsPerWeek} ${biText(lang, 'sessions/wk', 'buổi/tuần')} × ${pceLevel.hoursPerSession}h`
                        : biText(lang, 'Flexible Weekday / Weekend', 'Linh hoạt trong tuần / cuối tuần'))}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <GraduationCap className="w-4 h-4 text-[#6B21A8] shrink-0 mt-0.5" />
                <div>
                  <div className="text-[11px] text-[#525E80] font-medium">
                    {biText(lang, 'Faculty / Instructor', 'Giáo viên phụ trách')}
                  </div>
                  <div className="font-bold text-[#172154]">
                    {program.teacherName ||
                      biText(
                        lang,
                        'LiLab International & Bilingual Faculty',
                        'Đội ngũ Giáo viên Quốc tế & Song ngữ LiLab'
                      )}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-[#E61E64] shrink-0 mt-0.5" />
                <div>
                  <div className="text-[11px] text-[#525E80] font-medium">
                    {biText(lang, 'Campus / Location', 'Cơ sở học')}
                  </div>
                  <div className="font-bold text-[#172154]">
                    {program.location || 'C002 ParcSpring, 537 Nguyễn Duy Trinh, TP Thủ Đức'}
                  </div>
                </div>
              </div>

              {(program.enrollmentDate || program.startDate) && (
                <div className="col-span-2 flex items-center gap-2 pt-2 border-t border-[#172154]/8">
                  <Calendar className="w-4 h-4 text-[#FF6B00] shrink-0" />
                  <span className="text-[#172154]">
                    {program.enrollmentDate && (
                      <>
                        <strong>{biText(lang, 'Enrollment Open:', 'Mở tuyển sinh:')}</strong>{' '}
                        {program.enrollmentDate}
                      </>
                    )}
                    {program.startDate && (
                      <>
                        {program.enrollmentDate ? ' · ' : ''}
                        <strong>{biText(lang, 'Next Cohort Starts:', 'Dự kiến khai giảng:')}</strong>{' '}
                        {program.startDate}
                      </>
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Full Bilingual Overview */}
          {(descEn || descVi) && (
            <div className="bg-white rounded-xl p-5 border border-[#172154]/10 space-y-2">
              <div className="text-xs font-extrabold uppercase tracking-wider text-[#2D3E99] flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                {biText(lang, 'Course Overview', 'Tổng Quan Khóa Học')}
              </div>
              <p className="text-sm text-[#172154]/85 leading-relaxed">
                {lang === 'vi' ? descVi || descEn : descEn || descVi}
              </p>
              {lang === 'bi' && descEn && descVi && descEn !== descVi && (
                <p className="text-xs text-[#525E80] leading-relaxed pt-1 border-t border-[#172154]/8">
                  {descVi}
                </p>
              )}
            </div>
          )}

          {/* Key Highlights & Learning Outcomes */}
          <div className="bg-white rounded-xl p-5 border border-[#172154]/10 space-y-3">
            <div className="text-xs font-extrabold uppercase tracking-wider text-[#0F766E] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              {biText(
                lang,
                'What Your Child Will Learn & Experience',
                'Những Gì Bé Sẽ Học & Trải Nghiệm'
              )}
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(lang === 'vi' ? highlightsVi : highlightsEn).map((item, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 text-xs sm:text-sm text-[#172154] bg-[#F8F9FB] rounded-lg p-3 border border-[#172154]/6"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#0D9488] shrink-0 mt-0.5" />
                  <span className="leading-snug">{item}</span>
                </li>
              ))}
            </ul>

            {(selection.showcaseEn || selection.showcaseVi) && (
              <div className="p-3.5 rounded-xl bg-[#FFF8F1] border border-[#FF6B00]/20 flex items-start gap-2.5 text-xs">
                <Award className="w-4 h-4 text-[#FF6B00] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#172154]">
                    {biText(lang, 'End-of-Course Showcase:', 'Sản phẩm & Biểu diễn cuối khóa:')}
                  </strong>{' '}
                  <span className="text-[#172154]/85">
                    {biText(
                      lang,
                      selection.showcaseEn || selection.showcaseVi || '',
                      selection.showcaseVi || selection.showcaseEn || ''
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Full PCE-Kids Syllabus & Textbooks (when viewing a PCE-Kids level) */}
          {pceLevel && (
            <div className="bg-white rounded-xl p-5 border border-[#172154]/10 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-extrabold uppercase tracking-wider text-[#6B21A8] flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  {biText(
                    lang,
                    `Curriculum Units & Textbooks (Level ${pceLevel.levelNumber}/13)`,
                    `Học Phần Chi Tiết & Giáo Trình (Cấp độ ${pceLevel.levelNumber}/13)`
                  )}
                </div>
                <span className="text-[11px] font-mono font-bold text-[#6B21A8] bg-[#FAF5FF] border border-[#6B21A8]/20 px-2.5 py-0.5 rounded-md tabular-nums">
                  {pceLevel.hoursPerLevel}h · {biText(lang, 'Cumulative', 'Tích lũy')}: {pceLevel.cumulativeHours}h
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {pceLevel.textbooks.map((tb, idx) => (
                  <div
                    key={idx}
                    className="px-3 py-1.5 rounded-lg bg-[#F0FDFA] border border-[#0D9488]/20 text-xs font-semibold text-[#0F766E] flex items-center gap-1.5"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>{tb.title}</span>
                    {tb.publisher && (
                      <span className="text-[11px] text-[#0F766E]/70">({tb.publisher})</span>
                    )}
                  </div>
                ))}
              </div>

              {pceLevel.syllabus && pceLevel.syllabus.length > 0 && (
                <div className="space-y-2">
                  {pceLevel.syllabus.map((mod, mIdx) => (
                    <div
                      key={mIdx}
                      className="p-3 rounded-lg bg-[#F8F9FB] border border-[#172154]/8 space-y-1"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[#172154]">
                          {mod.unitCode}: {biText(lang, mod.titleEn, mod.titleVi)}
                        </span>
                      </div>
                      <div className="text-xs text-[#525E80]">
                        <strong className="text-[#172154]/80">
                          {biText(lang, 'Language Focus:', 'Trọng tâm ngôn ngữ:')}
                        </strong>{' '}
                        {biText(lang, mod.languageFocusEn, mod.languageFocusVi)}
                      </div>
                      {(mod.activitiesAndProjectsEn || mod.activitiesAndProjectsVi) && (
                        <div className="text-xs text-[#6B21A8]">
                          <strong>{biText(lang, 'Project & Activities:', 'Dự án & Hoạt động:')}</strong>{' '}
                          {biText(lang, mod.activitiesAndProjectsEn, mod.activitiesAndProjectsVi)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky Modal Footer — Parent Notes + Direct Enroll CTA */}
        <div className="bg-white border-t border-[#172154]/10 px-5 sm:px-7 py-4 space-y-3 shrink-0">
          {!existingEnrollment && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <input
                type="text"
                value={enrollNotes}
                onChange={(e) => onChangeEnrollNotes(e.target.value)}
                placeholder={biText(
                  lang,
                  'Optional note for LiLab Admissions (preferred days, sibling discount, questions)...',
                  'Ghi chú cho Tư vấn Tuyển sinh LiLab (lịch học mong muốn, ưu đãi anh chị em, câu hỏi)...'
                )}
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-[#172154]/15 bg-[#F8F9FB] focus:bg-white focus:border-[#0D9488] focus:outline-none text-xs text-[#172154]"
              />
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-[#525E80]">
              {activeStudent ? (
                <span>
                  {biText(lang, 'Enrolling Student:', 'Đăng ký cho bé:')}{' '}
                  <strong className="text-[#172154]">{activeStudent.fullName}</strong>
                </span>
              ) : (
                <span>
                  {biText(
                    lang,
                    'Ready to enroll — select student in next step',
                    'Sẵn sàng đăng ký — chọn hồ sơ bé ở bước tiếp theo'
                  )}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-[#172154]/15 bg-white hover:bg-[#F8F9FB] text-[#172154] text-xs font-bold cursor-pointer transition-colors"
              >
                {biText(lang, 'Close', 'Đóng')}
              </button>

              {existingEnrollment ? (
                <div className="px-4 py-2.5 rounded-xl bg-[#0D9488]/12 border border-[#0D9488]/25 text-[#0F766E] text-xs font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {biText(
                      lang,
                      `Enrollment ${existingEnrollment.status.toUpperCase()}`,
                      `Đã gửi đăng ký (${existingEnrollment.status})`
                    )}
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    onClose();
                    onProceedToCheckout(program);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-[#E61E64] hover:bg-[#c81655] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm cursor-pointer transition-colors disabled:opacity-60 whitespace-nowrap"
                >
                  <QrCode className="w-4 h-4" />
                  <span>
                    {biText(
                      lang,
                      'Enroll & Pay Now',
                      'Đăng Ký & Thanh Toán Ngay'
                    )}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
