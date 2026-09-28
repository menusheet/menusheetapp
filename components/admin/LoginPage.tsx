'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from '@/lib/auth';
import { useAuthGuard } from '@/lib/useAuthGuard';
import { ErrorBanner, PrimaryButton, Spinner, inputClass } from '@/components/admin/ui';

export default function LoginPage() {
  const { status, refresh } = useAuthGuard();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === 'ok') router.replace('/admin');
  }, [status, router]);

  const handleEmail = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      await refresh();
      router.replace('/admin');
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  if (status === 'ok') {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas">
        <Spinner label="Signed in — taking you to the dashboard…" />
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-forest-800 text-white shadow-card">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M7 3v7a2.5 2.5 0 0 0 5 0V3" />
              <path d="M9.5 12.5V21" />
              <path d="M17 3c-1.7 1.5-2.5 4.5-2.5 7 0 .8.7 1.5 1.5 1.5h1v9.5" />
            </svg>
          </span>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight">Sign in to MenuSheet</h1>
          <p className="mt-1 text-sm text-gray-500">Admin dashboard access only.</p>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-card ring-1 ring-gray-100">
          <form onSubmit={handleEmail} className="space-y-3">
            <input
              type="email"
              required
              autoComplete="username"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
            <input
              type="password"
              required
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
            {error ? <ErrorBanner message={error} /> : null}
            <PrimaryButton type="submit" disabled={busy} className="w-full !py-3">
              {busy ? 'Signing in…' : 'Sign in'}
            </PrimaryButton>
          </form>
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-gray-400">
          Operator accounts only. Sessions are issued and verified by the
          MenuSheet auth service.
        </p>
      </div>
    </div>
  );
}

function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/Incorrect email or password/i.test(msg)) return 'Incorrect email or password.';
  if (/Too many attempts/i.test(msg)) return 'Too many attempts — please wait a few minutes and retry.';
  if (/not configured/i.test(msg)) return msg;
  if (/Failed to fetch|NetworkError/i.test(msg)) {
    return 'Could not reach the auth service. Check your connection and try again.';
  }
  return 'Sign-in failed. Please try again.';
}
