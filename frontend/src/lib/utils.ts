import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Long titles, descriptions, labels: wrap on narrow widths instead of overflowing.
 * Parent flex/grid items should include min-w-0 where shrinking is required.
 */
export const longTextWrap =
  'min-w-0 max-w-full break-words [overflow-wrap:anywhere]' as const;

/** Phone numbers, POS keys, mono tokens — break very long unbroken strings */
export const longTextMono =
  'min-w-0 max-w-full break-all [overflow-wrap:anywhere] sm:break-words' as const;

/** YYYY-MM-DD in local calendar (avoids UTC shift from toISOString()). */
export function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
