import React, { useState } from 'react';
import { biText } from '../i18n';
import { formatCefrLabel, type LangCode, type StudentAssessment } from '../types';

export interface VisualScores {
  speaking: number;
  reading: number;
  writing: number;
  vocabulary?: number;
  comprehension?: number;
  social: number;
  emotional: number;
  mental: number;
}

export interface VisualComparisonOverlay {
  baselineLabel: string;
  currentLabel: string;
  baselineScores: VisualScores;
  baselineCefr?: string;
}

export interface QuadrantCohortPoint {
  id: string;
  name: string;
  langAvg: number;
  wholeAvg: number;
  cefr?: string;
}

export function getAssessmentTimestampMs(
  a: Pick<StudentAssessment, 'id' | 'createdAt' | 'updatedAt'>
): number {
  const candidates = [a.createdAt, a.updatedAt];
  for (const val of candidates) {
    if (!val) continue;
    if (typeof val === 'number' && Number.isFinite(val)) return val;
    if (typeof val === 'string') {
      const parsed = Date.parse(val);
      if (Number.isFinite(parsed)) return parsed;
    }
    if (val instanceof Date) {
      const t = val.getTime();
      if (Number.isFinite(t)) return t;
    }
    if (typeof val === 'object') {
      const obj = val as { toMillis?: () => number; seconds?: number; _seconds?: number };
      if (typeof obj.toMillis === 'function') {
        const ms = obj.toMillis();
        if (Number.isFinite(ms)) return ms;
      }
      const secs = typeof obj.seconds === 'number' ? obj.seconds : obj._seconds;
      if (typeof secs === 'number' && Number.isFinite(secs)) return secs * 1000;
    }
  }
  const idMatch = /^asm_(\d+)/.exec(a.id || '');
  if (idMatch) {
    const ms = Number(idMatch[1]);
    if (Number.isFinite(ms)) return ms;
  }
  return 0;
}

export function formatAssessmentDateShort(
  a: Pick<StudentAssessment, 'id' | 'createdAt' | 'updatedAt'>,
  lang: LangCode
): string {
  const ms = getAssessmentTimestampMs(a);
  if (!ms) return biText(lang, 'Undated', 'Chưa rõ ngày');
  try {
    return new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-GB', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toISOString().slice(0, 10);
  }
}

export function formatAssessmentDateOption(a: StudentAssessment, lang: LangCode): string {
  const dateStr = formatAssessmentDateShort(a, lang);
  const cefr = formatCefrLabel(a.cefrLevel, a.cefrModifier);
  return `${dateStr} · ${a.termLabel} · ${cefr}`;
}

export function sortAssessmentsChronological(
  list: StudentAssessment[],
  order: 'asc' | 'desc' = 'desc'
): StudentAssessment[] {
  return [...list].sort((a, b) => {
    const diff = getAssessmentTimestampMs(a) - getAssessmentTimestampMs(b);
    if (diff !== 0) return order === 'asc' ? diff : -diff;
    return order === 'asc' ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id);
  });
}

export function assessmentToVisualScores(a: StudentAssessment): VisualScores {
  return {
    speaking: a.speakingScore,
    reading: a.readingScore,
    writing: a.writingScore,
    vocabulary: a.vocabularyScore ?? 0,
    comprehension: a.comprehensionScore ?? 0,
    social: a.socialScore,
    emotional: a.emotionalScore,
    mental: a.mentalScore,
  };
}

interface StudentVisualAnalyticsProps {
  lang: LangCode;
  studentName: string;
  cefrDisplay: string;
  termLabel?: string;
  scores: VisualScores;
  comparisonOverlay?: VisualComparisonOverlay;
  cohortPoints?: QuadrantCohortPoint[];
  isBaseline?: boolean;
  compact?: boolean;
}

