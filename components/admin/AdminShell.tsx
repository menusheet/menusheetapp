'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from '@/lib/auth';
import { useAuthGuard } from '@/lib/useAuthGuard';
import { Wordmark } from '@/components/brand/Logo';
import {
  IconBell,
  IconGrid,
  IconHelp,
  IconLogout,
  IconPlus,
  IconSearch,
  IconSettings,
  IconX,
} from '@/components/icons';
import { Spinner } from '@/components/admin/ui';

const MENU_NAV = [
  { href: '/admin', label: 'Dashboard', icon: IconGrid },
  { href: '/admin/restaurants/new', label: 'Add Restaurant', icon: IconPlus },
];

const GENERAL_NAV = [
  { href: '/admin/settings', label: 'Settings', icon: IconSettings },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const { status, email, refresh } = useAuthGuard();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (status === 'anon') {
      router.replace('/admin/login');
    }
  }, [status, router]);

  if (status !== 'ok') {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas">
        {status === 'loading' ? (
          <Spinner label="Checking your session…" />
        ) : (
          <p className="text-sm text-gray-400">Redirecting to sign in…</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-canvas p-0 lg:p-5">
      <Sidebar
        email={email}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onLogout={async () => {
          await signOut();
          // Nudge other open tabs to re-check their (now missing) session.
          try {
            localStorage.setItem('menusheet_logged_out', String(Date.now()));
          } catch {}
          await refresh();
          router.replace('/admin/login');
        }}
      />

      <div className="flex min-w-0 flex-1 flex-col lg:ml-[246px]">
        <TopBar email={email} onMenuClick={() => setMobileOpen(true)} />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function Sidebar({
  email,
  mobileOpen,
  onClose,
  onLogout,
}: {
  email: string | null;
  mobileOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

  const linkClass = (active: boolean) =>
    `relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
      active
        ? 'bg-forest-50 text-forest-800'
        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
    }`;

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[230px] flex-col bg-white transition-transform duration-200 lg:translate-x-0 lg:rounded-3xl lg:shadow-card ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 pb-6 pt-6">
          <Link href="/admin" className="min-w-0" onClick={onClose}>
            <Wordmark className="h-8" />
          </Link>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full bg-canvas text-gray-500 lg:hidden"
            aria-label="Close menu"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 pb-4">
          <p className="px-3 pb-2 pt-1 text-[11px] font-bold uppercase tracking-widest text-gray-400">Menu</p>
          <div className="space-y-1">
            {MENU_NAV.map((item) => (
              <NavLink key={item.href} {...item} active={isActive(item.href)} onClick={onClose} className={linkClass} />
            ))}
          </div>

          <p className="mt-7 px-3 pb-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">General</p>
          <div className="space-y-1">
            {GENERAL_NAV.map((item) => (
              <NavLink key={item.href} {...item} active={isActive(item.href)} onClick={onClose} className={linkClass} />
            ))}
            <a
              href="https://wa.me/919207624728"
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass(false)}
            >
              <IconHelp />
              Help
            </a>
            <button onClick={onLogout} className={`w-full text-left ${linkClass(false)} hover:!text-red-600`}>
              <IconLogout />
              Logout
            </button>
          </div>
        </nav>

        <div className="m-4 mt-auto rounded-2xl bg-forest-900 p-4 text-white">
          <p className="text-sm font-bold leading-snug">Onboard your next restaurant in minutes</p>
          <p className="mt-1 text-xs leading-relaxed text-forest-200">
            Generate a theme, map it, deploy — done.
          </p>
          <Link
            href="/admin/restaurants/new"
            onClick={onClose}
            className="mt-3 block rounded-full bg-forest-600 py-2 text-center text-xs font-bold text-white transition hover:bg-forest-500"
          >
            + Add restaurant
          </Link>
        </div>

        {/* <div className="hidden border-t border-gray-100 px-5 py-3 lg:block">
          <p className="truncate text-xs font-semibold text-gray-700">{email}</p>
          <p className="text-[11px] text-gray-400">Operator</p>
        </div> */}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-30 bg-gray-950/30 backdrop-blur-sm lg:hidden" onClick={onClose} />
      ) : null}
    </>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  onClick,
  className,
}: {
  href: string;
  label: string;
  icon: (props: { className?: string }) => React.ReactElement;
  active: boolean;
  onClick: () => void;
  className: (active: boolean) => string;
}) {
  return (
    <Link href={href} onClick={onClick} className={className(active)}>
      {active ? (
        <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-forest-600" />
      ) : null}
      <Icon />
      {label}
    </Link>
  );
}

function TopBar({ email, onMenuClick }: { email: string | null; onMenuClick: () => void }) {
  const initials = (email || '?').slice(0, 2).toUpperCase();
  return (
    <div className="sticky top-0 z-20 bg-canvas/90 px-4 pt-5 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex h-14 items-center justify-between gap-3 rounded-2xl bg-white px-4 shadow-card ring-1 ring-gray-100">
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-canvas text-gray-500 lg:hidden"
            aria-label="Open menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="relative hidden sm:block">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
              <IconSearch className="h-4 w-4" />
            </span>
            <input
              placeholder="Search…"
              className="h-10 w-64 rounded-full border border-transparent bg-canvas pl-10 pr-16 text-sm outline-none transition placeholder:text-gray-400 focus:border-forest-200 focus:bg-white focus:ring-2 focus:ring-forest-100"
            />
            <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-gray-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-gray-400">
              ⌘F
            </kbd>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="relative grid h-9 w-9 place-items-center rounded-full text-gray-500 transition hover:bg-canvas"
            aria-label="Notifications"
          >
            <IconBell className="h-[18px] w-[18px]" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-400 ring-2 ring-white" />
          </button>
          <div className="mx-1 h-6 w-px bg-gray-100" />
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-forest-100 text-xs font-bold text-forest-800">
              {initials}
            </span>
            <div className="hidden md:block">
              <p className="max-w-[160px] truncate text-sm font-semibold leading-tight text-gray-800">{email}</p>
              <p className="text-[11px] leading-tight text-gray-400">admin</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
