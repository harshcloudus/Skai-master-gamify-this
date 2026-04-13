import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import {
  Filter,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Mic,
  Play,
  Pause,
  Loader2,
  FileText,
  MessageSquare,
  Download,
  X,
} from 'lucide-react';
import { cn, formatLocalDate, longTextMono, longTextWrap } from '../lib/utils';
import { useLockBodyScroll } from '../lib/use-lock-body-scroll';
import { useAuth } from '../lib/auth-context';
import { motion, AnimatePresence } from 'motion/react';
import { useSearchParams } from 'react-router-dom';
import DateRangePicker, {
  type DateRangeValue,
} from '../components/DateRangePicker';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { CallListItem, CallDetail } from '../types/api';
import { Skeleton } from '../components/ui/Skeleton';
import {
  CallDetailDrawerSkeleton,
  TableSkeletonRows,
} from '../components/skeletons';

function fmtShort(d: Date) {
  return d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' });
}

function fmtShortInTimeZone(d: Date, timeZone: string) {
  try {
    return d.toLocaleDateString(undefined, {
      timeZone,
      month: 'short',
      day: '2-digit',
    });
  } catch {
    return fmtShort(d);
  }
}

function formatDateKeyInTimeZone(d: Date, timeZone: string): string {
  // YYYY-MM-DD in restaurant timezone (matches call timestamp display tz).
  try {
    const parts = new Intl.DateTimeFormat(undefined, {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d);
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;
    if (!y || !m || !day) return formatLocalDate(d);
    return `${y}-${m}-${day}`;
  } catch {
    return formatLocalDate(d);
  }
}

function fmtDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function fmtCurrency(val: number | null | undefined): string {
  if (val == null) return '—';
  return `$${val.toFixed(2)}`;
}

function fmtTime(iso: string, timeZone?: string): string {
  try {
    const d = new Date(iso);
    const tzOpts = timeZone ? { timeZone } : undefined;
    const date = d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      ...tzOpts,
    });
    const time = d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      ...tzOpts,
    });
    return `${date} \u2022 ${time}`;
  } catch {
    return iso;
  }
}

function fmtTranscriptTime(secs: number | undefined): string {
  if (secs == null) return '';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function AudioPlayer({
  callId,
  durationSeconds,
}: {
  callId: string;
  durationSeconds: number | null | undefined;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  const loadAndPlay = useCallback(async () => {
    if (blobUrl) {
      audioRef.current?.play();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const blob = await api.getBlob(`/api/v1/calls/${callId}/audio`);
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.addEventListener('loadedmetadata', () => setDuration(audio.duration));
      audio.addEventListener('timeupdate', () => setCurrentTime(audio.currentTime));
      audio.addEventListener('ended', () => setPlaying(false));
      audio.addEventListener('pause', () => setPlaying(false));
      audio.addEventListener('play', () => setPlaying(true));
      await audio.play();
    } catch {
      setError('Failed to load recording');
    } finally {
      setLoading(false);
    }
  }, [blobUrl, callId]);

  const toggle = useCallback(() => {
    if (loading) return;
    if (!audioRef.current || !blobUrl) {
      loadAndPlay();
      return;
    }
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  }, [loading, blobUrl, playing, loadAndPlay]);

  const seek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = pct * duration;
  }, [duration]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const fmtTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center space-x-2">
        <Mic className="w-5 h-5 text-primary" />
        <h4 className="font-headline font-bold text-sm text-on-surface uppercase tracking-wider">
          Recording
        </h4>
      </div>
      <div className="glass-panel p-4 rounded-xl space-y-3">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={toggle}
            disabled={loading}
            className="w-10 h-10 shrink-0 rounded-full bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : playing ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current" />
            )}
          </button>
          <div className="flex-1 min-w-0 space-y-1">
            <div
              className="h-1.5 rounded-full bg-white/10 cursor-pointer group"
              onClick={seek}
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-on-surface-variant">
              <span>{fmtTime(currentTime)}</span>
              <span>
                {duration > 0
                  ? fmtTime(duration)
                  : fmtDuration(durationSeconds)}
              </span>
            </div>
          </div>
        </div>
        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}
      </div>
    </section>
  );
}

