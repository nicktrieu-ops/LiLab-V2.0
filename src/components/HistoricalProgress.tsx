import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Calendar, Layers, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { biText } from '../i18n';
import { isSuperAdminEmail } from '../services/seedData';
import {
  formatCefrLabel,
  type LangCode,
  type StudentAssessment,
  type StudentProfile,
  type UserProfile,
} from '../types';
import { ProfileAvatar } from './ProfileAvatar';
import {
  formatAssessmentDateShort,
  getAssessmentTimestampMs,
} from './StudentVisualAnalytics';

export type HistoricalScopeRole = 'admin' | 'teacher' | 'parent' | 'student';
type MetricViewMode = 'summary' | 'english' | 'whole' | 'all8';

interface TrajectorySeries {
  key: string;
  label: string;
  color: string;
  strokeWidth?: number;
  getValue: (a: StudentAssessment) => number;
}

interface ChartPoint {
  assessment: StudentAssessment;
  timestampMs: number;
  dateLabel: string;
  langAvg: number;
  wholeAvg: number;
  overallAvg: number;
}

export interface HistoricalProgressProps {
  lang: LangCode;
  currentUser: UserProfile;
  scopeRole: HistoricalScopeRole;
  studentId?: string;
  studentName?: string;
  studentPhotoUrl?: string;
  studentGender?: 'boy' | 'girl';
  students?: StudentProfile[];
}

