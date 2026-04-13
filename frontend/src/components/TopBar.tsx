import React from 'react';
import { Menu, Phone } from 'lucide-react';
import { cn } from '../lib/utils';

interface TopBarProps {
  title: string;
  sidebarCollapsed?: boolean;
  onOpenMobileMenu?: () => void;
}

function getSelectedTimeZone() {
  try {
    const tz = window.localStorage.getItem('skai.timeZone');
    return tz || Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
}

function formatTopBarDate(d: Date, timeZone: string) {
  const weekday = new Intl.DateTimeFormat(undefined, { timeZone, weekday: 'long' }).format(d);
  const month = new Intl.DateTimeFormat(undefined, { timeZone, month: 'short' }).format(d);
  const day = new Intl.DateTimeFormat(undefined, { timeZone, day: '2-digit' }).format(d);

  const parts = new Intl.DateTimeFormat(undefined, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(d);
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
  const suffix =
    parts.find((p) => p.type === 'dayPeriod')?.value ??
    (Number(hour) >= 12 ? 'PM' : 'AM');
  return `${weekday}, ${month} ${day} • ${hour}:${minute} ${suffix}`;
}

export default function TopBar({
  title,
  sidebarCollapsed = false,
  onOpenMobileMenu,
}: TopBarProps) {
  const [now, setNow] = React.useState(() => new Date());
  const [timeZone, setTimeZone] = React.useState(() => getSelectedTimeZone());

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(id);
  }, []);

  React.useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'skai.timeZone') setTimeZone(getSelectedTimeZone());
    };
    window.addEventListener('storage', onStorage);
    const id = window.setInterval(() => setTimeZone(getSelectedTimeZone()), 2_000);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.clearInterval(id);
    };
  }, []);

  return (
    <header
      className={cn(
        'fixed top-0 z-[200] flex h-16 items-center justify-between border-b border-nav-border bg-nav-bg/95 px-4 backdrop-blur-3xl sm:px-8',
        'left-0 w-full',
        sidebarCollapsed
          ? 'md:left-20 md:w-[calc(100%-5rem)]'
          : 'md:left-64 md:w-[calc(100%-16rem)]',
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-8">
        {onOpenMobileMenu && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="inline-flex shrink-0 rounded-lg p-2 text-nav-text hover:bg-white/10 md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-nav-text text-base font-headline font-bold sm:text-lg">
            {title}
          </h2>
          <p className="truncate text-xs text-nav-text-muted font-normal">
            {formatTopBarDate(now, timeZone)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-md">
          <Phone className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-bold text-primary uppercase tracking-widest whitespace-nowrap">
            42
          </span>
        </div>
      </div>
    </header>
  );
}
