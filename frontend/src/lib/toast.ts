type ToastType = 'error' | 'success' | 'info';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

type Listener = (toasts: Toast[]) => void;

let nextId = 1;
let toasts: Toast[] = [];
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((fn) => fn([...toasts]));
}

export function addToast(type: ToastType, message: string, durationMs = 5000) {
  const id = nextId++;
  toasts = [...toasts, { id, type, message }];
  notify();
  setTimeout(() => dismissToast(id), durationMs);
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getToasts(): Toast[] {
  return toasts;
}

export type { Toast, ToastType };
