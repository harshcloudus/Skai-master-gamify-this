import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

export type DateRangeValue = { startDate: Date | null; endDate: Date | null };

export type DateRangePickerProps = {
  value: DateRangeValue;
  onChange: (range: DateRangeValue) => void;
  minDate?: Date;
  maxDate?: Date;
  disabledDates?: Date[];
  disablePastDates?: boolean;
  className?: string;
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, months: number) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + months);
  return x;
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isBeforeDay(a: Date, b: Date) {
  return startOfDay(a).getTime() < startOfDay(b).getTime();
}

function isAfterDay(a: Date, b: Date) {
  return startOfDay(a).getTime() > startOfDay(b).getTime();
}

function clampToDay(d: Date, min?: Date, max?: Date) {
  const x = startOfDay(d);
  if (min && isBeforeDay(x, min)) return startOfDay(min);
  if (max && isAfterDay(x, max)) return startOfDay(max);
  return x;
}

function getMonthLabel(d: Date) {
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function fmtSummary(d: Date) {
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function toKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildDisabledSet(disabledDates?: Date[]) {
  if (!disabledDates?.length) return new Set<string>();
  const s = new Set<string>();
  for (const d of disabledDates) s.add(toKey(startOfDay(d)));
  return s;
}

function getGridStart(month: Date, weekStartsOnSunday: boolean) {
  // month is first of month
  const first = startOfMonth(month);
  const dow = first.getDay(); // 0 Sun ... 6 Sat
  const offset = weekStartsOnSunday ? dow : (dow + 6) % 7; // Monday=0
  return addDays(first, -offset);
}

function inRange(day: Date, start: Date, end: Date) {
  const t = startOfDay(day).getTime();
  const a = startOfDay(start).getTime();
  const b = startOfDay(end).getTime();
  return t >= Math.min(a, b) && t <= Math.max(a, b);
}

type CalendarMonthProps = {
  month: Date;
  weekStartsOnSunday: boolean;
  value: DateRangeValue;
  hoverDate: Date | null;
  disabledSet: Set<string>;
  minDate?: Date;
  maxDate?: Date;
  disablePastDates?: boolean;
  onDayClick: (d: Date) => void;
  onDayHover: (d: Date | null) => void;
  focusedDate: Date | null;
  onFocusDate: (d: Date) => void;
};

const CalendarMonth = React.memo(function CalendarMonth({
  month,
  weekStartsOnSunday,
  value,
  hoverDate,
  disabledSet,
  minDate,
  maxDate,
  disablePastDates,
  onDayClick,
  onDayHover,
  focusedDate,
  onFocusDate,
}: CalendarMonthProps) {
  const start = React.useMemo(() => getGridStart(month, weekStartsOnSunday), [month, weekStartsOnSunday]);
  const today = React.useMemo(() => startOfDay(new Date()), []);
  const monthIdx = month.getMonth();
  const startDate = value.startDate ? startOfDay(value.startDate) : null;
  const endDate = value.endDate ? startOfDay(value.endDate) : null;

  const effectiveEnd = React.useMemo(() => {
    if (startDate && !endDate && hoverDate) return startOfDay(hoverDate);
    return endDate;
  }, [startDate, endDate, hoverDate]);

  const weeks = React.useMemo(() => {
    const cells: Date[] = [];
    for (let i = 0; i < 42; i++) cells.push(addDays(start, i));
    const out: Date[][] = [];
    for (let i = 0; i < 6; i++) out.push(cells.slice(i * 7, i * 7 + 7));
    return out;
  }, [start]);

  const weekdays = weekStartsOnSunday
    ? ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
    : ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  function isDisabled(d: Date) {
    const day = startOfDay(d);
    if (disabledSet.has(toKey(day))) return true;
    if (disablePastDates && isBeforeDay(day, today)) return true;
    if (minDate && isBeforeDay(day, startOfDay(minDate))) return true;
    if (maxDate && isAfterDay(day, startOfDay(maxDate))) return true;
    return false;
  }

  function getRangeState(d: Date) {
    if (!startDate || !effectiveEnd) return { inPreview: false, inFinal: false, isStart: false, isEnd: false };
    const inFinal = !!(startDate && endDate && inRange(d, startDate, endDate));
    const inPreview = !!(startDate && !endDate && hoverDate && inRange(d, startDate, effectiveEnd));
    const isStart = !!startDate && isSameDay(d, startDate);
    const isEnd = !!effectiveEnd && isSameDay(d, effectiveEnd);
    return { inPreview, inFinal, isStart, isEnd };
  }

  return (
    <div className="space-y-2 min-w-[220px]">
      <div className="px-2 text-sm font-bold text-on-surface">{getMonthLabel(month)}</div>
      <div className="grid grid-cols-7 gap-[2px] px-1">
        {weekdays.map((w) => (
          <div
            key={w}
            className="flex h-7 items-center justify-center text-xs font-extrabold text-on-surface-variant/75 uppercase tracking-widest"
          >
            {w}
          </div>
        ))}
        {weeks.flat().map((d) => {
          const day = startOfDay(d);
          const disabled = isDisabled(day);
          const outside = day.getMonth() !== monthIdx;
          const { inFinal, inPreview, isStart, isEnd } = getRangeState(day);
          const inBand = inFinal || inPreview;
          const bandTone = inFinal ? "bg-primary/30" : "bg-primary/20";
          const endpointTone = inFinal ? "bg-primary/90" : "bg-primary/70";

          return (
            <div
              key={toKey(day)}
              className={cn("relative h-8 w-8")}
              onMouseEnter={() => (startDate && !endDate ? onDayHover(day) : onDayHover(null))}
              onMouseLeave={() => onDayHover(null)}
            >
              {inBand && (
                <div
                  className={cn(
                    "absolute inset-0",
                    bandTone,
                    isStart && "rounded-l-xl",
                    isEnd && "rounded-r-xl"
                  )}
                />
              )}
              <button
                type="button"
                disabled={disabled}
                onClick={() => !disabled && onDayClick(day)}
                onFocus={() => onFocusDate(day)}
                className={cn(
                  "relative z-[2] h-8 w-8 rounded-lg text-sm font-semibold transition-colors",
                  outside ? "text-on-surface-variant/45" : "text-on-surface",
                  disabled && "opacity-30 cursor-not-allowed",
                  !disabled && "hover:bg-surface-container focus:outline-none focus:ring-1 focus:ring-primary/30 focus:ring-offset-0",
                  (isStart || isEnd) && endpointTone,
                  (isStart || isEnd) && "text-white",
                  focusedDate && isSameDay(day, focusedDate) && "ring-1 ring-primary/40"
                )}
                aria-label={day.toDateString()}
              >
                {day.getDate()}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default function DateRangePicker({
  value,
  onChange,
  minDate,
  maxDate,
  disabledDates,
  disablePastDates,
  className,
}: DateRangePickerProps) {
  const disabledSet = React.useMemo(() => buildDisabledSet(disabledDates), [disabledDates]);
  const today = React.useMemo(() => startOfDay(new Date()), []);

  const initialMonth = React.useMemo(() => {
    const seed = value.startDate ?? value.endDate ?? today;
    const clamped = clampToDay(seed, minDate, maxDate);
    return startOfMonth(clamped);
  }, [value.startDate, value.endDate, today, minDate, maxDate]);

  const [month, setMonth] = React.useState<Date>(initialMonth);
  const [hoverDate, setHoverDate] = React.useState<Date | null>(null);
  const [focusedDate, setFocusedDate] = React.useState<Date | null>(null);

  // keep month in sync when controlled value changes materially
  React.useEffect(() => {
    setMonth(initialMonth);
  }, [initialMonth.getFullYear(), initialMonth.getMonth()]); // eslint-disable-line react-hooks/exhaustive-deps

  const summary = React.useMemo(() => {
    if (value.startDate && value.endDate) return `${fmtSummary(value.startDate)} - ${fmtSummary(value.endDate)}`;
    if (value.startDate && !value.endDate) return `${fmtSummary(value.startDate)} - …`;
    return 'Select range';
  }, [value.startDate, value.endDate]);

  const weekStartsOnSunday = true;

  const canPrev = React.useMemo(() => {
    if (!minDate) return true;
    const prev = startOfMonth(addMonths(month, -1));
    return !isBeforeDay(prev, startOfMonth(startOfDay(minDate)));
  }, [month, minDate]);

  const canNext = React.useMemo(() => {
    if (!maxDate) return true;
    const next = startOfMonth(addMonths(month, 1));
    return !isAfterDay(next, startOfMonth(startOfDay(maxDate)));
  }, [month, maxDate]);

  const applyClick = React.useCallback(
    (d: Date) => {
      const day = startOfDay(d);
      // If we already have a complete range, clicking again resets selection (Syncfusion-like).
      if (value.startDate && value.endDate) {
        onChange({ startDate: day, endDate: null });
        return;
      }
      // First click sets start.
      if (!value.startDate) {
        onChange({ startDate: day, endDate: null });
        return;
      }
      // Second click sets end (auto-adjust if earlier).
      const start = startOfDay(value.startDate);
      if (isBeforeDay(day, start)) {
        onChange({ startDate: day, endDate: start });
      } else if (isSameDay(day, start)) {
        // Clicking same start toggles reset to just start.
        onChange({ startDate: day, endDate: null });
      } else {
        onChange({ startDate: start, endDate: day });
      }
    },
    [value.startDate, value.endDate, onChange]
  );

  const clear = React.useCallback(() => onChange({ startDate: null, endDate: null }), [onChange]);

  // Basic keyboard: Arrow keys move focus; Enter/Space selects.
  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const key = e.key;
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', ' '].includes(key)) return;
      if (key === 'Enter' || key === ' ') {
        if (focusedDate) applyClick(focusedDate);
        e.preventDefault();
        return;
      }
      const base = focusedDate ?? value.endDate ?? value.startDate ?? today;
      const delta =
        key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : key === 'ArrowUp' ? -7 : 7;
      const next = clampToDay(addDays(base, delta), minDate, maxDate);
      setFocusedDate(next);
      // ensure month view contains focus
      setMonth(startOfMonth(next));
      e.preventDefault();
    },
    [focusedDate, value.startDate, value.endDate, today, minDate, maxDate, applyClick]
  );

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between px-1 mb-3">
        <button
          type="button"
          disabled={!canPrev}
          onClick={() => canPrev && setMonth((m) => startOfMonth(addMonths(m, -1)))}
          className={cn(
            "w-8 h-8 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface-variant hover:text-on-surface hover:bg-surface-bright transition-colors flex items-center justify-center",
            !canPrev && "opacity-30 cursor-not-allowed"
          )}
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-xs font-extrabold text-on-surface-variant/75 uppercase tracking-widest">
          Select range
        </div>
        <button
          type="button"
          disabled={!canNext}
          onClick={() => canNext && setMonth((m) => startOfMonth(addMonths(m, 1)))}
          className={cn(
            "w-8 h-8 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface-variant hover:text-on-surface hover:bg-surface-bright transition-colors flex items-center justify-center",
            !canNext && "opacity-30 cursor-not-allowed"
          )}
          aria-label="Next month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div
        className={cn(
          'flex pb-1',
          'flex-col items-center gap-4 min-[640px]:flex-row min-[640px]:items-start min-[640px]:gap-2 min-[640px]:overflow-x-auto',
        )}
        onKeyDown={onKeyDown}
        role="application"
        aria-label="Date range picker"
      >
        <CalendarMonth
          month={month}
          weekStartsOnSunday={weekStartsOnSunday}
          value={value}
          hoverDate={hoverDate}
          disabledSet={disabledSet}
          minDate={minDate}
          maxDate={maxDate}
          disablePastDates={disablePastDates}
          onDayClick={applyClick}
          onDayHover={setHoverDate}
          focusedDate={focusedDate}
          onFocusDate={setFocusedDate}
        />
        <div className="hidden min-[640px]:block">
          <CalendarMonth
            month={startOfMonth(addMonths(month, 1))}
            weekStartsOnSunday={weekStartsOnSunday}
            value={value}
            hoverDate={hoverDate}
            disabledSet={disabledSet}
            minDate={minDate}
            maxDate={maxDate}
            disablePastDates={disablePastDates}
            onDayClick={applyClick}
            onDayHover={setHoverDate}
            focusedDate={focusedDate}
            onFocusDate={setFocusedDate}
          />
        </div>
      </div>
    </div>
  );
}

