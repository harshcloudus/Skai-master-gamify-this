import { supabase } from './supabase';
import { addToast } from './toast';

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:8000';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(await getAuthHeaders()),
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = body.detail || res.statusText;

    if (res.status === 401) {
      addToast('error', 'Session expired — please sign in again.');
      await supabase.auth.signOut();
    } else if (res.status >= 500) {
      addToast('error', 'Server error — please try again later.');
    }

    throw new ApiError(res.status, message);
  }

  return res.json();
}

interface ApiResponse<T> {
  message: string;
  data: T;
}

interface PaginatedApiResponse<T> {
  message: string;
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

async function fetchBlob(path: string): Promise<Blob> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}${path}`, { headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail || res.statusText);
  }
  return res.blob();
}

export const api = {
  getBlob: (path: string) => fetchBlob(path),
  get: <T>(path: string) => request<ApiResponse<T>>(path),

  getPaginated: <T>(path: string) => request<PaginatedApiResponse<T>>(path),

  getRaw: <T>(path: string) => request<T>(path),

  put: <T>(path: string, body: unknown) =>
    request<ApiResponse<T>>(path, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  patch: <T>(path: string, body: unknown) =>
    request<ApiResponse<T>>(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  post: <T>(path: string, body?: unknown) =>
    request<ApiResponse<T>>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  postRaw: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
};
