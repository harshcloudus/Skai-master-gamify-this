import React from 'react';
import { CalendarDays, Flame, Eye } from 'lucide-react';
import { cn } from '../lib/utils';
import type { RestaurantStreak, StreakType } from '../lib/gamification';

const STREAK_META: Record<
  StreakType,
  {
    label: string;
    Icon: React.ElementType;
    toneSurface: string;
    toneNav: string;
  }
> = {
  agent_active: {
    label: 'Agent active',
    Icon: Flame,
    toneSurface: 'bg-primary/10 border-primary/20 text-primary',
    toneNav: 'bg-primary/10 border-primary/20 text-primary',
  },
  daily_login: {
    label: 'Daily login',
    Icon: CalendarDays,
    toneSurface: 'bg-surface-container-low border-outline-variant text-on-surface',
    toneNav: 'bg-white/5 border-white/10 text-nav-text',
  },
  weekly_review: {
    label: 'Weekly review',
    Icon: Eye,
    toneSurface: 'bg-secondary/10 border-secondary/20 text-secondary',
    toneNav: 'bg-secondary/10 border-secondary/20 text-secondary',
  },
};

export default function StreakBadge({
  streak,
  compact = false,
  variant = 'surface',
  showLabel = false,
  annotation = 'none',
  onClick,
}: {
  streak: Pick<RestaurantStreak, 'streak_type' | 'current_count' | 'longest_count'>;
  compact?: boolean;
  variant?: 'surface' | 'nav';
  showLabel?: boolean;
  annotation?: 'none' | 'inline' | 'stacked';
  onClick?: () => void;
}) {
  const meta = STREAK_META[streak.streak_type];
  const title = `${meta.label} streak: ${streak.current_count} (longest ${streak.longest_count})`;

  if (!streak.current_count || streak.current_count <= 0) return null;
  const tone = variant === 'nav' ? meta.toneNav : meta.toneSurface;

  const Wrapper: React.ElementType = onClick ? 'button' : 'div';

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        annotation === 'stacked'
          ? 'inline-flex flex-col items-start gap-2 rounded-2xl border'
          : 'inline-flex items-center gap-1.5 rounded-full border backdrop-blur-md',
        tone,
        annotation === 'stacked'
          ? 'px-4 py-3'
          : compact
            ? 'px-2.5 py-1'
            : 'px-3 py-1.5',
        onClick &&
          'cursor-pointer transition-[transform,background-color] duration-200 ease-out hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
      )}
      title={title}
      aria-label={title}
    >
      {annotation === 'stacked' ? (
        <>
          <div className="flex items-center gap-2">
            <meta.Icon className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-widest">
              {meta.label}
            </span>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="font-headline text-2xl font-extrabold">
              {streak.current_count}
            </span>
            <span className="text-xs font-semibold text-on-surface-variant">
              Current
            </span>
          </div>
          <div className="text-xs text-on-surface-variant">
            Longest{' '}
            <span className="font-bold text-on-surface-variant">
              {streak.longest_count}
            </span>
          </div>
        </>
      ) : (
        <>
          <meta.Icon className={cn(compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
          <span
            className={cn(
              'font-bold uppercase tracking-widest',
              compact ? 'text-[10px]' : 'text-[11px]',
            )}
          >
            {streak.current_count}
          </span>
          {showLabel && !compact && annotation !== 'none' && (
            <span className="ml-1 text-[11px] font-semibold text-on-surface-variant">
              {meta.label}
              <span className="ml-1 text-[11px] font-bold text-on-surface-variant">
                ·
              </span>
              <span className="ml-1 text-[11px] font-semibold text-on-surface-variant">
                longest {streak.longest_count}
              </span>
            </span>
          )}
        </>
      )}
    </Wrapper>
  );
}