function getSixMonthsAgoMs(nowMs: number): number {
  const d = new Date(nowMs);
  d.setMonth(d.getMonth() - 6);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function computeLangAvg(a: StudentAssessment): number {
  const voc = a.vocabularyScore ?? 0;
  const comp = a.comprehensionScore ?? 0;
  return Math.round((a.speakingScore + a.readingScore + a.writingScore + voc + comp) / 5);
}

function computeWholeAvg(a: StudentAssessment): number {
  return Math.round((a.socialScore + a.emotionalScore + a.mentalScore) / 3);
}

function computeOverallAvg(a: StudentAssessment): number {
  return Math.round((computeLangAvg(a) + computeWholeAvg(a)) / 2);
}

function formatMonthTick(ms: number, lang: LangCode): string {
  try {
    return new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {
      month: 'short',
      year: '2-digit',
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toISOString().slice(0, 7);
  }
}

export const HistoricalProgress: React.FC<HistoricalProgressProps> = ({
  lang,
  currentUser,
  scopeRole,
  studentId,
  studentName,
  studentPhotoUrl,
  studentGender,
  students = [],
}) => {
  const [rawAssessments, setRawAssessments] = useState<StudentAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [localStudentId, setLocalStudentId] = useState<string>(studentId || '');
  const [viewMode, setViewMode] = useState<MetricViewMode>('summary');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hiddenSeries, setHiddenSeries] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (studentId) {
      setLocalStudentId(studentId);
    }
  }, [studentId]);

  useEffect(() => {
    const email = (currentUser.email || '').toLowerCase();
    const isSuperAdmin = isSuperAdminEmail(email);

    setLoading(true);
    let ref;
    if (isSuperAdmin) {
      ref = collection(db, 'assessments');
    } else if (scopeRole === 'admin' || currentUser.role === 'admin' || currentUser.role === 'super_admin') {
      ref = query(collection(db, 'assessments'), where('adminUids', 'array-contains', currentUser.uid));
    } else if (scopeRole === 'teacher') {
      ref = query(collection(db, 'assessments'), where('teacherEmail', '==', email));
    } else if (scopeRole === 'student') {
      ref = query(collection(db, 'assessments'), where('studentEmail', '==', email));
    } else {
      ref = query(collection(db, 'assessments'), where('parentEmail', '==', email));
    }

    const unsub = onSnapshot(
      ref,
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as StudentAssessment));
        setRawAssessments(docs);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        handleFirestoreError(err, OperationType.LIST, 'assessments');
      }
    );

    return () => unsub();
  }, [currentUser.uid, currentUser.email, currentUser.role, scopeRole]);

  // Available student options (from passed students prop and/or fetched assessments)
  const studentOptions = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; photoUrl?: string; gender?: 'boy' | 'girl' }
    >();
    for (const s of students) {
      map.set(s.id, {
        id: s.id,
        name: s.fullName,
        photoUrl: s.photoUrl,
        gender: s.gender,
      });
    }
    for (const a of rawAssessments) {
      if (!map.has(a.studentId)) {
        map.set(a.studentId, {
          id: a.studentId,
          name: a.studentName,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [students, rawAssessments]);

  useEffect(() => {
    if (studentId) return;
    if (localStudentId && studentOptions.some((s) => s.id === localStudentId)) return;
    if (studentOptions.length > 0) {
      setLocalStudentId(studentOptions[0].id);
    }
  }, [studentId, localStudentId, studentOptions]);

  const effectiveStudentId = studentId || localStudentId;
  const matchedStudent = studentOptions.find((s) => s.id === effectiveStudentId);
  const displayStudentName =
    studentName || matchedStudent?.name || biText(lang, 'Student', 'Học viên');
  const displayPhotoUrl = studentPhotoUrl ?? matchedStudent?.photoUrl;
  const displayGender = studentGender ?? matchedStudent?.gender;

  const nowMs = Date.now();
  const sixMonthsAgoMs = getSixMonthsAgoMs(nowMs);

  const { sixMonthPoints, totalForStudent } = useMemo(() => {
    const forStudent = effectiveStudentId
      ? rawAssessments.filter((a) => a.studentId === effectiveStudentId)
      : rawAssessments;

    const withTimestamps: ChartPoint[] = forStudent.map((a) => {
      const parsedMs = getAssessmentTimestampMs(a);
      const timestampMs = parsedMs > 0 ? parsedMs : nowMs;
      return {
        assessment: a,
        timestampMs,
        dateLabel: formatAssessmentDateShort({ ...a, createdAt: a.createdAt || timestampMs }, lang),
        langAvg: computeLangAvg(a),
        wholeAvg: computeWholeAvg(a),
        overallAvg: computeOverallAvg(a),
      };
    });

    withTimestamps.sort((a, b) => {
      if (a.timestampMs !== b.timestampMs) return a.timestampMs - b.timestampMs;
      return a.assessment.id.localeCompare(b.assessment.id);
    });

    const filtered = withTimestamps.filter(
      (pt) => pt.timestampMs >= sixMonthsAgoMs && pt.timestampMs <= nowMs + 86400000
    );

    return {
      sixMonthPoints: filtered,
      totalForStudent: withTimestamps.length,
    };
  }, [rawAssessments, effectiveStudentId, sixMonthsAgoMs, nowMs, lang]);

  const allSeriesByMode: Record<MetricViewMode, TrajectorySeries[]> = useMemo(
    () => ({
      summary: [
        {
          key: 'overall',
          label: biText(lang, 'Overall Score', 'Điểm Tổng hợp'),
          color: '#2D3E99',
          strokeWidth: 3.5,
          getValue: (a) => computeOverallAvg(a),
        },
        {
          key: 'langAvg',
          label: biText(lang, 'English (5-Skill Avg)', 'Tiếng Anh (TB 5 kỹ năng)'),
          color: '#0EA5E9',
          strokeWidth: 2.75,
          getValue: (a) => computeLangAvg(a),
        },
        {
          key: 'wholeAvg',
          label: biText(lang, 'Whole-Child (SEM Avg)', 'Toàn diện (TB 3 mặt)'),
          color: '#E61E64',
          strokeWidth: 2.75,
          getValue: (a) => computeWholeAvg(a),
        },
      ],
      english: [
        {
          key: 'speaking',
          label: biText(lang, 'Speaking', 'Nói'),
          color: '#2D3E99',
          strokeWidth: 2.5,
          getValue: (a) => a.speakingScore,
        },
        {
          key: 'reading',
          label: biText(lang, 'Reading', 'Đọc'),
          color: '#2596BE',
          strokeWidth: 2.5,
          getValue: (a) => a.readingScore,
        },
        {
          key: 'writing',
          label: biText(lang, 'Writing', 'Viết'),
          color: '#6366F1',
          strokeWidth: 2.5,
          getValue: (a) => a.writingScore,
        },
        {
          key: 'vocabulary',
          label: biText(lang, 'Vocabulary', 'Từ vựng'),
          color: '#0D9488',
          strokeWidth: 2.5,
          getValue: (a) => a.vocabularyScore ?? 0,
        },
        {
          key: 'comprehension',
          label: biText(lang, 'Listening / Comp.', 'Nghe hiểu'),
          color: '#F59E0B',
          strokeWidth: 2.5,
          getValue: (a) => a.comprehensionScore ?? 0,
        },
      ],
      whole: [
        {
          key: 'social',
          label: biText(lang, 'Social', 'Xã hội'),
          color: '#E61E64',
          strokeWidth: 2.8,
          getValue: (a) => a.socialScore,
        },
        {
          key: 'emotional',
          label: biText(lang, 'Emotional', 'Cảm xúc'),
          color: '#EC4899',
          strokeWidth: 2.8,
          getValue: (a) => a.emotionalScore,
        },
        {
          key: 'mental',
          label: biText(lang, 'Mental', 'Tinh thần'),
          color: '#10B981',
          strokeWidth: 2.8,
          getValue: (a) => a.mentalScore,
        },
      ],
      all8: [
        {
          key: 'speaking',
          label: biText(lang, 'Speaking', 'Nói'),
          color: '#2D3E99',
          strokeWidth: 2.2,
          getValue: (a) => a.speakingScore,
        },
        {
          key: 'reading',
          label: biText(lang, 'Reading', 'Đọc'),
          color: '#2596BE',
          strokeWidth: 2.2,
          getValue: (a) => a.readingScore,
        },
        {
          key: 'writing',
          label: biText(lang, 'Writing', 'Viết'),
          color: '#6366F1',
          strokeWidth: 2.2,
          getValue: (a) => a.writingScore,
        },
        {
          key: 'vocabulary',
          label: biText(lang, 'Vocabulary', 'Từ vựng'),
          color: '#0D9488',
          strokeWidth: 2.2,
          getValue: (a) => a.vocabularyScore ?? 0,
        },
        {
          key: 'comprehension',
          label: biText(lang, 'Listening', 'Nghe hiểu'),
          color: '#F59E0B',
          strokeWidth: 2.2,
          getValue: (a) => a.comprehensionScore ?? 0,
        },
        {
          key: 'social',
          label: biText(lang, 'Social', 'Xã hội'),
          color: '#E61E64',
          strokeWidth: 2.2,
          getValue: (a) => a.socialScore,
        },
        {
          key: 'emotional',
          label: biText(lang, 'Emotional', 'Cảm xúc'),
          color: '#D946EF',
          strokeWidth: 2.2,
          getValue: (a) => a.emotionalScore,
        },
        {
          key: 'mental',
          label: biText(lang, 'Mental', 'Tinh thần'),
          color: '#10B981',
          strokeWidth: 2.2,
          getValue: (a) => a.mentalScore,
        },
      ],
    }),
    [lang]
  );

  const activeSeries = allSeriesByMode[viewMode];
  const visibleSeries = activeSeries.filter((s) => !hiddenSeries[s.key]);

  // KPI calculations across 6-month window
  const firstPt = sixMonthPoints[0] || null;
  const latestPt = sixMonthPoints[sixMonthPoints.length - 1] || null;
  const overallDelta =
    firstPt && latestPt && sixMonthPoints.length >= 2
      ? latestPt.overallAvg - firstPt.overallAvg
      : null;
  const langDelta =
    firstPt && latestPt && sixMonthPoints.length >= 2 ? latestPt.langAvg - firstPt.langAvg : null;
  const wholeDelta =
    firstPt && latestPt && sixMonthPoints.length >= 2 ? latestPt.wholeAvg - firstPt.wholeAvg : null;
  const peakOverall =
    sixMonthPoints.length > 0 ? Math.max(...sixMonthPoints.map((p) => p.overallAvg)) : 0;

  // SVG Chart Geometry
  const svgW = 860;
  const svgH = 330;
  const padL = 52;
  const padR = 28;
  const padT = 24;
  const padB = 48;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const minTimeMs = sixMonthsAgoMs;
  const maxTimeMs = Math.max(nowMs, ...(sixMonthPoints.map((p) => p.timestampMs)));
  const timeSpan = Math.max(1, maxTimeMs - minTimeMs);

  const xForMs = (ms: number) => {
    const ratio = Math.max(0, Math.min(1, (ms - minTimeMs) / timeSpan));
    return padL + ratio * plotW;
  };
  const yForVal = (val: number) => {
    const clamped = Math.max(0, Math.min(100, val));
    return padT + plotH - (clamped / 100) * plotH;
  };

  // Monthly ticks across last 6 months (7 ticks: M-6 to Today)
  const monthTicks = useMemo(() => {
    const ticks: Array<{ ms: number; label: string }> = [];
    for (let offset = 6; offset >= 0; offset--) {
      const d = new Date(nowMs);
      d.setMonth(d.getMonth() - offset);
      if (offset === 6) d.setHours(0, 0, 0, 0);
      const ms = d.getTime();
      ticks.push({
        ms,
        label: offset === 0 ? biText(lang, 'Now', 'Hiện tại') : formatMonthTick(ms, lang),
      });
    }
    return ticks;
  }, [nowMs, lang]);

  // Separate identical timestamps slightly horizontally so overlapping reports remain clickable
  const plottedPoints = useMemo(() => {
    return sixMonthPoints.map((pt, idx) => {
      let x = xForMs(pt.timestampMs);
      if (idx > 0) {
        const prev = sixMonthPoints[idx - 1];
        const prevX = xForMs(prev.timestampMs);
        if (Math.abs(x - prevX) < 10) {
          x = Math.min(svgW - padR, prevX + 12);
        }
      }
      return { ...pt, x };
    });
  }, [sixMonthPoints, minTimeMs, maxTimeMs]);

  const activeInspectPt =
    plottedPoints.find((p) => p.assessment.id === hoveredId) ||
    plottedPoints[plottedPoints.length - 1] ||
    null;

  const toggleSeries = (key: string) => {
    setHiddenSeries((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      // Prevent hiding every series
      if (activeSeries.every((s) => next[s.key])) return prev;
      return next;
    });
  };

  const renderDeltaBadge = (delta: number | null) => {
    if (delta === null) return null;
    const isUp = delta > 0;
    const isDown = delta < 0;
    return (
      <span
        className={`inline-flex items-center gap-0.5 text-xs font-mono-num font-bold ${
          isUp ? 'text-[#0F766E]' : isDown ? 'text-[#E61E64]' : 'text-[#172154]/60'
        }`}
      >
        {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : isDown ? <TrendingDown className="w-3.5 h-3.5" /> : null}
        {delta > 0 ? `+${delta}` : `${delta}`}
      </span>
    );
  };

  return (
    <div className="bg-white border border-[#2D3E99]/12 rounded-2xl p-6 space-y-5 print-only-clean">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-5 border-b border-[#2D3E99]/12 pb-5">
        <div className="flex items-center gap-5 min-w-0">
          <ProfileAvatar
            src={displayPhotoUrl}
            fallbackSrc={
              displayGender
                ? displayGender === 'boy'
                  ? '/assets/lila_boy.png'
                  : '/assets/lila_girl.png'
                : undefined
            }
            name={displayStudentName}
            size="2xl"
            className="report-student-avatar shadow-md ring-4 ring-[#2D3E99]/10"
          />
          <div className="min-w-0 space-y-1">
            <div className="text-xs sm:text-sm font-bold text-[#E61E64] flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              <span>
                {biText(lang, 'Historical Progress · Last 6 Months', 'Lịch sử Tiến bộ · 6 Tháng Gần nhất')}
              </span>
            </div>
            <div className="font-display text-3xl sm:text-4xl font-extrabold text-[#2D3E99] tracking-tight truncate report-student-name">
              {displayStudentName}
            </div>
            <h3 className="font-display text-base sm:text-lg font-bold text-[#172154]/80 truncate">
              {biText(
                lang,
                '6-Month Score Trajectory',
                'Biểu đồ Quỹ đạo Điểm 6 Tháng'
              )}
            </h3>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 no-print">
          {/* Student Selector when not locked by prop and multiple students exist */}
          {!studentId && studentOptions.length > 0 && (
            <select
              value={effectiveStudentId}
              onChange={(e) => {
                setLocalStudentId(e.target.value);
                setHoveredId(null);
              }}
              className="px-3 py-2 rounded-lg border border-[#2D3E99]/20 bg-white text-xs font-semibold text-[#172154]"
            >
              {studentOptions.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                </option>
              ))}
            </select>
          )}

          {/* View Mode Selector */}
          <div className="flex items-center p-1 bg-[#FDF9EE] border border-[#2D3E99]/15 rounded-xl">
            {(
              [
                { id: 'summary', label: biText(lang, 'Summary', 'Tổng quan') },
                { id: 'english', label: biText(lang, '5 English', '5 Tiếng Anh') },
                { id: 'whole', label: biText(lang, '3 Whole-Child', '3 Toàn diện') },
                { id: 'all8', label: biText(lang, 'All 8 Axes', 'Tất cả 8 trục') },
              ] as Array<{ id: MetricViewMode; label: string }>
            ).map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setViewMode(mode.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  viewMode === mode.id
                    ? 'bg-[#2D3E99] text-white'
                    : 'text-[#172154]/75 hover:text-[#2D3E99]'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-[#FDF9EE] border border-[#2D3E99]/12 space-y-1">
          <div className="text-[11px] font-semibold text-[#172154]/65">
            {biText(lang, 'Latest Composite', 'Điểm Tổng hợp Mới nhất')}
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono-num text-xl font-bold text-[#2D3E99]">
              {latestPt ? `${latestPt.overallAvg}/100` : '—'}
            </span>
            {renderDeltaBadge(overallDelta)}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#F0F9FF] border border-[#0EA5E9]/20 space-y-1">
          <div className="text-[11px] font-semibold text-[#172154]/65">
            {biText(lang, 'English 5-Skill Avg', 'TB 5 Kỹ năng Tiếng Anh')}
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono-num text-xl font-bold text-[#0284C7]">
              {latestPt ? `${latestPt.langAvg}/100` : '—'}
            </span>
            {renderDeltaBadge(langDelta)}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#FDF2F8] border border-[#E61E64]/20 space-y-1">
          <div className="text-[11px] font-semibold text-[#172154]/65">
            {biText(lang, 'Whole-Child SEM Avg', 'TB 3 Mặt Toàn diện')}
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono-num text-xl font-bold text-[#E61E64]">
              {latestPt ? `${latestPt.wholeAvg}/100` : '—'}
            </span>
            {renderDeltaBadge(wholeDelta)}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#ECFDF5] border border-[#10B981]/25 space-y-1">
          <div className="text-[11px] font-semibold text-[#172154]/65">
            {biText(lang, '6-Month Peak & Reports', 'Đỉnh 6 tháng & Số báo cáo')}
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono-num text-xl font-bold text-[#0F766E]">
              {sixMonthPoints.length > 0 ? `${peakOverall}/100` : '—'}
            </span>
            <span className="text-xs font-semibold text-[#172154]/70 font-mono-num">
              {sixMonthPoints.length} {biText(lang, 'reports', 'báo cáo')}
              {totalForStudent > sixMonthPoints.length ? ` / ${totalForStudent}` : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Main Line Chart Canvas */}
      {loading ? (
        <div className="h-64 rounded-xl bg-[#FDF9EE]/70 border border-[#2D3E99]/10 flex items-center justify-center text-sm text-[#172154]/65">
          {biText(lang, 'Loading Firebase assessment history...', 'Đang tải lịch sử đánh giá từ Firebase...')}
        </div>
      ) : plottedPoints.length === 0 ? (
        <div className="p-8 rounded-xl bg-[#FDF9EE]/70 border border-dashed border-[#2D3E99]/25 text-center space-y-2">
          <Layers className="w-8 h-8 text-[#2D3E99]/40 mx-auto" />
          <div className="font-display text-base font-bold text-[#2D3E99]">
            {biText(
              lang,
              'No assessments found in the last 6 months',
              'Chưa có báo cáo đánh giá nào trong 6 tháng gần đây'
            )}
          </div>
          <p className="text-xs text-[#172154]/70 max-w-md mx-auto">
            {biText(
              lang,
              `Once a teacher publishes CEFR & holistic assessments for ${displayStudentName}, their 6-month score trajectory will chart automatically here.`,
              `Ngay khi giáo viên xuất bản đánh giá CEFR & toàn diện cho ${displayStudentName}, biểu đồ đường tiến bộ 6 tháng sẽ tự động hiển thị tại đây.`
            )}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Interactive Series Legend Toggles */}
          <div className="flex flex-wrap items-center gap-2 no-print">
            {activeSeries.map((ser) => {
              const isHidden = Boolean(hiddenSeries[ser.key]);
              return (
                <button
                  key={ser.key}
                  type="button"
                  onClick={() => toggleSeries(ser.key)}
                  className={`px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    isHidden
                      ? 'bg-slate-50 border-slate-200 text-slate-400 opacity-65'
                      : 'bg-white border-[#2D3E99]/15 text-[#172154] shadow-2xs'
                  }`}
                >
                  <span
                    className="w-3 h-1.5 rounded-sm inline-block"
                    style={{ backgroundColor: ser.color }}
                  />
                  <span>{ser.label}</span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            {/* SVG Line Chart */}
            <div className="xl:col-span-9 bg-[#FDF9EE]/55 border border-[#2D3E99]/12 rounded-xl p-3 overflow-x-auto">
              <svg
                viewBox={`0 0 ${svgW} ${svgH}`}
                className="w-full min-w-[560px] h-auto select-none"
                role="img"
                aria-label={`${displayStudentName} 6-month historical score trajectory`}
              >
                <defs>
                  <linearGradient id="lilabOverallArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2D3E99" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#56BEB8" stopOpacity="0.02" />
                  </linearGradient>
                </defs>

                {/* Performance Zone Banding */}
                <rect
                  x={padL}
                  y={yForVal(100)}
                  width={plotW}
                  height={yForVal(80) - yForVal(100)}
                  fill="#10B981"
                  fillOpacity="0.06"
                />
                <rect
                  x={padL}
                  y={yForVal(80)}
                  width={plotW}
                  height={yForVal(50) - yForVal(80)}
                  fill="#0EA5E9"
                  fillOpacity="0.04"
                />

                {/* Y-Axis Gridlines & Labels (0, 25, 50, 75, 100) */}
                {[0, 25, 50, 75, 100].map((tick) => {
                  const y = yForVal(tick);
                  return (
                    <g key={`y-${tick}`}>
                      <line
                        x1={padL}
                        y1={y}
                        x2={svgW - padR}
                        y2={y}
                        stroke={tick === 0 ? '#2D3E99' : '#2D3E99'}
                        strokeOpacity={tick === 0 ? 0.3 : 0.12}
                        strokeDasharray={tick === 0 ? undefined : '4 4'}
                        strokeWidth={1}
                      />
                      <text
                        x={padL - 10}
                        y={y + 4}
                        textAnchor="end"
                        className="fill-[#172154]/65 text-[11px] font-mono-num font-semibold"
                      >
                        {tick}
                      </text>
                    </g>
                  );
                })}

                {/* X-Axis Monthly Ticks across last 6 months */}
                {monthTicks.map((t, i) => {
                  const x = xForMs(t.ms);
                  return (
                    <g key={`m-${i}`}>
                      <line
                        x1={x}
                        y1={padT}
                        x2={x}
                        y2={padT + plotH}
                        stroke="#2D3E99"
                        strokeOpacity="0.08"
                        strokeWidth={1}
                      />
                      <text
                        x={x}
                        y={padT + plotH + 22}
                        textAnchor={i === 0 ? 'start' : i === monthTicks.length - 1 ? 'end' : 'middle'}
                        className="fill-[#172154]/70 text-[11px] font-semibold"
                      >
                        {t.label}
                      </text>
                    </g>
                  );
                })}

                {/* Highlight Vertical Crosshair for Active Inspected Point */}
                {activeInspectPt && (
                  <line
                    x1={activeInspectPt.x}
                    y1={padT}
                    x2={activeInspectPt.x}
                    y2={padT + plotH}
                    stroke="#E61E64"
                    strokeOpacity="0.35"
                    strokeDasharray="3 3"
                    strokeWidth={1.5}
                  />
                )}

                {/* Soft Area Fill under Primary Line in Summary Mode */}
                {viewMode === 'summary' &&
                  !hiddenSeries.overall &&
                  plottedPoints.length >= 2 && (() => {
                    const topPath = plottedPoints
                      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${yForVal(p.overallAvg).toFixed(1)}`)
                      .join(' ');
                    const last = plottedPoints[plottedPoints.length - 1];
                    const first = plottedPoints[0];
                    const areaD = `${topPath} L ${last.x.toFixed(1)} ${(padT + plotH).toFixed(1)} L ${first.x.toFixed(1)} ${(padT + plotH).toFixed(1)} Z`;
                    return <path d={areaD} fill="url(#lilabOverallArea)" />;
                  })()}

                {/* Lines + Data Points */}
                {visibleSeries.map((ser) => {
                  const pts = plottedPoints.map((p) => ({
                    id: p.assessment.id,
                    x: p.x,
                    y: yForVal(ser.getValue(p.assessment)),
                    val: ser.getValue(p.assessment),
                  }));

                  const d = pts
                    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
                    .join(' ');

                  return (
                    <g key={ser.key}>
                      {pts.length >= 2 && (
                        <path
                          d={d}
                          fill="none"
                          stroke={ser.color}
                          strokeWidth={ser.strokeWidth ?? 2.5}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}
                      {pts.map((pt) => {
                        const isActive = activeInspectPt?.assessment.id === pt.id;
                        return (
                          <g
                            key={`${ser.key}-${pt.id}`}
                            onMouseEnter={() => setHoveredId(pt.id)}
                            onClick={() => setHoveredId(pt.id)}
                            className="cursor-pointer"
                          >
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r={isActive ? 6.5 : 4.5}
                              fill="#FFFFFF"
                              stroke={ser.color}
                              strokeWidth={isActive ? 3 : 2.5}
                            />
                            {isActive && (
                              <text
                                x={pt.x}
                                y={Math.max(padT + 10, pt.y - 10)}
                                textAnchor="middle"
                                className="text-[10px] font-mono-num font-bold"
                                fill={ser.color}
                              >
                                {Math.round(pt.val)}
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </g>
                  );
                })}
              </svg>

              {plottedPoints.length === 1 && (
                <div className="mt-2 px-3 py-2 rounded-lg bg-white/85 border border-[#2D3E99]/10 text-xs text-[#172154]/75 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#E61E64] shrink-0" />
                  <span>
                    {biText(
                      lang,
                      '1 assessment recorded in the last 6 months. Publish another assessment over time to draw the trajectory trend line.',
                      'Hiện có 1 báo cáo trong 6 tháng qua. Khi có thêm báo cáo mới, đường xu hướng sẽ tự động nối liền qua các tháng.'
                    )}
                  </span>
                </div>
              )}
            </div>

            {/* Selected / Hovered Report Snapshot Inspector */}
            <div className="xl:col-span-3 bg-[#FDF9EE] border border-[#2D3E99]/12 rounded-xl p-4 space-y-3">
              {activeInspectPt ? (
                <>
                  <div className="border-b border-[#2D3E99]/10 pb-2.5">
                    <div className="text-[11px] font-bold text-[#E61E64] uppercase tracking-wide">
                      {activeInspectPt.dateLabel}
                    </div>
                    <div className="font-display text-sm font-bold text-[#2D3E99] mt-0.5">
                      {activeInspectPt.assessment.termLabel}
                    </div>
                    <div className="text-xs text-[#172154]/70 mt-0.5">
                      {activeInspectPt.assessment.className} ·{' '}
                      <span className="font-mono-num font-bold text-[#E61E64]">
                        {formatCefrLabel(
                          activeInspectPt.assessment.cefrLevel,
                          activeInspectPt.assessment.cefrModifier
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    {visibleSeries.map((ser) => {
                      const val = Math.round(ser.getValue(activeInspectPt.assessment));
                      const firstVal = firstPt ? Math.round(ser.getValue(firstPt.assessment)) : val;
                      const diff =
                        sixMonthPoints.length >= 2 && activeInspectPt.assessment.id !== firstPt?.assessment.id
                          ? val - firstVal
                          : null;
                      return (
                        <div key={`insp-${ser.key}`} className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-[#172154]/85 truncate">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: ser.color }}
                            />
                            <span className="truncate">{ser.label}</span>
                          </span>
                          <span className="font-mono-num font-bold text-[#172154] shrink-0">
                            {val}
                            {diff !== null && (
                              <span
                                className={`ml-1 text-[10px] ${
                                  diff > 0
                                    ? 'text-[#0F766E]'
                                    : diff < 0
                                      ? 'text-[#E61E64]'
                                      : 'text-[#172154]/50'
                                }`}
                              >
                                ({diff > 0 ? `+${diff}` : diff})
                              </span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {plottedPoints.length > 1 && (
                    <div className="pt-2 border-t border-[#2D3E99]/10 space-y-1">
                      <div className="text-[11px] font-semibold text-[#172154]/60">
                        {biText(lang, 'Jump to Report Point:', 'Chọn nhanh mốc báo cáo:')}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {plottedPoints.map((p) => {
                          const selected = p.assessment.id === activeInspectPt.assessment.id;
                          return (
                            <button
                              key={`chip-${p.assessment.id}`}
                              type="button"
                              onClick={() => setHoveredId(p.assessment.id)}
                              className={`px-2 py-0.5 rounded text-[11px] font-mono-num font-semibold cursor-pointer ${
                                selected
                                  ? 'bg-[#2D3E99] text-white'
                                  : 'bg-white border border-[#2D3E99]/15 text-[#172154]/80 hover:border-[#2D3E99]'
                              }`}
                            >
                              {p.dateLabel}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
