/**
 * Admin identity + session, backed by the Cloudflare auth Worker.
 *
 * The Worker owns credentials, SHARED_SECRET, and session signing. This module
 * only holds the returned email and asks the Worker who the caller is.
 */

const AUTH_WORKER = (process.env.NEXT_PUBLIC_ADMIN_AUTH_WORKER_URL || '').replace(/\/+$/, '');

export interface AdminUser {
  email: string;
}

export function authConfigured(): boolean {
  return Boolean(AUTH_WORKER);
}

function requireConfig() {
  if (!AUTH_WORKER) {
    throw new Error(
      'Admin auth is not configured. Set NEXT_PUBLIC_ADMIN_AUTH_WORKER_URL in .env.local and rebuild.'
    );
  }
}

export async function signIn(email: string, password: string): Promise<AdminUser> {
  requireConfig();
  const res = await fetch(`${AUTH_WORKER}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });

  const data = (await res.json().catch(() => ({}))) as { email?: string; error?: string };

  if (!res.ok) throw new Error(data.error || 'Sign-in failed.');
  return { email: data.email ?? email };
}

export async function signOut(): Promise<void> {
  if (!AUTH_WORKER) return;
  await fetch(`${AUTH_WORKER}/api/logout`, {
    method: 'POST',
    credentials: 'include',
  }).catch(() => {});
}

/** Resolves to the signed-in operator, or null. Never throws. */
export async function currentUser(): Promise<AdminUser | null> {
  if (!AUTH_WORKER) return null;
  try {
    const res = await fetch(`${AUTH_WORKER}/api/session`, {
      credentials: 'include',
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { email?: string | null };
    return data.email ? { email: data.email } : null;
  } catch {
    return null;
  }
}
