/**
 * API client with automatic auth header injection and token refresh.
 * Wraps native fetch with:
 * - Bearer token from memory
 * - Auto-refresh on 401
 * - JSON request/response handling
 * - RFC 7807 error parsing
 */

const API_BASE = process.env.NEXT_PUBLIC_APP_URL ?? '';

// In-memory token storage (not persisted — refresh token in httpOnly cookie handles persistence)
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

interface ApiError {
  type: string;
  title: string;
  status: number;
  detail?: string;
  errors?: Record<string, string[]>;
}

export class ApiRequestError extends Error {
  status: number;
  detail?: string;
  errors?: Record<string, string[]>;

  constructor(apiError: ApiError) {
    super(apiError.detail ?? apiError.title);
    this.name = 'ApiRequestError';
    this.status = apiError.status;
    this.detail = apiError.detail;
    this.errors = apiError.errors;
  }
}

async function refreshAccessToken(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // sends httpOnly cookie
    });
    if (!res.ok) return false;
    const data = await res.json();
    accessToken = data.accessToken;
    return true;
  } catch {
    return false;
  }
}

interface FetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  skipAuth?: boolean;
}

/**
 * Core fetch wrapper. Automatically attaches Bearer token and handles refresh.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { body, skipAuth, ...init } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };

  if (!skipAuth && accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;

  let res = await fetch(url, {
    ...init,
    headers,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });

  // On 401, try refreshing the token once
  if (res.status === 401 && !skipAuth) {
    const refreshed = await refreshAccessToken();
    if (refreshed && accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      res = await fetch(url, {
        ...init,
        headers,
        credentials: 'include',
        body: body ? JSON.stringify(body) : undefined,
      });
    }
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  const data = await res.json();

  if (!res.ok) {
    throw new ApiRequestError(data);
  }

  return data as T;
}

// ============================================
// CONVENIENCE METHODS
// ============================================

export const api = {
  get: <T = unknown>(path: string, options?: FetchOptions) =>
    apiFetch<T>(path, { ...options, method: 'GET' }),

  post: <T = unknown>(path: string, body?: unknown, options?: FetchOptions) =>
    apiFetch<T>(path, { ...options, method: 'POST', body }),

  put: <T = unknown>(path: string, body?: unknown, options?: FetchOptions) =>
    apiFetch<T>(path, { ...options, method: 'PUT', body }),

  patch: <T = unknown>(path: string, body?: unknown, options?: FetchOptions) =>
    apiFetch<T>(path, { ...options, method: 'PATCH', body }),

  delete: <T = unknown>(path: string, options?: FetchOptions) =>
    apiFetch<T>(path, { ...options, method: 'DELETE' }),
};

export default api;
