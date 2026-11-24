import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Globe,
  GraduationCap,
  Heart,
  MapPin,
  MessageCircle,
  Mic,
  Music,
  Phone,
  Sparkles,
  Theater,
  Users,
  X,
} from 'lucide-react';
import { db } from '../firebase';
import { biText, formatVnd } from '../i18n';
import type { LangCode, ProgramCourse } from '../types';

export const ZALO_PHONE_DISPLAY = '0707 547 187';
export const ZALO_PHONE_RAW = '0707547187';
export const ZALO_URL = `https://zalo.me/${ZALO_PHONE_RAW}`;
export const TEL_URL = `tel:${ZALO_PHONE_RAW}`;

type StaticCourseOptionId =
  | 'intro'
  | 'foundation_single'
  | 'foundation_combo'
  | 'music_poetry'
  | 'cultural_exploration'
  | 'mc_skills';

interface CourseOption {
  id: StaticCourseOptionId;
  group: 'signature' | 'specialty';
  badgeVi: string;
  badgeEn: string;
  titleVi: string;
  titleEn: string;
  priceVi: string;
  originalPriceVi?: string;
  savingsTagVi?: string;
  savingsTagEn?: string;
  bulletsVi: string[];
  bulletsEn: string[];
  featured?: boolean;
}

const COURSE_OPTIONS: CourseOption[] = [
  {
    id: 'intro',
    group: 'signature',
    badgeVi: '1. LỚP NHẬP MÔN',
    badgeEn: '1. INTRODUCTION',
    titleVi: 'INTRODUCTION – LỚP NHẬP MÔN',
    titleEn: 'INTRODUCTION – Starter Course',
    priceVi: '900.000 VNĐ / khoá',
    bulletsVi: [
      '4 buổi chuyên đề × 1 giờ',
      'Tặng 2 buổi trải nghiệm lễ giáo và kỹ năng ứng xử',
    ],
    bulletsEn: [
      '4 themed sessions × 1 hour',
      'Bonus: 2 complimentary etiquette & life-manners sessions',
    ],
  },
  {
    id: 'foundation_single',
    group: 'signature',
    badgeVi: '2. FOUNDATION',
    badgeEn: '2. FOUNDATION',
    titleVi: 'FOUNDATION – LEVEL 1, 2, 3',
    titleEn: 'FOUNDATION – Level 1, 2, or 3',
    priceVi: '2.000.000 VNĐ / khoá',
    bulletsVi: [
      'Mỗi cấp độ 8 buổi × 1,5 giờ',
      '100% giáo viên nước ngoài + chuyên gia đồng hành',
    ],
    bulletsEn: [
      '8 sessions × 1.5 hours per level',
      '100% foreign teachers + dedicated co-facilitator',
    ],
  },
  {
    id: 'foundation_combo',
    group: 'signature',
    badgeVi: 'ƯU ĐÃI TRỌN BỘ (-10%)',
    badgeEn: 'FULL 3-LEVEL BUNDLE (-10%)',
    titleVi: 'TRỌN BỘ 3 CẤP ĐỘ (LEVEL 1, 2 & 3)',
    titleEn: 'COMPLETE 3-LEVEL BUNDLE (L1 + L2 + L3)',
    priceVi: '5.400.000 VNĐ',
    originalPriceVi: '6.000.000 VNĐ',
    savingsTagVi: 'Giảm 10% · Tiết kiệm 600.000 VNĐ',
    savingsTagEn: '10% Off · Save 600,000 VND',
    bulletsVi: [
      'Trọn hành trình 3 cấp độ (24 buổi × 1,5 giờ)',
      'Ưu tiên xếp lớp sĩ số nhỏ tối đa 10 học sinh',
    ],
    bulletsEn: [
      'Full 3-level journey (24 sessions × 1.5 hours)',
      'Priority placement in small classes (max 10 students)',
    ],
    featured: true,
  },
  {
    id: 'music_poetry',
    group: 'specialty',
    badgeVi: 'TÀI NĂNG · ÂM NHẠC & THƠ',
    badgeEn: 'SPECIALTY · MUSIC & POETRY',
    titleVi: 'ÂM NHẠC & THƠ CA (MP-01)',
    titleEn: 'MUSIC & POETRY STUDIO (MP-01)',
    priceVi: '2.400.000 VNĐ / khoá',
    savingsTagVi: '8 buổi × 1,5 giờ · Độ tuổi 6–12',
    savingsTagEn: '8 sessions × 1.5h · Ages 6–12',
    bulletsVi: [
      'Học phát âm, ngữ điệu tiếng Anh qua ca hát & thơ thiếu nhi',
      'Sáng tác lời bài hát & biểu diễn mini recital cuối khoá (tối đa 10 bé)',
    ],
    bulletsEn: [
      'Natural pronunciation & rhythm through songs and children’s poetry',
      'Songwriting workshop + mini stage recital (max 10 students)',
    ],
  },
  {
    id: 'cultural_exploration',
    group: 'specialty',
    badgeVi: 'CÔNG DÂN TOÀN CẦU · VĂN HOÁ',
    badgeEn: 'SPECIALTY · CULTURAL LAB',
    titleVi: 'KHÁM PHÁ VĂN HOÁ THẾ GIỚI (CE-01)',
    titleEn: 'CULTURAL EXPLORATION LAB (CE-01)',
    priceVi: '2.600.000 VNĐ / khoá',
    savingsTagVi: '8 buổi × 1,5 giờ · Bao gồm học liệu thủ công',
    savingsTagEn: '8 sessions × 1.5h · Craft materials included',
    bulletsVi: [
      'Khám phá 8 nền văn hoá, lễ hội, truyện dân gian & nghi thức quốc tế',
      'Thuyết trình dự án Hộ Chiếu Văn Hoá bằng tiếng Anh (tối đa 10 bé)',
    ],
    bulletsEn: [
      'Journey through 8 world cultures, festivals, folklore & etiquette',
      'Hands-on cultural crafts + World Passport Expo presentation',
    ],
  },
  {
    id: 'mc_skills',
    group: 'specialty',
    badgeVi: 'TỰ TIN SÂN KHẤU · MC NHÍ',
    badgeEn: 'SPECIALTY · JUNIOR MC SKILLS',
    titleVi: 'KỸ NĂNG MC NHÍ SONG NGỮ (MC-01)',
    titleEn: 'JUNIOR MC & STAGE SKILLS (MC-01)',
    priceVi: '3.200.000 VNĐ / khoá',
    savingsTagVi: '10 buổi × 1,5 giờ · Kèm video Gala MC Nhí',
    savingsTagEn: '10 sessions × 1.5h · Filmed MC Gala reel',
    bulletsVi: [
      'Làm chủ micro, giọng nói, phong thái sân khấu & dẫn kịch bản song ngữ',
      'Sĩ số nhỏ tối đa 8 học viên + ghi hình Gala MC Nhí cuối khoá',
    ],
    bulletsEn: [
      'Voice projection, live mic hosting, interviews & bilingual scripts',
      'Boutique cohort (max 8 students) + filmed Junior MC Gala reel',
    ],
    featured: true,
  },
];

