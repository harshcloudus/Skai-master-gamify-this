import React from 'react';
import { Menu, Phone } from 'lucide-react';
import { cn } from '../lib/utils';
import { useGamificationOverview, type RestaurantStreak } from '../lib/gamification';
import StreakBadge from './StreakBadge';
import { Skeleton } from './ui/Skeleton';
import { useNavigate } from 'react-router-dom';

interface TopBarProps {
  title: string;
  sidebarCollapsed?: boolean;
  onOpenMobileMenu?: () => void;
}

function getSelectedTimeZone() {
  try {
    const tz = window.localStorage.getItem('skai.timeZone');
    return tz || Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
}

function formatTopBarDate(d: Date, timeZone: string) {
  const weekday = new Intl.DateTimeFormat(undefined, { timeZone, weekday: 'long' }).format(d);
  const month = new Intl.DateTimeFormat(undefined, { timeZone, month: 'short' }).format(d);
  const day = new Intl.DateTimeFormat(undefined, { timeZone, day: '2-digit' }).format(d);

  const parts = new Intl.DateTimeFormat(undefined, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(d);
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
  const suffix =
    parts.find((p) => p.type === 'dayPeriod')?.value ??
    (Number(hour) >= 12 ? 'PM' : 'AM');
  return `${weekday}, ${month} ${day} • ${hour}:${minute} ${suffix}`;
}

export default function TopBar({
  title,
  sidebarCollapsed = false,
  onOpenMobileMenu,
}: TopBarProps) {
  const navigate = useNavigate();
  const [now, setNow] = React.useState(() => new Date());
  const [timeZone, setTimeZone] = React.useState(() => getSelectedTimeZone());
  const { data: overview, isLoading } = useGamificationOverview(true);

  const streaksByType = React.useMemo(() => {
    const list = overview?.streaks ?? [];
    const by = new Map<string, RestaurantStreak>();
    list.forEach((s) => by.set(s.streak_type, s));
    return {
      agent_active: by.get('agent_active') ?? {
        id: 'missing-agent',
        streak_type: 'agent_active',
        current_count: 0,
        longest_count: 0,
        last_activity_date: '',
        updated_at: '',
      },
      daily_login: by.get('daily_login') ?? {
        id: 'missing-login',
        streak_type: 'daily_login',
        current_count: 0,
        longest_count: 0,
        last_activity_date: '',
        updated_at: '',
      },
      weekly_review: by.get('weekly_review') ?? {
        id: 'missing-review',
        streak_type: 'weekly_review',
        current_count: 0,
        longest_count: 0,
        last_activity_date: '',
        updated_at: '',
      },
    };
  }, [overview]);

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(id);
  }, []);

  React.useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'skai.timeZone') setTimeZone(getSelectedTimeZone());
    };
    window.addEventListener('storage', onStorage);
    const id = window.setInterval(() => setTimeZone(getSelectedTimeZone()), 2_000);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.clearInterval(id);
    };
  }, []);

  const goToAchievements = React.useCallback(() => {
    navigate('/app/achievements');
  }, [navigate]);

  return (
    <header
      className={cn(
        'fixed top-0 z-[200] flex h-16 items-center justify-between border-b border-nav-border bg-nav-bg/95 px-4 backdrop-blur-3xl sm:px-8',
        'left-0 w-full',
        sidebarCollapsed
          ? 'md:left-[5.5rem] md:w-[calc(100%-5.5rem)]'
          : 'md:left-64 md:w-[calc(100%-16rem)]',
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-8">
        {onOpenMobileMenu && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="inline-flex shrink-0 rounded-lg p-2 text-nav-text hover:bg-white/10 md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-nav-text text-base font-headline font-bold sm:text-lg">
            {title}
          </h2>
          {/* Desktop date */}
          <p className="hidden truncate text-xs text-nav-text-muted font-normal sm:block">
            {formatTopBarDate(now, timeZone)}
          </p>

          {/* Mobile: date + streaks on same row (keeps header height stable) */}
          <div className="mt-1 flex min-w-0 items-center justify-between gap-2 text-xs font-normal text-nav-text-muted sm:hidden">
            <span className="min-w-0 truncate">
              {formatTopBarDate(now, timeZone)}
            </span>
            <div className="flex shrink-0 items-center gap-1">
              {isLoading ? (
                <>
                  <Skeleton className="h-7 w-12 rounded-full bg-white/10" />
                  <Skeleton className="h-7 w-12 rounded-full bg-white/10" />
                  <Skeleton className="h-7 w-12 rounded-full bg-white/10" />
                </>
              ) : (
                <>
                  {streaksByType.agent_active.current_count > 0 && (
                    <StreakBadge
                      streak={streaksByType.agent_active}
                      compact
                      variant="nav"
                      onClick={goToAchievements}
                    />
                  )}
                  {streaksByType.daily_login.current_count > 0 && (
                    <StreakBadge
                      streak={streaksByType.daily_login}
                      compact
                      variant="nav"
                      onClick={goToAchievements}
                    />
                  )}
                  {streaksByType.weekly_review.current_count > 0 && (
                    <StreakBadge
                      streak={streaksByType.weekly_review}
                      compact
                      variant="nav"
                      onClick={goToAchievements}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-6">
        <div className="hidden sm:flex items-center gap-2">
          {isLoading ? (
            <>
              <Skeleton className="h-8 w-16 rounded-full bg-white/10" />
              <Skeleton className="h-8 w-16 rounded-full bg-white/10" />
              <Skeleton className="h-8 w-16 rounded-full bg-white/10" />
            </>
          ) : (
            <>
              {/* Render only streaks with count > 0, but keep a subtle placeholder if none */}
              {streaksByType.agent_active.current_count > 0 && (
                <StreakBadge
                  streak={streaksByType.agent_active}
                  compact
                  variant="nav"
                  onClick={goToAchievements}
                />
              )}
              {streaksByType.daily_login.current_count > 0 && (
                <StreakBadge
                  streak={streaksByType.daily_login}
                  compact
                  variant="nav"
                  onClick={goToAchievements}
                />
              )}
              {streaksByType.weekly_review.current_count > 0 && (
                <StreakBadge
                  streak={streaksByType.weekly_review}
                  compact
                  variant="nav"
                  onClick={goToAchievements}
                />
              )}
              {streaksByType.agent_active.current_count <= 0 &&
                streaksByType.daily_login.current_count <= 0 &&
                streaksByType.weekly_review.current_count <= 0 && (
                  <div
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-nav-text-muted"
                    title="No streaks yet"
                  >
                    Streaks: 0
                  </div>
                )}
            </>
          )}
        </div>
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-md">
          <Phone className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-bold text-primary uppercase tracking-widest whitespace-nowrap">
            42
          </span>
        </div>
      </div>
    </header>
  );
}
