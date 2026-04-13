import React from 'react';
import { Lock } from 'lucide-react';
import { cn } from '../lib/utils';
import type { AchievementTier, AchievementWithStatus } from '../lib/gamification';
import { Skeleton } from './ui/Skeleton';

const TIER_TONES: Record<AchievementTier, { chip: string; label: string }> = {
  bronze: {
    chip: 'bg-amber-500/10 text-amber-800 border-amber-500/25',
    label: 'Bronze',
  },
  silver: {
    chip: 'bg-slate-500/10 text-slate-700 border-slate-500/20',
    label: 'Silver',
  },
  gold: {
    chip: 'bg-yellow-500/10 text-yellow-800 border-yellow-500/25',
    label: 'Gold',
  },
  platinum: {
    chip: 'bg-purple-500/10 text-purple-800 border-purple-500/25',
    label: 'Platinum',
  },
};

export function AchievementCardSkeleton() {
  return (
    <div className="glass-panel rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-10 w-10 rounded-2xl" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-4 w-32 rounded-lg" />
        <Skeleton className="h-3 w-full rounded-lg" />
        <Skeleton className="h-3 w-2/3 rounded-lg" />
      </div>
    </div>
  );
}

export default function AchievementCard({
  achievement,
  onClick,
}: {
  achievement: AchievementWithStatus;
  onClick?: () => void;
}) {
  const unlocked = achievement.unlocked;
  const tier = TIER_TONES[achievement.tier];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'glass-panel group relative w-full rounded-2xl p-5 text-left transition-all duration-200 ease-out',
        'hover:bg-surface-container-low',
        unlocked
          ? 'shadow-[0_0_20px_rgba(14,165,233,0.10)] hover:shadow-[0_0_24px_rgba(14,165,233,0.14)]'
          : 'opacity-90',
      )}
      aria-label={`${achievement.title} achievement`}
    >
      {!unlocked && (
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-slate-950/10" />
      )}

      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border',
            unlocked ? 'border-primary/25 bg-primary/10' : 'border-outline-variant bg-surface-container-low',
          )}
        >
          {unlocked ? (
            <span
              className={cn('text-xl leading-none', !unlocked && 'grayscale')}
              aria-hidden
            >
              {achievement.icon}
            </span>
          ) : (
            <Lock className="h-5 w-5 text-on-surface-variant" />
          )}
        </div>

        <span
          className={cn(
            'inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest',
            tier.chip,
          )}
        >
          {tier.label}
        </span>
      </div>

      <div className={cn('mt-4', !unlocked && 'grayscale')}>
        <p
          className={cn(
            'font-headline text-sm font-extrabold',
            unlocked ? 'text-on-surface' : 'text-on-surface-variant',
          )}
        >
          {achievement.title}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
          {achievement.description}
        </p>
      </div>

      {!unlocked && (
        <div className="pointer-events-none absolute right-4 bottom-4 flex items-center gap-1 rounded-full border border-outline-variant bg-surface/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
          Locked
        </div>
      )}
    </button>
  );
}

