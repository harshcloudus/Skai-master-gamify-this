import React from 'react';
import { Lock, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';
import type { AchievementWithStatus } from '../lib/gamification';

function ConfettiBurst({ active }: { active: boolean }) {
  const pieces = React.useMemo(() => {
    const colors = [
      'bg-primary',
      'bg-secondary',
      'bg-white',
      'bg-primary/60',
      'bg-secondary/60',
    ] as const;
    return Array.from({ length: 18 }).map((_, i) => {
      const angle = (i / 18) * Math.PI * 2;
      const dx = Math.cos(angle) * (40 + (i % 3) * 18);
      const dy = Math.sin(angle) * (40 + ((i + 1) % 3) * 18);
      const rot = Math.round((i * 37) % 360);
      const delay = (i % 6) * 12;
      return { key: i, dx, dy, rot, delay, color: colors[i % colors.length] };
    });
  }, []);

  if (!active) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible">
      {pieces.map((p) => (
        <span
          key={p.key}
          className={cn(
            'absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-sm opacity-0',
            p.color,
            'animate-[confettiPop_1.1s_ease-out_forwards]',
          )}
          style={
            {
              transform: `translate(-50%, -50%) translate(${p.dx}px, ${p.dy}px) rotate(${p.rot}deg)`,
              animationDelay: `${p.delay}ms`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

export default function AchievementToast({
  achievement,
  onDismiss,
  locked = false,
}: {
  achievement: AchievementWithStatus;
  locked?: boolean;
  onDismiss: () => void;
}) {
  const [confetti, setConfetti] = React.useState(false);

  React.useEffect(() => {
    if (locked) return;
    setConfetti(true);
    const id = window.setTimeout(() => setConfetti(false), 1_150);
    return () => window.clearTimeout(id);
  }, [locked, achievement.id]);

  return (
    <div
      className={cn(
        'pointer-events-auto relative overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-xl',
        'border-primary/20 bg-nav-bg/92 text-nav-text',
        'animate-[slideIn_0.25s_ease-out] w-[340px] max-w-[calc(100vw-2rem)]',
      )}
      role="status"
      aria-live="polite"
    >
      <ConfettiBurst active={confetti} />
      <div className="relative flex gap-3 p-4">
        <div
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border',
            locked
              ? 'border-white/10 bg-white/5 text-nav-text-muted'
              : 'border-primary/25 bg-primary/10 text-primary shadow-[0_0_18px_rgba(14,165,233,0.18)]',
          )}
        >
          {locked ? (
            <Lock className="h-5 w-5" />
          ) : (
            <span className="text-xl leading-none" aria-hidden>
              {achievement.icon}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-bold font-headline">
              {locked ? 'Locked' : 'Achievement unlocked'}
            </p>
            {!locked && <Sparkles className="h-4 w-4 text-primary" />}
          </div>
          <p className="mt-0.5 truncate text-sm text-nav-text">
            {achievement.title}
          </p>
          <p className="mt-1 line-clamp-2 text-xs text-nav-text-muted">
            {achievement.description}
          </p>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold uppercase tracking-wider text-nav-text-muted transition-colors hover:text-nav-text"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

