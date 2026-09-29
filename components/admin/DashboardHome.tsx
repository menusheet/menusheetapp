'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { listRestaurants, reloadMenu, updateRestaurant } from '@/lib/adminApi';
import { daysLeft, formatDate, formatDateTime } from '@/lib/date';
import type { RestaurantRecord } from '@/lib/types';
import {
  DaysBadge,
  ErrorBanner,
  Pill,
  PrimaryButton,
  SecondaryButton,
  Spinner,
  StatCard,
  Toast,
  Toggle,
} from '@/components/admin/ui';
import { IconAlert, IconCalendar, IconEdit, IconEye, IconGrid, IconPlus, IconQr, IconRefresh } from '@/components/icons';
import QRCodeModal from '@/components/admin/QRCodeModal';

export default function DashboardHome() {
  const [rows, setRows] = useState<RestaurantRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [qrRow, setQrRow] = useState<RestaurantRecord | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [reloadingId, setReloadingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await listRestaurants();
    setRows(data);
    setError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    listRestaurants()
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  };

  const stats = useMemo(() => {
    const all = rows || [];
    let active = 0;
    let expiringSoon = 0;
    let expired = 0;
    for (const r of all) {
      const left = daysLeft(r.expiry_date);
      if (!isNaN(left) && left < 0) expired++;
      else if (r.active) {
        active++;
        if (!isNaN(left) && left <= 7) expiringSoon++;
      }
    }
    return { total: all.length, active, expiringSoon, expired };
  }, [rows]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.restaurant_name.toLowerCase().includes(q) ||
        r.restaurant_id.toLowerCase().includes(q) ||
        r.owner_contact.toLowerCase().includes(q)
    );
  }, [rows, query]);

  const nextExpiry = useMemo(() => {
    if (!rows) return null;
    const candidates = rows
      .filter((r) => !isNaN(daysLeft(r.expiry_date)) && daysLeft(r.expiry_date) >= 0 && daysLeft(r.expiry_date) <= 45)
      .sort((a, b) => daysLeft(a.expiry_date) - daysLeft(b.expiry_date));
    return candidates[0] || null;
  }, [rows]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  /**
   * The Worker applies the kill switch itself on every read, so flipping this
   * takes effect on the next customer page load. There is no second system to
   * push to and nothing to wait for.
   */
  const toggleActive = async (row: RestaurantRecord) => {
    setTogglingId(row.restaurant_id);
    const next = !row.active;
    setRows((prev) =>
      prev ? prev.map((r) => (r.restaurant_id === row.restaurant_id ? { ...r, active: next } : r)) : prev
    );
    try {
      const { restaurant, restaurants } = await updateRestaurant({
        restaurant_id: row.restaurant_id,
        active: next,
      });
      if (restaurants) setRows(restaurants);
      else setRows((prev) => (prev ? prev.map((r) => (r.restaurant_id === row.restaurant_id ? restaurant : r)) : prev));
      showToast(`${row.restaurant_name} is now ${next ? 'active' : 'inactive'}`);
    } catch (e) {
      setRows((prev) =>
        prev ? prev.map((r) => (r.restaurant_id === row.restaurant_id ? { ...r, active: row.active } : r)) : prev
      );
      showToast(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setTogglingId(null);
    }
  };

  /**
   * Re-fetch one restaurant's sheet into the KV cache.
   *
   * The only path in the product that reads Google Apps Script, and it runs
   * because an operator asked for it — never on a schedule, never on a
   * customer page load.
   */
  const reloadOne = async (row: RestaurantRecord) => {
    setReloadingId(row.restaurant_id);
    try {
      const result = await reloadMenu(row.restaurant_id);
      if (result.restaurants) setRows(result.restaurants);
      showToast(`${row.restaurant_name}: ${result.itemCount} item(s) published`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Reload failed');
    } finally {
      setReloadingId(null);
    }
  };

  const openEdit = (row: RestaurantRecord) => {
    window.location.assign(`/admin/restaurants/${row.restaurant_id}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Live overview of every restaurant on MenuSheet."
        actions={
          <>
            <SecondaryButton onClick={() => void refresh()}>
              <IconRefresh className={refreshing || !rows ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /> Refresh data
            </SecondaryButton>
            <Link href="/admin/restaurants/new">
              <PrimaryButton>
                <IconPlus className="h-4 w-4" /> Add Restaurant
              </PrimaryButton>
            </Link>
          </>
        }
      />

      {error ? <ErrorBanner message={`Could not reach the platform: ${error}`} /> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          featured
          label="Total Restaurants"
          value={stats.total}
          caption="in the live roster"
          icon={<IconGrid />}
        />
        <StatCard label="Active" value={stats.active} caption="live & serving menus" captionTone="positive" icon={<IconEye />} />
        <StatCard
          label="Expiring in 7 days"
          value={stats.expiringSoon}
          caption={stats.expiringSoon > 0 ? 'needs renewal attention' : 'all clear for now'}
          captionTone={stats.expiringSoon > 0 ? 'warning' : 'neutral'}
          icon={<IconCalendar />}
        />
        <StatCard
          label="Expired"
          value={stats.expired}
          caption={stats.expired > 0 ? 'renew or deactivate' : 'nothing overdue'}
          captionTone={stats.expired > 0 ? 'danger' : 'positive'}
          icon={<IconAlert />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <DonutWidget rows={rows} />
        <ReminderWidget row={nextExpiry} onOpen={() => (nextExpiry ? openEdit(nextExpiry) : undefined)} />
        <HealthWidget rows={rows} />
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-gray-100">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <h2 className="font-bold tracking-tight">Restaurants</h2>
            <Pill tone="neutral">{filtered.length}</Pill>
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, ID or contact…"
            className="h-9 w-full max-w-xs rounded-full border border-transparent bg-canvas px-4 text-sm outline-none transition placeholder:text-gray-400 focus:border-forest-200 focus:bg-white focus:ring-2 focus:ring-forest-100"
          />
        </div>

        {!rows ? (
          <Spinner label="Loading restaurants…" />
        ) : filtered.length === 0 ? (
          <div className="px-5 py-14 text-center text-sm text-gray-400">
            No restaurants match “{query}”.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-y border-gray-100 bg-canvas/60 text-left text-xs uppercase tracking-wide text-gray-400">
                  <th className="px-5 py-3 font-semibold">Restaurant</th>
                  <th className="px-4 py-3 font-semibold">Active</th>
                  <th className="px-4 py-3 font-semibold">Expiry</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Theme</th>
                  <th className="px-4 py-3 font-semibold">Menu fetched</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const left = daysLeft(row.expiry_date);
                  const expired = !isNaN(left) && left < 0;
                  return (
                    <tr key={row.restaurant_id} className="border-b border-gray-50 transition hover:bg-canvas/50">
                      <td className="px-5 py-3.5">
                        <button onClick={() => openEdit(row)} className="text-left">
                          <p className="font-semibold text-gray-800 hover:text-forest-700">{row.restaurant_name}</p>
                          <p className="text-xs text-gray-400">/{row.restaurant_id}</p>
                        </button>
                      </td>
                      <td className="px-4 py-3.5">
                        <Toggle
                          checked={row.active && !expired}
                          disabled={togglingId === row.restaurant_id}
                          onChange={() => void toggleActive(row)}
                          label={`Toggle ${row.restaurant_name}`}
                        />
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">{formatDate(row.expiry_date)}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <DaysBadge days={left} />
                      </td>
                      <td className="px-4 py-3.5">
                        <code className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-500">{row.theme_key}</code>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs text-gray-500">
                        {row.last_checked_at ? relativeTime(row.last_checked_at) : 'never'}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <IconButton
                            title="Fetch this restaurant's menu from its sheet now"
                            busy={reloadingId === row.restaurant_id}
                            onClick={() => void reloadOne(row)}
                          >
                            <IconRefresh className="h-4 w-4" />
                          </IconButton>
                          <IconButton title="Preview menu" onClick={() => window.open(`/r/${row.restaurant_id}`, '_blank')}>
                            <IconEye className="h-4 w-4" />
                          </IconButton>
                          <IconButton title="Edit restaurant" onClick={() => openEdit(row)}>
                            <IconEdit className="h-4 w-4" />
                          </IconButton>
                          <IconButton title="QR code" onClick={() => setQrRow(row)}>
                            <IconQr className="h-4 w-4" />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {qrRow ? (
        <QRCodeModal
          restaurantId={qrRow.restaurant_id}
          restaurantName={qrRow.restaurant_name}
          open
          onClose={() => setQrRow(null)}
        />
      ) : null}

      <Toast message={toast} />
    </div>
  );
}

function relativeTime(iso: string): string {
  const t = Date.parse(iso);
  if (isNaN(t)) return 'never';
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} d ago`;
  return formatDate(iso);
}

function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
      </div>
      <div className="flex items-center gap-2.5">{actions}</div>
    </div>
  );
}

function IconButton({
  children,
  onClick,
  title,
  busy,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  busy?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={busy}
      className="grid h-9 w-9 place-items-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:bg-canvas hover:text-gray-800 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function DonutWidget({ rows }: { rows: RestaurantRecord[] | null }) {
  const counts = useMemo(() => {
    let ok = 0;
    let soon = 0;
    let bad = 0;
    for (const r of rows || []) {
      const left = daysLeft(r.expiry_date);
      if (isNaN(left)) continue;
      if (left < 0) bad++;
      else if (left <= 7) soon++;
      else ok++;
    }
    const total = ok + soon + bad || 1;
    return { ok, soon, bad, total, pct: Math.round(((ok + soon) / total) * 100) };
  }, [rows]);

  const R = 52;
  const C = 2 * Math.PI * R;
  const segOk = (counts.ok / counts.total) * C;
  const segSoon = (counts.soon / counts.total) * C;

  return (
    <div className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-gray-100">
      <h3 className="font-bold tracking-tight">Subscription health</h3>
      <div className="mt-3 flex items-center gap-6">
        <svg width="130" height="130" viewBox="0 0 130 130" className="-rotate-90">
          <circle cx="65" cy="65" r={R} fill="none" stroke="#FEE2E2" strokeWidth="13" />
          <circle cx="65" cy="65" r={R} fill="none" stroke="#FCD34D" strokeWidth="13" strokeDasharray={`${segSoon} ${C}`} strokeDashoffset={-segOk} strokeLinecap="butt" />
          <circle cx="65" cy="65" r={R} fill="none" stroke="#16A34A" strokeWidth="13" strokeDasharray={`${segOk} ${C}`} strokeLinecap="round" />
          <text x="65" y="65" textAnchor="middle" dominantBaseline="central" transform="rotate(90 65 65)" className="fill-gray-900 text-[20px] font-bold" style={{ fontSize: 22 }}>
            {counts.pct}%
          </text>
        </svg>
        <div className="space-y-2.5 text-sm">
          <Legend color="#16A34A" label="Healthy" value={counts.ok} />
          <Legend color="#FCD34D" label="Expiring ≤7d" value={counts.soon} />
          <Legend color="#FCA5A5" label="Expired" value={counts.bad} />
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-gray-500">{label}</span>
      <span className="ml-auto pl-6 font-bold">{value}</span>
    </div>
  );
}

function ReminderWidget({ row, onOpen }: { row: RestaurantRecord | null; onOpen: () => void }) {
  const left = row ? daysLeft(row.expiry_date) : NaN;
  return (
    <div className="flex flex-col rounded-2xl bg-white p-5 shadow-card ring-1 ring-gray-100">
      <h3 className="font-bold tracking-tight">Next renewal</h3>
      {row ? (
        <>
          <div className="mt-3 rounded-xl border-l-4 border-amber-400 bg-amber-50 p-3.5">
            <p className="font-semibold leading-tight">{row.restaurant_name}</p>
            <p className="mt-0.5 text-xs text-gray-500">
              expires {formatDate(row.expiry_date)} · in {left} day{left === 1 ? '' : 's'}
            </p>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-gray-500">
            Renew by extending the expiry date. It takes effect the moment you save — the
            platform enforces it on every page load.
          </p>
          <div className="mt-auto pt-4">
            <PrimaryButton onClick={onOpen} className="w-full">
              Review renewal
            </PrimaryButton>
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
          <span className="text-2xl">🎉</span>
          <p className="text-sm text-gray-500">Nothing due in the next 45 days.</p>
        </div>
      )}
    </div>
  );
}

/**
 * Replaces the old "Worker sync status" panel.
 *
 * There is no nightly job any more, so "stale" no longer means a background
 * reconciliation is behind. It now means the opposite of healthy: nobody has
 * pressed Reload for this restaurant, so its menu is whatever was last pulled
 * out of the sheet.
 */
function HealthWidget({ rows }: { rows: RestaurantRecord[] | null }) {
  const counts = useMemo(() => {
    const all = rows || [];
    const fetched = all.filter((r) => r.last_checked_at).length;
    return {
      total: all.length,
      fetched,
      never: all.length - fetched,
      week: all.filter((r) => {
        if (!r.last_checked_at) return false;
        const t = Date.parse(r.last_checked_at);
        return isNaN(t) || Date.now() - t > 7 * 24 * 3600 * 1000;
      }).length,
    };
  }, [rows]);

  return (
    <div className="rounded-2xl bg-forest-900 p-5 text-white shadow-card">
      <div className="flex items-start justify-between">
        <h3 className="font-bold tracking-tight">Menu cache</h3>
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-forest-200">
          on demand
        </span>
      </div>
      <p className="mt-4 font-mono text-[26px] font-bold leading-none tracking-tight">{counts.fetched}</p>
      <p className="mt-1.5 text-xs text-forest-200">of {counts.total} restaurant(s) have a fetched menu</p>
      <div className="mt-4 space-y-2 text-xs">
        <div className="flex justify-between rounded-lg bg-white/10 px-3 py-2">
          <span className="text-forest-100">Never reloaded</span>
          <span className="font-bold">{counts.never}</span>
        </div>
        <div className="flex justify-between rounded-lg bg-white/10 px-3 py-2">
          <span className="text-forest-100">Not reloaded in 7 days</span>
          <span className="font-bold">{counts.week}</span>
        </div>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-forest-300">
        Nothing is fetched on a schedule. A restaurant&rsquo;s menu updates when an operator
        presses Reload, or when the owner uses the button in their own sheet.
      </p>
    </div>
  );
}
