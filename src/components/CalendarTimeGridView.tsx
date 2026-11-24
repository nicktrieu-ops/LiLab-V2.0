import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, GripVertical, MapPin, Plus } from 'lucide-react';
import { biText } from '../i18n';
import type { AcademyEventType, LangCode } from '../types';
import type { DisplayCalendarEvent } from './AcademyEventCalendar';

export const GRID_START_HOUR = 8; // 08:00
export const GRID_END_HOUR = 22; // 22:00
const HOUR_HEIGHT = 68; // px per hour (15 min = 17px)
const SNAP_MINUTES = 15;
const TOTAL_HOURS = GRID_END_HOUR - GRID_START_HOUR;
const TOTAL_GRID_HEIGHT = TOTAL_HOURS * HOUR_HEIGHT;

const WEEKDAY_SHORT_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_SHORT_VI = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const STANDARD_ROOMS = ['Phòng 1', 'Phòng 2', 'Phòng 3', 'Phòng 4'];

export function parseTimeToMinutes(hhmm: string | undefined, fallbackMin = 9 * 60): number {
  if (!hhmm) return fallbackMin;
  const match = hhmm.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return fallbackMin;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (Number.isNaN(h) || Number.isNaN(m)) return fallbackMin;
  return Math.max(0, Math.min(23 * 60 + 59, h * 60 + m));
}

export function minutesToTimeStr(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 45, Math.round(totalMinutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatLocalYmd(dt: Date): string {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export interface WeekColumnDay {
  dateStr: string;
  dayNumber: number;
  weekdayEn: string;
  weekdayVi: string;
  monthLabel: string;
  isToday: boolean;
}

export function getWeekDaysForYmd(anchorYmd: string, todayYmd: string): WeekColumnDay[] {
  const parts = anchorYmd.split('-').map(Number);
  const anchor =
    parts.length === 3 && !parts.some(Number.isNaN)
      ? new Date(parts[0], parts[1] - 1, parts[2])
      : new Date();
  const mondayOffset = (anchor.getDay() + 6) % 7; // Mon=0 .. Sun=6
  const monday = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - mondayOffset);

  const days: WeekColumnDay[] = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const dateStr = formatLocalYmd(dt);
    const dow = dt.getDay();
    days.push({
      dateStr,
      dayNumber: dt.getDate(),
      weekdayEn: WEEKDAY_SHORT_EN[dow],
      weekdayVi: WEEKDAY_SHORT_VI[dow],
      monthLabel: dt.toLocaleDateString('en-US', { month: 'short' }),
      isToday: dateStr === todayYmd
    });
  }
  return days;
}

interface PositionedEvent {
  ev: DisplayCalendarEvent;
  startMin: number;
  endMin: number;
  colIndex: number;
  colCount: number;
}

function layoutOverlappingEvents(events: DisplayCalendarEvent[]): PositionedEvent[] {
  const items = events
    .map((ev) => {
      const startMin = parseTimeToMinutes(ev.startTime, 9 * 60);
      const rawEnd = parseTimeToMinutes(ev.endTime, startMin + 90);
      const endMin = Math.max(startMin + 30, rawEnd);
      return { ev, startMin, endMin };
    })
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin || a.ev.location.localeCompare(b.ev.location));

  // Group into connected overlapping clusters
  const result: PositionedEvent[] = [];
  let cluster: Array<{ ev: DisplayCalendarEvent; startMin: number; endMin: number }> = [];
  let clusterMaxEnd = -1;

  const flushCluster = () => {
    if (cluster.length === 0) return;
    const laneEnds: number[] = [];
    const assigned: Array<{ item: (typeof cluster)[number]; colIndex: number }> = [];

    for (const item of cluster) {
      let lane = laneEnds.findIndex((endVal) => endVal <= item.startMin);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(item.endMin);
      } else {
        laneEnds[lane] = item.endMin;
      }
      assigned.push({ item, colIndex: lane });
    }

    const colCount = Math.max(1, laneEnds.length);
    for (const entry of assigned) {
      result.push({
        ev: entry.item.ev,
        startMin: entry.item.startMin,
        endMin: entry.item.endMin,
        colIndex: entry.colIndex,
        colCount
      });
    }
    cluster = [];
    clusterMaxEnd = -1;
  };

  for (const item of items) {
    if (cluster.length === 0 || item.startMin < clusterMaxEnd) {
      cluster.push(item);
      clusterMaxEnd = Math.max(clusterMaxEnd, item.endMin);
    } else {
      flushCluster();
      cluster.push(item);
      clusterMaxEnd = item.endMin;
    }
  }
  flushCluster();
  return result;
}

