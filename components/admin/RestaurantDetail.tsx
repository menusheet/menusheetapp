'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { listRestaurants, menuStatus, reloadMenu, updateRestaurant } from '@/lib/adminApi';
import { daysLeft, formatDate, formatDateTime } from '@/lib/date';
import { publicMenuUrl } from '@/lib/siteUrl';
import type { MenuCacheStatus, RestaurantRecord } from '@/lib/types';
import { getThemeKeys } from '@/themes';
import {
  DaysBadge,
  ErrorBanner,
  Field,
  Pill,
  PrimaryButton,
  SecondaryButton,
  Select,
  Spinner,
  Toast,
  Toggle,
  inputClass,
} from '@/components/admin/ui';
import QRCodeModal from '@/components/admin/QRCodeModal';
import { IconCheck, IconCopy, IconQr, IconRefresh, IconSheet } from '@/components/icons';

const TTL_PRESETS: Array<{ label: string; value: string }> = [
  { label: 'Never expires (until next Reload)', value: '0' },
  { label: '15 minutes', value: '900' },
  { label: '1 hour', value: '3600' },
  { label: '6 hours', value: '21600' },
  { label: '24 hours', value: '86400' },
  { label: '7 days', value: '604800' },
];

export default function RestaurantDetail({ restaurantId }: { restaurantId: string }) {
  const [record, setRecord] = useState<RestaurantRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [active, setActive] = useState(false);
  const [expiryDate, setExpiryDate] = useState('');
  const [appscriptUrl, setAppscriptUrl] = useState('');
  const [sheetId, setSheetId] = useState('');
  const [themeKey, setThemeKey] = useState('');
  const [contact, setContact] = useState('');
  const [planAmount, setPlanAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [cacheTtl, setCacheTtl] = useState('0');

  const [cache, setCache] = useState<MenuCacheStatus | null>(null);
  const [reloading, setReloading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listRestaurants()
      .then((rows) => {
        if (cancelled) return;
        const found = rows.find((r) => r.restaurant_id === restaurantId) || null;
        if (found) {
          setRecord(found);
          setActive(found.active);
          setExpiryDate(found.expiry_date);
          setAppscriptUrl(found.appscript_url);
          setSheetId(found.sheet_id);
          setThemeKey(found.theme_key);
          setContact(found.owner_contact);
          setPlanAmount(String(found.plan_amount ?? ''));
          setNotes(found.notes);
          setCacheTtl(String(found.cache_ttl_seconds ?? 0));
        } else {
          setError(`No restaurant with the id “${restaurantId}” exists.`);
        }
        return menuStatus(restaurantId);
      })
      .then((status) => {
        if (!cancelled) setCache(status ?? null);
      })      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  const dirty = useMemo(() => {
    if (!record) return false;
    return (
      active !== record.active ||
      expiryDate !== record.expiry_date ||
      appscriptUrl !== record.appscript_url ||
      sheetId !== record.sheet_id ||
      themeKey !== record.theme_key ||
      contact !== record.owner_contact ||
      planAmount !== String(record.plan_amount ?? '') ||
      notes !== record.notes ||
      Number(cacheTtl) !== Number(record.cache_ttl_seconds ?? 0)
    );
  }, [record, active, expiryDate, appscriptUrl, sheetId, themeKey, contact, planAmount, notes, cacheTtl]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  /** The Worker returns the whole refreshed roster with every write, so take it. */
  const applyList = (rows: RestaurantRecord[]) => {
    const found = rows.find((r) => r.restaurant_id === restaurantId);
    if (found) setRecord(found);
  };

  const save = async () => {
    if (!record) return;
    setBusy(true);
    try {
      const { restaurant, restaurants } = await updateRestaurant({
        restaurant_id: record.restaurant_id,
        active,
        expiry_date: expiryDate,
        appscript_url: appscriptUrl.trim(),
        sheet_id: sheetId.trim(),
        theme_key: themeKey.trim() || 'demo',
        owner_contact: contact.trim(),
        plan_amount: Number(planAmount) || 0,
        notes: notes.trim(),
        cache_ttl_seconds: Number(cacheTtl) || 0,
      });
      setRecord(restaurant);
      if (restaurants) applyList(restaurants);
      showToast('Saved');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  /**
   * Ask the platform to re-fetch this restaurant's sheet right now.
   *
   * This is the only thing in the product that talks to Google Apps Script, and
   * it only happens because someone pressed this button. The result lands in KV
   * and every customer page load is served from there until the cache TTL
   * lapses or somebody presses Reload again.
   */
  const doReload = async () => {
    if (!record || reloading) return;

    // A TTL change only takes effect on write, so persist before reloading
    // rather than caching under the old expiry.
    if (dirty) {
      try {
        const { restaurant, restaurants } = await updateRestaurant({
          restaurant_id: record.restaurant_id,
          cache_ttl_seconds: Number(cacheTtl) || 0,
        });
        setRecord(restaurant);
        if (restaurants) applyList(restaurants);
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Could not save the cache setting');
        return;
      }
    }

    setReloading(true);
    try {
      const result = await reloadMenu(record.restaurant_id);
      setCache(result.cache);
      if (result.restaurant) setRecord(result.restaurant);
      if (result.restaurants) applyList(result.restaurants);
      const ttl =
        result.ttlSeconds > 0
          ? ` Kept for ${formatTtl(result.ttlSeconds)}.`
          : ' It will stay live until the next Reload.';
      showToast(`Published ${result.itemCount} item${result.itemCount === 1 ? '' : 's'}.${ttl}`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Reload failed');
    } finally {
      setReloading(false);
    }
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(publicMenuUrl(restaurantId));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked */
    }
  };

  if (loading) return <Spinner label="Loading restaurant…" />;

  if (error || !record) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <h1 className="text-2xl font-extrabold tracking-tight">Restaurant not found</h1>
        <ErrorBanner message={error || 'Unknown error'} />
        <Link href="/admin">
          <SecondaryButton>← Back to dashboard</SecondaryButton>
        </Link>
      </div>
    );
  }

  const left = daysLeft(record.expiry_date);
  const themeOptions = getThemeKeys();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{record.restaurant_name}</h1>
            <DaysBadge days={left} />
            {record.active ? <Pill tone="ok">Active</Pill> : <Pill tone="neutral">Inactive</Pill>}
          </div>
          <p className="mt-1 text-sm text-gray-500">
            /r/{record.restaurant_id} · onboarded {formatDate(record.onboarded_at)} · last menu fetch{' '}
            {record.last_checked_at ? formatDateTime(record.last_checked_at) : 'never'}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <SecondaryButton onClick={() => setShowPreview(!showPreview)}>
            {showPreview ? 'Hide preview' : 'Live preview'}
          </SecondaryButton>
          <PrimaryButton onClick={() => setQrOpen(true)}>
            <IconQr className="h-4 w-4" /> Generate QR
          </PrimaryButton>
        </div>
      </div>

      {showPreview ? (
        <div className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-gray-100">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
            <span className="font-mono text-xs text-gray-400">{publicMenuUrl(restaurantId)}</span>
            <button
              onClick={() => window.open(`/r/${record.restaurant_id}`, '_blank')}
              className="text-xs font-semibold text-forest-700 hover:underline"
            >
              Open in new tab ↗
            </button>
          </div>
          <iframe
            src={`/r/${record.restaurant_id}`}
            title="Menu preview"
            className="mx-auto block h-[640px] w-full max-w-md border-0"
          />
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          className="space-y-5 rounded-2xl bg-white p-6 shadow-card ring-1 ring-gray-100 lg:col-span-2"
        >
          <h2 className="font-bold tracking-tight">Billing &amp; status</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Subscription expiry"
              hint="Enforced by the platform on every page load. Nothing is written to the restaurant's sheet."
            >
              <input type="date" required value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Master switch" hint="Takes effect on the next customer page load.">
              <div
                className={`flex h-[42px] items-center justify-between rounded-xl border px-3.5 ${
                  active ? 'border-forest-200 bg-forest-50' : 'border-gray-200 bg-canvas'
                }`}
              >
                <span className={`text-sm font-semibold ${active ? 'text-forest-800' : 'text-gray-500'}`}>
                  {active ? 'Active' : 'Inactive'}
                </span>
                <Toggle checked={active} onChange={setActive} label="Active toggle" />
              </div>
            </Field>
          </div>

          <h2 className="pt-2 font-bold tracking-tight">Connection</h2>
          <Field
            label="Apps Script Web App URL"
            hint="Their deployed restaurant-template.gs endpoint. Only read, and only when you press Reload."
          >
            <input value={appscriptUrl} onChange={(e) => setAppscriptUrl(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" className={`${inputClass} font-mono text-xs`} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Google Sheet ID">
              <input value={sheetId} onChange={(e) => setSheetId(e.target.value)} className={`${inputClass} font-mono text-xs`} />
            </Field>
            <Field label="Theme key" hint={`Installed: ${themeOptions.join(', ')}`}>
              <Select value={themeKey} onChange={setThemeKey} options={themeOptions} placeholder="Choose a theme…" />
            </Field>
          </div>

          <h2 className="pt-2 font-bold tracking-tight">Account</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Owner contact">
              <input value={contact} onChange={(e) => setContact(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Plan amount (₹/month)">
              <input type="number" min="0" value={planAmount} onChange={(e) => setPlanAmount(e.target.value)} className={inputClass} />
            </Field>
          </div>
          <Field label="Notes">
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
          </Field>

          <div className="flex items-center gap-3 pt-1">
            <PrimaryButton type="submit" disabled={busy || !dirty}>
              {busy ? 'Saving…' : dirty ? 'Save changes' : 'No changes'}
            </PrimaryButton>
            {!dirty && <span className="text-xs text-gray-400">Changes are saved straight to the platform database.</span>}
          </div>
        </form>

        <div className="space-y-5">
          <ReloadCard
            cache={cache}
            reloading={reloading}
            ttlValue={cacheTtl}
            ttlDirty={Number(cacheTtl) !== Number(record.cache_ttl_seconds ?? 0)}
            onTtlChange={setCacheTtl}
            onReload={doReload}
          />

          <div className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-gray-100">
            <h2 className="font-bold tracking-tight">Owner setup</h2>
            <p className="mt-2 text-xs leading-relaxed text-gray-500">
              The owner&apos;s sheet has one tab, <strong className="font-semibold">Menu</strong> —
              everything else is hardcoded in the Apps Script. Ask them to set{' '}
              <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[11px]">RESTAURANT_ID</code>{' '}
              at the top of their script to the id below, then redeploy it. That unlocks their{' '}
              <em>MenuSheet → Reload menu on website</em> button so they can publish edits
              themselves.
            </p>
            <p className="mt-3 select-all break-all rounded-lg bg-canvas px-3 py-2 font-mono text-sm font-semibold text-gray-700">
              {record.restaurant_id}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-gray-100">
            <h2 className="font-bold tracking-tight">Public URL</h2>
            <p className="mt-2 break-all rounded-lg bg-canvas px-3 py-2 font-mono text-[11px] leading-relaxed text-gray-500">
              {publicMenuUrl(record.restaurant_id)}
            </p>
            <button
              onClick={copyUrl}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-dashed border-gray-300 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
            >
              {copied ? <IconCheck className="h-4 w-4 text-forest-600" /> : <IconCopy className="h-4 w-4" />}
              {copied ? 'Copied!' : 'Copy URL'}
            </button>
            {record.sheet_id ? (
              <a
                href={`https://docs.google.com/spreadsheets/d/${record.sheet_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full border border-gray-200 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
              >
                <IconSheet className="h-4 w-4" />
                Open Google Sheet
              </a>
            ) : null}
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-gray-100">
            <h2 className="font-bold tracking-tight">Details</h2>
            <dl className="mt-3 space-y-2.5 text-sm">
              <Row label="Last menu fetch" value={record.last_checked_at ? formatDateTime(record.last_checked_at) : 'never'} />
              <Row label="Expiry date" value={formatDate(record.expiry_date)} />
              <Row label="Days remaining" value={isNaN(left) ? '—' : String(left)} />
              <Row label="Theme" value={record.theme_key} mono />
            </dl>
          </div>

          <div className="rounded-2xl bg-forest-900 p-6 text-white shadow-card">
            <h2 className="font-bold tracking-tight">Changing the theme?</h2>
            <p className="mt-2 text-xs leading-relaxed text-forest-200">
              New or changed theme code is compiled at build time. After adding a theme here, run{' '}
              <code className="rounded bg-white/10 px-1 py-0.5 font-mono">npm run deploy</code>{' '}
              to make it live. Switching an existing restaurant to a theme that is already
              installed needs no deploy.
            </p>
          </div>
        </div>
      </div>

      {qrOpen ? (
        <QRCodeModal
          restaurantId={record.restaurant_id}
          restaurantName={record.restaurant_name}
          open
          onClose={() => setQrOpen(false)}
        />
      ) : null}

      <Toast message={toast} />
    </div>
  );
}

function ReloadCard({
  cache,
  reloading,
  ttlValue,
  ttlDirty,
  onTtlChange,
  onReload,
}: {
  cache: MenuCacheStatus | null;
  reloading: boolean;
  ttlValue: string;
  ttlDirty: boolean;
  onTtlChange: (v: string) => void;
  onReload: () => void;
}) {
  const neverFetched = !cache || !cache.cached;
  const expiredNow = cache?.expires_in_seconds === 0;

  return (
    <div className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-gray-100">
      <h2 className="font-bold tracking-tight">Live menu</h2>

      <p className="mt-3 rounded-xl bg-canvas px-3.5 py-3 text-xs leading-relaxed text-gray-600">
        {neverFetched ? (
          expiredNow ? (
            <>The cached menu has lapsed. Press Reload to fetch it from the sheet again.</>
          ) : (
            <>This menu has never been fetched. Press Reload to publish the sheet for the first time.</>
          )
        ) : (
          <>
            Serving <strong className="font-semibold text-gray-800">{cache?.item_count ?? 0} item(s)</strong>{' '}
            fetched {cache?.fetched_at ? formatDateTime(cache.fetched_at) : 'unknown'}.
          </>
        )}
      </p>

      {cache?.cached && cache.ttl_seconds > 0 ? (
        <p className="mt-2 text-[11px] leading-relaxed text-gray-400">
          {cache.expires_in_seconds && cache.expires_in_seconds > 0
            ? `Cache lapses in ${formatDuration(cache.expires_in_seconds)}, after which the page asks you to Reload.`
            : 'Cache has lapsed — the menu page is waiting for a Reload.'}
        </p>
      ) : cache?.cached ? (
        <p className="mt-2 text-[11px] leading-relaxed text-gray-400">
          This menu never expires on its own. Press Reload whenever the owner says they changed something.
        </p>
      ) : null}

      <div className="mt-4">
        <Field label="Cache lifetime" hint="How long the fetched menu is served before it lapses.">
          <Select
            value={ttlValue}
            onChange={onTtlChange}
            options={TTL_PRESETS.map((p) => p.label)}
            values={TTL_PRESETS.map((p) => p.value)}
            placeholder="Custom…"
          />
        </Field>
      </div>

      <button
        type="button"
        onClick={onReload}
        disabled={reloading}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-forest-700 py-2.5 text-sm font-semibold text-white transition hover:bg-forest-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <IconRefresh className={`h-4 w-4 ${reloading ? 'animate-spin' : ''}`} />
        {reloading ? 'Fetching from the sheet…' : 'Reload menu now'}
      </button>

      <p className="mt-2 text-center text-[11px] leading-relaxed text-gray-400">
        {ttlDirty ? 'Saves the new cache lifetime first, then fetches.' : 'The only thing that reads their Google Sheet.'}
      </p>
    </div>
  );
}

function formatTtl(seconds: number): string {
  return formatDuration(seconds);
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} hr`;
  return `${Math.round(seconds / 86400)} days`;
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-gray-400">{label}</dt>
      <dd className={`text-right font-semibold text-gray-700 ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  );
}
