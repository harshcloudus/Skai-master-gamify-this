import React from 'react';
import { cn } from '../lib/utils';

export default function ProgressRing({
  value,
  max,
  size = 44,
  strokeWidth = 6,
  className,
  label,
  tone = 'primary',
}: {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  label?: string;
  tone?: 'primary' | 'success';
}) {
  const clamped = Math.max(0, Math.min(max, value));
  const pct = max > 0 ? clamped / max : 0;

  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const dashOffset = c * (1 - pct);

  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const progressStroke =
    tone === 'success' ? 'rgba(16,185,129,0.95)' : 'var(--color-primary)';

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-label={label}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--color-outline-variant)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={progressStroke}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={mounted ? dashOffset : c}
          style={{ transition: 'stroke-dashoffset 260ms ease-out' }}
        />
      </svg>
      <span className="absolute text-[11px] font-extrabold text-on-surface">
        {Math.round(pct * 100)}%
      </span>
    </div>
  );
}