export const StudentVisualAnalytics: React.FC<StudentVisualAnalyticsProps> = ({
  lang,
  studentName,
  cefrDisplay,
  termLabel,
  scores,
  comparisonOverlay,
  cohortPoints = [],
  isBaseline = false,
}) => {
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

  const normalizeScores = (raw: VisualScores) => ({
    speaking: clamp(raw.speaking),
    reading: clamp(raw.reading),
    writing: clamp(raw.writing),
    vocabulary: clamp(raw.vocabulary ?? 0),
    comprehension: clamp(raw.comprehension ?? 0),
    social: clamp(raw.social),
    emotional: clamp(raw.emotional),
    mental: clamp(raw.mental),
  });

  const s = normalizeScores(scores);
  const base = comparisonOverlay ? normalizeScores(comparisonOverlay.baselineScores) : null;

  const langAvg = Math.round((s.speaking + s.reading + s.writing + s.vocabulary + s.comprehension) / 5);
  const wholeAvg = Math.round((s.social + s.emotional + s.mental) / 3);
  const overallAvg = Math.round((langAvg + wholeAvg) / 2);

  const baseLangAvg = base
    ? Math.round((base.speaking + base.reading + base.writing + base.vocabulary + base.comprehension) / 5)
    : null;
  const baseWholeAvg = base
    ? Math.round((base.social + base.emotional + base.mental) / 3)
    : null;
  const baseOverallAvg =
    baseLangAvg !== null && baseWholeAvg !== null ? Math.round((baseLangAvg + baseWholeAvg) / 2) : null;

  const langDelta = baseLangAvg !== null ? langAvg - baseLangAvg : null;
  const wholeDelta = baseWholeAvg !== null ? wholeAvg - baseWholeAvg : null;
  const overallDelta = baseOverallAvg !== null ? overallAvg - baseOverallAvg : null;

  const formatDelta = (d: number) => (d > 0 ? `+${d}` : `${d}`);
  const deltaTextClass = (d: number) =>
    d > 0 ? 'text-[#0F766E]' : d < 0 ? 'text-[#E61E64]' : 'text-[#172154]/60';

  const [mapViewMode, setMapViewMode] = useState<'radial' | 'radar'>('radial');
  const [inspectedAxisKey, setInspectedAxisKey] = useState<string | null>(null);

  // 1. 8-Axis Radial Polar & Radar Map Geometry
  const radarAxes = [
    {
      key: 'speaking',
      label: biText(lang, 'Speaking', 'Nói'),
      shortLabel: biText(lang, 'SPEAKING', 'NÓI'),
      val: s.speaking,
      baseVal: base ? base.speaking : null,
      group: 'lang',
      color: '#4F7DF3',
      tipEn: 'Expressive spoken fluency, pronunciation clarity, and storytelling confidence.',
      tipVi: 'Sự lưu loát khi nói, phát âm rõ ràng và tự tin trình bày câu chuyện.',
    },
    {
      key: 'reading',
      label: biText(lang, 'Reading', 'Đọc'),
      shortLabel: biText(lang, 'READING', 'ĐỌC'),
      val: s.reading,
      baseVal: base ? base.reading : null,
      group: 'lang',
      color: '#E8632C',
      tipEn: 'Phonics decoding, storybook fluency, and reading comprehension accuracy.',
      tipVi: 'Khả năng giải mã ngữ âm, đọc trôi chảy và hiểu nội dung bài đọc.',
    },
    {
      key: 'writing',
      label: biText(lang, 'Writing', 'Viết'),
      shortLabel: biText(lang, 'WRITING', 'VIẾT'),
      val: s.writing,
      baseVal: base ? base.writing : null,
      group: 'lang',
      color: '#D27D2D',
      tipEn: 'Sentence structure, spelling accuracy, and creative written expression.',
      tipVi: 'Cấu trúc câu, chính tả chuẩn và khả năng diễn đạt viết sáng tạo.',
    },
    {
      key: 'vocabulary',
      label: biText(lang, 'Vocabulary', 'Từ vựng'),
      shortLabel: biText(lang, 'VOCAB', 'TỪ VỰNG'),
      val: s.vocabulary,
      baseVal: base ? base.vocabulary : null,
      group: 'lang',
      color: '#6CAFD3',
      tipEn: 'Active word bank range and accurate use of Cambridge & theme words.',
      tipVi: 'Vốn từ vựng chủ động và cách dùng từ chính xác theo chủ đề Cambridge.',
    },
    {
      key: 'comprehension',
      label:
        lang === 'en'
          ? 'Comprehension/Listening'
          : lang === 'vi'
            ? 'Nghe hiểu'
            : 'Nghe hiểu / Listening',
      shortLabel: biText(lang, 'LISTENING', 'NGHE'),
      val: s.comprehension,
      baseVal: base ? base.comprehension : null,
      group: 'lang',
      color: '#78B9A6',
      tipEn: 'Active listening focus, following multi-step instructions, and story recall.',
      tipVi: 'Khả năng tập trung nghe hiểu, làm theo hướng dẫn và ghi nhớ chi tiết.',
    },
    {
      key: 'social',
      label: biText(lang, 'Social', 'Xã hội'),
      shortLabel: biText(lang, 'SOCIAL', 'XÃ HỘI'),
      val: s.social,
      baseVal: base ? base.social : null,
      group: 'whole',
      color: '#57B773',
      tipEn: 'Kindness, teamwork, sharing ideas respectfully, and positive peer leadership.',
      tipVi: 'Lòng tốt, tinh thần hợp tác, lắng nghe và gắn kết tích cực cùng bạn bè.',
    },
    {
      key: 'emotional',
      label: biText(lang, 'Emotional', 'Cảm xúc'),
      shortLabel: biText(lang, 'EMOTION', 'CẢM XÚC'),
      val: s.emotional,
      baseVal: base ? base.emotional : null,
      group: 'whole',
      color: '#8083E8',
      tipEn: 'Self-awareness, calm emotional regulation, empathy, and joyful resilience.',
      tipVi: 'Nhận biết cảm xúc, giữ bình tĩnh, thấu cảm và vượt qua thử thách tích cực.',
    },
    {
      key: 'mental',
      label: biText(lang, 'Mental', 'Tinh thần'),
      shortLabel: biText(lang, 'MENTAL', 'TINH THẦN'),
      val: s.mental,
      baseVal: base ? base.mental : null,
      group: 'whole',
      color: '#B86228',
      tipEn: 'Curiosity, creative problem-solving, focus stamina, and growth mindset.',
      tipVi: 'Sự tò mò ham học hỏi, tư duy giải quyết vấn đề và tinh thần cầu tiến.',
    },
  ];

  const inspectedAxis = radarAxes.find((a) => a.key === inspectedAxisKey) || null;

  const angleStep = (2 * Math.PI) / radarAxes.length;
  const rCx = 215;
  const rCy = 166;
  const rMax = 104;
  const polarInnerR = 38;
  const polarOuterR = 112;

  const buildPolarWedgePath = (startAngle: number, endAngle: number, innerR: number, outerR: number) => {
    const x1 = rCx + outerR * Math.cos(startAngle);
    const y1 = rCy + outerR * Math.sin(startAngle);
    const x2 = rCx + outerR * Math.cos(endAngle);
    const y2 = rCy + outerR * Math.sin(endAngle);
    const x3 = rCx + innerR * Math.cos(endAngle);
    const y3 = rCy + innerR * Math.sin(endAngle);
    const x4 = rCx + innerR * Math.cos(startAngle);
    const y4 = rCy + innerR * Math.sin(startAngle);
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    return [
      `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
      `A ${outerR.toFixed(2)} ${outerR.toFixed(2)} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
      `L ${x3.toFixed(2)} ${y3.toFixed(2)}`,
      `A ${innerR.toFixed(2)} ${innerR.toFixed(2)} 0 ${largeArc} 0 ${x4.toFixed(2)} ${y4.toFixed(2)}`,
      'Z',
    ].join(' ');
  };

  const buildArcPath = (startAngle: number, endAngle: number, radius: number) => {
    const x1 = rCx + radius * Math.cos(startAngle);
    const y1 = rCy + radius * Math.sin(startAngle);
    const x2 = rCx + radius * Math.cos(endAngle);
    const y2 = rCy + radius * Math.sin(endAngle);
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius.toFixed(2)} ${radius.toFixed(2)} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  };

  const radarPolygon = radarAxes
    .map((axis, idx) => {
      const angle = angleStep * idx - Math.PI / 2;
      const r = (axis.val / 100) * rMax;
      return `${rCx + r * Math.cos(angle)},${rCy + r * Math.sin(angle)}`;
    })
    .join(' ');

  const baseRadarPolygon = base
    ? radarAxes
        .map((axis, idx) => {
          const angle = angleStep * idx - Math.PI / 2;
          const r = ((axis.baseVal ?? 0) / 100) * rMax;
          return `${rCx + r * Math.cos(angle)},${rCy + r * Math.sin(angle)}`;
        })
        .join(' ')
    : null;

  // 2. Quadrant Map Geometry (Expanded canvas: X = English Language Avg, Y = Holistic Wellbeing Avg)
  const qLeft = 52;
  const qTop = 22;
  const qWidth = 286;
  const qHeight = 216;
  const threshold = 55;
  const xMid = qLeft + (threshold / 100) * qWidth;
  const yMid = qTop + (1 - threshold / 100) * qHeight;

  const toQx = (val: number) => qLeft + (Math.max(0, Math.min(100, val)) / 100) * qWidth;
  const toQy = (val: number) => qTop + (1 - Math.max(0, Math.min(100, val)) / 100) * qHeight;

  const activeQx = toQx(langAvg);
  const activeQy = toQy(wholeAvg);
  const baseQx = baseLangAvg !== null ? toQx(baseLangAvg) : null;
  const baseQy = baseWholeAvg !== null ? toQy(baseWholeAvg) : null;

  // Shorten directional arrow endpoint slightly so the arrowhead stops cleanly at the rim of the target pin
  let arrowEndX = activeQx;
  let arrowEndY = activeQy;
  const hasMovement =
    baseQx !== null && baseQy !== null && (Math.abs(activeQx - baseQx) > 2 || Math.abs(activeQy - baseQy) > 2);
  if (hasMovement && baseQx !== null && baseQy !== null) {
    const dx = activeQx - baseQx;
    const dy = activeQy - baseQy;
    const dist = Math.hypot(dx, dy);
    if (dist > 10) {
      const pullBack = 9;
      arrowEndX = activeQx - (dx / dist) * pullBack;
      arrowEndY = activeQy - (dy / dist) * pullBack;
    }
  }

  const quadrantSummary =
    langAvg >= threshold && wholeAvg >= threshold
      ? biText(
          lang,
          'Flourishing Whole Learner (Strong English & Strong Wellbeing)',
          'Phát triển Toàn diện Xuất sắc (Anh ngữ & Nhân cách đều vững)'
        )
      : langAvg < threshold && wholeAvg >= threshold
        ? biText(
            lang,
            'Strong Character · Growing English Fluency',
            'Nhân cách Tốt · Đang tăng tốc Tiếng Anh'
          )
        : langAvg >= threshold && wholeAvg < threshold
          ? biText(
              lang,
              'Strong English · Building Social-Emotional Confidence',
              'Giỏi Tiếng Anh · Cần thêm Tự tin & Kết nối'
            )
          : biText(
              lang,
              'Guided Foundation Support Recommended',
              'Cần đồng hành & Hỗ trợ nền tảng'
            );

  // 3. Bar Graph Dimensions
  const barItems = [
    {
      label: biText(lang, 'Speaking', 'Nói (Speaking)'),
      domain: biText(lang, 'English', 'Anh ngữ'),
      val: s.speaking,
      baseVal: base ? base.speaking : null,
      color: '#2D3E99',
    },
    {
      label: biText(lang, 'Reading', 'Đọc (Reading)'),
      domain: biText(lang, 'English', 'Anh ngữ'),
      val: s.reading,
      baseVal: base ? base.reading : null,
      color: '#2563EB',
    },
    {
      label: biText(lang, 'Writing', 'Viết (Writing)'),
      domain: biText(lang, 'English', 'Anh ngữ'),
      val: s.writing,
      baseVal: base ? base.writing : null,
      color: '#0D9488',
    },
    {
      label: biText(lang, 'Vocabulary', 'Từ vựng (Vocabulary)'),
      domain: biText(lang, 'English', 'Anh ngữ'),
      val: s.vocabulary,
      baseVal: base ? base.vocabulary : null,
      color: '#0284C7',
    },
    {
      label: biText(lang, 'Comprehension/Listening', 'Nghe hiểu (Comprehension/Listening)'),
      domain: biText(lang, 'English', 'Anh ngữ'),
      val: s.comprehension,
      baseVal: base ? base.comprehension : null,
      color: '#4F46E5',
    },
    {
      label: biText(lang, 'Social', 'Xã hội (Social)'),
      domain: 'Be Whole',
      val: s.social,
      baseVal: base ? base.social : null,
      color: '#E61E64',
    },
    {
      label: biText(lang, 'Emotional', 'Cảm xúc (Emotional)'),
      domain: 'Be Whole',
      val: s.emotional,
      baseVal: base ? base.emotional : null,
      color: '#EC4899',
    },
    {
      label: biText(lang, 'Mental', 'Tinh thần (Mental)'),
      domain: 'Be Whole',
      val: s.mental,
      baseVal: base ? base.mental : null,
      color: '#F59E0B',
    },
  ];

  const getScoreBand = (val: number) => {
    if (val >= 80) return biText(lang, 'Strong', 'Tốt');
    if (val >= 65) return biText(lang, 'On Track', 'Đạt');
    return biText(lang, 'Focus', 'Cần rèn');
  };

  return (
    <div className="space-y-6">
      {/* Summary Banner */}
      <div className="bg-[#FDF9EE] border border-[#2D3E99]/15 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-display text-2xl sm:text-3xl font-extrabold text-[#2D3E99] tracking-tight report-banner-student-name">
              {studentName}
            </span>
            <span className="text-xs sm:text-sm font-bold text-[#E61E64] bg-[#E61E64]/10 border border-[#E61E64]/20 px-3 py-1 rounded-lg">
              {termLabel || biText(lang, '8-Dimension Visual Analysis', 'Phân tích Trực quan 8 Chiều')}
            </span>
          </div>
          <div className="font-display text-base sm:text-lg font-bold text-[#0F766E]">
            {quadrantSummary}
          </div>
          {comparisonOverlay && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#172154]/85">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-0.5 border-t-2 border-dashed border-[#D97706]" />
                <strong>{biText(lang, 'From:', 'Từ:')}</strong> {comparisonOverlay.baselineLabel}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-0.5 bg-[#2D3E99]" />
                <strong>{biText(lang, 'To:', 'Đến:')}</strong> {comparisonOverlay.currentLabel}
              </span>
            </div>
          )}
          {isBaseline && !comparisonOverlay && (
            <p className="text-xs text-[#172154]/70 mt-1">
              {biText(
                lang,
                'No published assessment reports yet. Exact teacher ratings will populate automatically once published.',
                'Chưa có báo cáo đánh giá nào. Điểm số chi tiết sẽ tự động cập nhật khi giáo viên xuất bản báo cáo.'
              )}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="bg-white border border-[#2D3E99]/15 rounded-xl px-3.5 py-2.5">
            <div className="text-xs font-semibold text-[#172154]/65">CEFR</div>
            <div className="font-mono-num text-base sm:text-lg font-extrabold text-[#E61E64]">{cefrDisplay}</div>
            {comparisonOverlay?.baselineCefr && (
              <div className="text-[10px] font-mono-num text-[#D97706] mt-0.5">
                {biText(lang, 'From', 'Từ')}: {comparisonOverlay.baselineCefr}
              </div>
            )}
          </div>
          <div className="bg-white border border-[#2D3E99]/15 rounded-xl px-3.5 py-2.5">
            <div className="text-xs font-semibold text-[#172154]/65">{biText(lang, 'English', 'Anh ngữ')}</div>
            <div className="font-mono-num text-base sm:text-lg font-extrabold text-[#2D3E99]">{langAvg}%</div>
            {langDelta !== null && (
              <div className={`text-[10px] font-mono-num font-bold mt-0.5 ${deltaTextClass(langDelta)}`}>
                {formatDelta(langDelta)}% ({baseLangAvg}%)
              </div>
            )}
          </div>
          <div className="bg-white border border-[#2D3E99]/15 rounded-xl px-3.5 py-2.5">
            <div className="text-xs font-semibold text-[#172154]/65">Be Whole</div>
            <div className="font-mono-num text-base sm:text-lg font-extrabold text-[#0D9488]">{wholeAvg}%</div>
            {wholeDelta !== null && (
              <div className={`text-[10px] font-mono-num font-bold mt-0.5 ${deltaTextClass(wholeDelta)}`}>
                {formatDelta(wholeDelta)}% ({baseWholeAvg}%)
              </div>
            )}
          </div>
          <div className="bg-white border border-[#2D3E99]/15 rounded-xl px-3.5 py-2.5">
            <div className="text-xs font-semibold text-[#172154]/65">{biText(lang, 'Overall', 'Tổng')}</div>
            <div className="font-mono-num text-base sm:text-lg font-extrabold text-[#172154]">{overallAvg}%</div>
            {overallDelta !== null && (
              <div className={`text-[10px] font-mono-num font-bold mt-0.5 ${deltaTextClass(overallDelta)}`}>
                {formatDelta(overallDelta)}% ({baseOverallAvg}%)
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top Row: Two Larger, Vibrant Spatial Charts (Radial Map & Whole-Child Quadrant Map) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CHART 1: 8-DIMENSION RADIAL POLAR / RADAR MAP */}
        <div className="bg-white border border-[#FDE68A] rounded-2xl p-6 flex flex-col justify-between space-y-4 shadow-xs">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#EA580C]">
                {biText(lang, '8-PILLAR RADIAL SKILL MAP', 'BẢN ĐỒ NĂNG LỰC 8 TRỤC')}
              </div>
              <h4 className="font-display text-lg sm:text-xl font-extrabold text-[#172154] mt-0.5">
                {mapViewMode === 'radial'
                  ? biText(lang, 'Concentric Radial Polar Map', 'Bản đồ Đồng tâm 8 Năng lực')
                  : biText(lang, '8-Axis Radar Polygon Map', 'Bản đồ Mạng nhện 8 Trục')}
              </h4>
            </div>

            {/* Radial | Radar Segmented Toggle (matches uploaded design) */}
            <div
              className="flex items-center gap-1 p-1 rounded-xl border border-[#FCD34D] bg-white shrink-0 no-print"
              role="tablist"
              aria-label={biText(lang, 'Map view mode', 'Chế độ hiển thị bản đồ')}
            >
              <button
                type="button"
                role="tab"
                aria-selected={mapViewMode === 'radial'}
                onClick={() => setMapViewMode('radial')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                  mapViewMode === 'radial'
                    ? 'bg-[#EA580C] text-white'
                    : 'text-[#172154] hover:bg-[#FFF7ED]'
                }`}
              >
                {biText(lang, 'Radial', 'Đồng tâm')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mapViewMode === 'radar'}
                onClick={() => setMapViewMode('radar')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                  mapViewMode === 'radar'
                    ? 'bg-[#EA580C] text-white'
                    : 'text-[#172154] hover:bg-[#FFF7ED]'
                }`}
              >
                {biText(lang, 'Radar', 'Mạng nhện')}
              </button>
            </div>
          </div>

          {mapViewMode === 'radial' ? (
            <svg
              viewBox="0 0 430 332"
              className="w-full max-w-[460px] mx-auto select-none"
              aria-label="Concentric Radial Polar Map"
            >
              {/* Soft outer cream backing circle */}
              <circle
                cx={rCx}
                cy={rCy}
                r={polarOuterR}
                fill="#FEFCE8"
                stroke="#FDE68A"
                strokeWidth={1.2}
              />

              {/* Concentric dashed reference rings (25%, 50%, 75%) */}
              {[0.25, 0.5, 0.75].map((pct) => (
                <circle
                  key={`polar-ring-${pct}`}
                  cx={rCx}
                  cy={rCy}
                  r={polarInnerR + pct * (polarOuterR - polarInnerR)}
                  fill="none"
                  stroke="#F59E0B"
                  strokeOpacity={0.28}
                  strokeWidth={1}
                  strokeDasharray="3 4"
                />
              ))}

              {/* 8 Polar Wedges with crisp white dividers & interactive inspection */}
              {radarAxes.map((axis, idx) => {
                const gapAngle = 0.055;
                const baseStart = -Math.PI / 2 + idx * angleStep;
                const startAngle = baseStart + gapAngle / 2;
                const endAngle = baseStart + angleStep - gapAngle / 2;
                const midAngle = (startAngle + endAngle) / 2;

                const valueR =
                  polarInnerR + Math.max(0.14, axis.val / 100) * (polarOuterR - polarInnerR);
                const trackPath = buildPolarWedgePath(startAngle, endAngle, polarInnerR, polarOuterR);
                const valuePath = buildPolarWedgePath(startAngle, endAngle, polarInnerR, valueR);

                const isSelected = inspectedAxisKey === axis.key;
                const scoreLabelR =
                  axis.val >= 28
                    ? polarInnerR + (valueR - polarInnerR) * 0.54
                    : valueR + 12;
                const sx = rCx + scoreLabelR * Math.cos(midAngle);
                const sy = rCy + scoreLabelR * Math.sin(midAngle);

                const outerLabelR = polarOuterR + 24;
                const lx = rCx + outerLabelR * Math.cos(midAngle);
                const ly = rCy + outerLabelR * Math.sin(midAngle);
                const cos = Math.cos(midAngle);
                const textAnchor = Math.abs(cos) < 0.2 ? 'middle' : cos > 0 ? 'start' : 'end';

                const baselineArcR =
                  axis.baseVal !== null
                    ? polarInnerR + Math.max(0.08, axis.baseVal / 100) * (polarOuterR - polarInnerR)
                    : null;

                return (
                  <g
                    key={`wedge-${axis.key}`}
                    onMouseEnter={() => setInspectedAxisKey(axis.key)}
                    onClick={() =>
                      setInspectedAxisKey((prev) => (prev === axis.key ? null : axis.key))
                    }
                    className="cursor-pointer"
                  >
                    {/* Crisp white radial separator background */}
                    <path
                      d={trackPath}
                      fill="#FFFBEB"
                      fillOpacity={0.85}
                      stroke="#FFFFFF"
                      strokeWidth={2.5}
                    />
                    {/* Active Score Polar Wedge */}
                    <path
                      d={valuePath}
                      fill={axis.color}
                      fillOpacity={inspectedAxisKey && !isSelected ? 0.65 : 0.95}
                      stroke={isSelected ? '#172154' : '#FFFFFF'}
                      strokeWidth={isSelected ? 2 : 1.5}
                      className="transition-opacity duration-150"
                    >
                      <title>{`${axis.label}: ${axis.val}/100`}</title>
                    </path>

                    {/* Optional Baseline Comparison Arc Band (matches emerald arc accent) */}
                    {baselineArcR !== null && (
                      <path
                        d={buildArcPath(startAngle + 0.03, endAngle - 0.03, baselineArcR)}
                        fill="none"
                        stroke="#10B981"
                        strokeWidth={3.2}
                        strokeLinecap="round"
                      />
                    )}

                    {/* White Numeric Score inside Wedge */}
                    <text
                      x={sx}
                      y={sy}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className={`font-mono-num text-[11px] font-extrabold pointer-events-none ${
                        axis.val >= 28 ? 'fill-white' : 'fill-[#172154]'
                      }`}
                    >
                      {axis.val}
                    </text>

                    {/* Outer Perimeter Skill Label */}
                    <text
                      x={lx}
                      y={ly}
                      textAnchor={textAnchor}
                      dominantBaseline="middle"
                      className={`text-[10px] font-extrabold tracking-wide transition-colors ${
                        isSelected ? 'fill-[#EA580C]' : 'fill-[#334155]'
                      }`}
                    >
                      {axis.shortLabel}
                    </text>
                  </g>
                );
              })}

              {/* Center Balance Ring */}
              <circle cx={rCx} cy={rCy} r={polarInnerR - 2} fill="#FFFFFF" stroke="#FBBF24" strokeWidth={2.2} />
              <text
                x={rCx}
                y={rCy - 4}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-[#0F172A] font-display text-[17px] font-extrabold font-mono-num"
              >
                {overallAvg}%
              </text>
              <text
                x={rCx}
                y={rCy + 12}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-[#64748B] text-[8.5px] font-bold tracking-wider uppercase"
              >
                {biText(lang, 'BALANCE', 'CÂN BẰNG')}
              </text>
            </svg>
          ) : (
            <svg viewBox="0 0 430 332" className="w-full max-w-[460px] mx-auto" aria-label="8-Axis Student Radar Map">
              <defs>
                <radialGradient id="radial-current-fill" cx="50%" cy="50%" r="60%">
                  <stop offset="0%" stopColor="#56BEB8" stopOpacity="0.62" />
                  <stop offset="58%" stopColor="#3B82F6" stopOpacity="0.46" />
                  <stop offset="100%" stopColor="#2D3E99" stopOpacity="0.38" />
                </radialGradient>
                <linearGradient id="radial-baseline-fill" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FDE047" stopOpacity="0.42" />
                  <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.28" />
                </linearGradient>
              </defs>

              {[
                { scale: 1, fill: '#FEF9E7', fillOp: 0.75, stroke: '#2D3E99', strokeOp: 0.22, dash: undefined },
                { scale: 0.75, fill: '#CCFBF1', fillOp: 0.34, stroke: '#0D9488', strokeOp: 0.45, dash: '4 3' },
                { scale: 0.5, fill: '#E0F2FE', fillOp: 0.38, stroke: '#0284C7', strokeOp: 0.22, dash: undefined },
                { scale: 0.25, fill: '#FCE7F3', fillOp: 0.36, stroke: '#E61E64', strokeOp: 0.2, dash: undefined },
              ].map((ring) => {
                const pts = radarAxes
                  .map((_, idx) => {
                    const angle = angleStep * idx - Math.PI / 2;
                    const r = ring.scale * rMax;
                    return `${rCx + r * Math.cos(angle)},${rCy + r * Math.sin(angle)}`;
                  })
                  .join(' ');
                return (
                  <polygon
                    key={ring.scale}
                    points={pts}
                    fill={ring.fill}
                    fillOpacity={ring.fillOp}
                    stroke={ring.stroke}
                    strokeOpacity={ring.strokeOp}
                    strokeDasharray={ring.dash}
                    strokeWidth={ring.scale === 0.75 ? 1.4 : 1.1}
                  />
                );
              })}

              {/* Scale labels */}
              <text x={rCx + 5} y={rCy - rMax * 0.5 + 3} className="fill-[#0284C7] text-[9px] font-bold font-mono-num">
                50
              </text>
              <text x={rCx + 5} y={rCy - rMax * 0.75 + 3} className="fill-[#0D9488] text-[9px] font-bold font-mono-num">
                75
              </text>
              <text x={rCx + 5} y={rCy - rMax + 9} className="fill-[#2D3E99]/65 text-[8.5px] font-bold font-mono-num">
                100
              </text>

              {/* Color-coded Spokes */}
              {radarAxes.map((axis, idx) => {
                const angle = angleStep * idx - Math.PI / 2;
                const x2 = rCx + rMax * Math.cos(angle);
                const y2 = rCy + rMax * Math.sin(angle);
                return (
                  <line
                    key={`spoke-${axis.key}`}
                    x1={rCx}
                    y1={rCy}
                    x2={x2}
                    y2={y2}
                    stroke={axis.color}
                    strokeOpacity={0.35}
                    strokeWidth={1.3}
                  />
                );
              })}

              {/* Baseline Overlay Polygon */}
              {baseRadarPolygon && (
                <polygon
                  points={baseRadarPolygon}
                  fill="url(#radial-baseline-fill)"
                  stroke="#D97706"
                  strokeWidth={2.4}
                  strokeDasharray="6 3"
                />
              )}

              {/* Current / Target Polygon */}
              <polygon
                points={radarPolygon}
                fill="url(#radial-current-fill)"
                stroke="#2D3E99"
                strokeWidth={2.8}
                strokeLinejoin="round"
              />

              {/* Interactive Vertex Dots & Axis Labels */}
              {radarAxes.map((axis, idx) => {
                const angle = angleStep * idx - Math.PI / 2;
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                const textAnchor = Math.abs(cos) < 0.25 ? 'middle' : cos > 0 ? 'start' : 'end';
                const labelRadiusOffset = Math.abs(cos) < 0.25 ? 24 : 16;
                const lx = rCx + (rMax + labelRadiusOffset) * cos;
                const ly = rCy + (rMax + 24) * sin;
                const vx = rCx + (axis.val / 100) * rMax * cos;
                const vy = rCy + (axis.val / 100) * rMax * sin;
                const bvx = axis.baseVal !== null ? rCx + (axis.baseVal / 100) * rMax * cos : null;
                const bvy = axis.baseVal !== null ? rCy + (axis.baseVal / 100) * rMax * sin : null;
                const axisDelta = axis.baseVal !== null ? axis.val - axis.baseVal : null;
                return (
                  <g
                    key={axis.key}
                    onMouseEnter={() => setInspectedAxisKey(axis.key)}
                    onClick={() =>
                      setInspectedAxisKey((prev) => (prev === axis.key ? null : axis.key))
                    }
                    className="cursor-pointer"
                  >
                    {bvx !== null && bvy !== null && (
                      <circle
                        cx={bvx}
                        cy={bvy}
                        r={3.8}
                        fill="#FEF3C7"
                        stroke="#D97706"
                        strokeWidth={1.8}
                      >
                        <title>{`${axis.label} (${comparisonOverlay?.baselineLabel}): ${axis.baseVal}`}</title>
                      </circle>
                    )}
                    <circle cx={vx} cy={vy} r={7.5} fill={axis.color} fillOpacity={0.22} />
                    <circle
                      cx={vx}
                      cy={vy}
                      r={4.8}
                      fill={axis.color}
                      stroke="#ffffff"
                      strokeWidth={1.6}
                    >
                      <title>{`${axis.label}: ${axis.val}`}</title>
                    </circle>
                    <text
                      x={lx}
                      y={ly - 5}
                      textAnchor={textAnchor}
                      dominantBaseline="middle"
                      className="fill-[#172154] text-[10.5px] font-bold"
                    >
                      {axis.label}
                    </text>
                    <text
                      x={lx}
                      y={ly + 9}
                      textAnchor={textAnchor}
                      dominantBaseline="middle"
                      fill={axis.color}
                      className="text-[11px] font-bold font-mono-num"
                    >
                      {axis.val}
                      {axisDelta !== null && (
                        <tspan
                          dx={4}
                          className={`text-[9.5px] font-bold ${
                            axisDelta > 0
                              ? 'fill-[#0F766E]'
                              : axisDelta < 0
                                ? 'fill-[#E61E64]'
                                : 'fill-[#172154]/55'
                          }`}
                        >
                          {formatDelta(axisDelta)}
                        </tspan>
                      )}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}

          {/* Interactive Inspection Box (matches uploaded screenshot footer box) */}
          <div className="rounded-xl border border-[#FDE68A] bg-[#FFFDF7] px-4 py-3 text-xs text-[#475569]">
            {inspectedAxis ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: inspectedAxis.color }}
                    />
                    <span className="font-bold text-[#172154]">{inspectedAxis.label}</span>
                    <span className="text-[11px] text-[#64748B]">
                      · {inspectedAxis.group === 'lang' ? biText(lang, 'English Skill', 'Kỹ năng Anh ngữ') : 'Be Whole'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#525E80]">
                    {biText(lang, inspectedAxis.tipEn, inspectedAxis.tipVi)}
                  </p>
                </div>
                <div className="font-mono-num text-right shrink-0">
                  <div className="text-sm font-extrabold text-[#172154]">
                    {inspectedAxis.val}/100{' '}
                    <span className="text-[11px] font-semibold text-[#EA580C]">
                      ({getScoreBand(inspectedAxis.val)})
                    </span>
                  </div>
                  {inspectedAxis.baseVal !== null && (
                    <div
                      className={`text-[11px] font-bold ${deltaTextClass(
                        inspectedAxis.val - inspectedAxis.baseVal
                      )}`}
                    >
                      {biText(lang, 'From', 'Từ')} {inspectedAxis.baseVal} (
                      {formatDelta(inspectedAxis.val - inspectedAxis.baseVal)})
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {mapViewMode === 'radial'
                    ? biText(
                        lang,
                        'Hover or click any radial wedge to inspect its score, meaning, and study focus.',
                        'Di chuột hoặc nhấp vào từng ô năng lực để xem điểm chi tiết, ý nghĩa và hướng rèn luyện.'
                      )
                    : biText(
                        lang,
                        'Hover or click any radar vertex to inspect its score, meaning, and study focus.',
                        'Di chuột hoặc nhấp vào từng đỉnh mạng nhện để xem điểm chi tiết và hướng rèn luyện.'
                      )}
                </span>
                {comparisonOverlay && overallDelta !== null && (
                  <span className={`font-mono-num font-bold ${deltaTextClass(overallDelta)}`}>
                    {formatDelta(overallDelta)} pts
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* CHART 2: 2x2 WHOLE-CHILD QUADRANT MAP */}
        <div className="bg-gradient-to-b from-white to-[#FDF9EE]/60 border border-[#2D3E99]/15 rounded-2xl p-6 flex flex-col justify-between space-y-4 shadow-xs">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-display text-lg font-bold text-[#2D3E99]">
                {biText(lang, '2. Whole-Child Quadrant Map', '2. Ma trận 4 Góc (Quadrant)')}
              </h4>
              <span className="font-mono-num text-xs sm:text-sm font-bold text-[#2D3E99] bg-[#2D3E99]/10 px-2.5 py-0.5 rounded-md">
                {baseLangAvg !== null && baseWholeAvg !== null
                  ? `(${baseLangAvg},${baseWholeAvg}) → (${langAvg},${wholeAvg})`
                  : `(${langAvg}, ${wholeAvg})`}
              </span>
            </div>
            <p className="text-xs text-[#172154]/70 mt-1">
              {comparisonOverlay
                ? biText(
                    lang,
                    'Tracks learner movement from earlier amber pin to selected crimson pin.',
                    'Hiển thị hướng dịch chuyển từ điểm cam (trước) sang điểm đỏ (sau).'
                  )
                : biText(
                    lang,
                    'Plots English Mastery (horizontal) against Be Whole Wellbeing (vertical).',
                    'So sánh Năng lực Anh ngữ (trục ngang) và Chỉ số Be Whole (trục dọc).'
                  )}
            </p>
          </div>

          <svg viewBox="0 0 360 280" className="w-full max-w-[440px] mx-auto" aria-label="Whole-Child Quadrant Map">
            <defs>
              <linearGradient id="q-flourishing" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#99F6E4" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#14B8A6" stopOpacity="0.34" />
              </linearGradient>
              <linearGradient id="q-character" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#FEF08A" stopOpacity="0.48" />
                <stop offset="100%" stopColor="#FBBF24" stopOpacity="0.34" />
              </linearGradient>
              <linearGradient id="q-english" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#DBEAFE" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#60A5FA" stopOpacity="0.32" />
              </linearGradient>
              <linearGradient id="q-support" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#FECDD3" stopOpacity="0.42" />
                <stop offset="100%" stopColor="#FB7185" stopOpacity="0.25" />
              </linearGradient>
              <marker
                id="quadrant-progression-arrow"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 9.5 5 L 0 9 z" fill="#172154" />
              </marker>
            </defs>

            {/* 4 Vibrant Gradient Quadrant Backgrounds */}
            <rect x={qLeft} y={qTop} width={xMid - qLeft} height={yMid - qTop} fill="url(#q-character)" />
            <rect x={xMid} y={qTop} width={qLeft + qWidth - xMid} height={yMid - qTop} fill="url(#q-flourishing)" />
            <rect x={qLeft} y={yMid} width={xMid - qLeft} height={qTop + qHeight - yMid} fill="url(#q-support)" />
            <rect x={xMid} y={yMid} width={qLeft + qWidth - xMid} height={qTop + qHeight - yMid} fill="url(#q-english)" />

            {/* Subtle Reference Gridlines (25 & 75) */}
            {[25, 75].map((v) => (
              <g key={`grid-${v}`}>
                <line
                  x1={toQx(v)}
                  y1={qTop}
                  x2={toQx(v)}
                  y2={qTop + qHeight}
                  stroke="#ffffff"
                  strokeOpacity={0.75}
                  strokeWidth={1}
                />
                <line
                  x1={qLeft}
                  y1={toQy(v)}
                  x2={qLeft + qWidth}
                  y2={toQy(v)}
                  stroke="#ffffff"
                  strokeOpacity={0.75}
                  strokeWidth={1}
                />
              </g>
            ))}

            {/* Outer Frame & 55% Threshold Crosshairs */}
            <rect
              x={qLeft}
              y={qTop}
              width={qWidth}
              height={qHeight}
              fill="none"
              stroke="#2D3E99"
              strokeOpacity={0.35}
              strokeWidth={1.4}
              rx={4}
            />
            <line
              x1={xMid}
              y1={qTop}
              x2={xMid}
              y2={qTop + qHeight}
              stroke="#0F766E"
              strokeOpacity={0.7}
              strokeWidth={1.6}
              strokeDasharray="5 3"
            />
            <line
              x1={qLeft}
              y1={yMid}
              x2={qLeft + qWidth}
              y2={yMid}
              stroke="#0F766E"
              strokeOpacity={0.7}
              strokeWidth={1.6}
              strokeDasharray="5 3"
            />

            {/* Quadrant Labels with high-contrast tinted backing */}
            <text x={qLeft + 8} y={qTop + 16} className="fill-[#92400E] text-[9.5px] font-bold">
              {lang === 'en' ? 'Growing English' : 'Nhân cách tốt'}
            </text>
            <text x={qLeft + qWidth - 8} y={qTop + 16} textAnchor="end" className="fill-[#0F766E] text-[10px] font-bold">
              {lang === 'en' ? 'Flourishing ★' : 'Xuất sắc ★'}
            </text>
            <text x={qLeft + 8} y={qTop + qHeight - 8} className="fill-[#BE123C] text-[9.5px] font-bold">
              {lang === 'en' ? 'Guided Support' : 'Cần đồng hành'}
            </text>
            <text x={qLeft + qWidth - 8} y={qTop + qHeight - 8} textAnchor="end" className="fill-[#1D4ED8] text-[9.5px] font-bold">
              {lang === 'en' ? 'Strong English' : 'Giỏi Anh ngữ'}
            </text>

            {/* Cohort comparison points (if provided) */}
            {cohortPoints.map((pt) => (
              <g key={pt.id}>
                <circle
                  cx={toQx(pt.langAvg)}
                  cy={toQy(pt.wholeAvg)}
                  r={4.2}
                  fill="#2D3E99"
                  fillOpacity={0.45}
                  stroke="#ffffff"
                  strokeWidth={1}
                >
                  <title>{`${pt.name}: English ${pt.langAvg}%, Be Whole ${pt.wholeAvg}%`}</title>
                </circle>
              </g>
            ))}

            {/* Earlier Baseline Pin & Directional Progression Vector */}
            {baseQx !== null && baseQy !== null && (
              <g>
                {hasMovement && (
                  <line
                    x1={baseQx}
                    y1={baseQy}
                    x2={arrowEndX}
                    y2={arrowEndY}
                    stroke="#172154"
                    strokeWidth={2.2}
                    strokeDasharray="5 3"
                    markerEnd="url(#quadrant-progression-arrow)"
                  />
                )}
                <circle cx={baseQx} cy={baseQy} r={11} fill="#F59E0B" fillOpacity={0.28} />
                <circle cx={baseQx} cy={baseQy} r={6.2} fill="#D97706" stroke="#ffffff" strokeWidth={2}>
                  <title>{`${comparisonOverlay?.baselineLabel}: English ${baseLangAvg}%, Be Whole ${baseWholeAvg}%`}</title>
                </circle>
                <text
                  x={baseQx > qLeft + qWidth - 65 ? baseQx - 10 : baseQx + 10}
                  y={baseQy > qTop + qHeight - 20 ? baseQy - 8 : baseQy + 13}
                  textAnchor={baseQx > qLeft + qWidth - 65 ? 'end' : 'start'}
                  className="fill-[#B45309] text-[9.5px] font-bold"
                >
                  {biText(lang, 'From', 'Từ')}
                </text>
              </g>
            )}

            {/* Highlighted Target Student Pin */}
            <circle cx={activeQx} cy={activeQy} r={14} fill="#E61E64" fillOpacity={0.22} />
            <circle cx={activeQx} cy={activeQy} r={7.2} fill="#E61E64" stroke="#ffffff" strokeWidth={2.2}>
              <title>{`${studentName}: English ${langAvg}%, Be Whole ${wholeAvg}%`}</title>
            </circle>
            <text
              x={activeQx > qLeft + qWidth - 65 ? activeQx - 11 : activeQx + 11}
              y={activeQy < qTop + 28 ? activeQy + 14 : activeQy - 9}
              textAnchor={activeQx > qLeft + qWidth - 65 ? 'end' : 'start'}
              className="fill-[#172154] text-[10.5px] font-bold"
            >
              {comparisonOverlay ? biText(lang, 'To', 'Đến') : studentName.split(' ').slice(-1)[0]}
            </text>

            {/* Axis Ticks & Titles */}
            <text x={qLeft} y={qTop + qHeight + 15} className="fill-[#172154]/65 text-[9px] font-mono-num font-semibold">0</text>
            <text x={xMid} y={qTop + qHeight + 15} textAnchor="middle" className="fill-[#0F766E] text-[9.5px] font-bold font-mono-num">55</text>
            <text x={toQx(75)} y={qTop + qHeight + 15} textAnchor="middle" className="fill-[#172154]/55 text-[9px] font-mono-num">75</text>
            <text x={qLeft + qWidth} y={qTop + qHeight + 15} textAnchor="end" className="fill-[#172154]/65 text-[9px] font-mono-num font-semibold">100</text>
            <text x={qLeft + qWidth / 2} y={qTop + qHeight + 32} textAnchor="middle" className="fill-[#2D3E99] text-[10.5px] font-bold">
              {lang === 'en' ? 'English Language Average →' : 'Điểm Anh ngữ Trung bình →'}
            </text>

            <text x={qLeft - 7} y={yMid + 3} textAnchor="end" className="fill-[#0F766E] text-[9.5px] font-bold font-mono-num">55</text>
            <text x={qLeft - 7} y={toQy(75) + 3} textAnchor="end" className="fill-[#172154]/55 text-[9px] font-mono-num">75</text>
            <text
              x={16}
              y={qTop + qHeight / 2}
              textAnchor="middle"
              transform={`rotate(-90 16 ${qTop + qHeight / 2})`}
              className="fill-[#E61E64] text-[10.5px] font-bold"
            >
              {lang === 'en' ? 'Be Whole Wellbeing →' : 'Chỉ số Be Whole →'}
            </text>
          </svg>

          {comparisonOverlay && langDelta !== null && wholeDelta !== null ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#172154]/85 pt-2 border-t border-[#2D3E99]/10">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="w-3 h-3 rounded-full bg-[#D97706] inline-block" />
                  {biText(lang, 'From', 'Từ')}
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="w-3 h-3 rounded-full bg-[#E61E64] inline-block" />
                  {biText(lang, 'To', 'Đến')}
                </span>
              </div>
              <span className="font-mono-num font-bold text-[#172154]">
                EN{' '}
                <span className={deltaTextClass(langDelta)}>{formatDelta(langDelta)}%</span> · BW{' '}
                <span className={deltaTextClass(wholeDelta)}>{formatDelta(wholeDelta)}%</span>
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs text-[#172154]/80 pt-2 border-t border-[#2D3E99]/10">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-3 h-3 rounded-full bg-[#E61E64] inline-block" />
                {studentName}
              </span>
              <span className="font-mono-num font-semibold text-[#0F766E]">
                {biText(lang, 'Target Zone: ≥ 55%', 'Mốc chuẩn: ≥ 55%')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row: CHART 3: 8-DIMENSION BAR GRAPH (2-column wide grid) */}
      <div className="bg-white border border-[#2D3E99]/15 rounded-2xl p-6 flex flex-col justify-between space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="font-display text-lg font-bold text-[#2D3E99]">
              {biText(lang, '3. 8-Dimension Bar Graph', '3. Biểu đồ Cột 8 Năng lực')}
            </h4>
            <p className="text-xs text-[#172154]/65 mt-0.5">
              {comparisonOverlay
                ? biText(
                    lang,
                    'Amber tick marks earlier score; solid bar and delta show progression.',
                    'Vạch cam là điểm kỳ trước; thanh màu và độ chênh thể hiện sự tiến bộ.'
                  )
                : biText(
                    lang,
                    'Clear side-by-side comparison of every skill against the 75% benchmark.',
                    'So sánh từng kỹ năng cụ thể kèm mức đạt chuẩn.'
                  )}
            </p>
          </div>
          <span className="text-xs font-semibold text-[#0D9488] bg-[#56BEB8]/15 px-3 py-1 rounded-md">
            {biText(lang, 'Benchmark: 75+', 'Mục tiêu: 75+')}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 py-1 relative">
          {barItems.map((item) => {
            const delta = item.baseVal !== null ? item.val - item.baseVal : null;
            return (
              <div key={item.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#172154]">{item.label}</span>
                    <span className="text-[10px] text-[#172154]/55">{item.domain}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono-num">
                    {delta !== null ? (
                      <span className={`text-[11px] font-bold ${deltaTextClass(delta)}`}>
                        {item.baseVal}→{item.val} ({formatDelta(delta)})
                      </span>
                    ) : (
                      <>
                        <span className="text-[10px] font-semibold text-[#172154]/65">{getScoreBand(item.val)}</span>
                        <span className="font-bold text-[#2D3E99] w-8 text-right">{item.val}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="relative h-3.5 rounded-md bg-[#FDF9EE] border border-[#2D3E99]/12 overflow-hidden">
                  <div
                    className="h-full rounded-r-md transition-all duration-300"
                    style={{ width: `${item.val}%`, backgroundColor: item.color }}
                  />
                  {/* Earlier Baseline Marker (if comparing) */}
                  {item.baseVal !== null && (
                    <div
                      className="absolute top-0 bottom-0 w-1 bg-[#D97706]"
                      style={{ left: `${Math.min(99, item.baseVal)}%` }}
                      title={`${biText(lang, 'Earlier', 'Mốc trước')}: ${item.baseVal}`}
                    />
                  )}
                  {/* 75% Benchmark Marker */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-[#172154]/35"
                    style={{ left: '75%' }}
                    title="75% Target Benchmark"
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-xs text-[#172154]/75 pt-2 border-t border-[#2D3E99]/10">
          <span>
            {comparisonOverlay
              ? biText(lang, 'Amber tick = Earlier · Navy line = 75%', 'Vạch cam = Trước · Xanh đậm = 75%')
              : biText(lang, 'Vertical line = 75% Target', 'Vạch dọc = Mốc 75%')}
          </span>
          <span className="font-mono-num font-semibold text-[#2D3E99]">0 – 100 pts</span>
        </div>
      </div>
    </div>
  );
};