function blockStyleForType(type: AcademyEventType): {
  bg: string;
  border: string;
  text: string;
  accent: string;
} {
  switch (type) {
    case 'class_session':
      return {
        bg: 'bg-indigo-50/95 hover:bg-indigo-100/95',
        border: 'border-indigo-300 border-l-indigo-600',
        text: 'text-indigo-950',
        accent: 'bg-indigo-600'
      };
    case 'cefr_assessment':
      return {
        bg: 'bg-rose-50/95 hover:bg-rose-100/95',
        border: 'border-rose-300 border-l-[#E61E64]',
        text: 'text-rose-950',
        accent: 'bg-[#E61E64]'
      };
    case 'academy_milestone':
      return {
        bg: 'bg-amber-50/95 hover:bg-amber-100/95',
        border: 'border-amber-300 border-l-amber-500',
        text: 'text-amber-950',
        accent: 'bg-amber-500'
      };
    case 'parent_workshop':
      return {
        bg: 'bg-emerald-50/95 hover:bg-emerald-100/95',
        border: 'border-emerald-300 border-l-emerald-600',
        text: 'text-emerald-950',
        accent: 'bg-emerald-600'
      };
    case 'holiday':
      return {
        bg: 'bg-stone-100/95 hover:bg-stone-200/95',
        border: 'border-stone-300 border-l-stone-500',
        text: 'text-stone-900',
        accent: 'bg-stone-500'
      };
  }
}

interface CalendarTimeGridViewProps {
  mode: 'week' | 'day';
  lang: LangCode;
  canManageCalendar: boolean;
  selectedDate: string;
  todayStr: string;
  events: DisplayCalendarEvent[];
  draggedEvent: DisplayCalendarEvent | null;
  onSelectDate: (dateStr: string) => void;
  onDateDoubleClick?: (dateStr: string) => void;
  onEventClick: (ev: DisplayCalendarEvent) => void;
  onDragEventChange: (ev: DisplayCalendarEvent | null) => void;
  onDropReschedule: (
    ev: DisplayCalendarEvent,
    updates: { eventDate: string; startTime: string; endTime: string; location?: string }
  ) => void;
  onEmptySlotClick?: (dateStr: string, startTime: string, endTime: string, room?: string) => void;
  maxHeightClass?: string;
}

interface DropGhostState {
  colKey: string;
  dateStr: string;
  room?: string;
  startMin: number;
  endMin: number;
}

interface ResizeState {
  ev: DisplayCalendarEvent;
  startMin: number;
  currentEndMin: number;
  initialClientY: number;
  initialEndMin: number;
}

