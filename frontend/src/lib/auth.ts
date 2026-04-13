// Legacy auth helpers — kept for backwards compatibility.
// Real auth is handled by auth-context.tsx using Supabase.

const AUTH_KEY = 'skai_authed';

export function isAuthed(): boolean {
  try {
    return localStorage.getItem(AUTH_KEY) === '1';
  } catch {
    return false;
  }
}

export function setAuthed(value: boolean) {
  try {
    localStorage.setItem(AUTH_KEY, value ? '1' : '0');
  } catch {
    // ignore
  }
}

export function clearAuthed() {
  try {
    localStorage.removeItem(AUTH_KEY);
  } catch {
    // ignore
  }
}
