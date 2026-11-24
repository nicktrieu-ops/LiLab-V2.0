import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Compass,
  FileText,
  Flag,
  GraduationCap,
  Layers,
  Play,
  Sparkles,
  Target,
  TrendingUp,
  X,
} from 'lucide-react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { biText, formatVnd } from '../i18n';
import {
  LILAB_FOLKLORE_GALLERY,
  PCE_KIDS_CURRICULUM,
  PCE_PEDAGOGICAL_PILLARS,
  resolveStudentPceLevel,
  type PceDivisionId,
  type PceLevelCourse,
  type PceSyllabusUnit,
} from '../data/pceCurriculumData';
import {
  formatCefrLabel,
  type LangCode,
  type ProgramCourse,
  type StudentAssessment,
  type StudentProfile,
} from '../types';

interface PceInteractiveDashboardProps {
  lang: LangCode;
  portalRole: 'parent' | 'student';
  student: StudentProfile | null;
  studentNameFallback: string;
  assessments: StudentAssessment[];
  onEnrollProgram?: (program: ProgramCourse) => void;
  onNavigateTab?: (tab: 'dashboard' | 'calendar' | 'resources' | 'enroll' | 'billing') => void;
}

type DashboardSubView = 'journey' | 'todo' | 'next_courses' | 'pillars_folklore';