export default function Calls() {
  const { profile } = useAuth();
  const [urlParams, setUrlParams] = useSearchParams();
  const timeZone =
    profile?.restaurant?.timezone ||
    window.localStorage.getItem('skai.timeZone') ||
    Intl.DateTimeFormat().resolvedOptions().timeZone;

  const didInitFromUrlRef = useRef(false);

  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [orderType, setOrderType] = useState<'all' | 'dine-in' | 'takeaway'>('all');
  const [orderTypeOpen, setOrderTypeOpen] = useState(false);
  const orderTypeWrapRef = useRef<HTMLDivElement | null>(null);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangeValue>({
    startDate: null,
    endDate: null,
  });
  const rangeWrapRef = useRef<HTMLDivElement | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Initialize filters from URL (so refresh preserves state).
  useEffect(() => {
    if (didInitFromUrlRef.current) return;
    const searchQ = urlParams.get('search') ?? '';
    const ot = urlParams.get('order_type') ?? 'all';
    const p = parseInt(urlParams.get('page') ?? '1', 10);
    const df = urlParams.get('date_from');
    const dt = urlParams.get('date_to');

    setSearch(searchQ);
    setOrderType(ot === 'dine-in' || ot === 'takeaway' ? ot : 'all');
    if (Number.isFinite(p) && p > 0) setPage(p);
    setDateRange({
      startDate: df ? new Date(`${df}T00:00:00`) : null,
      endDate: dt ? new Date(`${dt}T00:00:00`) : null,
    });

    didInitFromUrlRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep URL in sync with filters.
  useEffect(() => {
    if (!didInitFromUrlRef.current) return;
    const next = new URLSearchParams(urlParams);

    const trimmed = search.trim();
    if (trimmed) next.set('search', trimmed);
    else next.delete('search');

    if (orderType !== 'all') next.set('order_type', orderType);
    else next.delete('order_type');

    if (dateRange.startDate)
      next.set(
        'date_from',
        formatDateKeyInTimeZone(dateRange.startDate, timeZone),
      );
    else next.delete('date_from');

    if (dateRange.endDate)
      next.set(
        'date_to',
        formatDateKeyInTimeZone(dateRange.endDate, timeZone),
      );
    else next.delete('date_to');

    next.set('page', String(page));

    setUrlParams(next, { replace: true });
  }, [
    urlParams,
    setUrlParams,
    search,
    orderType,
    dateRange.startDate,
    dateRange.endDate,
    page,
    timeZone,
  ]);

  const orderTypeLabel = useMemo(() => {
    if (orderType === 'dine-in') return 'Dine-In';
    if (orderType === 'takeaway') return 'Takeaway';
    return 'All';
  }, [orderType]);

  const rangeLabel = useMemo(() => {
    if (!dateRange.startDate) return 'Select range';
    if (!dateRange.endDate)
      return `${fmtShortInTimeZone(dateRange.startDate, timeZone)} — …`;
    return `${fmtShortInTimeZone(dateRange.startDate, timeZone)} — ${fmtShortInTimeZone(
      dateRange.endDate,
      timeZone,
    )}`;
  }, [dateRange, timeZone]);

  useEffect(() => {
    setPage(1);
  }, [orderType, search, dateRange.startDate, dateRange.endDate]);

  useLockBodyScroll(!!selectedCallId);

  useEffect(() => {
    if (!selectedCallId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSelectedCallId(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedCallId]);

  useEffect(() => {
    if (!orderTypeOpen && !rangeOpen) return;
    function onPointerDown(e: MouseEvent | TouchEvent) {
      const t = e.target as Node;
      if (
        orderTypeOpen &&
        orderTypeWrapRef.current &&
        !orderTypeWrapRef.current.contains(t)
      ) {
        setOrderTypeOpen(false);
      }
      if (
        rangeOpen &&
        rangeWrapRef.current &&
        !rangeWrapRef.current.contains(t)
      ) {
        setRangeOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOrderTypeOpen(false);
        setRangeOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [orderTypeOpen, rangeOpen]);

  useEffect(() => {
    function calcPageSize() {
      const ROW_HEIGHT = 57;
      const CHROME_HEIGHT = 360;
      const available = window.innerHeight - CHROME_HEIGHT;
      setPageSize(Math.max(5, Math.floor(available / ROW_HEIGHT)));
    }
    calcPageSize();
    window.addEventListener('resize', calcPageSize);
    return () => window.removeEventListener('resize', calcPageSize);
  }, []);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(pageSize));
    if (search.trim()) params.set('search', search.trim());
    if (orderType !== 'all') params.set('order_type', orderType);
    if (dateRange.startDate)
      params.set('date_from', formatDateKeyInTimeZone(dateRange.startDate, timeZone));
    if (dateRange.endDate)
      params.set('date_to', formatDateKeyInTimeZone(dateRange.endDate, timeZone));
    return params.toString();
  }, [page, pageSize, search, orderType, dateRange, timeZone]);

  const { data: callsResponse, isLoading } = useQuery({
    queryKey: ['calls', queryParams],
    queryFn: () =>
      api.getPaginated<CallListItem>(`/api/v1/calls?${queryParams}`),
  });

  const calls = callsResponse?.data ?? [];
  const pagination = callsResponse?.pagination;
  const totalPages = pagination?.pages ?? 1;
  const currentPage = page;
  const showingFrom =
    calls.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const showingTo = showingFrom + calls.length - (calls.length > 0 ? 1 : 0);

  // Call detail query
  const { data: callDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['call-detail', selectedCallId],
    queryFn: () =>
      api.get<CallDetail>(`/api/v1/calls/${selectedCallId}/details`),
    select: (res) => res.data,
    enabled: !!selectedCallId,
  });

  return (
    <div className="relative min-h-0 min-w-0 w-full flex-1 overflow-x-hidden">
      <main
        className={cn(
          'mx-auto max-w-[1600px] min-w-0 flex-1 space-y-6 px-4 py-4 sm:space-y-8 sm:px-6 sm:py-6 lg:p-8',
        )}
      >
        {/* Filters */}
        <div className="relative z-[80] flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-4">
            <h3 className="font-headline text-xl font-extrabold text-on-surface sm:text-2xl">
              Recent Activity
            </h3>
            <div className="space-y-3">
              <div className="glass-panel flex w-full min-w-0 items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium text-on-surface transition-all">
                <span className="shrink-0 text-xs font-bold uppercase tracking-widest text-on-surface-variant/80">
                  Search
                </span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Phone number..."
                  className="min-w-0 flex-1 rounded-lg border border-outline-variant bg-transparent px-3 py-1.5 text-sm text-on-surface placeholder:text-on-surface-variant/85 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div
                  className={cn(
                    'glass-panel relative flex min-w-0 items-center space-x-3 rounded-lg px-4 py-2 text-sm font-medium text-on-surface transition-all',
                    orderTypeOpen
                      ? 'z-[270]'
                      : rangeOpen
                        ? 'z-[240]'
                        : 'z-[260]',
                  )}
                >
                  <Filter className="h-4 w-4 shrink-0 text-primary" />
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 text-xs font-bold uppercase tracking-widest text-on-surface-variant/80">
                      Order type
                    </span>
                    <div className="relative min-w-0" ref={orderTypeWrapRef}>
                      <button
                        type="button"
                        onClick={() => setOrderTypeOpen((v) => !v)}
                        className={cn(
                          'h-9 max-w-full pl-3 pr-2 rounded-lg border border-outline-variant bg-surface-container-low',
                          'inline-flex items-center gap-2 font-semibold text-on-surface transition-colors hover:bg-surface-bright',
                          'focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/30',
                        )}
                        aria-haspopup="listbox"
                        aria-expanded={orderTypeOpen}
                      >
                        <span
                          className={cn(
                            'min-w-20 max-w-[10rem] text-left sm:max-w-none',
                            longTextWrap,
                          )}
                        >
                          {orderTypeLabel}
                        </span>
                        <ChevronDown
                          className={cn(
                            'w-4 h-4 text-on-surface-variant/85 transition-transform',
                            orderTypeOpen && 'rotate-180',
                          )}
                        />
                      </button>

                      {orderTypeOpen && (
                        <div
                          role="listbox"
                          className="absolute left-0 z-[280] mt-2 w-44 overflow-hidden rounded-xl border border-outline-variant bg-white/98 shadow-2xl backdrop-blur-2xl"
                        >
                          {[
                            { id: 'all', label: 'All' },
                            { id: 'dine-in', label: 'Dine-In' },
                            { id: 'takeaway', label: 'Takeaway' },
                          ].map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              role="option"
                              aria-selected={orderType === opt.id}
                              onClick={() => {
                                setOrderType(
                                  opt.id as typeof orderType,
                                );
                                setOrderTypeOpen(false);
                              }}
                              className={cn(
                                'w-full text-left px-4 py-3 text-sm font-semibold transition-colors',
                                orderType === opt.id
                                  ? 'bg-primary/10 text-primary'
                                  : 'text-on-surface hover:bg-surface-container-low',
                              )}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div
                  className={cn(
                    'glass-panel relative flex items-center space-x-3 rounded-lg px-4 py-2 text-sm font-medium text-on-surface transition-all',
                    rangeOpen
                      ? 'z-[270]'
                      : orderTypeOpen
                        ? 'z-[240]'
                        : 'z-[250]',
                  )}
                >
                  <Calendar className="h-4 w-4 text-on-surface-variant" />
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant/80">
                      Date range
                    </span>
                    <div className="relative" ref={rangeWrapRef}>
                      <button
                        type="button"
                        onClick={() => setRangeOpen((v) => !v)}
                        className={cn(
                          'h-9 pl-3 pr-2 rounded-lg bg-surface-container-low border border-outline-variant',
                          'text-on-surface font-semibold transition-colors hover:bg-surface-bright',
                          'focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40',
                          'inline-flex items-center gap-2',
                        )}
                        aria-haspopup="dialog"
                        aria-expanded={rangeOpen}
                      >
                        <span className="min-w-44 text-left text-sm">
                          {rangeLabel}
                        </span>
                        <ChevronDown
                          className={cn(
                            'w-4 h-4 text-on-surface-variant/85 transition-transform',
                            rangeOpen && 'rotate-180',
                          )}
                        />
                      </button>

                      {rangeOpen && (
                        <div
                          role="dialog"
                          aria-label="Select date range"
                          className={cn(
                            'absolute z-[280] mt-2 max-h-[80vh] w-[min(100vw-2rem,500px)] overflow-auto rounded-2xl border border-outline-variant bg-white/98 p-4 shadow-2xl backdrop-blur-2xl',
                            'left-[31%] -translate-x-1/2 min-[640px]:left-0 min-[640px]:translate-x-0',
                          )}
                        >
                          <DateRangePicker
                            value={dateRange}
                            onChange={(r) => {
                              setDateRange(r);
                              if (r.startDate && r.endDate)
                                setRangeOpen(false);
                            }}
                            disablePastDates={false}
                          />
                          <div className="mt-4 flex items-center justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                setDateRange({
                                  startDate: null,
                                  endDate: null,
                                });
                                setRangeOpen(false);
                              }}
                              className="text-xs font-bold uppercase tracking-widest text-on-surface-variant/80 hover:text-on-surface transition-colors"
                            >
                              Clear
                            </button>
                            <button
                              type="button"
                              onClick={() => setRangeOpen(false)}
                              className="px-4 py-2 rounded-lg bg-surface-container-low hover:bg-surface-bright border border-outline-variant text-xs font-bold uppercase tracking-widest text-on-surface transition-colors"
                            >
                              Close
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Calls list: stacked cards on narrow screens (all columns visible); table from sm */}
        <div className="relative z-0 w-full min-w-0">
          <div className="glass-panel relative overflow-hidden rounded-xl shadow-2xl">
            <div className="space-y-3 p-4 sm:hidden">
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-outline-variant bg-surface-container-low/80 p-4"
                    >
                      <Skeleton className="mb-3 h-5 w-40 rounded-md" />
                      <div className="grid grid-cols-2 gap-2">
                        <Skeleton className="h-3 w-full rounded" />
                        <Skeleton className="h-3 w-full rounded" />
                        <Skeleton className="h-3 w-full rounded" />
                        <Skeleton className="h-3 w-full rounded" />
                      </div>
                      <Skeleton className="mt-3 h-9 w-full rounded-lg" />
                    </div>
                  ))}
                </div>
              ) : calls.length === 0 ? (
                <p className="py-8 text-center text-sm text-on-surface-variant">
                  No calls found
                </p>
              ) : (
                calls.map((call) => (
                  <div
                    key={call.id}
                    className="w-full min-w-0 overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low/80 p-4"
                  >
                    <div className="mb-3 flex min-w-0 justify-between gap-3">
                      <div className="min-w-0 pr-1">
                        <p
                          className={cn(
                            'font-headline text-sm font-bold text-on-surface',
                            longTextMono,
                          )}
                        >
                          {call.phone_number || 'Unknown'}
                        </p>
                        <p
                          className={cn(
                            'text-xs text-on-surface-variant',
                            longTextWrap,
                          )}
                        >
                          {fmtTime(call.created_at, timeZone)}
                        </p>
                      </div>
                      <div className="min-w-0 max-w-[45%] shrink-0 text-right">
                        <p className="font-headline text-sm font-bold text-on-surface">
                          {fmtCurrency(call.order_value)}
                        </p>
                        <p
                          className={cn(
                            'text-xs font-bold capitalize text-on-surface-variant',
                            longTextWrap,
                          )}
                        >
                          {call.order_type || '—'}
                        </p>
                      </div>
                    </div>
                    <dl className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 border-t border-outline-variant/60 pt-3 text-xs">
                      <dt className="shrink-0 font-bold uppercase tracking-wider text-on-surface-variant/80">
                        Name
                      </dt>
                      <dd
                        className={cn(
                          'text-right font-semibold text-on-surface',
                          longTextWrap,
                        )}
                      >
                        {call.customer_name || '—'}
                      </dd>
                      <dt className="shrink-0 font-bold uppercase tracking-wider text-on-surface-variant/80">
                        Status
                      </dt>
                      <dd
                        className={cn(
                          'text-right font-semibold capitalize text-on-surface',
                          longTextWrap,
                        )}
                      >
                        {call.call_status}
                      </dd>
                      <dt className="shrink-0 font-bold uppercase tracking-wider text-on-surface-variant/80">
                        Items
                      </dt>
                      <dd
                        className={cn(
                          'text-right text-on-surface',
                          longTextWrap,
                        )}
                      >
                        {call.items_count != null
                          ? `${call.items_count} ${call.items_count === 1 ? 'item' : 'items'}`
                          : '—'}
                      </dd>
                      <dt className="shrink-0 font-bold uppercase tracking-wider text-on-surface-variant/80">
                        Duration
                      </dt>
                      <dd
                        className={cn(
                          'text-right font-mono text-on-surface',
                          longTextWrap,
                        )}
                      >
                        {fmtDuration(call.call_duration_seconds)}
                      </dd>
                    </dl>
                    <button
                      type="button"
                      onClick={() => setSelectedCallId(call.id)}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2.5 text-xs font-bold uppercase tracking-widest text-on-surface transition-colors hover:bg-surface-bright"
                    >
                      Details
                      <ChevronRight className="h-4 w-4 text-on-surface-variant/85" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="hidden w-full min-w-0 overflow-x-auto sm:block">
              <div className="min-w-[720px] sm:min-w-0">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-surface-container-low">
                <th className="py-4 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-widest">
                  Phone Number
                </th>
                <th className="py-4 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-widest">
                  Name
                </th>
                <th className="py-4 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-widest">
                  Time
                </th>
                <th className="py-4 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-widest">
                  Status
                </th>
                <th className="py-4 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-widest">
                  Items
                </th>
                <th className="py-4 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-widest">
                  Total
                </th>
                <th className="py-4 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-widest">
                  Order Type
                </th>
                <th className="py-4 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-widest">
                  Duration
                </th>
                <th className="py-4 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-widest">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {isLoading ? (
                <TableSkeletonRows columns={9} rows={10} />
              ) : calls.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="py-12 text-center text-on-surface-variant text-sm"
                  >
                    No calls found
                  </td>
                </tr>
              ) : (
                calls.map((call) => (
                  <tr
                    key={call.id}
                    className={cn(
                      'transition-colors group',
                      'hover:bg-surface-container-low',
                    )}
                  >
                    <td className="max-w-[10rem] py-4 px-6 text-sm font-medium text-on-surface lg:max-w-none">
                      <span className={longTextMono}>
                        {call.phone_number || 'Unknown'}
                      </span>
                    </td>
                    <td
                      className={cn(
                        'max-w-[12rem] py-4 px-6 text-sm font-semibold text-on-surface',
                        longTextWrap,
                      )}
                    >
                      {call.customer_name || '—'}
                    </td>
                    <td
                      className={cn(
                        'py-4 px-6 text-sm text-on-surface-variant',
                        longTextWrap,
                      )}
                    >
                      {fmtTime(call.created_at, timeZone)}
                    </td>
                    <td
                      className={cn(
                        'py-4 px-6 text-sm capitalize text-on-surface-variant',
                        longTextWrap,
                      )}
                    >
                      {call.call_status}
                    </td>
                    <td
                      className={cn(
                        'py-4 px-6 text-sm text-on-surface-variant',
                        longTextWrap,
                      )}
                    >
                      {call.items_count != null
                        ? `${call.items_count} ${call.items_count === 1 ? 'item' : 'items'}`
                        : '—'}
                    </td>
                    <td className="py-4 px-6 text-sm font-bold text-on-surface">
                      {fmtCurrency(call.order_value)}
                    </td>
                    <td className="min-w-0 py-4 px-6">
                      <span
                        className={cn(
                          'text-xs font-bold capitalize text-on-surface-variant',
                          longTextWrap,
                        )}
                      >
                        {call.order_type || '—'}
                      </span>
                    </td>
                    <td
                      className={cn(
                        'py-4 px-6 font-mono text-sm text-on-surface-variant',
                        longTextWrap,
                      )}
                    >
                      {fmtDuration(call.call_duration_seconds)}
                    </td>
                    <td className="py-4 px-6">
                      <button
                        type="button"
                        onClick={() => setSelectedCallId(call.id)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-bright border border-outline-variant text-xs font-bold uppercase tracking-widest text-on-surface transition-colors"
                      >
                        View
                        <ChevronRight className="w-4 h-4 text-on-surface-variant/85" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
              </div>
            </div>

            <div className="flex flex-col items-center gap-3 border-t border-outline-variant bg-surface-container-low px-4 py-4 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left sm:px-8">
            <p className="text-xs text-on-surface-variant">
              Showing{' '}
              <span className="text-on-surface font-bold">
                {showingFrom} - {showingTo}
              </span>{' '}
              of{' '}
              <span className="text-on-surface font-bold">
                {pagination?.total ?? 0}
              </span>{' '}
              entries
            </p>
            <div className="flex items-center space-x-2">
              <button
                className="w-8 h-8 rounded bg-surface-container-low flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors border border-outline-variant disabled:opacity-30 disabled:hover:text-on-surface-variant"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-on-surface-variant">
                Page{' '}
                <span className="text-on-surface">{currentPage}</span> /{' '}
                {totalPages}
              </span>
              <button
                className="w-8 h-8 rounded bg-surface-container-low flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors border border-outline-variant disabled:opacity-30 disabled:hover:text-on-surface-variant"
                onClick={() =>
                  setPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage >= totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          </div>
        </div>
      </main>

      {/* Details Drawer */}
      <AnimatePresence>
        {selectedCallId && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-240 bg-slate-900/40 backdrop-blur-[2px]"
              onClick={() => setSelectedCallId(null)}
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{
                type: 'spring',
                damping: 25,
                stiffness: 200,
              }}
              className="fixed top-0 right-0 h-full w-full sm:w-[70vw] lg:w-[50vw] max-w-[760px] z-250 bg-surface-container-low/90 backdrop-blur-3xl border-l border-outline-variant flex flex-col shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-outline-variant flex justify-between items-center bg-surface-container">
                <div className="flex flex-col">
                  <h3 className="font-headline font-bold text-lg text-on-surface">
                    Call Details
                  </h3>
                  <span className="text-xs font-bold text-on-surface-variant/72 uppercase tracking-widest block min-h-[1rem]">
                    {detailLoading ? (
                      <Skeleton className="h-3 w-36 rounded mt-1" />
                    ) : (
                      (callDetail?.phone_number || 'Unknown number')
                    )}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedCallId(null)}
                  className="text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {detailLoading ? (
                  <CallDetailDrawerSkeleton />
                ) : callDetail ? (
                  <>
                    {/* Audio */}
                    <AudioPlayer
                      callId={selectedCallId!}
                      durationSeconds={callDetail.call_duration_seconds}
                    />

                    {/* Order Summary */}
                    {callDetail.order && (
                      <section className="space-y-4">
                        <div className="flex items-center space-x-2">
                          <FileText className="w-5 h-5 text-primary" />
                          <h4 className="font-headline font-bold text-sm text-on-surface uppercase tracking-wider">
                            Order
                          </h4>
                        </div>
                        <div className="glass-panel p-5 rounded-xl space-y-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-on-surface-variant">
                              Type
                            </span>
                            <span className="text-on-surface font-semibold capitalize">
                              {callDetail.order.order_type}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-on-surface-variant">
                              Total
                            </span>
                            <span className="text-on-surface font-bold">
                              {fmtCurrency(
                                callDetail.order.total_amount,
                              )}
                            </span>
                          </div>
                          {callDetail.order.items.length > 0 && (
                            <div className="pt-2 border-t border-outline-variant space-y-2">
                              {callDetail.order.items.map(
                                (item) => (
                                  <div
                                    key={item.id}
                                    className="flex justify-between text-sm"
                                  >
                                    <span className="text-on-surface-variant">
                                      {item.quantity}x{' '}
                                      {item.item_name}
                                      {item.modifiers.length > 0 && (
                                        <span className="text-on-surface-variant/72 ml-1">
                                          (
                                          {item.modifiers.join(
                                            ', ',
                                          )}
                                          )
                                        </span>
                                      )}
                                    </span>
                                    <span className="text-on-surface font-medium">
                                      {fmtCurrency(item.subtotal)}
                                    </span>
                                  </div>
                                ),
                              )}
                            </div>
                          )}
                        </div>
                      </section>
                    )}

                    {/* Summary */}
                    {callDetail.summary && (
                      <section className="space-y-4">
                        <div className="flex items-center space-x-2">
                          <FileText className="w-5 h-5 text-primary" />
                          <h4 className="font-headline font-bold text-sm text-on-surface uppercase tracking-wider">
                            Summary
                          </h4>
                        </div>
                        <div className="glass-panel p-5 rounded-xl border-l-2 border-primary/50 bg-surface-container-low">
                          <p className="text-sm text-on-surface-variant leading-relaxed">
                            {callDetail.summary}
                          </p>
                        </div>
                      </section>
                    )}

                    {/* Transcript */}
                    {callDetail.transcript &&
                      Array.isArray(callDetail.transcript) &&
                      callDetail.transcript.length > 0 && (
                        <section className="space-y-4 pb-10">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <MessageSquare className="w-5 h-5 text-primary" />
                              <h4 className="font-headline font-bold text-sm text-on-surface uppercase tracking-wider">
                                Transcript
                              </h4>
                            </div>
                          </div>
                          <div className="space-y-6">
                            {callDetail.transcript
                              .filter((entry) => entry.message?.trim())
                              .map((entry, i) => {
                                const isAgent =
                                  entry.role === 'agent' ||
                                  entry.role === 'assistant';
                                return (
                                  <div
                                    key={i}
                                    className="space-y-2"
                                  >
                                    <div className="flex items-center space-x-2">
                                      <span
                                        className={cn(
                                          'w-1.5 h-1.5 rounded-full',
                                          isAgent
                                            ? 'bg-primary'
                                            : 'bg-secondary',
                                        )}
                                      />
                                      <span
                                        className={cn(
                                          'text-xs font-bold uppercase tracking-widest',
                                          isAgent
                                            ? 'text-primary'
                                            : 'text-secondary',
                                        )}
                                      >
                                        {isAgent
                                          ? 'Skai AI'
                                          : 'Customer'}
                                      </span>
                                      <span className="text-xs text-on-surface-variant/68 ml-auto">
                                        {fmtTranscriptTime(
                                          entry.time_in_call_secs,
                                        )}
                                      </span>
                                    </div>
                                    <div
                                      className={cn(
                                        'rounded-2xl rounded-tl-none p-3 text-sm text-on-surface leading-snug',
                                        isAgent
                                          ? 'bg-surface-container-low border border-outline-variant'
                                          : 'bg-secondary/10 border border-secondary/10',
                                      )}
                                    >
                                      {entry.message}
                                    </div>
                                  </div>
                                );
                              },
                            )}
                          </div>
                        </section>
                      )}
                  </>
                ) : (
                  <p className="text-sm text-on-surface-variant">
                    Call not found
                  </p>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
