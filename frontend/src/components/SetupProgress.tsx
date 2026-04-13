import React from 'react';
import { cn } from '../lib/utils';
import { Skeleton } from './ui/Skeleton';

export function SetupProgressSkeleton() {
  return <Skeleton className="h-2 w-full rounded-full" />;
}

export default function SetupProgress({
  percent,
  className,
}: {
  percent: number;
  className?: string;
}) {
  const p = Math.max(0, Math.min(100, percent));
  if (p >= 100) return null;

  return (
    <div className={cn('w-full', className)} aria-label={`Setup ${p}% complete`}>
      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-nav-text-muted">
        <span>Setup</span>
        <span>{p}%</span>
      </div>
      <div className="mt-2 h-2 w-full rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
          style={{ width: `${p}%` }}
        />
      </div>
    </div>
  );
}

