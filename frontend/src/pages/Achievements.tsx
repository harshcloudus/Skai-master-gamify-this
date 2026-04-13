import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { Award, Trophy } from 'lucide-react';
import type { AppLayoutOutletContext } from '../types/layout-context';
import { cn } from '../lib/utils';
import {
  useGamificationOverview,
  type AchievementCategory,
  type AchievementWithStatus,
} from '../lib/gamification';
import AchievementCard, { AchievementCardSkeleton } from '../components/AchievementCard';
import ChallengeCard, { ChallengeCardSkeleton } from '../components/ChallengeCard';
import StreakBadge from '../components/StreakBadge';
import { Skeleton } from '../components/ui/Skeleton';

type CategoryTab = 'all' | AchievementCategory;

const tabs: Array<{ id: CategoryTab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'calls', label: 'Calls' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'setup', label: 'Setup' },
  { id: 'engagement', label: 'Engagement' },
];

function levelProgress(xp: number, nextLevelXp: number) {
  const max = Math.max(1, nextLevelXp);
  const p = Math.max(0, Math.min(1, xp / max));
  return { pct: p, max };
}

function sortAchievements(list: AchievementWithStatus[]) {
  return [...list].sort((a, b) => {
    if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
}

export default function Achievements() {
  const { setHeaderTitle } = useOutletContext<AppLayoutOutletContext>();
  React.useEffect(() => {
    setHeaderTitle('Achievements');
    return () => setHeaderTitle(null);
  }, [setHeaderTitle]);

  const [tab, setTab] = React.useState<CategoryTab>('all');
  const { data: overview, isLoading, isError } = useGamificationOverview(true);

  const filtered = React.useMemo(() => {
    const list = overview?.achievements ?? [];
    const byTab =
      tab === 'all' ? list : list.filter((a) => a.category === tab);
    return sortAchievements(byTab);
  }, [overview, tab]);

  const xp = overview?.xp ?? 0;
  const level = overview?.level ?? 1;
  const next = overview?.next_level_xp ?? 100;
  const { pct } = levelProgress(xp, next);
  const xpToNext = Math.max(0, next - xp);

  return (
    <div className="min-h-0 flex-1">
      <div className="mx-auto max-w-[1600px] space-y-6 px-4 py-4 sm:space-y-8 sm:px-6 sm:py-6 lg:space-y-8 lg:p-8">
        {/* Header cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-panel rounded-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                  Level
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-[0_0_16px_rgba(14,165,233,0.12)]">
                    <Trophy className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    {isLoading ? (
                      <Skeleton className="h-6 w-28 rounded-lg" />
                    ) : (
                      <p className="truncate font-headline text-lg font-extrabold text-on-surface">
                        Level {level}
                      </p>
                    )}
                    <p className="truncate text-xs text-on-surface-variant">
                      {overview?.level_title ?? 'Newcomer'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  XP
                </p>
                {isLoading ? (
                  <Skeleton className="mt-2 h-6 w-20 rounded-lg ml-auto" />
                ) : (
                  <p className="mt-1 font-headline text-lg font-extrabold text-on-surface">
                    {xp.toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              <span>{Math.round(pct * 100)}% to next</span>
              {!isLoading && (
                <span>{xpToNext.toLocaleString()} XP remaining</span>
              )}
            </div>

            <div className="mt-2 h-2 w-full rounded-full bg-surface-container ring-1 ring-inset ring-outline-variant/60">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
                style={{ width: `${Math.round(pct * 100)}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              <span>0</span>
              <span>{next.toLocaleString()} XP</span>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-6" id="streaks">
            <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              Streaks
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {isLoading ? (
                <>
                  <Skeleton className="h-[108px] w-full rounded-2xl" />
                  <Skeleton className="h-[108px] w-full rounded-2xl" />
                  <Skeleton className="h-[108px] w-full rounded-2xl" />
                </>
              ) : (
                (overview?.streaks ?? []).map((s) => (
                  <StreakBadge key={s.id} streak={s} annotation="stacked" />
                ))
              )}
              {!isLoading && (overview?.streaks?.length ?? 0) === 0 && (
                <p className="text-sm text-on-surface-variant">
                  No streaks yet — check back after a few days of activity.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Challenges */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              <h3 className="font-headline text-sm font-extrabold uppercase tracking-widest text-on-surface">
                Weekly challenges
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {isLoading ? (
              <>
                <ChallengeCardSkeleton />
                <ChallengeCardSkeleton />
                <ChallengeCardSkeleton />
              </>
            ) : (
              (overview?.active_challenges ?? []).map((c) => (
                <ChallengeCard key={c.id} challenge={c} />
              ))
            )}
          </div>
        </section>

        {/* Achievements grid */}
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              <h3 className="font-headline text-sm font-extrabold uppercase tracking-widest text-on-surface">
                Achievements
              </h3>
            </div>

            <div className="flex flex-wrap gap-2">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors',
                    tab === t.id
                      ? 'border-primary/25 bg-primary/10 text-primary'
                      : 'border-outline-variant bg-surface/70 text-on-surface-variant hover:bg-surface-container-low',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {isError && (
            <div className="glass-panel rounded-2xl p-6">
              <p className="text-sm text-on-surface-variant">
                Gamification is not available yet for this environment.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            {isLoading ? (
              <>
                <AchievementCardSkeleton />
                <AchievementCardSkeleton />
                <AchievementCardSkeleton />
                <AchievementCardSkeleton />
              </>
            ) : (
              filtered.map((a) => <AchievementCard key={a.id} achievement={a} />)
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

