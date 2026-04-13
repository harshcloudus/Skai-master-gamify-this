import React from 'react';
import {
  TrendingUp,
  FileText,
  Clock,
  ChevronRight,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { cn, longTextMono, longTextWrap } from '../lib/utils';
import { useAuth } from '../lib/auth-context';
import type { DashboardOverview } from '../types/api';
import type { AppLayoutOutletContext } from '../types/layout-context';
import { Skeleton } from '../components/ui/Skeleton';
import { useGamificationOverview } from '../lib/gamification';
import ChallengeCard, { ChallengeCardSkeleton } from '../components/ChallengeCard';
import {
  ActivityFeedSkeleton,
  DashboardChartSkeleton,
} from '../components/skeletons';

/** Two-line tick (day + dd-mm-yyyy) for wide charts */
function XTickTwoLine(props: any) {
  const { x, y, payload } = props;
  const [day, date] = String(payload?.value ?? '').split(' ');
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={2}
        textAnchor="middle"
        fill="var(--color-chart-tick)"
        style={{ fontSize: 12, fontWeight: 800 }}
      >
        <tspan x="0" dy="0">
          {day ?? ''}
        </tspan>
        <tspan x="0" dy="14">
          {date ?? ''}
        </tspan>
      </text>
    </g>
  );
}

/** Narrow screens: day + date, rotated (~45°) so labels don’t overlap */
function XTickAngled(props: any) {
  const { x, y, payload } = props;
  const [day, date] = String(payload?.value ?? '').split(' ');
  const dateShort = date ? formatDDMMYYFromTick(date) : '';
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        transform="rotate(-45)"
        textAnchor="end"
        fill="var(--color-chart-tick)"
        style={{ fontSize: 9, fontWeight: 800 }}
        dy={4}
        dx={0}
      >
        <tspan x={0} dy={0}>
          {day ?? ''}
        </tspan>
        <tspan x={0} dy={9}>
          {dateShort}
        </tspan>
      </text>
    </g>
  );
}

