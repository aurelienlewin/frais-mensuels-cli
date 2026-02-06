import { getBaseUrl, getSessionCookie, setSessionCookie, setUserEmail } from '../config.js';

export type AuthUser = { id: string; email: string };

type ApiOk<T> = { ok: true } & T;
type ApiErr = { ok: false; error: string; message?: string; reasons?: string[] };

export type CloudStateRecord = { v?: unknown; modifiedAt: string; updatedAt: string; state: unknown; chunks?: number };

const SESSION_COOKIE = 'fm_session';

function extractSessionCookie(setCookie: string | null): string | null {
  if (!setCookie) return null;
  const match = setCookie.match(/(?:^|,\s*)fm_session=([^;]+)/i);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1] ?? '');
  } catch {
    return match[1] ?? null;
  }
}

async function parseJson(res: Response): Promise<unknown | null> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function api<T>(path: string, init: RequestInit): Promise<T> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) throw new Error('BASE_URL_MISSING');

  const headers = new Headers(init.headers ?? {});
  headers.set('Accept', 'application/json');

  const cookie = getSessionCookie();
  if (cookie) headers.set('Cookie', `${SESSION_COOKIE}=${cookie}`);

  const res = await fetch(`${baseUrl}${path}`, { ...init, headers });

  const setCookie = res.headers.get('set-cookie');
  const nextCookie = extractSessionCookie(setCookie);
  if (nextCookie) setSessionCookie(nextCookie);

  const body = (await parseJson(res)) as unknown;
  if (!res.ok) {
    const err = body && typeof body === 'object' ? (body as ApiErr) : null;
    const message =
      err?.message ||
      (err && 'reasons' in err && Array.isArray(err.reasons) ? err.reasons.join(' - ') : '') ||
      `API error (${res.status})`;
    const error = err?.error || 'API_ERROR';
    throw Object.assign(new Error(message), { code: error, status: res.status, payload: err });
  }
  return body as T;
}

export async function authMe(): Promise<AuthUser | null> {
  try {
    const body = await api<ApiOk<{ user: AuthUser }>>('/api/auth/me', { method: 'GET' });
    return body.user;
  } catch (e) {
    const err = e as { status?: number } | undefined;
    if (err?.status === 401) return null;
    throw e;
  }
}

export async function authLogin(email: string, password: string): Promise<AuthUser> {
  const body = await api<ApiOk<{ user: AuthUser }>>('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  setUserEmail(body.user.email);
  return body.user;
}

export async function authRegister(email: string, password: string): Promise<{ user: AuthUser; recoveryCode: string }> {
  const body = await api<ApiOk<{ user: AuthUser; recoveryCode: string }>>('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  setUserEmail(body.user.email);
  return { user: body.user, recoveryCode: body.recoveryCode };
}

export async function authLogout(): Promise<void> {
  await api<ApiOk<{}>>('/api/auth/logout', { method: 'POST' });
  setSessionCookie(null);
}

export async function authResetPassword(email: string, recoveryCode: string, newPassword: string): Promise<{ user: AuthUser; recoveryCode: string }> {
  const body = await api<ApiOk<{ user: AuthUser; recoveryCode: string }>>('/api/auth/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, recoveryCode, newPassword }),
  });
  setUserEmail(body.user.email);
  return { user: body.user, recoveryCode: body.recoveryCode };
}

export async function cloudGetState(): Promise<CloudStateRecord | null> {
  const body = await api<ApiOk<{ record: CloudStateRecord | null }>>('/api/state', { method: 'GET' });
  return body.record;
}

export async function cloudPutState(state: unknown, modifiedAt?: string): Promise<{ modifiedAt: string; updatedAt: string }> {
  const body = await api<ApiOk<{ record: { modifiedAt: string; updatedAt: string } }>>('/api/state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state, modifiedAt }),
  });
  return body.record;
}