const EXPERIENCES = [
  {
    icon: BookOpen,
    accent: '#2D3E99',
    title: 'Reading & Comprehension',
    vi: 'Đọc truyện, thơ và khám phá ngôn ngữ.',
    en: 'Stories, poetry, and joyful language discovery.',
  },
  {
    icon: Theater,
    accent: '#E61E64',
    title: 'Storytelling & Role-play',
    vi: 'Kể chuyện, nhập vai và thực hành giao tiếp.',
    en: 'Expressive storytelling, role-play, and real communication.',
  },
  {
    icon: Music,
    accent: '#D97706',
    title: 'Music & Poetry',
    vi: 'Học tiếng Anh qua âm nhạc và thơ ca.',
    en: 'Absorb natural rhythm and English through songs & poems.',
  },
  {
    icon: Globe,
    accent: '#0D9488',
    title: 'Cultural Exploration',
    vi: 'Khám phá văn hoá và đời sống các quốc gia.',
    en: 'Explore traditions, stories, and daily life across cultures.',
  },
  {
    icon: Mic,
    accent: '#FF6B00',
    title: 'MC & Stage Skills',
    vi: 'Dẫn chương trình song ngữ, làm chủ micro và tự tin sân khấu.',
    en: 'Bilingual event hosting, voice projection, and stage confidence.',
  },
  {
    icon: Sparkles,
    accent: '#7C3AED',
    title: 'Life Skills & Creativity',
    vi: 'Phát triển kỹ năng sống, tư duy và khả năng biểu đạt.',
    en: 'Build confidence, critical thinking, and creative expression.',
  },
];

interface BigSkillsPromoModalProps {
  isOpen: boolean;
  lang: LangCode;
  onClose: (dontShowToday?: boolean) => void;
  highlightedProgramId?: string | null;
  canEnrollInPortal?: boolean;
  onEnrollFromPopup?: (programId: string) => void;
}

function getProgramTimestampMs(createdAt: unknown): number {
  if (!createdAt || typeof createdAt !== 'object') return 0;
  const ts = createdAt as { seconds?: number; toMillis?: () => number };
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  return 0;
}