export const CalendarTimeGridView: React.FC<CalendarTimeGridViewProps> = ({
  mode,
  lang,
  canManageCalendar,
  selectedDate,
  todayStr,
  events,
  draggedEvent,
  onSelectDate,
  onDateDoubleClick,
  onEventClick,
  onDragEventChange,
  onDropReschedule,
  onEmptySlotClick,
  maxHeightClass
}) => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const grabOffsetMinRef = useRef<number>(0);
  const draggedDurationRef = useRef<number>(90);

  const [dropGhost, setDropGhost] = useState<DropGhostState | null>(null);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const resizeStateRef = useRef<ResizeState | null>(null);
  const internalDragIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!draggedEvent) {
      setDropGhost(null);
      internalDragIdRef.current = null;
      grabOffsetMinRef.current = 0;
      return;
    }
    if (internalDragIdRef.current !== draggedEvent.id) {
      const s = parseTimeToMinutes(draggedEvent.startTime, 9 * 60);
      const e = parseTimeToMinutes(draggedEvent.endTime, s + 90);
      draggedDurationRef.current = Math.max(30, e - s);
      grabOffsetMinRef.current = 15;
    }
  }, [draggedEvent]);

  const weekDays = useMemo(() => getWeekDaysForYmd(selectedDate, todayStr), [selectedDate, todayStr]);

  // Columns definition: 7 days in Week mode, Rooms in Day mode
  const columns = useMemo(() => {
    if (mode === 'week') {
      return weekDays.map((d) => ({
        key: d.dateStr,
        dateStr: d.dateStr,
        room: undefined as string | undefined,
        title: lang === 'vi' ? d.weekdayVi : lang === 'en' ? d.weekdayEn : `${d.weekdayEn}/${d.weekdayVi}`,
        subtitle: `${d.monthLabel} ${d.dayNumber}`,
        isHighlighted: d.dateStr === selectedDate,
        isToday: d.isToday,
        events: events.filter((ev) => ev.eventDate === d.dateStr)
      }));
    }

    // Day mode: Room columns
    const dayEvents = events.filter((ev) => ev.eventDate === selectedDate);
    const extraEvents = dayEvents.filter(
      (ev) => !STANDARD_ROOMS.some((r) => ev.location.toLowerCase().startsWith(r.toLowerCase()))
    );
    const roomCols: Array<{
      key: string;
      dateStr: string;
      room: string | undefined;
      title: string;
      subtitle: string;
      isHighlighted: boolean;
      isToday: boolean;
      events: DisplayCalendarEvent[];
    }> = STANDARD_ROOMS.map((room) => ({
      key: room,
      dateStr: selectedDate,
      room,
      title: room,
      subtitle:
        room === 'Phòng 4'
          ? biText(lang, 'Coach 1:1', 'Coach 1:1')
          : biText(lang, 'Group Room', 'Phòng nhóm'),
      isHighlighted: false,
      isToday: selectedDate === todayStr,
      events: dayEvents.filter((ev) => ev.location.toLowerCase().startsWith(room.toLowerCase()))
    }));

    if (extraEvents.length > 0) {
      roomCols.push({
        key: '__other__',
        dateStr: selectedDate,
        room: undefined,
        title: biText(lang, 'Other / Hall', 'Hội trường / Khác'),
        subtitle: biText(lang, 'Events', 'Sự kiện'),
        isHighlighted: false,
        isToday: selectedDate === todayStr,
        events: extraEvents
      });
    }
    return roomCols;
  }, [mode, weekDays, selectedDate, todayStr, events, lang]);

  // Auto-scroll to show afternoon/evening classes comfortably when opening Week/Day grid
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const allVisible = columns.flatMap((c) => c.events);
    let targetHour = 14;
    if (allVisible.length > 0) {
      const earliestMin = Math.min(...allVisible.map((ev) => parseTimeToMinutes(ev.startTime, 14 * 60)));
      targetHour = Math.max(GRID_START_HOUR, Math.min(16, Math.floor(earliestMin / 60) - 1));
    }
    el.scrollTop = Math.max(0, (targetHour - GRID_START_HOUR) * HOUR_HEIGHT);
  }, [mode]);

  // Global pointer listeners for bottom-edge duration resize
  useEffect(() => {
    if (!resizeState) return;

    const handlePointerMove = (e: PointerEvent) => {
      const cur = resizeStateRef.current;
      if (!cur) return;
      const deltaPx = e.clientY - cur.initialClientY;
      const deltaMin = Math.round((deltaPx / HOUR_HEIGHT) * 60 / SNAP_MINUTES) * SNAP_MINUTES;
      const nextEnd = Math.max(
        cur.startMin + 30,
        Math.min(GRID_END_HOUR * 60, cur.initialEndMin + deltaMin)
      );
      if (nextEnd !== cur.currentEndMin) {
        const updated = { ...cur, currentEndMin: nextEnd };
        resizeStateRef.current = updated;
        setResizeState(updated);
      }
    };

    const handlePointerUp = () => {
      const cur = resizeStateRef.current;
      resizeStateRef.current = null;
      setResizeState(null);
      if (!cur) return;
      if (cur.currentEndMin !== cur.initialEndMin) {
        onDropReschedule(cur.ev, {
          eventDate: cur.ev.eventDate,
          startTime: cur.ev.startTime,
          endTime: minutesToTimeStr(cur.currentEndMin),
          location: cur.ev.location
        });
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [resizeState !== null, onDropReschedule]);

  const computeSnappedRange = (clientY: number, colEl: HTMLElement, durationMin: number) => {
    const rect = colEl.getBoundingClientRect();
    const relY = clientY - rect.top;
    const rawMin = GRID_START_HOUR * 60 + (relY / HOUR_HEIGHT) * 60 - grabOffsetMinRef.current;
    const snappedStart = Math.round(rawMin / SNAP_MINUTES) * SNAP_MINUTES;
    const minStart = GRID_START_HOUR * 60;
    const maxStart = Math.max(minStart, GRID_END_HOUR * 60 - durationMin);
    const startMin = Math.max(minStart, Math.min(maxStart, snappedStart));
    const endMin = Math.min(GRID_END_HOUR * 60, startMin + durationMin);
    return { startMin, endMin };
  };

  const hours = useMemo(
    () => Array.from({ length: TOTAL_HOURS }, (_, idx) => GRID_START_HOUR + idx),
    []
  );

  return (
    <div className="rounded-2xl border border-[#2D3E99]/15 bg-white overflow-hidden">
      {/* Sticky Column Headers */}
      <div className="flex border-b border-[#2D3E99]/12 bg-[#FDF9EE]">
        <div className="w-14 sm:w-16 shrink-0 border-r border-[#2D3E99]/10 flex items-center justify-center text-[10px] font-bold uppercase tracking-wider text-[#172154]/50">
          {biText(lang, 'Time', 'Giờ')}
        </div>
        <div
          className="flex-1 grid divide-x divide-[#2D3E99]/10"
          style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
        >
          {columns.map((col) => (
            <button
              key={col.key}
              type="button"
              onClick={() => onSelectDate(col.dateStr)}
              onDoubleClick={() => {
                if (mode === 'week' && onDateDoubleClick) {
                  onDateDoubleClick(col.dateStr);
                }
              }}
              title={
                mode === 'week' && onDateDoubleClick
                  ? biText(lang, 'Double-click to open Day View popup', 'Nhấp đúp để mở cửa sổ Xem Chi tiết Ngày')
                  : undefined
              }
              className={`px-2 py-2.5 text-center transition-colors cursor-pointer ${
                col.isToday
                  ? 'bg-rose-50/80'
                  : col.isHighlighted
                    ? 'bg-indigo-50/70'
                    : 'hover:bg-white/60'
              }`}
            >
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#2D3E99] truncate">
                {col.title}
              </div>
              <div className="flex items-center justify-center gap-1 mt-0.5">
                <span
                  className={`text-xs font-mono-num font-bold px-1.5 py-0.5 rounded-md ${
                    col.isToday
                      ? 'bg-[#E61E64] text-white'
                      : col.isHighlighted
                        ? 'bg-[#2D3E99] text-white'
                        : 'text-[#172154]/75'
                  }`}
                >
                  {col.subtitle}
                </span>
                {col.events.length > 0 && (
                  <span className="text-[10px] font-mono-num font-bold text-[#6B21A8] bg-[#FAF5FF] border border-[#6B21A8]/20 px-1 rounded">
                    {col.events.length}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable Time Grid Body */}
      <div
        ref={scrollContainerRef}
        className={`overflow-y-auto overflow-x-auto ${maxHeightClass || 'max-h-[640px]'} relative select-none`}
      >
        <div className="flex min-w-[640px]" style={{ height: `${TOTAL_GRID_HEIGHT}px` }}>
          {/* Time Axis Gutter */}
          <div className="w-14 sm:w-16 shrink-0 border-r border-[#2D3E99]/12 bg-stone-50/60 relative">
            {hours.map((hr, idx) => (
              <div
                key={hr}
                className="absolute left-0 right-0 pr-2 text-right -translate-y-2"
                style={{ top: `${idx * HOUR_HEIGHT}px` }}
              >
                <span className="text-[10px] font-mono-num font-bold text-[#172154]/55">
                  {String(hr).padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>

          {/* Day / Room Drop Columns */}
          <div
            className="flex-1 grid divide-x divide-[#2D3E99]/10 relative"
            style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
          >
            {columns.map((col) => {
              const positioned = layoutOverlappingEvents(col.events);
              const activeGhost = dropGhost && dropGhost.colKey === col.key ? dropGhost : null;

              return (
                <div
                  key={col.key}
                  onClick={(e) => {
                    onSelectDate(col.dateStr);
                    if (!canManageCalendar || !onEmptySlotClick || resizeState) return;
                    if ((e.target as HTMLElement).closest('[data-cal-event-block="true"]')) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const relY = e.clientY - rect.top;
                    const rawMin = GRID_START_HOUR * 60 + (relY / HOUR_HEIGHT) * 60;
                    const snappedStart = Math.max(
                      GRID_START_HOUR * 60,
                      Math.min(GRID_END_HOUR * 60 - 60, Math.floor(rawMin / 30) * 30)
                    );
                    const endMin = Math.min(GRID_END_HOUR * 60, snappedStart + 90);
                    onEmptySlotClick(col.dateStr, minutesToTimeStr(snappedStart), minutesToTimeStr(endMin), col.room);
                  }}
                  onDragOver={(e) => {
                    if (!canManageCalendar || !draggedEvent) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    const { startMin, endMin } = computeSnappedRange(
                      e.clientY,
                      e.currentTarget,
                      draggedDurationRef.current
                    );
                    setDropGhost((prev) =>
                      prev &&
                      prev.colKey === col.key &&
                      prev.startMin === startMin &&
                      prev.endMin === endMin
                        ? prev
                        : {
                            colKey: col.key,
                            dateStr: col.dateStr,
                            room: col.room,
                            startMin,
                            endMin
                          }
                    );
                  }}
                  onDragLeave={(e) => {
                    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                    setDropGhost((prev) => (prev?.colKey === col.key ? null : prev));
                  }}
                  onDrop={(e) => {
                    if (!canManageCalendar || !draggedEvent) return;
                    e.preventDefault();
                    const { startMin, endMin } = computeSnappedRange(
                      e.clientY,
                      e.currentTarget,
                      draggedDurationRef.current
                    );
                    const evToMove = draggedEvent;
                    setDropGhost(null);
                    onDragEventChange(null);
                    onDropReschedule(evToMove, {
                      eventDate: col.dateStr,
                      startTime: minutesToTimeStr(startMin),
                      endTime: minutesToTimeStr(endMin),
                      location: col.room ?? evToMove.location
                    });
                  }}
                  className={`relative h-full transition-colors ${
                    activeGhost
                      ? 'bg-[#FAF5FF]/70'
                      : col.isHighlighted
                        ? 'bg-indigo-50/15'
                        : 'bg-white'
                  }`}
                >
                  {/* Hour + Half-Hour Background Lines */}
                  {hours.map((hr, idx) => (
                    <div
                      key={hr}
                      className="absolute left-0 right-0 border-t border-stone-200/80 pointer-events-none"
                      style={{ top: `${idx * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
                    >
                      <div
                        className="absolute left-0 right-0 border-t border-dashed border-stone-100"
                        style={{ top: `${HOUR_HEIGHT / 2}px` }}
                      />
                    </div>
                  ))}

                  {/* Live Drag-and-Drop Ghost Preview */}
                  {activeGhost && draggedEvent && (
                    <div
                      className="absolute left-1 right-1 z-30 rounded-xl border-2 border-dashed border-[#6B21A8] bg-[#6B21A8]/15 px-2 py-1 pointer-events-none flex flex-col justify-between shadow-sm"
                      style={{
                        top: `${((activeGhost.startMin - GRID_START_HOUR * 60) / 60) * HOUR_HEIGHT}px`,
                        height: `${Math.max(28, ((activeGhost.endMin - activeGhost.startMin) / 60) * HOUR_HEIGHT)}px`
                      }}
                    >
                      <div className="flex items-center justify-between gap-1 text-[10px] font-bold text-[#6B21A8]">
                        <span className="font-mono-num">
                          {minutesToTimeStr(activeGhost.startMin)}–{minutesToTimeStr(activeGhost.endMin)}
                        </span>
                        <span className="truncate">
                          {activeGhost.room || col.subtitle}
                        </span>
                      </div>
                      <div className="text-[10px] font-semibold text-[#6B21A8] truncate">
                        {lang === 'vi' ? draggedEvent.titleVi : draggedEvent.titleEn}
                      </div>
                    </div>
                  )}

                  {/* Event Blocks */}
                  {positioned.map(({ ev, startMin, endMin, colIndex, colCount }) => {
                    const isResizing = resizeState?.ev.id === ev.id;
                    const effectiveEndMin = isResizing ? resizeState.currentEndMin : endMin;
                    const clampedStart = Math.max(GRID_START_HOUR * 60, startMin);
                    const clampedEnd = Math.min(GRID_END_HOUR * 60, Math.max(clampedStart + 30, effectiveEndMin));
                    const topPx = ((clampedStart - GRID_START_HOUR * 60) / 60) * HOUR_HEIGHT;
                    const heightPx = Math.max(30, ((clampedEnd - clampedStart) / 60) * HOUR_HEIGHT - 2);
                    const widthPct = 100 / colCount;
                    const leftPct = colIndex * widthPct;
                    const st = blockStyleForType(ev.eventType);
                    const isBeingDragged = draggedEvent?.id === ev.id;

                    return (
                      <div
                        key={ev.id}
                        data-cal-event-block="true"
                        draggable={canManageCalendar && !isResizing}
                        onDragStart={(e) => {
                          if (!canManageCalendar) return;
                          e.stopPropagation();
                          e.dataTransfer.setData('text/plain', ev.id);
                          e.dataTransfer.effectAllowed = 'move';
                          const rect = e.currentTarget.getBoundingClientRect();
                          const offsetPx = Math.max(0, e.clientY - rect.top);
                          internalDragIdRef.current = ev.id;
                          grabOffsetMinRef.current = (offsetPx / HOUR_HEIGHT) * 60;
                          draggedDurationRef.current = Math.max(30, endMin - startMin);
                          onDragEventChange(ev);
                        }}
                        onDragEnd={() => {
                          setDropGhost(null);
                          onDragEventChange(null);
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(ev);
                        }}
                        style={{
                          top: `${topPx}px`,
                          height: `${heightPx}px`,
                          left: `calc(${leftPct}% + 2px)`,
                          width: `calc(${widthPct}% - 4px)`
                        }}
                        className={`group/ev absolute z-10 rounded-lg border border-l-[3px] px-1.5 py-1 overflow-hidden shadow-2xs transition-all flex flex-col justify-between ${st.bg} ${st.border} ${st.text} ${
                          canManageCalendar ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                        } ${isBeingDragged ? 'opacity-35 scale-[0.98]' : ''} ${
                          isResizing ? 'z-30 ring-2 ring-[#6B21A8] shadow-md' : 'hover:z-20 hover:shadow-sm'
                        }`}
                        title={biText(
                          lang,
                          `${ev.startTime}–${ev.endTime} · ${ev.titleEn} (${ev.location})${canManageCalendar ? ' — Drag to reschedule day/time, or drag bottom edge to resize' : ''}`,
                          `${ev.startTime}–${ev.endTime} · ${ev.titleVi} (${ev.location})${canManageCalendar ? ' — Kéo thả để đổi ngày/giờ, hoặc kéo cạnh dưới để chỉnh thời lượng' : ''}`
                        )}
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-0.5 text-[9.5px] font-mono-num font-bold leading-tight">
                            {canManageCalendar && (
                              <GripVertical className="w-2.5 h-2.5 opacity-45 group-hover/ev:opacity-90 shrink-0 -ml-0.5" />
                            )}
                            <span className="truncate">
                              {ev.startTime}–{isResizing ? minutesToTimeStr(effectiveEndMin) : ev.endTime}
                            </span>
                          </div>
                          <div className="text-[10.5px] font-bold leading-tight line-clamp-2">
                            {lang === 'vi' ? ev.titleVi : ev.titleEn}
                          </div>
                        </div>

                        {heightPx >= 56 && (
                          <div className="flex items-center justify-between gap-1 text-[9.5px] opacity-75 truncate mt-0.5">
                            <span className="inline-flex items-center gap-0.5 truncate font-medium">
                              <MapPin className="w-2.5 h-2.5 shrink-0" />
                              <span className="truncate">{ev.location}</span>
                            </span>
                            {ev.status === 'rescheduled' && (
                              <span className="px-1 rounded bg-amber-200/80 text-amber-950 text-[8.5px] font-bold shrink-0">
                                {biText(lang, 'Moved', 'Dời')}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Bottom-edge Resize Handle for Admin */}
                        {canManageCalendar && (
                          <div
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              const initial: ResizeState = {
                                ev,
                                startMin,
                                currentEndMin: endMin,
                                initialClientY: e.clientY,
                                initialEndMin: endMin
                              };
                              resizeStateRef.current = initial;
                              setResizeState(initial);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize flex items-center justify-center opacity-0 group-hover/ev:opacity-100 transition-opacity"
                            title={biText(lang, 'Drag bottom edge to adjust end time', 'Kéo cạnh dưới để thay đổi giờ kết thúc')}
                          >
                            <span className="w-6 h-1 rounded-full bg-[#6B21A8]/55" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer Hint Bar */}
      <div className="px-4 py-2 bg-stone-50 border-t border-[#2D3E99]/10 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#172154]/65">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-[#6B21A8]" />
          {canManageCalendar ? (
            <span>
              {mode === 'week'
                ? biText(
                    lang,
                    'Drag any class card across days & 15-min time slots, drag bottom edge to resize duration, or click an empty slot to add.',
                    'Kéo thả thẻ lớp học sang ngày & khung giờ (bước 15 phút), kéo cạnh dưới để đổi thời lượng, hoặc nhấp ô trống để thêm mới.'
                  )
                : biText(
                    lang,
                    'Drag classes vertically to change time or horizontally to switch rooms (Phòng 1–4).',
                    'Kéo lớp theo chiều dọc để đổi giờ học hoặc kéo ngang để đổi phòng (Phòng 1–4).'
                  )}
            </span>
          ) : (
            <span>
              {biText(
                lang,
                'Click any class block to view full details, teacher info, and notes.',
                'Nhấp vào bất kỳ buổi học nào để xem chi tiết giáo viên và ghi chú.'
              )}
            </span>
          )}
        </div>
        {canManageCalendar && onEmptySlotClick && (
          <span className="inline-flex items-center gap-1 font-semibold text-[#6B21A8]">
            <Plus className="w-3 h-3" />
            {biText(lang, '15-min snap', 'Bước 15 phút')}
          </span>
        )}
      </div>
    </div>
  );
};
