/**
 * Admin identity + session, backed by the platform API Worker.
 *
 * The Worker owns credentials, SHARED_SECRET, and session signing. This module
 * only holds the returned email and asks the Worker who the caller is.
 *
 * The signed token is kept in localStorage and replayed as an Authorization
 * header rather than relying on the Worker's session cookie. The dashboard is a
 * static export on pages.dev and the Worker is on workers.dev, so that cookie
 * is third-party: Safari drops it, as does any browser with third-party cookies
 * turned off, which left sign-in broken for most operators. A header is not
 * subject to third-party cookie policy.
 */

const API = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '');

const TOKEN_KEY = 'menusheet_session_token';

export interface AdminUser {
  email: string;
}

export function authConfigured(): boolean {
  return Boolean(API);
}

function requireConfig() {
  if (!API) {
    throw new Error(
      'Admin auth is not configured. Set NEXT_PUBLIC_API_URL in .env.local and rebuild.'
    );
  }
}

function readToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null; // storage disabled (private mode, blocked cookies)
  }
}

function writeToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* nothing to do; the session simply will not persist */
  }
}

/** Spread into every privileged request's headers. */
export function authHeaders(): Record<string, string> {
  const token = readToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function signIn(email: string, password: string): Promise<AdminUser> {
  requireConfig();
  const res = await fetch(`${API}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    email?: string;
    token?: string;
    error?: string;
  };

  if (!res.ok) throw new Error(data.error || 'Sign-in failed.');
  writeToken(data.token ?? null);
  return { email: data.email ?? email };
}

export async function signOut(): Promise<void> {
  writeToken(null);
  if (!API) return;
  await fetch(`${API}/api/logout`, {
    method: 'POST',
    credentials: 'include',
    headers: authHeaders(),
  }).catch(() => {});
}

/** Resolves to the signed-in operator, or null. Never throws. */
export async function currentUser(): Promise<AdminUser | null> {
  if (!API) return null;
  try {
    const res = await fetch(`${API}/api/session`, {
      credentials: 'include',
      cache: 'no-store',
      headers: authHeaders(),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { email?: string | null };
    return data.email ? { email: data.email } : null;
  } catch {
    return null;
  }
}
