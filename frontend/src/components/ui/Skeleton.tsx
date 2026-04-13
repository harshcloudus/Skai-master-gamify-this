import React from 'react';
import { cn } from '../../lib/utils';

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-md bg-surface-bright animate-pulse',
        className,
      )}
      {...props}
    />
  );
}
