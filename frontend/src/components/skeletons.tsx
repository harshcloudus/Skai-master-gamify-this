import React from 'react';
import { Skeleton } from './ui/Skeleton';
import { cn } from '../lib/utils';

/** Full-screen shell while auth session is resolving (matches app layout rhythm). */
export function AppLoadingSkeleton() {
  return (
    <div className="min-h-screen flex bg-surface">
      <aside
        className="hidden md:flex w-64 shrink-0 flex-col gap-3 p-4 border-r border-outline-variant bg-surface-container-low/80"
        aria-hidden
      >
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="space-y-2 pt-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-lg" />
          ))}
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 shrink-0 border-b border-outline-variant flex items-center px-6 md:px-8 gap-4 bg-surface/95 backdrop-blur-md">
          <Skeleton className="md:hidden h-9 w-9 rounded-lg shrink-0" />
          <Skeleton className="h-8 flex-1 max-w-lg rounded-lg" />
        </header>
        <div className="p-6 md:p-8 space-y-8 flex-1 max-w-[1600px] w-full mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Skeleton className="lg:col-span-2 h-[420px] rounded-2xl" />
            <Skeleton className="h-[420px] rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function TableSkeletonRows({
  columns,
  rows = 8,
  lastColumnAlignEnd,
}: {
  columns: number;
  rows?: number;
  lastColumnAlignEnd?: boolean;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <tr key={rowIdx}>
          {Array.from({ length: columns }).map((_, colIdx) => {
            const isLast = colIdx === columns - 1;
            const w =
              colIdx === 0
                ? 'w-[72%]'
                : isLast
                  ? 'w-20'
                  : 'w-[60%]';
            return (
              <td
                key={colIdx}
                className={cn(
                  'py-4 px-6 align-middle',
                  lastColumnAlignEnd && isLast && 'text-right',
                )}
              >
                <Skeleton
                  className={cn('h-4 max-w-full', w, isLast && 'ml-auto')}
                />
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

export function DashboardChartSkeleton() {
  return (
    <div className="flex-1 min-h-0 w-full flex flex-col justify-end gap-3 px-2 pb-2">
      <div className="flex items-end justify-between gap-2 h-[280px]">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-t-md min-w-[6px]"
            style={{ height: `${28 + ((i * 17) % 55)}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between gap-2 pt-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1 max-w-12 rounded" />
        ))}
      </div>
    </div>
  );
}

export function ActivityFeedSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="bg-surface-container-low rounded-xl p-3 border-l-2 border-transparent"
        >
          <div className="flex justify-between items-center gap-4">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-[55%] rounded" />
              <Skeleton className="h-3 w-[35%] rounded" />
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <Skeleton className="h-5 w-16 rounded" />
              <Skeleton className="h-3 w-12 rounded" />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

/** Mirrors Settings grid of glass cards while `/api/v1/settings` loads. */
export function SettingsPageSkeleton() {
  return (
    <>
      <div className="mb-6">
        <Skeleton className="h-8 w-44 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="min-h-[280px] rounded-xl" />
        ))}
      </div>
    </>
  );
}

export function CallDetailDrawerSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-14 w-full rounded-xl" />
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-4 w-20 rounded" />
        </div>
        <Skeleton className="h-36 w-full rounded-xl" />
      </div>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-10 rounded" />
          <Skeleton className="h-4 w-28 rounded" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-[92%] rounded" />
          <Skeleton className="h-4 w-[78%] rounded" />
        </div>
      </div>
    </div>
  );
}