function formatCurrency(val: number | null | undefined): string {
  if (val == null) return '—';
  return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDDMMYYYY(value: string): string {
  // Supports "YYYY-MM-DD" (from API) and falls back to original string.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return value;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Chart X tick on narrow screens: same as formatDDMMYYYY but 2-digit year (e.g. 01-02-26). */
function formatDDMMYYFromTick(datePart: string): string {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(datePart.trim());
  if (!m) return datePart;
  return `${m[1]}-${m[2]}-${m[3].slice(-2)}`;
}

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function Dashboard() {
  const { setHeaderTitle } = useOutletContext<AppLayoutOutletContext>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: gamification, isLoading: gamificationLoading } =
    useGamificationOverview(true);
  const [now, setNow] = React.useState(() => new Date());

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const greeting = React.useMemo(() => {
    let h = now.getHours();
    try {
      const timeZone =
        profile?.restaurant?.timezone ||
        window.localStorage.getItem('skai.timeZone') ||
        Intl.DateTimeFormat().resolvedOptions().timeZone;
      const parts = new Intl.DateTimeFormat(undefined, {
        timeZone,
        hour: '2-digit',
        hour12: false,
      }).formatToParts(now);
      const hourStr = parts.find((p) => p.type === 'hour')?.value;
      const parsed = hourStr ? Number(hourStr) : NaN;
      if (Number.isFinite(parsed)) h = parsed;
    } catch {
      // ignore
    }
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }, [now, profile]);

  const firstName = profile?.full_name?.split(' ')[0] || 'there';

  React.useEffect(() => {
    const title = `${greeting}, ${firstName}`;
    setHeaderTitle(title);
    return () => setHeaderTitle(null);
  }, [greeting, firstName, setHeaderTitle]);

  const { data: overview, isLoading } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: () => api.get<DashboardOverview>('/api/v1/dashboard/overview'),
    select: (res) => res.data,
  });

  const [isLgUp, setIsLgUp] = React.useState(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia('(min-width: 1024px)').matches;
  });
  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => setIsLgUp(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  /** Call volume chart: tighter axis & single-line X ticks below sm */
  const [chartCompact, setChartCompact] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 639px)').matches;
  });
  React.useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const sync = () => setChartCompact(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const recentActivityLimit = isLgUp ? 5 : 4;

  const chartData = React.useMemo(() => {
    if (!overview?.calls_graph) return [];
    return overview.calls_graph.map((pt) => ({
      name: `${pt.day} ${formatDDMMYYYY(pt.date)}`,
      value: pt.call_count,
    }));
  }, [overview]);

  return (
    <div className="min-h-0 flex-1">
      <div className="mx-auto max-w-[1600px] space-y-6 px-4 py-4 sm:space-y-8 sm:px-6 sm:py-6 lg:space-y-8 lg:p-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-panel rounded-xl p-6 transition-all hover:bg-surface-container-low group">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-[0_0_15px_rgba(14,165,233,0.12)]">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>
            <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest mb-2">
              Total Revenue
            </p>
            <div className="min-h-[2.25rem] flex items-center">
              {isLoading ? (
                <Skeleton className="h-9 w-36 rounded-lg" />
              ) : (
                <h3 className="text-3xl font-headline font-extrabold text-on-surface">
                  {formatCurrency(overview?.kpis?.revenue?.value)}
                </h3>
              )}
            </div>
          </div>

          <div className="glass-panel rounded-xl p-6 transition-all hover:bg-surface-container-low group">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-[0_0_15px_rgba(14,165,233,0.12)]">
                <FileText className="w-6 h-6" />
              </div>
            </div>
            <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest mb-2">
              Orders Processed
            </p>
            <div className="min-h-[2.25rem] flex items-center">
              {isLoading ? (
                <Skeleton className="h-9 w-16 rounded-lg" />
              ) : (
                <h3 className="text-3xl font-headline font-extrabold text-on-surface">
                  {overview?.kpis?.total_orders?.value ?? '—'}
                </h3>
              )}
            </div>
          </div>

          <div className="glass-panel rounded-xl p-6 transition-all hover:bg-surface-container-low group">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-[0_0_15px_rgba(14,165,233,0.12)]">
                <Clock className="w-6 h-6" />
              </div>
            </div>
            <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest mb-2">
              Labor Hours Saved
            </p>
            <div className="min-h-[2.25rem] flex items-center">
              {isLoading ? (
                <Skeleton className="h-9 w-24 rounded-lg" />
              ) : (
                <h3 className="text-3xl font-headline font-extrabold text-on-surface">
                  {overview?.kpis?.labor_hours_saved?.value ?? '\u00A0'}
                </h3>
              )}
            </div>
          </div>
        </div>

        {/* Gamification strip (always visible via skeletons/fallback) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
          <div className="glass-panel rounded-2xl p-6 lg:col-span-2">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                  Active challenges
                </p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Your goals for the week
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/app/achievements')}
                className="text-xs font-bold uppercase tracking-widest text-primary hover:opacity-80"
              >
                View all
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
              {gamificationLoading ? (
                <>
                  <ChallengeCardSkeleton />
                  <ChallengeCardSkeleton />
                  <ChallengeCardSkeleton />
                </>
              ) : (
                (gamification?.active_challenges ?? []).slice(0, 3).map((c) => (
                  <ChallengeCard key={c.id} challenge={c} />
                ))
              )}
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                  Latest unlocks
                </p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Recent achievements
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/app/achievements')}
                className="text-xs font-bold uppercase tracking-widest text-primary hover:opacity-80"
              >
                Achievements
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {gamificationLoading ? (
                <>
                  <Skeleton className="h-10 w-20 rounded-2xl" />
                  <Skeleton className="h-10 w-20 rounded-2xl" />
                  <Skeleton className="h-10 w-20 rounded-2xl" />
                </>
              ) : (
                (gamification?.achievements ?? [])
                  .filter((a) => a.unlocked)
                  .sort((a, b) => {
                    const at = a.unlocked_at ? new Date(a.unlocked_at).getTime() : 0;
                    const bt = b.unlocked_at ? new Date(b.unlocked_at).getTime() : 0;
                    return bt - at;
                  })
                  .slice(0, 3)
                  .map((a) => (
                    <div
                      key={a.id}
                      className="inline-flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-2 shadow-[0_0_14px_rgba(14,165,233,0.10)]"
                      title={a.title}
                    >
                      <span className="text-lg leading-none">{a.icon}</span>
                      <span className="text-xs font-bold uppercase tracking-widest text-primary">
                        {a.title}
                      </span>
                    </div>
                  ))
              )}

              {!gamificationLoading &&
                (gamification?.achievements ?? []).filter((a) => a.unlocked)
                  .length === 0 && (
                  <div className="rounded-xl border border-outline-variant bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
                    No achievements yet — your first unlock will show up here.
                  </div>
                )}
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
          {/* Calls Chart */}
          <div className="relative flex h-[360px] flex-col overflow-hidden rounded-2xl glass-panel p-4 sm:p-6 lg:col-span-2 lg:h-[500px] lg:p-8">
            <div className="mb-4 flex shrink-0 items-center justify-between sm:mb-10">
              <div>
                <h3 className="text-xl font-headline font-bold text-on-surface">
                  Call Volume
                </h3>
                <p className="text-on-surface-variant text-sm mt-1">
                  Real-time digital concierge activity
                </p>
              </div>
            </div>

            <div className="flex-1 min-h-0 w-full">
              {isLoading ? (
                <DashboardChartSkeleton />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData}
                    margin={
                      chartCompact
                        ? { top: 6, right: 6, left: 20, bottom: 22 }
                        : { top: 6, right: 18, left: 12, bottom: 6 }
                    }
                  >
                    <defs>
                      <linearGradient
                        id="colorValue"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="var(--color-primary)"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="var(--color-primary)"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="var(--color-chart-grid)"
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      width={34}
                      allowDecimals={false}
                      tick={{
                        fill: 'var(--color-chart-tick)',
                        fontSize: chartCompact ? 10 : 12,
                        fontWeight: 800,
                      }}
                      label={{
                        value: 'Calls',
                        angle: -90,
                        position: 'insideLeft',
                        offset: chartCompact ? 8 : 6,
                        style: {
                          fill: 'var(--color-chart-tick)',
                          fontSize: chartCompact ? 10 : 12,
                          fontWeight: 900,
                        },
                      }}
                      domain={[0, 'dataMax']}
                    />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      minTickGap={chartCompact ? 0 : 0}
                      padding={
                        chartCompact
                          ? { left: 8, right: 8 }
                          : { left: 12, right: 10 }
                      }
                      height={chartCompact ? 48 : 64}
                      tickMargin={chartCompact ? 4 : 14}
                      tick={
                        chartCompact ? (
                          <XTickAngled />
                        ) : (
                          <XTickTwoLine />
                        )
                      }
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--color-surface)',
                        border: '1px solid var(--color-outline-variant)',
                        borderRadius: '8px',
                      }}
                      itemStyle={{ color: 'var(--color-primary)' }}
                      formatter={(val: any) => [val, 'Calls']}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="var(--color-primary)"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorValue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="flex h-auto flex-col rounded-2xl glass-panel p-4 sm:p-6">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-headline font-bold text-on-surface">
                Recent Activity
              </h3>
              <button
                type="button"
                className="text-xs font-bold uppercase tracking-widest text-primary hover:opacity-80"
                onClick={() => navigate('/app/calls')}
              >
                View All
              </button>
            </div>
            <div className="space-y-3 overflow-visible">
              {isLoading ? (
                <ActivityFeedSkeleton rows={recentActivityLimit} />
              ) : overview?.recent_activity?.length === 0 ? (
                <p className="text-sm text-on-surface-variant">
                  No recent activity
                </p>
              ) : (
                overview?.recent_activity
                  ?.slice(0, recentActivityLimit)
                  .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate('/app/calls')}
                    className={cn(
                      'group w-full rounded-xl border border-outline-variant/60 bg-surface-container-low p-3 text-left',
                      'transition-[background-color,border-color,transform,box-shadow] duration-200 ease-out',
                      'hover:border-outline-variant hover:bg-surface-container hover:shadow-lg hover:shadow-black/5',
                      'active:scale-[0.99]',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                    )}
                  >
                    <div className="flex min-w-0 items-center justify-between gap-4">
                      <div className="min-w-0 pr-1">
                        <p
                          className={cn(
                            'line-clamp-2 text-sm font-headline font-bold tracking-tight text-on-surface',
                            longTextMono,
                          )}
                        >
                          {item.phone_number || 'Unknown'}
                        </p>
                        <p
                          className={cn(
                            'line-clamp-2 text-xs text-on-surface-variant',
                            longTextWrap,
                          )}
                        >
                          {item.call_status}
                        </p>
                      </div>
                      <div className="flex min-w-0 shrink-0 flex-col items-end">
                        <span className="text-lg font-headline font-bold text-on-surface">
                          {item.order_value != null
                            ? formatCurrency(item.order_value)
                            : '—'}
                        </span>
                        <span className="text-xs text-on-surface-variant/75 font-semibold">
                          {timeAgo(item.time)}
                        </span>
                      </div>
                    </div>
                  </button>
                  ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
