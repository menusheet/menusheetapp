'use client';

import { useCallback, useEffect, useState } from 'react';
import { currentUser, type AdminUser } from '@/lib/auth';

export type AuthStatus = 'loading' | 'anon' | 'ok';

interface AuthGuardState {
  status: AuthStatus;
  email: string | null;
  refresh: () => Promise<void>;
}

/**
 * Resolves the signed-in operator by asking the auth Worker.
 *
 * The 'denied' state is gone: the Worker only issues a session for the exact
 * allow-listed email, so an unauthorized identity cannot reach this point.
 */
export function useAuthGuard(): AuthGuardState {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [email, setEmail] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const user: AdminUser | null = await currentUser();
    setEmail(user?.email ?? null);
    setStatus(user ? 'ok' : 'anon');
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const user = await currentUser();
      if (cancelled) return;
      setEmail(user?.email ?? null);
      setStatus(user ? 'ok' : 'anon');
    })();

    // Sign-out in another tab should lock this one too.
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'menusheet_logged_out') void refresh();
    };
    window.addEventListener('storage', onStorage);

    return () => {
      cancelled = true;
      window.removeEventListener('storage', onStorage);
    };
  }, [refresh]);

  return { status, email, refresh };
}