export const BigSkillsPromoModal: React.FC<BigSkillsPromoModalProps> = ({
  isOpen,
  lang,
  onClose,
  highlightedProgramId,
  canEnrollInPortal = false,
  onEnrollFromPopup,
}) => {
  const [livePrograms, setLivePrograms] = useState<ProgramCourse[]>([]);
  const [selectedStaticCourse, setSelectedStaticCourse] = useState<StaticCourseOptionId>('foundation_combo');
  const [selectedDynamicProgramId, setSelectedDynamicProgramId] = useState<string | null>(null);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);

  // Subscribe to live LiLab programs when modal is open so newly added admin programs appear immediately
  useEffect(() => {
    if (!isOpen) return;
    const unsub = onSnapshot(
      collection(db, 'programs'),
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ProgramCourse));
        setLivePrograms(rows);
      },
      () => {
        // Non-blocking fallback if offline
      }
    );
    return () => unsub();
  }, [isOpen]);

  const featuredPopupPrograms = useMemo(() => {
    return livePrograms
      .filter((p) => p.isActive !== false && p.showInPromoPopup === true)
      .sort((a, b) => getProgramTimestampMs(b.createdAt) - getProgramTimestampMs(a.createdAt));
  }, [livePrograms]);

  // Auto-select newly added/highlighted program or first featured dynamic program when available
  useEffect(() => {
    if (!isOpen) return;
    if (highlightedProgramId && featuredPopupPrograms.some((p) => p.id === highlightedProgramId)) {
      setSelectedDynamicProgramId(highlightedProgramId);
    } else if (
      selectedDynamicProgramId &&
      !featuredPopupPrograms.some((p) => p.id === selectedDynamicProgramId)
    ) {
      setSelectedDynamicProgramId(featuredPopupPrograms[0]?.id ?? null);
    } else if (!selectedDynamicProgramId && featuredPopupPrograms.length > 0) {
      setSelectedDynamicProgramId(featuredPopupPrograms[0].id);
    }
  }, [isOpen, highlightedProgramId, featuredPopupPrograms, selectedDynamicProgramId]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const activeDynamicProgram =
    featuredPopupPrograms.find((p) => p.id === selectedDynamicProgramId) ?? null;
  const activeStaticCourse =
    COURSE_OPTIONS.find((c) => c.id === selectedStaticCourse) ?? COURSE_OPTIONS[2];

  const selectedTitleDisplay = activeDynamicProgram
    ? lang === 'en'
      ? activeDynamicProgram.titleEn
      : activeDynamicProgram.titleVi || activeDynamicProgram.titleEn
    : lang === 'en'
      ? activeStaticCourse.titleEn
      : activeStaticCourse.titleVi;

  const inquiryTemplate = activeDynamicProgram
    ? `Chào LiLab Creative Talent Academy, ba mẹ muốn tư vấn và đăng ký khoá học "${activeDynamicProgram.titleVi || activeDynamicProgram.titleEn}" (${activeDynamicProgram.code} - ${formatVnd(activeDynamicProgram.tuitionVnd)}${activeDynamicProgram.teacherName ? `, GV: ${activeDynamicProgram.teacherName}` : ''}${activeDynamicProgram.enrollmentDate ? `, ngày tuyển sinh: ${activeDynamicProgram.enrollmentDate}` : ''}) cho bé.`
    : `Chào LiLab Creative Talent Academy, ba mẹ muốn tư vấn lộ trình và đăng ký chương trình BIG SKILLS, BIG HEART (${activeStaticCourse.titleVi} - ${activeStaticCourse.priceVi}) cho bé (7-12 tuổi).`;

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(inquiryTemplate);
      setCopiedMsg(true);
      setTimeout(() => setCopiedMsg(false), 2600);
    } catch {
      // Clipboard may be blocked in strict sandbox; ignore gracefully
    }
  };

  const handleCopyPhone = async () => {
    try {
      await navigator.clipboard.writeText(ZALO_PHONE_RAW);
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2200);
    } catch {
      // Non-blocking
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#172154]/65 backdrop-blur-sm animate-fadeIn no-print"
      role="dialog"
      aria-modal="true"
      aria-labelledby="big-skills-promo-title"
      onClick={() => onClose(false)}
    >
      <div
        className="relative w-full max-w-4xl max-h-[92vh] bg-[#FDF9EE] rounded-3xl shadow-2xl border-2 border-[#2D3E99]/20 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Close Button */}
        <button
          type="button"
          onClick={() => onClose(false)}
          aria-label={biText(lang, 'Close announcement', 'Đóng thông báo')}
          className="absolute top-3.5 right-3.5 z-20 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-[#172154] shadow-md border border-[#2D3E99]/15 flex items-center justify-center transition-transform hover:scale-105 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Scrollable Body */}
        <div className="overflow-y-auto flex-1">
          {/* Hero Header */}
          <div className="relative bg-gradient-to-br from-[#2D3E99] via-[#263585] to-[#172154] text-white px-6 sm:px-8 pt-7 pb-6 overflow-hidden">
            {/* Soft Decorative Accents */}
            <div className="pointer-events-none absolute -top-12 -right-12 w-48 h-48 rounded-full bg-[#E61E64]/25 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-10 left-1/3 w-44 h-44 rounded-full bg-[#FFD41D]/20 blur-2xl" />

            <div className="relative flex flex-col md:flex-row items-center gap-6">
              <div className="flex-1 space-y-3 text-center md:text-left">
                <div className="inline-flex flex-wrap items-center justify-center md:justify-start gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#E61E64] text-white text-[11px] font-bold tracking-wide uppercase shadow-sm">
                    <Sparkles className="w-3.5 h-3.5" />
                    {biText(
                      lang,
                      'NOW ENROLLING · LILAB PROGRAMS & COURSES',
                      'KHAI GIẢNG · CHƯƠNG TRÌNH & KHÓA HỌC LILAB'
                    )}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#FFD41D] text-[#172154] text-[11px] font-extrabold">
                    {featuredPopupPrograms.length > 0
                      ? biText(
                          lang,
                          `${featuredPopupPrograms.length} New Course${featuredPopupPrograms.length > 1 ? 's' : ''} Open`,
                          `${featuredPopupPrograms.length} Khóa Mới Đang Mở`
                        )
                      : biText(lang, 'Ages 7–12', 'Học sinh 7–12 tuổi')}
                  </span>
                </div>

                <h2
                  id="big-skills-promo-title"
                  className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight text-white"
                >
                  BIG SKILLS, BIG HEART{' '}
                  <span className="text-[#FFD41D]">TẠI LILAB!</span>
                </h2>

                <p className="text-sm sm:text-[15px] text-white/95 font-medium leading-relaxed">
                  {biText(
                    lang,
                    'More than English — explore world cultures, build real life skills, and express yourself with confidence.',
                    'Không chỉ học tiếng Anh – Cùng con khám phá văn hoá, phát triển kỹ năng và tự tin thể hiện bản thân.'
                  )}
                </p>

                <p className="text-xs sm:text-[13px] text-white/80 leading-relaxed">
                  {biText(
                    lang,
                    'LiLab Creative Talent Academy offers small-group English & creative talent courses taught by dedicated international educators.',
                    'LiLab Creative Talent Academy tuyển sinh các lớp Tiếng Anh & phát triển tài năng quy mô nhỏ với đội ngũ giáo viên quốc tế tận tâm.'
                  )}
                </p>
              </div>

              {/* Mascot / Visual */}
              <div className="shrink-0 flex flex-col items-center">
                <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-2xl bg-[#FDF9EE] border-2 border-white/80 p-2.5 shadow-xl flex items-center justify-center overflow-hidden">
                  <img
                    src="/assets/media/lila_girl.webp"
                    alt="LiLab Creative Talent Academy Student"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const img = e.currentTarget;
                      if (!img.dataset.fallbackApplied) {
                        img.dataset.fallbackApplied = '1';
                        img.src = '/assets/lila_girl.png';
                      }
                    }}
                    className="w-full h-full object-contain drop-shadow-sm"
                  />
                </div>
                <span className="mt-2 text-[10px] font-bold uppercase tracking-widest text-[#56BEB8]">
                  LILAB ACADEMY · HCMC
                </span>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-7 space-y-6">
            {/* DYNAMIC SECTION: Admin-Added LiLab Programs & Courses */}
            {featuredPopupPrograms.length > 0 && (
              <div className="space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#E61E64] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      {biText(
                        lang,
                        'NEW LILAB COURSES · OPEN FOR ENROLLMENT',
                        'CHƯƠNG TRÌNH & KHÓA HỌC MỚI TẠI LILAB'
                      )}
                    </div>
                    <h3 className="font-display text-base sm:text-lg font-extrabold text-[#2D3E99]">
                      {biText(
                        lang,
                        'Featured LiLab Programs (Select a Course to Enroll)',
                        'Các Khóa Học Đang Tuyển Sinh (Chọn Khóa Để Đăng Ký)'
                      )}
                    </h3>
                  </div>
                  <span className="text-[11px] text-[#172154]/65 font-medium">
                    {biText(lang, 'Live from LiLab Academy', 'Cập nhật trực tiếp từ LiLab')}
                  </span>
                </div>

                <div
                  className={`grid grid-cols-1 ${
                    featuredPopupPrograms.length === 1
                      ? 'md:grid-cols-1'
                      : featuredPopupPrograms.length === 2
                        ? 'md:grid-cols-2'
                        : 'md:grid-cols-2'
                  } gap-4`}
                >
                  {featuredPopupPrograms.map((prog) => {
                    const isSelected = selectedDynamicProgramId === prog.id;
                    const isNewlyHighlighted = highlightedProgramId === prog.id;
                    return (
                      <div
                        key={prog.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedDynamicProgramId(prog.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedDynamicProgramId(prog.id);
                          }
                        }}
                        className={`relative rounded-2xl p-5 border-2 transition-all cursor-pointer flex flex-col justify-between gap-4 ${
                          isSelected
                            ? 'bg-white border-[#E61E64] shadow-lg shadow-[#E61E64]/15 ring-2 ring-[#E61E64]/20'
                            : 'bg-white border-[#2D3E99]/18 hover:border-[#2D3E99]/45'
                        }`}
                      >
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#E61E64] text-white text-[10px] font-extrabold uppercase tracking-wider">
                              {isNewlyHighlighted
                                ? biText(lang, 'JUST ADDED', 'VỪA MỞ LỚP')
                                : biText(
                                    lang,
                                    prog.promoBadgeEn || 'NOW ENROLLING',
                                    prog.promoBadgeVi || 'ĐANG TUYỂN SINH'
                                  )}
                            </span>
                            <span className="text-[11px] font-mono font-bold text-[#2D3E99] bg-[#2D3E99]/8 px-2 py-0.5 rounded-md">
                              {prog.code} · {prog.cefrTarget}
                            </span>
                          </div>

                          <div>
                            <h4 className="font-display text-lg font-extrabold text-[#2D3E99] leading-snug">
                              {lang === 'vi'
                                ? prog.titleVi || prog.titleEn
                                : lang === 'en'
                                  ? prog.titleEn
                                  : `${prog.titleVi || prog.titleEn} / ${prog.titleEn}`}
                            </h4>
                            <div className="mt-1.5 flex items-baseline gap-2">
                              <span className="font-display text-2xl font-extrabold text-[#E61E64] tabular-nums">
                                {formatVnd(prog.tuitionVnd)}
                              </span>
                              <span className="text-xs text-[#172154]/60 font-semibold">
                                / {prog.weeksCount} {biText(lang, 'weeks', 'tuần')}
                              </span>
                            </div>
                          </div>

                          {(prog.descriptionEn || prog.descriptionVi) && (
                            <p className="text-xs text-[#172154]/80 leading-relaxed">
                              {lang === 'vi'
                                ? prog.descriptionVi || prog.descriptionEn
                                : lang === 'en'
                                  ? prog.descriptionEn
                                  : `${prog.descriptionVi || prog.descriptionEn} — ${prog.descriptionEn}`}
                            </p>
                          )}

                          {/* Structured Course Metadata Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-[#2D3E99]/10 text-xs">
                            {prog.teacherName && (
                              <div className="flex items-center gap-1.5 text-[#172154]/85 font-semibold">
                                <GraduationCap className="w-3.5 h-3.5 text-[#2D3E99] shrink-0" />
                                <span className="truncate">
                                  {biText(lang, 'Teacher:', 'GV:')} {prog.teacherName}
                                </span>
                              </div>
                            )}
                            {prog.enrollmentDate && (
                              <div className="flex items-center gap-1.5 text-[#172154]/85 font-semibold">
                                <Calendar className="w-3.5 h-3.5 text-[#E61E64] shrink-0" />
                                <span>
                                  {biText(lang, 'Enroll by:', 'Ngày tuyển sinh:')} {prog.enrollmentDate}
                                </span>
                              </div>
                            )}
                            {prog.maxClassSize && (
                              <div className="flex items-center gap-1.5 text-[#172154]/85 font-semibold">
                                <Users className="w-3.5 h-3.5 text-[#0D9488] shrink-0" />
                                <span>
                                  {biText(
                                    lang,
                                    `Class Size: Max ${prog.maxClassSize} students`,
                                    `Sĩ số: Tối đa ${prog.maxClassSize} học viên`
                                  )}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 text-[#172154]/80 font-medium">
                              <Sparkles className="w-3.5 h-3.5 text-[#D97706] shrink-0" />
                              <span>
                                {biText(lang, 'Ages:', 'Độ tuổi:')} {prog.ageRange}
                              </span>
                            </div>
                            {prog.scheduleSummary && (
                              <div className="flex items-center gap-1.5 text-[#172154]/80 sm:col-span-2">
                                <Clock className="w-3.5 h-3.5 text-[#2D3E99] shrink-0" />
                                <span>{prog.scheduleSummary}</span>
                              </div>
                            )}
                            {prog.location && (
                              <div className="flex items-center gap-1.5 text-[#172154]/75 sm:col-span-2">
                                <MapPin className="w-3.5 h-3.5 text-[#E61E64] shrink-0" />
                                <span>{prog.location}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2 pt-1">
                          {canEnrollInPortal && onEnrollFromPopup && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEnrollFromPopup(prog.id);
                              }}
                              className="flex-1 py-2.5 px-3.5 rounded-xl bg-[#E61E64] hover:bg-[#c81655] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                            >
                              <span>{biText(lang, 'Select & Enroll Now', 'Chọn & Đăng Ký Ngay')}</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <a
                            href={ZALO_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className={`${
                              canEnrollInPortal && onEnrollFromPopup ? 'sm:w-auto px-3.5' : 'w-full px-3'
                            } py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors bg-[#0068FF] hover:bg-[#0055d4] text-white`}
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>{biText(lang, 'Register via Zalo', 'Đăng ký Zalo')}</span>
                            <ExternalLink className="w-3 h-3 opacity-80" />
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section 1: 5 Core Learning Experiences */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-5 rounded-full bg-[#E61E64]" />
                <h3 className="font-display text-sm sm:text-base font-bold text-[#2D3E99] uppercase tracking-wide">
                  {biText(
                    lang,
                    'What Children Experience at LiLab',
                    'Trẻ Sẽ Được Trải Nghiệm Điều Gì Tại LiLab?'
                  )}
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {EXPERIENCES.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.title}
                      className="bg-white rounded-2xl p-3.5 border border-[#2D3E99]/10 shadow-sm flex flex-col gap-2"
                    >
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0"
                        style={{ backgroundColor: item.accent }}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="font-display text-xs font-bold text-[#172154] leading-snug">
                        {item.title}
                      </div>
                      <p className="text-[11px] text-[#172154]/75 leading-relaxed">
                        {lang === 'en' ? item.en : item.vi}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 2: Signature Big Skills Courses & Tuition */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-5 rounded-full bg-[#2D3E99]" />
                  <h3 className="font-display text-sm sm:text-base font-bold text-[#2D3E99] uppercase tracking-wide">
                    {biText(
                      lang,
                      'Big Skills, Big Heart · Signature Tracks',
                      'Lộ Trình Big Skills, Big Heart & Học Phí'
                    )}
                  </h3>
                </div>
                <span className="text-[11px] text-[#172154]/65 font-medium">
                  {biText(
                    lang,
                    'Click a track to pre-fill your inquiry',
                    'Chọn khoá để tự tạo tin nhắn đăng ký'
                  )}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {COURSE_OPTIONS.filter((c) => c.group === 'signature').map((course) => {
                  const isSelected = !activeDynamicProgram && selectedStaticCourse === course.id;
                  return (
                    <div
                      key={course.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setSelectedDynamicProgramId(null);
                        setSelectedStaticCourse(course.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedDynamicProgramId(null);
                          setSelectedStaticCourse(course.id);
                        }
                      }}
                      className={`relative rounded-2xl p-4 border-2 transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                        course.featured
                          ? isSelected
                            ? 'bg-gradient-to-b from-[#FFF9DB] to-white border-[#E61E64] shadow-lg shadow-[#E61E64]/15'
                            : 'bg-gradient-to-b from-[#FFFBEB] to-white border-[#FFD41D] hover:border-[#E61E64]'
                          : isSelected
                            ? 'bg-white border-[#2D3E99] shadow-md'
                            : 'bg-white border-[#2D3E99]/12 hover:border-[#2D3E99]/40'
                      }`}
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                              course.featured
                                ? 'bg-[#E61E64] text-white'
                                : 'bg-[#2D3E99]/10 text-[#2D3E99]'
                            }`}
                          >
                            {lang === 'en' ? course.badgeEn : course.badgeVi}
                          </span>
                          {isSelected && (
                            <span className="w-5 h-5 rounded-full bg-[#2D3E99] text-white flex items-center justify-center">
                              <Check className="w-3 h-3" />
                            </span>
                          )}
                        </div>

                        <h4 className="font-display text-sm font-extrabold text-[#172154] leading-snug">
                          {lang === 'en' ? course.titleEn : course.titleVi}
                        </h4>

                        <div>
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="font-display text-lg font-extrabold text-[#E61E64]">
                              {course.priceVi}
                            </span>
                            {course.originalPriceVi && (
                              <span className="text-xs text-[#172154]/45 line-through font-medium">
                                {course.originalPriceVi}
                              </span>
                            )}
                          </div>
                          {course.savingsTagVi && (
                            <div className="text-[11px] font-bold text-[#0D9488] mt-0.5">
                              {lang === 'en'
                                ? course.savingsTagEn
                                : course.savingsTagVi}
                            </div>
                          )}
                        </div>

                        <ul className="space-y-1.5 pt-1 border-t border-[#2D3E99]/10">
                          {(lang === 'en' ? course.bulletsEn : course.bulletsVi).map(
                            (bullet) => (
                              <li
                                key={bullet}
                                className="flex items-start gap-1.5 text-xs text-[#172154]/85 leading-relaxed"
                              >
                                <Check className="w-3.5 h-3.5 text-[#56BEB8] shrink-0 mt-0.5" />
                                <span>{bullet}</span>
                              </li>
                            )
                          )}
                        </ul>
                      </div>

                      <a
                        href={ZALO_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                          course.featured || isSelected
                            ? 'bg-[#0068FF] hover:bg-[#0055d4] text-white'
                            : 'bg-[#2D3E99]/8 hover:bg-[#0068FF] text-[#2D3E99] hover:text-white'
                        }`}
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>
                          {biText(lang, 'Register on Zalo', 'Đăng ký qua Zalo')}
                        </span>
                        <ExternalLink className="w-3 h-3 opacity-80" />
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 2B: Creative Talent Specialty Programs (Music & Poetry, Cultural Exploration, Junior MC Skills) */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-5 rounded-full bg-[#FF6B00]" />
                  <h3 className="font-display text-sm sm:text-base font-bold text-[#2D3E99] uppercase tracking-wide">
                    {biText(
                      lang,
                      'Creative Talent Specialty Tracks · Music & Poetry · Culture · MC Skills',
                      'Khoá Tài Năng Chuyên Sâu · Âm Nhạc & Thơ Ca · Văn Hoá · MC Nhí'
                    )}
                  </h3>
                </div>
                <span className="text-[11px] text-[#172154]/65 font-medium">
                  {biText(
                    lang,
                    'Boutique small cohorts · Click to select',
                    'Lớp sĩ số nhỏ · Chọn khoá để đăng ký'
                  )}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {COURSE_OPTIONS.filter((c) => c.group === 'specialty').map((course) => {
                  const isSelected = !activeDynamicProgram && selectedStaticCourse === course.id;
                  return (
                    <div
                      key={course.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setSelectedDynamicProgramId(null);
                        setSelectedStaticCourse(course.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedDynamicProgramId(null);
                          setSelectedStaticCourse(course.id);
                        }
                      }}
                      className={`relative rounded-2xl p-4 border-2 transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                        course.featured
                          ? isSelected
                            ? 'bg-gradient-to-b from-[#FFF5EE] to-white border-[#E61E64] shadow-lg shadow-[#E61E64]/15'
                            : 'bg-gradient-to-b from-[#FFF7ED] to-white border-[#FF6B00]/45 hover:border-[#E61E64]'
                          : isSelected
                            ? 'bg-white border-[#2D3E99] shadow-md'
                            : 'bg-white border-[#2D3E99]/12 hover:border-[#2D3E99]/40'
                      }`}
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                              course.featured
                                ? 'bg-[#FF6B00] text-white'
                                : 'bg-[#2D3E99]/10 text-[#2D3E99]'
                            }`}
                          >
                            {lang === 'en' ? course.badgeEn : course.badgeVi}
                          </span>
                          {isSelected && (
                            <span className="w-5 h-5 rounded-full bg-[#2D3E99] text-white flex items-center justify-center">
                              <Check className="w-3 h-3" />
                            </span>
                          )}
                        </div>

                        <h4 className="font-display text-sm font-extrabold text-[#172154] leading-snug">
                          {lang === 'en' ? course.titleEn : course.titleVi}
                        </h4>

                        <div>
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="font-display text-lg font-extrabold text-[#E61E64] tabular-nums">
                              {course.priceVi}
                            </span>
                          </div>
                          {course.savingsTagVi && (
                            <div className="text-[11px] font-bold text-[#0D9488] mt-0.5">
                              {lang === 'en' ? course.savingsTagEn : course.savingsTagVi}
                            </div>
                          )}
                        </div>

                        <ul className="space-y-1.5 pt-1 border-t border-[#2D3E99]/10">
                          {(lang === 'en' ? course.bulletsEn : course.bulletsVi).map((bullet) => (
                            <li
                              key={bullet}
                              className="flex items-start gap-1.5 text-xs text-[#172154]/85 leading-relaxed"
                            >
                              <Check className="w-3.5 h-3.5 text-[#56BEB8] shrink-0 mt-0.5" />
                              <span>{bullet}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <a
                        href={ZALO_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                          course.featured || isSelected
                            ? 'bg-[#0068FF] hover:bg-[#0055d4] text-white'
                            : 'bg-[#2D3E99]/8 hover:bg-[#0068FF] text-[#2D3E99] hover:text-white'
                        }`}
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>{biText(lang, 'Register on Zalo', 'Đăng ký qua Zalo')}</span>
                        <ExternalLink className="w-3 h-3 opacity-80" />
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 3: Special Class Model */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#56BEB8]/40 bg-gradient-to-r from-[#F0FDFA] via-white to-[#EEF2FF]">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-[#0D9488]" />
                <h3 className="font-display text-xs sm:text-sm font-bold text-[#172154] uppercase tracking-wide">
                  {biText(lang, 'Special Class Model', 'Mô Hình Lớp Học Đặc Biệt')}
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex items-center gap-3 bg-white/90 rounded-xl p-3 border border-[#2D3E99]/10">
                  <div className="w-10 h-10 rounded-xl bg-[#2D3E99] text-white font-display font-extrabold text-sm flex items-center justify-center shrink-0">
                    ≤10
                  </div>
                  <div className="text-xs font-semibold text-[#172154] leading-snug">
                    {biText(
                      lang,
                      'Maximum 10 students per class',
                      'Tối đa 10 học sinh / lớp'
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-white/90 rounded-xl p-3 border border-[#E61E64]/15">
                  <div className="w-10 h-10 rounded-xl bg-[#E61E64] text-white font-display font-extrabold text-sm flex items-center justify-center shrink-0">
                    2 GV
                  </div>
                  <div className="text-xs font-semibold text-[#172154] leading-snug">
                    {biText(
                      lang,
                      '2 teachers / specialists accompanying every class',
                      '2 giáo viên / chuyên gia đồng hành'
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-white/90 rounded-xl p-3 border border-[#56BEB8]/25">
                  <div className="w-10 h-10 rounded-xl bg-[#0D9488] text-white flex items-center justify-center shrink-0">
                    <Heart className="w-4 h-4" />
                  </div>
                  <div className="text-xs font-semibold text-[#172154] leading-snug">
                    {biText(
                      lang,
                      'High interaction & personalized care for every child',
                      'Tăng cường thực hành, tương tác & theo sát từng học sinh'
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 4: Admissions Contact & Zalo Action Bar */}
            <div className="bg-[#172154] text-white rounded-2xl p-5 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#FFD41D]">
                    {biText(lang, 'Admissions & Consultation', 'Thông Tin Tuyển Sinh')}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-bold">
                    <a
                      href={ZALO_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-white hover:text-[#FFD41D] transition-colors"
                    >
                      <Phone className="w-4 h-4 text-[#56BEB8]" />
                      <span>Hotline / Zalo: {ZALO_PHONE_DISPLAY}</span>
                    </a>
                    <button
                      type="button"
                      onClick={handleCopyPhone}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-[11px] font-semibold text-white/90 cursor-pointer"
                    >
                      {copiedPhone ? (
                        <>
                          <Check className="w-3 h-3 text-[#56BEB8]" />
                          <span>{biText(lang, 'Copied!', 'Đã chép SĐT!')}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>{biText(lang, 'Copy number', 'Chép SĐT')}</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="flex items-start gap-1.5 text-xs text-white/80 leading-relaxed">
                    <MapPin className="w-3.5 h-3.5 text-[#E61E64] shrink-0 mt-0.5" />
                    <span>
                      C002 Chung cư ParcSpring, 537 Nguyễn Duy Trinh, phường Bình Trưng, TP.HCM.
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopyMessage}
                    className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedMsg ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#56BEB8]" />
                        <span>
                          {biText(lang, 'Message copied!', 'Đã chép tin nhắn!')}
                        </span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>
                          {biText(lang, 'Copy Inquiry Text', 'Chép mẫu đăng ký')}
                        </span>
                      </>
                    )}
                  </button>

                  <a
                    href={ZALO_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-2.5 rounded-xl bg-[#0068FF] hover:bg-[#1a7aff] text-white text-xs sm:text-sm font-extrabold shadow-lg shadow-[#0068FF]/35 flex items-center justify-center gap-2 transition-all"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>
                      {biText(
                        lang,
                        'Open Zalo to Register',
                        'Mở Zalo Đăng Ký Ngay'
                      )}
                    </span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              <div className="pt-3 border-t border-white/12 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
                <div className="text-[11px] text-white/75">
                  <span className="font-bold text-[#FFD41D]">
                    LILAB CREATIVE TALENT ACADEMY
                  </span>{' '}
                  · A place to read deeply, think freely and create beautifully.
                </div>
                <div className="text-[11px] italic text-[#56BEB8] font-medium">
                  Learn the Language. Experience the Culture. Express Yourself.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Dismiss Bar */}
        <div className="px-5 py-3 bg-white border-t border-[#2D3E99]/10 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-[#172154]/65 font-medium">
            {biText(lang, 'Selected course: ', 'Khoá đang chọn: ')}
            <strong className="text-[#2D3E99]">{selectedTitleDisplay}</strong>
          </span>
          <div className="flex items-center gap-3">
            {activeDynamicProgram && canEnrollInPortal && onEnrollFromPopup && (
              <button
                type="button"
                onClick={() => onEnrollFromPopup(activeDynamicProgram.id)}
                className="px-3.5 py-1.5 rounded-lg bg-[#E61E64] hover:bg-[#c81655] text-white font-bold cursor-pointer"
              >
                {biText(lang, 'Enroll in Parent Portal', 'Đăng ký trong Cổng Phụ huynh')}
              </button>
            )}
            <button
              type="button"
              onClick={() => onClose(true)}
              className="text-[#172154]/60 hover:text-[#172154] font-medium cursor-pointer"
            >
              {biText(lang, "Don't show again today", 'Không hiện lại hôm nay')}
            </button>
            <button
              type="button"
              onClick={() => onClose(false)}
              className="px-3.5 py-1.5 rounded-lg bg-[#2D3E99]/10 hover:bg-[#2D3E99]/15 text-[#2D3E99] font-bold cursor-pointer"
            >
              {biText(lang, 'Close', 'Đóng')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