export const PceInteractiveDashboard: React.FC<PceInteractiveDashboardProps> = ({
  lang,
  portalRole,
  student,
  studentNameFallback,
  assessments,
  onEnrollProgram,
  onNavigateTab,
}) => {
  // Determine student's baseline PCE level from their profile/assessment
  const latestAssessment = assessments[0] || null;
  const effectiveCefr = latestAssessment?.cefrLevel || student?.cefrLevel || 'Pre-A1 Starters';
  const effectiveMod = latestAssessment?.cefrModifier || student?.cefrModifier || 'standard';
  const effectiveAge = student?.age || 7;

  const resolvedDefaultCourse = useMemo(
    () => resolveStudentPceLevel(effectiveAge, effectiveCefr, effectiveMod),
    [effectiveAge, effectiveCefr, effectiveMod]
  );

  // Persisted per-student current level & current week state
  const storagePrefix = `lilab_pce_${student?.id || 'default'}`;

  const [currentLevelNum, setCurrentLevelNum] = useState<number>(() => {
    const saved = localStorage.getItem(`${storagePrefix}_level`);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (parsed >= 1 && parsed <= 13) return parsed;
    }
    return resolvedDefaultCourse.levelNumber;
  });

  const [inspectedLevelNum, setInspectedLevelNum] = useState<number>(currentLevelNum);

  const currentCourse: PceLevelCourse = useMemo(
    () =>
      PCE_KIDS_CURRICULUM.find((c) => c.levelNumber === currentLevelNum) ||
      resolvedDefaultCourse,
    [currentLevelNum, resolvedDefaultCourse]
  );

  const inspectedCourse: PceLevelCourse = useMemo(
    () =>
      PCE_KIDS_CURRICULUM.find((c) => c.levelNumber === inspectedLevelNum) ||
      currentCourse,
    [inspectedLevelNum, currentCourse]
  );

  const nextCourse: PceLevelCourse | null = useMemo(
    () =>
      currentCourse.levelNumber < 13
        ? PCE_KIDS_CURRICULUM.find((c) => c.levelNumber === currentCourse.levelNumber + 1) || null
        : null,
    [currentCourse]
  );

  const [currentWeek, setCurrentWeek] = useState<number>(() => {
    const saved = localStorage.getItem(`${storagePrefix}_week`);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (parsed >= 1 && parsed <= 26) return parsed;
    }
    return 5; // Default active week in mid-term
  });

  // Sync when switching active student
  useEffect(() => {
    const savedLvl = localStorage.getItem(`${storagePrefix}_level`);
    const nextLvl = savedLvl ? parseInt(savedLvl, 10) : resolvedDefaultCourse.levelNumber;
    const validLvl = nextLvl >= 1 && nextLvl <= 13 ? nextLvl : resolvedDefaultCourse.levelNumber;
    setCurrentLevelNum(validLvl);
    setInspectedLevelNum(validLvl);

    const savedWk = localStorage.getItem(`${storagePrefix}_week`);
    const nextWk = savedWk ? parseInt(savedWk, 10) : 5;
    setCurrentWeek(Math.min(nextWk, PCE_KIDS_CURRICULUM[validLvl - 1].durationWeeks));
  }, [storagePrefix, resolvedDefaultCourse.levelNumber]);

  // Clamp week if level changes
  useEffect(() => {
    if (currentWeek > currentCourse.durationWeeks) {
      setCurrentWeek(currentCourse.durationWeeks);
    }
  }, [currentCourse.durationWeeks, currentWeek]);

  // Sub-view navigation tabs
  const [activeSubView, setActiveSubView] = useState<DashboardSubView>('journey');

  // Interactive task completion state (persisted per student + level + week)
  const [completedTasks, setCompletedTasks] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(`${storagePrefix}_tasks`);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  // Goal courses bookmarked by student/parent
  const [goalCourseCodes, setGoalCourseCodes] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(`${storagePrefix}_goals`);
      return raw ? JSON.parse(raw) : nextCourse ? [nextCourse.code] : [];
    } catch {
      return [];
    }
  });

  // Interactive Digital Homework Quiz Modal state
  const [quizModalUnit, setQuizModalUnit] = useState<{
    course: PceLevelCourse;
    unit: PceSyllabusUnit;
  } | null>(null);
  const [selectedQuizOption, setSelectedQuizOption] = useState<number | null>(null);
  const [quizPracticeSentence, setQuizPracticeSentence] = useState('');
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // Course Catalog filter & expanded syllabus state
  const [catalogFilter, setCatalogFilter] = useState<'recommended' | 'all' | PceDivisionId>('recommended');
  const [expandedSyllabusCode, setExpandedSyllabusCode] = useState<string | null>(
    nextCourse ? nextCourse.code : currentCourse.code
  );

  // Curriculum PDF preview modal
  const [pdfPreviewLang, setPdfPreviewLang] = useState<'en' | 'vi' | null>(null);

  // Status feedback banner
  const [statusToast, setStatusToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setStatusToast(msg);
    setTimeout(() => setStatusToast(null), 4000);
  };

  const handleUpdateCurrentPosition = async (newLevelNum: number, newWeek: number) => {
    const targetCourse =
      PCE_KIDS_CURRICULUM.find((c) => c.levelNumber === newLevelNum) || currentCourse;
    const clampedWeek = Math.max(1, Math.min(targetCourse.durationWeeks, newWeek));

    setCurrentLevelNum(newLevelNum);
    setInspectedLevelNum(newLevelNum);
    setCurrentWeek(clampedWeek);
    localStorage.setItem(`${storagePrefix}_level`, String(newLevelNum));
    localStorage.setItem(`${storagePrefix}_week`, String(clampedWeek));

    // Also update student's activitiesNote / cefrLevel in Firestore if student profile exists
    if (student?.id) {
      try {
        await updateDoc(doc(db, 'students', student.id), {
          cefrLevel: targetCourse.mappedCefrLevel,
          activitiesNote: `PCE-Kids Level ${targetCourse.levelNumber}: ${targetCourse.titleEn} (Week ${clampedWeek}/${targetCourse.durationWeeks})`,
          updatedAt: serverTimestamp(),
        });
      } catch {
        // Non-blocking if user doesn't have write permission on student doc
      }
    }
  };

  // Active syllabus unit for the current week
  const currentUnit: PceSyllabusUnit = useMemo(() => {
    return (
      currentCourse.syllabus.find(
        (u) => currentWeek >= u.weekStart && currentWeek <= u.weekEnd
      ) || currentCourse.syllabus[0]
    );
  }, [currentCourse, currentWeek]);

  // 4 concrete interactive weekly tasks for the student
  const weeklyActionItems = useMemo(() => {
    const baseKey = `L${currentCourse.levelNumber}_W${currentWeek}`;
    return [
      {
        id: `${baseKey}_class`,
        categoryEn: '1. In-Class Communicative Focus',
        categoryVi: '1. Trọng Tâm Giao Tiếp Trên Lớp',
        titleEn: `${currentUnit.unitCode}: ${currentUnit.titleEn}`,
        titleVi: `${currentUnit.unitCode}: ${currentUnit.titleVi}`,
        detailEn: `Language Focus: ${currentUnit.languageFocusEn}`,
        detailVi: `Trọng tâm Ngôn ngữ: ${currentUnit.languageFocusVi}`,
        timeBadge: `${currentCourse.sessionsPerWeek} × ${currentCourse.hoursPerSession}h`,
        pillarBadgeEn: 'Communicative Approach',
        pillarBadgeVi: 'Phương pháp Giao tiếp',
        hasQuiz: false,
      },
      {
        id: `${baseKey}_homework`,
        categoryEn: '2. Adaptive Digital Homework',
        categoryVi: '2. Bài Tập Số Hóa Tại Nhà',
        titleEn: currentCourse.digitalHomeworkEn,
        titleVi: currentCourse.digitalHomeworkVi,
        detailEn: `Interactive Question: "${currentUnit.quizQuestionEn}"`,
        detailVi: `Câu hỏi thực hành: "${currentUnit.quizQuestionVi}"`,
        timeBadge: `${currentCourse.homeworkMinutesPerWeek} mins/wk`,
        pillarBadgeEn: 'Personalized Learning',
        pillarBadgeVi: 'Học tập Cá nhân hóa',
        hasQuiz: true,
      },
      {
        id: `${baseKey}_project`,
        categoryEn: '3. Experiential Project & Portfolio',
        categoryVi: '3. Dự Án Trải Nghiệm & Hồ Sơ Năng Lực',
        titleEn: currentUnit.activitiesAndProjectsEn,
        titleVi: currentUnit.activitiesAndProjectsVi,
        detailEn: 'Hands-on creative artifact added to your term Learning Portfolio',
        detailVi: 'Sản phẩm thực hành sáng tạo lưu vào Hồ sơ Học tập (Portfolio) học kỳ',
        timeBadge: biText(lang, 'Portfolio Task', 'Hồ sơ Năng lực'),
        pillarBadgeEn: 'Experiential Learning',
        pillarBadgeVi: 'Học tập Trải nghiệm',
        hasQuiz: false,
      },
      {
        id: `${baseKey}_assessment`,
        categoryEn: '4. Unit Checkpoint & Cambridge Readiness',
        categoryVi: '4. Kiểm Tra Định Kỳ & Chuẩn Đầu Ra Quốc Tế',
        titleEn: currentUnit.assessmentEn,
        titleVi: currentUnit.assessmentVi,
        detailEn: `Target Milestone: ${currentCourse.cambridgeMilestoneEn}`,
        detailVi: `Cột mốc hướng tới: ${currentCourse.cambridgeMilestoneVi}`,
        timeBadge: currentCourse.cefrBand,
        pillarBadgeEn: 'Cambridge Benchmark',
        pillarBadgeVi: 'Chuẩn Cambridge',
        hasQuiz: false,
      },
    ];
  }, [currentCourse, currentUnit, currentWeek, lang]);

  const completedWeekCount = weeklyActionItems.filter((item) => completedTasks[item.id]).length;
  const weekTaskPercent = Math.round((completedWeekCount / weeklyActionItems.length) * 100);

  const toggleTaskDone = (taskId: string) => {
    setCompletedTasks((prev) => {
      const next = { ...prev, [taskId]: !prev[taskId] };
      localStorage.setItem(`${storagePrefix}_tasks`, JSON.stringify(next));
      return next;
    });
  };

  const toggleGoalCourse = (code: string) => {
    setGoalCourseCodes((prev) => {
      const next = prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code];
      localStorage.setItem(`${storagePrefix}_goals`, JSON.stringify(next));
      return next;
    });
    showToast(
      biText(
        lang,
        'Updated your Next-Level Course Roadmap!',
        'Đã cập nhật lộ trình khóa học mục tiêu của con!'
      )
    );
  };

  // Calculate cumulative hours completed up to current level + current week
  const priorLevelsHours =
    currentCourse.levelNumber > 1
      ? PCE_KIDS_CURRICULUM[currentCourse.levelNumber - 2].cumulativeHours
      : 0;
  const hoursInCurrentLevelSoFar = Math.round(
    (currentWeek / currentCourse.durationWeeks) * currentCourse.hoursPerLevel
  );
  const liveCumulativeHours = Math.min(
    780,
    priorLevelsHours + hoursInCurrentLevelSoFar
  );
  const hoursRemainingToNextLevel = Math.max(
    0,
    currentCourse.hoursPerLevel - hoursInCurrentLevelSoFar
  );
  const weeksRemainingToNextLevel = Math.max(0, currentCourse.durationWeeks - currentWeek);
  const levelProgressPercent = Math.round((currentWeek / currentCourse.durationWeeks) * 100);
  const overall13LevelPercent = Math.round((liveCumulativeHours / 780) * 100);

  const filteredCatalogCourses = useMemo(() => {
    if (catalogFilter === 'recommended') {
      // Show current course + next 3 courses in the pathway
      return PCE_KIDS_CURRICULUM.filter(
        (c) =>
          c.levelNumber >= currentCourse.levelNumber &&
          c.levelNumber <= Math.min(13, currentCourse.levelNumber + 3)
      );
    }
    if (catalogFilter === 'all') return PCE_KIDS_CURRICULUM;
    return PCE_KIDS_CURRICULUM.filter((c) => c.divisionId === catalogFilter);
  }, [catalogFilter, currentCourse.levelNumber]);

  const handleTriggerEnroll = (course: PceLevelCourse) => {
    const mappedProgram: ProgramCourse = {
      id: `prog_${course.code.toLowerCase().replace('-', '_')}`,
      code: course.code,
      titleEn: course.titleEn,
      titleVi: course.titleVi,
      descriptionEn: course.summaryEn,
      descriptionVi: course.summaryVi,
      cefrTarget: `${course.cefrBand} · ${course.cambridgeMilestoneEn}`,
      ageRange: course.ageRangeEn,
      weeksCount: course.durationWeeks,
      tuitionVnd: course.tuitionVnd,
      scheduleSummary: `${course.sessionsPerWeek} sessions/week × ${course.hoursPerSession}h (${course.hoursPerLevel}h total)`,
      isActive: true,
    };
    if (onEnrollProgram) {
      onEnrollProgram(mappedProgram);
    } else if (onNavigateTab) {
      onNavigateTab('enroll');
    }
  };

  const openQuizModal = (course: PceLevelCourse, unit: PceSyllabusUnit) => {
    setQuizModalUnit({ course, unit });
    setSelectedQuizOption(null);
    setQuizPracticeSentence('');
    setQuizSubmitted(false);
  };

  const handleSubmitQuiz = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quizModalUnit || selectedQuizOption === null) return;
    setQuizSubmitted(true);
    // Automatically check off the digital homework task if it's for the current level/week
    const hwTaskId = `L${currentCourse.levelNumber}_W${currentWeek}_homework`;
    if (quizModalUnit.course.levelNumber === currentCourse.levelNumber) {
      setCompletedTasks((prev) => {
        const next = { ...prev, [hwTaskId]: true };
        localStorage.setItem(`${storagePrefix}_tasks`, JSON.stringify(next));
        return next;
      });
    }
  };

  const displayName = student ? student.fullName : studentNameFallback;

  return (
    <section
      aria-label="PCE-Kids Interactive Learning Journey Dashboard"
      className="bg-white border border-[#2D3E99]/15 rounded-2xl shadow-xs overflow-hidden no-print"
    >
      {/* ===================================================================== */}
      {/* 1. LILAB SIGNATURE HERO HEADER & LIVE POSITION KPI BAR                */}
      {/* ===================================================================== */}
      <div className="bg-gradient-to-r from-[#172154] via-[#2D3E99] to-[#1E3A8A] text-white p-6 sm:p-7 relative overflow-hidden">
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left: Student Position Summary & Pedagogical Framing */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold tracking-wide uppercase text-[#FFD41D]">
              <Compass className="w-4 h-4" />
              <span>
                {biText(
                  lang,
                  'THE PCE-KIDS FRAMEWORK · 13-LEVEL INTERACTIVE LEARNING DASHBOARD',
                  'KHUNG CHƯƠNG TRÌNH PCE-KIDS · BẢNG ĐIỀU KHIỂN HÀNH TRÌNH 13 CẤP ĐỘ'
                )}
              </span>
            </div>

            <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
              {portalRole === 'student'
                ? biText(
                    lang,
                    `${displayName}’s Learning Compass: Where I Am, My Weekly Mission & Next Level`,
                    `La Bàn Học Tập Của ${displayName}: Vị Trí Hiện Tại, Nhiệm Vụ Tuần & Cấp Độ Tiếp Theo`
                  )
                : biText(
                    lang,
                    `${displayName}’s PCE-Kids Progress: Current Stage, Weekly To-Do & Next-Level Pathway`,
                    `Hành Trình PCE-Kids Của ${displayName}: Cấp Độ Hiện Tại, Việc Cần Làm & Lộ Trình Lên Cấp`
                  )}
            </h2>

            <p className="text-xs sm:text-sm text-white/85 leading-relaxed max-w-2xl">
              {biText(
                lang,
                currentCourse.summaryEn,
                currentCourse.summaryVi
              )}
            </p>

            {/* Static metadata line (Zero-pill discipline: clean middle-dot separated text) */}
            <div className="pt-1 text-xs font-medium text-[#FFD41D]/95">
              {biText(lang, currentCourse.divisionNameEn, currentCourse.divisionNameVi)} ·{' '}
              {biText(lang, currentCourse.ageRangeEn, currentCourse.ageRangeVi)} ·{' '}
              {currentCourse.cefrBand} ·{' '}
              {biText(
                lang,
                `${currentCourse.sessionsPerWeek} sessions/wk × ${currentCourse.hoursPerSession}h`,
                `${currentCourse.sessionsPerWeek} buổi/tuần × ${currentCourse.hoursPerSession} giờ`
              )}
            </div>

            {/* Quick PDF Curriculum Proposal Launchers */}
            <div className="pt-2 flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setPdfPreviewLang('vi')}
                className="px-3.5 py-2 rounded-xl bg-[#FFD41D] text-[#172154] text-xs font-bold hover:bg-[#f2c60f] transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                {biText(
                  lang,
                  'View Official PCE-Kids Curriculum (VI PDF)',
                  'Xem Khung Chương Trình PCE-Kids (Bản Tiếng Việt PDF)'
                )}
              </button>
              <button
                type="button"
                onClick={() => setPdfPreviewLang('en')}
                className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/25 text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5 text-[#FFD41D]" />
                {biText(
                  lang,
                  'View PCE-Kids Proposal (EN PDF)',
                  'Xem Khung PCE-Kids (Bản Tiếng Anh PDF)'
                )}
              </button>
            </div>
          </div>

          {/* Right: LiLab Beret Character Showcase & 4 Tabular Numerals KPIs */}
          <div className="lg:col-span-5 bg-white/10 backdrop-blur-xs border border-white/20 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-4">
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-[#FDF9EE] p-2 shrink-0 flex items-center justify-center shadow-md border-2 border-[#FFD41D]">
              <img
                src={currentCourse.lilabCharacterImg}
                alt={currentCourse.titleEn}
                className="w-full h-full object-contain"
              />
            </div>

            <div className="flex-1 w-full space-y-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#FFD41D]">
                {biText(
                  lang,
                  `CURRENT LEVEL ${currentCourse.levelNumber} OF 13`,
                  `ĐANG HỌC CẤP ĐỘ ${currentCourse.levelNumber} / 13`
                )}
              </div>
              <div className="font-display text-base sm:text-lg font-extrabold text-white leading-snug">
                {biText(lang, currentCourse.titleEn, currentCourse.titleVi)}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="bg-[#172154]/60 border border-white/15 rounded-xl px-3 py-2">
                  <div className="text-[10px] text-white/70">
                    {biText(lang, 'Active Week', 'Tuần hiện tại')}
                  </div>
                  <div className="font-mono text-sm sm:text-base font-bold text-[#FFD41D] tabular-nums">
                    W{currentWeek} / {currentCourse.durationWeeks} ({levelProgressPercent}%)
                  </div>
                </div>
                <div className="bg-[#172154]/60 border border-white/15 rounded-xl px-3 py-2">
                  <div className="text-[10px] text-white/70">
                    {biText(lang, 'Cumulative Hours', 'Giờ học tích lũy')}
                  </div>
                  <div className="font-mono text-sm sm:text-base font-bold text-[#56BEB8] tabular-nums">
                    {liveCumulativeHours} / 780h
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-white/85 font-medium">
                <strong className="text-[#FFD41D]">
                  {biText(lang, 'Next Level:', 'Cấp tiếp theo:')}
                </strong>{' '}
                {nextCourse
                  ? biText(
                      lang,
                      `Level ${nextCourse.levelNumber} (${nextCourse.code}) in ${weeksRemainingToNextLevel}w (${hoursRemainingToNextLevel}h left)`,
                      `Cấp ${nextCourse.levelNumber} (${nextCourse.code}) sau ${weeksRemainingToNextLevel} tuần (${hoursRemainingToNextLevel} giờ nữa)`
                    )
                  : biText(
                      lang,
                      'Senior C1 / IELTS 6.5+ Capstone Level!',
                      'Đỉnh cao C1 / IELTS 6.5+ Toàn khóa!'
                    )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. INTERACTIVE SUB-NAVIGATION TABS & POSITION SIMULATOR               */}
      {/* ===================================================================== */}
      <div className="bg-[#FDF9EE] border-b border-[#2D3E99]/12 px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            {
              id: 'journey' as const,
              label: biText(
                lang,
                '1. Where I Am Now (13-Level Map)',
                '1. Vị Trí Hiện Tại (Bản Đồ 13 Cấp)'
              ),
              icon: <Compass className="w-4 h-4" />,
            },
            {
              id: 'todo' as const,
              label: biText(
                lang,
                `2. What To Do This Week (${completedWeekCount}/${weeklyActionItems.length})`,
                `2. Việc Cần Làm Tuần ${currentWeek} (${completedWeekCount}/${weeklyActionItems.length})`
              ),
              icon: <Target className="w-4 h-4" />,
            },
            {
              id: 'next_courses' as const,
              label: biText(
                lang,
                '3. Courses to Next Level & Syllabus',
                '3. Khóa Học Lên Cấp & Giáo Trình Chi Tiết'
              ),
              icon: <GraduationCap className="w-4 h-4" />,
            },
            {
              id: 'pillars_folklore' as const,
              label: biText(
                lang,
                '4. LiLab Style & 3 Pedagogical Pillars',
                '4. Phong Cách Văn Hóa LiLab & 3 Trụ Cột'
              ),
              icon: <Sparkles className="w-4 h-4" />,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubView(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                activeSubView === tab.id
                  ? 'bg-[#2D3E99] text-white shadow-xs'
                  : 'bg-white text-[#172154]/80 border border-[#2D3E99]/15 hover:border-[#2D3E99]/40'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Interactive Level & Week Control Bar */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-[#2D3E99]">
            {biText(lang, 'Current Stage:', 'Đang học:')}
          </span>
          <select
            aria-label="Select Student Current PCE-Kids Level"
            value={currentCourse.levelNumber}
            onChange={(e) =>
              void handleUpdateCurrentPosition(parseInt(e.target.value, 10), 1)
            }
            className="px-2.5 py-1.5 rounded-lg border border-[#2D3E99]/25 bg-white font-semibold text-[#172154] text-xs cursor-pointer"
          >
            {PCE_KIDS_CURRICULUM.map((lvl) => (
              <option key={lvl.code} value={lvl.levelNumber}>
                Lv.{lvl.levelNumber} · {lvl.code} ({biText(lang, lvl.ageRangeEn, lvl.ageRangeVi)} · {lvl.cefrBand})
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 bg-white border border-[#2D3E99]/25 rounded-lg px-1.5 py-1">
            <button
              type="button"
              onClick={() =>
                void handleUpdateCurrentPosition(currentCourse.levelNumber, currentWeek - 1)
              }
              disabled={currentWeek <= 1}
              className="p-1 rounded hover:bg-[#FDF9EE] disabled:opacity-40 cursor-pointer"
              title={biText(lang, 'Previous Week', 'Tuần trước')}
            >
              <ChevronLeft className="w-3.5 h-3.5 text-[#2D3E99]" />
            </button>
            <span className="font-mono font-bold text-[#E61E64] px-1.5 tabular-nums whitespace-nowrap">
              {biText(lang, `Week ${currentWeek}/${currentCourse.durationWeeks}`, `Tuần ${currentWeek}/${currentCourse.durationWeeks}`)}
            </span>
            <button
              type="button"
              onClick={() =>
                void handleUpdateCurrentPosition(currentCourse.levelNumber, currentWeek + 1)
              }
              disabled={currentWeek >= currentCourse.durationWeeks}
              className="p-1 rounded hover:bg-[#FDF9EE] disabled:opacity-40 cursor-pointer"
              title={biText(lang, 'Next Week', 'Tuần tiếp')}
            >
              <ChevronRight className="w-3.5 h-3.5 text-[#2D3E99]" />
            </button>
          </div>
        </div>
      </div>

      {statusToast && (
        <div className="mx-6 mt-4 px-4 py-2.5 rounded-xl bg-[#0F766E]/10 border border-[#0F766E]/30 text-xs font-bold text-[#0F766E] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusToast}</span>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-VIEW 1: WHERE THE CHILD / STUDENT CURRENTLY IS (13-LEVEL MAP)     */}
      {/* ===================================================================== */}
      {activeSubView === 'journey' && (
        <div className="p-6 space-y-6">
          {/* 13-Level Cradle-to-College Interactive Progression Track */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-lg font-extrabold text-[#2D3E99]">
                  {biText(
                    lang,
                    '13-Level Cradle-to-College Progression Map (Ages 3–16 · Pre-A1 to C1)',
                    'Bản Đồ Lộ Trình 13 Cấp Độ Xuyên Suốt (3–16 Tuổi · Từ Pre-A1 Đến C1 / IELTS 6.5+)'
                  )}
                </h3>
                <p className="text-xs text-[#172154]/70">
                  {biText(
                    lang,
                    'Click any of the 13 LiLab level cards below to inspect its syllabus, textbooks, and milestones, or click "Set as Current Level" to update position.',
                    'Nhấn vào bất kỳ cấp độ nào trong 13 cấp độ dưới đây để xem chi tiết giáo trình, sách học và cột mốc quốc tế.'
                  )}
                </p>
              </div>
              <div className="font-mono text-xs font-bold text-[#2D3E99] bg-[#FDF9EE] border border-[#2D3E99]/15 px-3 py-1.5 rounded-lg tabular-nums">
                {biText(
                  lang,
                  `Overall Academy Journey: ${overall13LevelPercent}% (${liveCumulativeHours}/780 hrs)`,
                  `Tiến độ Toàn Khung 13 Cấp: ${overall13LevelPercent}% (${liveCumulativeHours}/780 giờ)`
                )}
              </div>
            </div>

            {/* 13 Interactive Level Nodes Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 lg:grid-cols-13 gap-2">
              {PCE_KIDS_CURRICULUM.map((lvl) => {
                const isCurrent = lvl.levelNumber === currentCourse.levelNumber;
                const isCompleted = lvl.levelNumber < currentCourse.levelNumber;
                const isInspected = lvl.levelNumber === inspectedCourse.levelNumber;
                const isNext = lvl.levelNumber === currentCourse.levelNumber + 1;

                return (
                  <button
                    key={lvl.code}
                    type="button"
                    onClick={() => setInspectedLevelNum(lvl.levelNumber)}
                    className={`p-2 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer relative ${
                      isCurrent
                        ? 'bg-[#2D3E99] text-white border-[#E61E64] ring-2 ring-[#E61E64]'
                        : isInspected
                          ? 'bg-[#FDF9EE] text-[#172154] border-[#2D3E99] ring-2 ring-[#2D3E99]'
                          : isCompleted
                            ? 'bg-[#0F766E]/10 text-[#172154] border-[#0F766E]/35 hover:bg-[#0F766E]/15'
                            : isNext
                              ? 'bg-[#FFD41D]/20 text-[#172154] border-[#D97706]/50 hover:bg-[#FFD41D]/30'
                              : 'bg-white text-[#172154]/80 border-slate-200 hover:border-[#2D3E99]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-[10px] font-extrabold tabular-nums">
                        L{lvl.levelNumber}
                      </span>
                      {isCurrent ? (
                        <span className="w-2 h-2 rounded-full bg-[#FFD41D]" title="Current Level" />
                      ) : isCompleted ? (
                        <CheckCircle2 className="w-3 h-3 text-[#0F766E]" />
                      ) : isNext ? (
                        <ArrowRight className="w-3 h-3 text-[#D97706]" />
                      ) : null}
                    </div>

                    <div className="my-1.5 h-11 w-full flex items-center justify-center bg-white/90 rounded-lg p-1">
                      <img
                        src={lvl.lilabCharacterImg}
                        alt={lvl.code}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>

                    <div>
                      <div className="text-[10px] font-extrabold truncate">{lvl.code.replace('PCE-', '')}</div>
                      <div
                        className={`text-[9px] font-mono truncate tabular-nums ${
                          isCurrent ? 'text-[#FFD41D]' : 'text-[#172154]/65'
                        }`}
                      >
                        {lvl.cumulativeHours}h
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detailed Spotlight of the Selected/Current Level + Week Scrubber */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 7 Cols: Active / Inspected Level Deep Dive & Week-by-Week Timeline */}
            <div className="lg:col-span-7 bg-[#FDF9EE]/70 border border-[#2D3E99]/15 rounded-2xl p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#2D3E99]/10 pb-3.5">
                <div className="flex items-center gap-3.5">
                  <img
                    src={inspectedCourse.lilabCharacterImg}
                    alt={inspectedCourse.titleEn}
                    className="w-16 h-16 rounded-xl bg-white p-1.5 border border-[#2D3E99]/15 object-contain shrink-0"
                  />
                  <div>
                    <div className="text-xs font-bold text-[#E61E64]">
                      {inspectedCourse.levelNumber === currentCourse.levelNumber
                        ? biText(lang, '● CURRENT ACTIVE LEVEL', '● CẤP ĐỘ ĐANG THEO HỌC')
                        : inspectedCourse.levelNumber < currentCourse.levelNumber
                          ? biText(lang, '✓ COMPLETED LEVEL', '✓ CẤP ĐỘ ĐÃ HOÀN THÀNH')
                          : biText(lang, '→ UPCOMING TARGET LEVEL', '→ CẤP ĐỘ MỤC TIÊU TIẾP THEO')}{' '}
                      · {inspectedCourse.code}
                    </div>
                    <h4 className="font-display text-lg sm:text-xl font-extrabold text-[#2D3E99]">
                      {biText(lang, inspectedCourse.titleEn, inspectedCourse.titleVi)}
                    </h4>
                    <div className="text-xs text-[#172154]/70 mt-0.5">
                      {biText(lang, inspectedCourse.ageRangeEn, inspectedCourse.ageRangeVi)} ·{' '}
                      {inspectedCourse.durationWeeks} {biText(lang, 'weeks', 'tuần')} ({inspectedCourse.hoursPerLevel}h) ·{' '}
                      {biText(lang, inspectedCourse.cambridgeMilestoneEn, inspectedCourse.cambridgeMilestoneVi)}
                    </div>
                  </div>
                </div>

                {inspectedCourse.levelNumber !== currentCourse.levelNumber && (
                  <button
                    type="button"
                    onClick={() => void handleUpdateCurrentPosition(inspectedCourse.levelNumber, 1)}
                    className="px-3 py-1.5 rounded-lg bg-[#2D3E99] text-white text-xs font-semibold hover:bg-[#1e2b70] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {biText(lang, 'Set as Current Level', 'Chọn làm Cấp độ Hiện tại')}
                  </button>
                )}
              </div>

              {/* Interactive Week Slider when viewing Current Level */}
              {inspectedCourse.levelNumber === currentCourse.levelNumber && (
                <div className="bg-white border border-[#2D3E99]/15 rounded-xl p-4 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-[#2D3E99]">
                      {biText(
                        lang,
                        `Interactive Week Scrubber: Week ${currentWeek} of ${currentCourse.durationWeeks}`,
                        `Thanh trượt Tuần học Hiện tại: Tuần ${currentWeek} / ${currentCourse.durationWeeks}`
                      )}
                    </span>
                    <span className="font-mono font-bold text-[#E61E64] tabular-nums">
                      {currentUnit.unitCode} ({currentUnit.weeks})
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={currentCourse.durationWeeks}
                    value={currentWeek}
                    onChange={(e) =>
                      void handleUpdateCurrentPosition(
                        currentCourse.levelNumber,
                        parseInt(e.target.value, 10)
                      )
                    }
                    className="w-full accent-[#E61E64] cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] font-mono text-[#172154]/60 tabular-nums">
                    <span>Week 1 (Start)</span>
                    <span>Week 9 (Mid-Level Test)</span>
                    <span>Week {currentCourse.durationWeeks} (Cambridge Mock)</span>
                  </div>
                </div>
              )}

              {/* Syllabus Units List for the Inspected Course */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-[#172154]/75 uppercase tracking-wider">
                  {biText(
                    lang,
                    `Week-by-Week Syllabus (${inspectedCourse.syllabus.length} Modules · ${inspectedCourse.durationWeeks} Weeks)`,
                    `Phân Phối Chương Trình Theo Tuần (${inspectedCourse.syllabus.length} Học Phần · ${inspectedCourse.durationWeeks} Tuần)`
                  )}
                </div>

                <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                  {inspectedCourse.syllabus.map((unit) => {
                    const isActiveUnit =
                      inspectedCourse.levelNumber === currentCourse.levelNumber &&
                      currentWeek >= unit.weekStart &&
                      currentWeek <= unit.weekEnd;

                    return (
                      <div
                        key={unit.unitCode}
                        onClick={() => {
                          if (inspectedCourse.levelNumber === currentCourse.levelNumber) {
                            void handleUpdateCurrentPosition(
                              currentCourse.levelNumber,
                              unit.weekStart
                            );
                          }
                        }}
                        className={`p-3.5 rounded-xl border transition-colors cursor-pointer ${
                          isActiveUnit
                            ? 'bg-white border-[#E61E64] ring-1 ring-[#E61E64]'
                            : 'bg-white/80 border-[#2D3E99]/10 hover:border-[#2D3E99]/35'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-extrabold text-[#2D3E99] tabular-nums">
                              {unit.weeks} · {unit.unitCode}
                            </span>
                            {isActiveUnit && (
                              <span className="text-[11px] font-bold text-[#E61E64]">
                                {biText(lang, '● CURRENT WEEK FOCUS', '● BÀI ĐANG HỌC TUẦN NÀY')}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openQuizModal(inspectedCourse, unit);
                            }}
                            className="text-[11px] font-bold text-[#2D3E99] hover:text-[#E61E64] flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Play className="w-3 h-3" />
                            {biText(lang, 'Practice Quiz', 'Làm thử Bài tập')}
                          </button>
                        </div>

                        <div className="font-display text-sm font-bold text-[#172154] mt-1">
                          {biText(lang, unit.titleEn, unit.titleVi)}
                        </div>
                        <p className="text-xs text-[#172154]/75 mt-1 leading-relaxed">
                          <strong>{biText(lang, 'Focus:', 'Trọng tâm:')}</strong>{' '}
                          {biText(lang, unit.languageFocusEn, unit.languageFocusVi)}
                        </p>
                        <p className="text-[11px] text-[#0F766E] font-medium mt-1">
                          <strong>{biText(lang, 'Project / Activity:', 'Dự án / Hoạt động:')}</strong>{' '}
                          {biText(lang, unit.activitiesAndProjectsEn, unit.activitiesAndProjectsVi)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right 5 Cols: What They Have To Do Quick Summary + Next Level Unlock Preview */}
            <div className="lg:col-span-5 space-y-4">
              {/* Quick Action Card: What to do in Current Week */}
              <div className="bg-white border border-[#2D3E99]/15 rounded-2xl p-5 space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-[#E61E64]" />
                    <h4 className="font-display text-base font-extrabold text-[#2D3E99]">
                      {biText(
                        lang,
                        `This Week’s Mission (Week ${currentWeek})`,
                        `Nhiệm Vụ Cần Làm Tuần ${currentWeek}`
                      )}
                    </h4>
                  </div>
                  <span className="font-mono text-xs font-bold text-[#0F766E] tabular-nums">
                    {completedWeekCount}/{weeklyActionItems.length} ({weekTaskPercent}%)
                  </span>
                </div>

                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#2D3E99] via-[#E61E64] to-[#FFD41D] transition-all duration-300"
                    style={{ width: `${Math.max(8, weekTaskPercent)}%` }}
                  />
                </div>

                <div className="space-y-2">
                  {weeklyActionItems.map((item) => {
                    const isDone = Boolean(completedTasks[item.id]);
                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-xl border transition-colors ${
                          isDone
                            ? 'bg-[#0F766E]/10 border-[#0F766E]/30'
                            : 'bg-[#FDF9EE]/60 border-[#2D3E99]/12'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <input
                            type="checkbox"
                            checked={isDone}
                            onChange={() => toggleTaskDone(item.id)}
                            className="mt-1 rounded cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-[#E61E64]">
                              <span>{biText(lang, item.categoryEn, item.categoryVi)}</span>
                              <span className="font-mono text-[#172154]/60 tabular-nums">
                                {item.timeBadge}
                              </span>
                            </div>
                            <div className="text-xs font-bold text-[#172154] mt-0.5">
                              {biText(lang, item.titleEn, item.titleVi)}
                            </div>
                            {item.hasQuiz && (
                              <button
                                type="button"
                                onClick={() => openQuizModal(currentCourse, currentUnit)}
                                className="mt-1.5 px-2.5 py-1 rounded-lg bg-[#2D3E99] text-white text-[11px] font-semibold hover:bg-[#1f2c73] inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Play className="w-3 h-3 text-[#FFD41D]" />
                                {biText(
                                  lang,
                                  'Start Digital Homework Exercise',
                                  'Làm Bài Tập Số Hóa Ngay'
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setActiveSubView('todo')}
                  className="w-full py-2 px-3 rounded-xl bg-[#FDF9EE] border border-[#2D3E99]/20 text-xs font-bold text-[#2D3E99] hover:bg-[#2D3E99] hover:text-white transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>
                    {biText(
                      lang,
                      'Open Full Weekly Action Center & Rubric Weights',
                      'Mở Chi Tiết Nhiệm Vụ Tuần & Tỷ Trọng Điểm Đánh Giá'
                    )}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Next Level Unlock Card */}
              <div className="bg-[#FDF9EE] border border-[#2D3E99]/20 rounded-2xl p-5 space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-bold text-[#E61E64] uppercase tracking-wider">
                    {biText(
                      lang,
                      'Next-Level Pathway Unlock',
                      'Lộ Trình Mở Khóa Cấp Độ Tiếp Theo'
                    )}
                  </div>
                  <span className="font-mono text-xs font-bold text-[#2D3E99] tabular-nums">
                    {weeksRemainingToNextLevel}w · {hoursRemainingToNextLevel}h {biText(lang, 'remaining', 'còn lại')}
                  </span>
                </div>

                {nextCourse ? (
                  <>
                    <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-[#2D3E99]/12">
                      <img
                        src={nextCourse.lilabCharacterImg}
                        alt={nextCourse.titleEn}
                        className="w-14 h-14 rounded-lg bg-[#FDF9EE] p-1 object-contain shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-mono font-bold text-[#0F766E]">
                          NEXT: LEVEL {nextCourse.levelNumber} · {nextCourse.code} ({nextCourse.cefrBand})
                        </div>
                        <div className="font-display text-sm font-extrabold text-[#2D3E99] truncate">
                          {biText(lang, nextCourse.titleEn, nextCourse.titleVi)}
                        </div>
                        <div className="text-[11px] text-[#172154]/70 truncate">
                          {biText(lang, nextCourse.cambridgeMilestoneEn, nextCourse.cambridgeMilestoneVi)}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="text-[11px] font-bold text-[#172154]/75">
                        {biText(
                          lang,
                          `Requirements to Graduate from ${currentCourse.code}:`,
                          `Điều kiện hoàn thành ${currentCourse.code} để lên cấp:`
                        )}
                      </div>
                      {(lang === 'vi'
                        ? currentCourse.nextLevelUnlockCriteriaVi
                        : currentCourse.nextLevelUnlockCriteriaEn
                      ).map((req, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs text-[#172154]/85">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#2D3E99] shrink-0 mt-0.5" />
                          <span>{req}</span>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveSubView('next_courses')}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#2D3E99] text-white text-xs font-bold hover:bg-[#1f2c73] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <GraduationCap className="w-4 h-4 text-[#FFD41D]" />
                      <span>
                        {biText(
                          lang,
                          `Explore Next Course (${nextCourse.code}) & Full Syllabus`,
                          `Xem Khóa Tiếp Theo (${nextCourse.code}) & Lộ Trình 13 Cấp`
                        )}
                      </span>
                    </button>
                  </>
                ) : (
                  <div className="text-xs text-[#172154]/85 space-y-2">
                    <p className="font-bold text-[#0F766E]">
                      {biText(
                        lang,
                        'You are in the highest Senior Capstone Level (Level 13 · Future Leaders 5 · C1 / IELTS 6.5+)!',
                        'Con đang ở Cấp độ Đỉnh cao Cuối khóa (Cấp 13 · Future Leaders 5 · C1 / IELTS 6.5+)!'
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-VIEW 2: WHAT THEY HAVE TO DO THIS WEEK (ACTION & ASSESSMENT)      */}
      {/* ===================================================================== */}
      {activeSubView === 'todo' && (
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 7 Cols: Interactive Weekly Tasks & Textbooks */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-lg font-extrabold text-[#2D3E99]">
                    {biText(
                      lang,
                      `Weekly Action Checklist · ${currentCourse.code} Week ${currentWeek}`,
                      `Nhiệm Vụ Học Tập Tuần ${currentWeek} · Cấp Độ ${currentCourse.code}`
                    )}
                  </h3>
                  <p className="text-xs text-[#172154]/70">
                    {biText(
                      lang,
                      'Check off each task as you complete your classwork, digital homework, and experiential project.',
                      'Đánh dấu hoàn thành từng nhiệm vụ khi con làm xong bài trên lớp, bài tập số hóa và dự án trải nghiệm.'
                    )}
                  </p>
                </div>
                <span className="font-mono text-xs font-extrabold text-[#E61E64] bg-[#FDF9EE] px-3 py-1.5 rounded-lg border border-[#E61E64]/25 tabular-nums">
                  {completedWeekCount} / {weeklyActionItems.length}{' '}
                  {biText(lang, 'Completed', 'Hoàn thành')}
                </span>
              </div>

              <div className="space-y-3">
                {weeklyActionItems.map((item) => {
                  const isDone = Boolean(completedTasks[item.id]);
                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        isDone
                          ? 'bg-[#0F766E]/10 border-[#0F766E]/40'
                          : 'bg-white border-[#2D3E99]/15 hover:border-[#2D3E99]/35'
                      }`}
                    >
                      <div className="flex items-start gap-3.5">
                        <input
                          type="checkbox"
                          checked={isDone}
                          onChange={() => toggleTaskDone(item.id)}
                          className="mt-1 w-4 h-4 rounded cursor-pointer"
                        />
                        <div className="flex-1 space-y-1.5">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="font-bold text-[#E61E64]">
                              {biText(lang, item.categoryEn, item.categoryVi)} ·{' '}
                              {biText(lang, item.pillarBadgeEn, item.pillarBadgeVi)}
                            </span>
                            <span className="font-mono font-bold text-[#2D3E99] tabular-nums">
                              {item.timeBadge}
                            </span>
                          </div>
                          <h4 className="font-display text-sm sm:text-base font-bold text-[#172154]">
                            {biText(lang, item.titleEn, item.titleVi)}
                          </h4>
                          <p className="text-xs text-[#172154]/75 leading-relaxed">
                            {biText(lang, item.detailEn, item.detailVi)}
                          </p>
                          {item.hasQuiz && (
                            <div className="pt-1.5">
                              <button
                                type="button"
                                onClick={() => openQuizModal(currentCourse, currentUnit)}
                                className="px-3.5 py-2 rounded-xl bg-[#2D3E99] text-white text-xs font-bold hover:bg-[#1f2c73] transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                <Play className="w-3.5 h-3.5 text-[#FFD41D]" />
                                {biText(
                                  lang,
                                  'Launch Interactive Homework Quiz',
                                  'Mở Bài Tập Tương Tác Tuần Này'
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Required Textbooks for Current Level */}
              <div className="bg-[#FDF9EE] border border-[#2D3E99]/15 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-[#2D3E99] uppercase tracking-wider">
                  <BookOpen className="w-4 h-4 text-[#E61E64]" />
                  <span>
                    {biText(
                      lang,
                      `Official Publisher Textbooks for ${currentCourse.code}`,
                      `Bộ Giáo Trình Quốc Tế Chính Thức Của ${currentCourse.code}`
                    )}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {currentCourse.textbooks.map((tb, idx) => (
                    <div
                      key={idx}
                      className="bg-white border border-[#2D3E99]/12 rounded-xl p-3.5 space-y-1"
                    >
                      <div className="text-[11px] font-bold text-[#E61E64]">{tb.publisher}</div>
                      <div className="font-display text-xs sm:text-sm font-extrabold text-[#2D3E99]">
                        {tb.title}
                      </div>
                      <p className="text-xs text-[#172154]/75 leading-relaxed">
                        {biText(lang, tb.roleEn, tb.roleVi)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right 5 Cols: Official Division Assessment Weights & LiLab Folklore Companion */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-[#FDF9EE]/80 border border-[#2D3E99]/15 rounded-2xl p-5 space-y-4">
                <div>
                  <div className="text-xs font-bold text-[#E61E64] uppercase tracking-wider">
                    {biText(
                      lang,
                      'Official PCE-Kids Assessment Architecture',
                      'Cơ Cấu Điểm Đánh Giá Chính Thức Khung PCE-Kids'
                    )}
                  </div>
                  <h4 className="font-display text-base font-extrabold text-[#2D3E99] mt-0.5">
                    {biText(lang, currentCourse.divisionNameEn, currentCourse.divisionNameVi)}
                  </h4>
                </div>

                <div className="space-y-3">
                  {currentCourse.assessmentWeights.map((aw, idx) => (
                    <div
                      key={idx}
                      className="bg-white border border-[#2D3E99]/10 rounded-xl p-3 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-[#172154]">
                          {biText(lang, aw.componentEn, aw.componentVi)}
                        </span>
                        <span className="font-mono text-[#E61E64] tabular-nums">
                          {aw.weightPercent}%
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-[#2D3E99] rounded-full"
                          style={{ width: `${aw.weightPercent}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-[#172154]/70 leading-relaxed">
                        {biText(lang, aw.descriptionEn, aw.descriptionVi)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* LiLab Cultural Storytelling Card */}
              <div className="bg-white border border-[#2D3E99]/15 rounded-2xl p-4 flex items-center gap-4">
                <img
                  src={currentCourse.lilabFolkloreImg}
                  alt="LiLab Cultural Illustration"
                  className="w-20 h-20 rounded-xl bg-[#FDF9EE] p-1.5 border border-[#2D3E99]/15 object-contain shrink-0"
                />
                <div className="space-y-1">
                  <div className="text-[11px] font-bold text-[#E61E64]">
                    {biText(lang, 'LiLab Visual & Cultural Companion', 'Biểu Tượng Văn Hóa LiLab')}
                  </div>
                  <div className="font-display text-xs sm:text-sm font-bold text-[#2D3E99]">
                    {biText(
                      lang,
                      currentCourse.lilabMascotCaptionEn,
                      currentCourse.lilabMascotCaptionVi
                    )}
                  </div>
                  {onNavigateTab && (
                    <button
                      type="button"
                      onClick={() => onNavigateTab('resources')}
                      className="text-xs font-bold text-[#2D3E99] hover:text-[#E61E64] inline-flex items-center gap-1 pt-0.5 cursor-pointer"
                    >
                      <span>
                        {biText(
                          lang,
                          'Go to Resource Library & Assigned Worksheets',
                          'Mở Thư Viện Học Liệu & Bài Tập Được Giao'
                        )}
                      </span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-VIEW 3: COURSES TO GET TO THE NEXT LEVEL & FULL 13-LEVEL CATALOG  */}
      {/* ===================================================================== */}
      {activeSubView === 'next_courses' && (
        <div className="p-6 space-y-6">
          {/* Top Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-display text-lg font-extrabold text-[#2D3E99]">
                {biText(
                  lang,
                  'Courses to Reach the Next Level & Full 13-Level PCE-Kids Curriculum',
                  'Các Khóa Học Để Lên Cấp Tiếp Theo & Toàn Bộ 13 Cấp Độ PCE-Kids'
                )}
              </h3>
              <p className="text-xs text-[#172154]/70">
                {biText(
                  lang,
                  'Inspect required courses, textbooks, and week-by-week syllabi to advance from your current level to C1 / IELTS 6.5+.',
                  'Xem chi tiết các khóa học cần thiết, bộ giáo trình và đề cương từng tuần để tiến lên cấp độ tiếp theo.'
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {[
                {
                  id: 'recommended' as const,
                  label: biText(lang, 'Recommended Next Steps', 'Lộ Trình Tiếp Theo Đề Xuất'),
                },
                {
                  id: 'all' as const,
                  label: biText(lang, 'All 13 Levels', 'Tất Cả 13 Cấp Độ'),
                },
                {
                  id: 'early_years' as const,
                  label: biText(lang, 'Early Years (3–6)', 'Mầm Non (3–6t)'),
                },
                {
                  id: 'primary' as const,
                  label: biText(lang, 'Primary (6–11)', 'Tiểu Học (6–11t)'),
                },
                {
                  id: 'teen' as const,
                  label: biText(lang, 'Teen (11–16)', 'Thiếu Niên (11–16t)'),
                },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setCatalogFilter(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    catalogFilter === f.id
                      ? 'bg-[#E61E64] text-white'
                      : 'bg-[#FDF9EE] text-[#172154]/80 border border-[#2D3E99]/15 hover:border-[#2D3E99]/40'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Course Cards List with Expandable Week-by-Week Syllabi */}
          <div className="space-y-4">
            {filteredCatalogCourses.map((course) => {
              const isCurrent = course.levelNumber === currentCourse.levelNumber;
              const isImmediateNext = course.levelNumber === currentCourse.levelNumber + 1;
              const isExpanded = expandedSyllabusCode === course.code;
              const isGoal = goalCourseCodes.includes(course.code);

              return (
                <div
                  key={course.code}
                  className={`rounded-2xl border transition-all overflow-hidden ${
                    isImmediateNext
                      ? 'bg-[#FDF9EE]/90 border-[#E61E64] ring-1 ring-[#E61E64]'
                      : isCurrent
                        ? 'bg-white border-[#2D3E99] ring-1 ring-[#2D3E99]'
                        : 'bg-white border-[#2D3E99]/15'
                  }`}
                >
                  <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
                    {/* Col 1–2: LiLab Character Artwork */}
                    <div className="lg:col-span-2 flex items-center justify-center">
                      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-[#FDF9EE] border border-[#2D3E99]/15 p-2 flex items-center justify-center">
                        <img
                          src={course.lilabCharacterImg}
                          alt={course.titleEn}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>

                    {/* Col 3–8: Course Metadata, Textbooks & Unlock Criteria */}
                    <div className="lg:col-span-7 space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                        <span className="text-[#E61E64]">
                          LEVEL {course.levelNumber}/13 · {course.code}
                        </span>
                        <span>·</span>
                        <span className="text-[#2D3E99]">{course.cefrBand}</span>
                        <span>·</span>
                        <span className="text-[#172154]/70">
                          {biText(lang, course.ageRangeEn, course.ageRangeVi)}
                        </span>
                        {isCurrent && (
                          <span className="text-[#0F766E] font-extrabold">
                            · {biText(lang, '● CURRENT ENROLLED LEVEL', '● CẤP ĐỘ HIỆN TẠI')}
                          </span>
                        )}
                        {isImmediateNext && (
                          <span className="text-[#D97706] font-extrabold">
                            · {biText(lang, '★ RECOMMENDED NEXT LEVEL', '★ CẤP ĐỘ KẾ TIẾP ĐỀ XUẤT')}
                          </span>
                        )}
                      </div>

                      <h4 className="font-display text-lg sm:text-xl font-extrabold text-[#2D3E99]">
                        {biText(lang, course.titleEn, course.titleVi)}
                      </h4>

                      <p className="text-xs text-[#172154]/80 leading-relaxed">
                        {biText(lang, course.summaryEn, course.summaryVi)}
                      </p>

                      <div className="text-xs text-[#172154]/75 font-mono tabular-nums pt-0.5">
                        <strong>{biText(lang, 'Duration:', 'Thời lượng:')}</strong>{' '}
                        {course.durationWeeks} {biText(lang, 'weeks', 'tuần')} ({course.hoursPerLevel}h ·{' '}
                        {course.cumulativeHours}h {biText(lang, 'cumulative', 'tích lũy')}) ·{' '}
                        <strong>{biText(lang, 'Milestone:', 'Cột mốc:')}</strong>{' '}
                        {biText(lang, course.cambridgeMilestoneEn, course.cambridgeMilestoneVi)}
                      </div>

                      <div className="text-xs text-[#2D3E99] font-medium">
                        <strong>{biText(lang, 'Textbooks:', 'Giáo trình:')}</strong>{' '}
                        {course.textbooks.map((t) => `${t.title} (${t.publisher})`).join(' + ')}
                      </div>
                    </div>

                    {/* Col 9–12: Actions (Syllabus Toggle + Enroll / Goal) */}
                    <div className="lg:col-span-3 flex flex-col gap-2.5 justify-end">
                      {portalRole === 'parent' ? (
                        <div className="space-y-2">
                          <div className="text-right font-mono text-sm font-extrabold text-[#2D3E99] tabular-nums">
                            {formatVnd(course.tuitionVnd)}{' '}
                            <span className="text-[11px] font-normal text-[#172154]/60">
                              / {course.durationWeeks}w
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleTriggerEnroll(course)}
                            className="w-full py-2.5 px-4 rounded-xl bg-[#E61E64] hover:bg-[#c81655] text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                          >
                            <GraduationCap className="w-4 h-4" />
                            <span>
                              {isImmediateNext
                                ? biText(lang, 'Enroll in Next Level', 'Đăng Ký Lên Cấp Tiếp Theo')
                                : biText(lang, 'Enroll Child in Course', 'Đăng Ký Khóa Học Này')}
                            </span>
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleGoalCourse(course.code)}
                          className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                            isGoal
                              ? 'bg-[#0F766E] text-white'
                              : 'bg-[#FFD41D] text-[#172154] hover:bg-[#f2c60f]'
                          }`}
                        >
                          <Flag className="w-3.5 h-3.5" />
                          <span>
                            {isGoal
                              ? biText(lang, 'Saved in My Next-Level Goals', 'Đã Lưu Vào Mục Tiêu Phấn Đấu')
                              : biText(lang, 'Set as My Next-Level Goal', 'Đặt Làm Mục Tiêu Tiếp Theo')}
                          </span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedSyllabusCode(isExpanded ? null : course.code)
                        }
                        className="w-full py-2 px-3 rounded-xl bg-[#FDF9EE] border border-[#2D3E99]/20 text-xs font-bold text-[#2D3E99] hover:bg-[#2D3E99] hover:text-white transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                      >
                        <span>
                          {isExpanded
                            ? biText(lang, 'Hide Week-by-Week Syllabus', 'Thu Gọn Đề Cương Tuần')
                            : biText(
                                lang,
                                `Inspect ${course.durationWeeks}-Week Syllabus`,
                                `Xem Đề Cương ${course.durationWeeks} Tuần`
                              )}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Week-by-Week Syllabus Table */}
                  {isExpanded && (
                    <div className="bg-[#FDF9EE]/60 border-t border-[#2D3E99]/12 p-5 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h5 className="font-display text-sm font-extrabold text-[#2D3E99]">
                          {biText(
                            lang,
                            `${course.code} Complete Week-by-Week Curriculum & Assessment Plan`,
                            `Đề Cương Chi Tiết Từng Tuần & Kế Hoạch Đánh Giá — ${course.code}`
                          )}
                        </h5>
                        <span className="text-xs font-medium text-[#172154]/70">
                          {biText(lang, course.digitalHomeworkEn, course.digitalHomeworkVi)}
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-[#2D3E99]/15 text-[#2D3E99] font-bold">
                              <th className="py-2 pr-3 whitespace-nowrap">
                                {biText(lang, 'Weeks / Unit', 'Tuần / Bài')}
                              </th>
                              <th className="py-2 px-3">
                                {biText(lang, 'Topic & Theme', 'Chủ đề Bài học')}
                              </th>
                              <th className="py-2 px-3">
                                {biText(lang, 'Vocabulary & Grammar Focus', 'Trọng tâm Từ vựng & Ngữ pháp')}
                              </th>
                              <th className="py-2 px-3">
                                {biText(lang, 'Experiential Project & Assessment', 'Dự án Trải nghiệm & Đánh giá')}
                              </th>
                              <th className="py-2 pl-3 text-right whitespace-nowrap">
                                {biText(lang, 'Interactive Tryout', 'Thực hành')}
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#2D3E99]/10">
                            {course.syllabus.map((u) => (
                              <tr key={u.unitCode} className="hover:bg-white/80">
                                <td className="py-2.5 pr-3 font-mono font-bold text-[#E61E64] whitespace-nowrap tabular-nums align-top">
                                  <div>{u.weeks}</div>
                                  <div className="text-[11px] text-[#2D3E99]">{u.unitCode}</div>
                                </td>
                                <td className="py-2.5 px-3 font-bold text-[#172154] align-top">
                                  {biText(lang, u.titleEn, u.titleVi)}
                                </td>
                                <td className="py-2.5 px-3 text-[#172154]/80 align-top">
                                  {biText(lang, u.languageFocusEn, u.languageFocusVi)}
                                </td>
                                <td className="py-2.5 px-3 text-[#172154]/80 align-top">
                                  <div className="text-[#0F766E] font-medium">
                                    {biText(lang, u.activitiesAndProjectsEn, u.activitiesAndProjectsVi)}
                                  </div>
                                  <div className="text-[11px] text-[#172154]/60 mt-0.5">
                                    {biText(lang, u.assessmentEn, u.assessmentVi)}
                                  </div>
                                </td>
                                <td className="py-2.5 pl-3 text-right align-top whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => openQuizModal(course, u)}
                                    className="px-2.5 py-1 rounded-lg bg-[#2D3E99] text-white text-[11px] font-semibold hover:bg-[#E61E64] transition-colors inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <Play className="w-3 h-3 text-[#FFD41D]" />
                                    {biText(lang, 'Try Quiz', 'Làm thử')}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-VIEW 4: LILAB VISUAL STYLE, FOLKLORE & 3 PEDAGOGICAL PILLARS       */}
      {/* ===================================================================== */}
      {activeSubView === 'pillars_folklore' && (
        <div className="p-6 space-y-6">
          {/* 3 Pedagogical Pillars */}
          <div className="space-y-3">
            <h3 className="font-display text-lg font-extrabold text-[#2D3E99]">
              {biText(
                lang,
                'The Three Pillars of PCE-Kids (Personalized · Communicative · Experiential)',
                'Ba Trụ Cột Sư Phạm Cốt Lõi Của PCE-Kids (Cá Nhân Hóa · Giao Tiếp · Trải Nghiệm)'
              )}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {PCE_PEDAGOGICAL_PILLARS.map((pillar) => (
                <div
                  key={pillar.id}
                  className="bg-[#FDF9EE]/80 border border-[#2D3E99]/15 rounded-2xl p-5 flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="h-36 w-full rounded-xl bg-white border border-[#2D3E99]/10 p-3 flex items-center justify-center">
                      <img
                        src={pillar.illustrationImg}
                        alt={pillar.titleEn}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <div>
                      <h4 className="font-display text-base font-extrabold text-[#2D3E99]">
                        {biText(lang, pillar.titleEn, pillar.titleVi)}
                      </h4>
                      <p className="text-xs font-semibold text-[#E61E64] mt-0.5">
                        {biText(lang, pillar.subtitleEn, pillar.subtitleVi)}
                      </p>
                    </div>
                    <ul className="space-y-1.5 text-xs text-[#172154]/85">
                      {(lang === 'vi' ? pillar.featuresVi : pillar.featuresEn).map((feat, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#0F766E] shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* LiLab Cultural & Folklore Storytelling Gallery */}
          <div className="space-y-3 pt-2 border-t border-[#2D3E99]/12">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-lg font-extrabold text-[#2D3E99]">
                  {biText(
                    lang,
                    'LiLab Cultural Heritage & Storytelling Illustrations',
                    'Bộ Minh Họa Văn Hóa Dân Gian & Nhân Vật Đặc Trưng LiLab'
                  )}
                </h3>
                <p className="text-xs text-[#172154]/70">
                  {biText(
                    lang,
                    'Students bring Vietnamese cultural stories into English role-plays, Show & Tell, and global projects.',
                    'Học viên lồng ghép niềm tự hào văn hóa dân gian Việt Nam vào các dự án kể chuyện và thuyết trình tiếng Anh quốc tế.'
                  )}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {LILAB_FOLKLORE_GALLERY.map((item) => (
                <div
                  key={item.id}
                  className="bg-white border border-[#2D3E99]/15 rounded-2xl p-4 space-y-3 flex flex-col justify-between"
                >
                  <div className="h-44 w-full rounded-xl bg-[#FDF9EE] p-2 flex items-center justify-center border border-[#2D3E99]/10">
                    <img
                      src={item.image}
                      alt={item.titleEn}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-display text-sm font-extrabold text-[#2D3E99]">
                      {biText(lang, item.titleEn, item.titleVi)}
                    </h4>
                    <p className="text-xs text-[#172154]/75 leading-relaxed">
                      {biText(lang, item.storyEn, item.storyVi)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 1: INTERACTIVE DIGITAL HOMEWORK & UNIT PRACTICE QUIZ            */}
      {/* ===================================================================== */}
      {quizModalUnit && (
        <div className="fixed inset-0 z-50 bg-[#172154]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-[#2D3E99] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-[#2D3E99]/12 pb-3">
              <div className="flex items-center gap-3">
                <img
                  src={quizModalUnit.course.lilabCharacterImg}
                  alt={quizModalUnit.course.code}
                  className="w-12 h-12 rounded-xl bg-[#FDF9EE] p-1 border border-[#2D3E99]/15 object-contain"
                />
                <div>
                  <div className="text-xs font-bold text-[#E61E64]">
                    {quizModalUnit.course.code} · {quizModalUnit.unit.weeks} ({quizModalUnit.unit.unitCode})
                  </div>
                  <h4 className="font-display text-base font-extrabold text-[#2D3E99]">
                    {biText(lang, quizModalUnit.unit.titleEn, quizModalUnit.unit.titleVi)}
                  </h4>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuizModalUnit(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-[#172154]/70 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitQuiz} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-[#FDF9EE] border border-[#2D3E99]/15 space-y-1">
                <div className="text-[11px] font-bold text-[#2D3E99] uppercase">
                  {biText(lang, 'Language & Grammar Focus:', 'Trọng tâm Ngôn ngữ & Ngữ pháp:')}
                </div>
                <p className="text-xs text-[#172154]/85">
                  {biText(
                    lang,
                    quizModalUnit.unit.languageFocusEn,
                    quizModalUnit.unit.languageFocusVi
                  )}
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#172154]">
                  {biText(
                    lang,
                    quizModalUnit.unit.quizQuestionEn,
                    quizModalUnit.unit.quizQuestionVi
                  )}
                </label>
                <div className="space-y-2">
                  {quizModalUnit.unit.quizOptions.map((opt, idx) => (
                    <label
                      key={idx}
                      className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                        selectedQuizOption === idx
                          ? 'bg-[#2D3E99]/10 border-[#2D3E99] text-[#2D3E99]'
                          : 'bg-white border-slate-200 text-[#172154]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="pce_quiz_opt"
                        checked={selectedQuizOption === idx}
                        onChange={() => setSelectedQuizOption(idx)}
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#172154] mb-1">
                  {biText(
                    lang,
                    'Write your own English sentence or speaking note for this unit:',
                    'Viết 1 câu tiếng Anh thực hành của em cho bài học này:'
                  )}
                </label>
                <input
                  type="text"
                  value={quizPracticeSentence}
                  onChange={(e) => setQuizPracticeSentence(e.target.value)}
                  placeholder={biText(
                    lang,
                    'Type your English practice sentence...',
                    'Nhập câu tiếng Anh thực hành của em...'
                  )}
                  className="w-full px-3 py-2 rounded-xl border border-[#2D3E99]/25 text-xs"
                />
              </div>

              {quizSubmitted && (
                <div
                  className={`p-3.5 rounded-xl border text-xs font-bold ${
                    selectedQuizOption === quizModalUnit.unit.quizAnswerIndex
                      ? 'bg-[#0F766E]/10 border-[#0F766E] text-[#0F766E]'
                      : 'bg-[#E61E64]/10 border-[#E61E64] text-[#E61E64]'
                  }`}
                >
                  {selectedQuizOption === quizModalUnit.unit.quizAnswerIndex
                    ? biText(
                        lang,
                        '✓ Awesome job! Correct answer! Your digital homework task for this week is marked complete.',
                        '✓ Tuyệt vời! Câu trả lời chính xác! Bài tập số hóa tuần này đã được ghi nhận hoàn thành.'
                      )
                    : biText(
                        lang,
                        `Good try! The correct answer is: "${quizModalUnit.unit.quizOptions[quizModalUnit.unit.quizAnswerIndex]}".`,
                        `Hãy thử lại nhé! Đáp án đúng là: "${quizModalUnit.unit.quizOptions[quizModalUnit.unit.quizAnswerIndex]}".`
                      )}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setQuizModalUnit(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-[#172154] cursor-pointer"
                >
                  {biText(lang, 'Close', 'Đóng')}
                </button>
                <button
                  type="submit"
                  disabled={selectedQuizOption === null}
                  className="px-4 py-2 rounded-xl bg-[#E61E64] text-white text-xs font-bold disabled:opacity-45 cursor-pointer"
                >
                  {biText(lang, 'Check Answer & Complete', 'Kiểm Tra Đáp Án & Hoàn Thành')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: EMBEDDED PCE-KIDS CURRICULUM PDF PROPOSAL VIEWER             */}
      {/* ===================================================================== */}
      {pdfPreviewLang && (
        <div className="fixed inset-0 z-50 bg-[#172154]/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-[#2D3E99] rounded-2xl max-w-5xl w-full h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-5 py-3.5 bg-[#172154] text-white flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <FileText className="w-4 h-4 text-[#FFD41D]" />
                <span className="font-display text-sm font-bold">
                  {pdfPreviewLang === 'vi'
                    ? 'Đề Xuất Chương Trình Giảng Dạy: Khung PCE-Kids (13 Cấp Độ · 3–16 Tuổi)'
                    : 'Curriculum Proposal: The PCE-Kids Framework (13 Levels · Ages 3–16)'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPdfPreviewLang('vi')}
                  className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                    pdfPreviewLang === 'vi' ? 'bg-[#FFD41D] text-[#172154]' : 'bg-white/15 text-white'
                  }`}
                >
                  Bản Tiếng Việt
                </button>
                <button
                  type="button"
                  onClick={() => setPdfPreviewLang('en')}
                  className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                    pdfPreviewLang === 'en' ? 'bg-[#FFD41D] text-[#172154]' : 'bg-white/15 text-white'
                  }`}
                >
                  English Version
                </button>
                <button
                  type="button"
                  onClick={() => setPdfPreviewLang(null)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-100">
              <iframe
                title="PCE-Kids Official Curriculum PDF"
                src={
                  pdfPreviewLang === 'vi'
                    ? '/api/media/pce_curriculum_vi.pdf'
                    : '/api/media/pce_curriculum_en.pdf'
                }
                className="w-full h-full border-0"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
