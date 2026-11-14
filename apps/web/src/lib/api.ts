import type { Me } from './types';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
const SERVER_URL = process.env.API_INTERNAL_URL ?? API_URL;

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

/** Server components: public, unauthenticated reads. Returns null on any failure so pages degrade gracefully. */
export async function serverGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(SERVER_URL + path, { cache: 'no-store' });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

// ───────────── client session (access token lives in memory only; refresh token is an httpOnly cookie) ─────────────
let accessToken: string | null = null;
let inflight: Promise<boolean> | null = null;
let listener: ((me: Me | null, expiresIn?: number) => void) | null = null;

export const getToken = () => accessToken;
export const onSession = (fn: typeof listener) => { listener = fn; };

const HINT = 'hrone_session';
export const hasSessionHint = () => { try { return localStorage.getItem(HINT) === '1'; } catch { return false; } };

export function setSession(token: string | null, me: Me | null, expiresIn?: number) {
  accessToken = token;
  try { if (token) localStorage.setItem(HINT, '1'); else localStorage.removeItem(HINT); } catch {}
  listener?.(me, expiresIn);
}

/** Single-flight refresh so parallel 401s trigger exactly one rotation. */
export function refreshSession(): Promise<boolean> {
  if (!accessToken && !hasSessionHint()) return Promise.resolve(false); // anonymous visitor: skip the pointless 401
  inflight ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' });
      if (!res.ok) { setSession(null, null); return false; }
      const data = await res.json();
      setSession(data.accessToken, data.user, data.expiresIn);
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => { inflight = null; }, 0);
    }
  })();
  return inflight;
}

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const run = () =>
    fetch(API_URL + path, {
      method: init.method ?? 'GET',
      credentials: 'include',
      headers: {
        ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });

  let res = await run();
  if (res.status === 401 && init.auth !== false && (await refreshSession())) res = await run();
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = Array.isArray(data.message) ? data.message[0] : data.message;
    throw new ApiError(res.status, data.code ?? 'ERROR', translate(res.status, data.code, msg));
  }
  return data as T;
}

/** Friendly Arabic messages for the errors users actually hit. */
function translate(status: number, code: string | undefined, fallback?: string): string {
  if (code === 'PREMIUM_REQUIRED') return 'هذا المحتوى للمشتركين فقط';
  if (code === 'BLOCKED') return 'لا يمكن المراسلة مع هذا المستخدم';
  if (status === 429) return 'محاولات كثيرة، يرجى الانتظار قليلاً ثم إعادة المحاولة';
  if (status === 401) return 'يلزم تسجيل الدخول';
  if (status === 403) return 'ليست لديك صلاحية لهذا الإجراء';
  if (status === 404) return 'لم يتم العثور على المطلوب';
  if (status === 409) return 'البيانات مستخدمة من قبل';
  if (status >= 500) return 'حدث خطأ غير متوقع، حاول لاحقاً';
  return fallback ?? 'تعذّر تنفيذ الطلب';
}
