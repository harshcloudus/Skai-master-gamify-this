import { useEffect, useSyncExternalStore } from 'react';
import { X, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { subscribe, getToasts, dismissToast } from '../lib/toast';
import type { ToastType } from '../lib/toast';
import { cn } from '../lib/utils';

const iconMap: Record<ToastType, React.ElementType> = {
  error: AlertCircle,
  success: CheckCircle2,
  info: Info,
};

const colorMap: Record<ToastType, string> = {
  error: 'border-red-200 bg-red-50 text-red-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  info: 'border-primary/20 bg-primary/5 text-primary',
};

export default function Toaster() {
  const toasts = useSyncExternalStore(subscribe, getToasts, getToasts);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-9999 flex flex-col gap-2">
      {toasts.map((t) => {
        const Icon = iconMap[t.type];
        return (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm',
              'animate-[slideIn_0.2s_ease-out] min-w-[280px] max-w-sm',
              colorMap[t.type],
            )}
          >
            <Icon className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="flex-1 text-sm font-medium">{t.message}</p>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="shrink-0 opacity-60 transition-opacity hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
