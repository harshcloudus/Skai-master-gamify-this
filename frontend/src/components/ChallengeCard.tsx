import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';
import type { WeeklyChallenge } from '../lib/gamification';
import ProgressRing from './ProgressRing';
import { Skeleton } from './ui/Skeleton';

export function ChallengeCardSkeleton() {
  return (
    <div className="glass-panel rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4 rounded-lg" />
          <Skeleton className="h-3 w-1/2 rounded-lg" />
        </div>
        <Skeleton className="h-12 w-12 rounded-full" />
      </div>
      <div className="mt-4">
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
    </div>
  );
}

function fmt(val: number) {
  if (!Number.isFinite(val)) return '0';
  if (Math.abs(val) >= 1000) return val.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return val.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function ChallengeCard({ challenge }: { challenge: WeeklyChallenge }) {
  const max = Math.max(0, challenge.target_value);
  const value = Math.max(0, challenge.current_value);
  const pct = max > 0 ? Math.min(1, value / max) : 0;

  return (
    <div
      className={cn(
        'glass-panel rounded-2xl p-5 transition-all duration-200 ease-out hover:bg-surface-container-low',
        challenge.completed && 'ring-1 ring-inset ring-emerald-500/20',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
            Weekly challenge
          </p>
          <p className="mt-1 truncate font-headline text-sm font-extrabold text-on-surface">
            {challenge.title}
          </p>
          <p className="mt-1 text-xs text-on-surface-variant">
            {fmt(value)} / {fmt(max)}
          </p>
        </div>

        {challenge.completed ? (
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10">
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          </div>
        ) : (
          <ProgressRing value={pct * 100} max={100} size={48} strokeWidth={6} />
        )}
      </div>

      <div className="mt-4 h-2 w-full rounded-full bg-surface-container ring-1 ring-inset ring-outline-variant/60">
        <div
          className={cn(
            'h-full rounded-full bg-primary transition-[width] duration-200 ease-out',
            challenge.completed && 'bg-emerald-500',
          )}
          style={{ width: `${Math.round(pct * 100)}%` }}
        />
      </div>
    </div>
  );
}

