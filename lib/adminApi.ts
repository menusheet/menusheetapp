import type { RestaurantRecord } from '@/lib/types';

/**
 * All privileged calls go through the auth Worker, which holds SHARED_SECRET
 * and injects it upstream.
 *
 * The dashboard previously called the Apps Script directly with
 * NEXT_PUBLIC_SHARED_SECRET inlined into the client bundle — readable by anyone
 * who opened devtools, which made the write API callable while logged out.
 */
const AUTH_WORKER = (process.env.NEXT_PUBLIC_ADMIN_AUTH_WORKER_URL || '').replace(/\/+$/, '');

export function adminApiConfigured(): boolean {
  return Boolean(AUTH_WORKER);
}

function requireConfig() {
  if (!adminApiConfigured()) {
    throw new Error(
      'Admin API is not configured. Set NEXT_PUBLIC_ADMIN_AUTH_WORKER_URL in .env.local and rebuild.'
    );
  }
}

async function call(action: string, payload?: Record<string, unknown>): Promise<Record<string, unknown>> {
  requireConfig();
  const res = await fetch(`${AUTH_WORKER}/api/admin/${encodeURIComponent(action)}`, {
    method: payload ? 'POST' : 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: payload ? { 'Content-Type': 'application/json' } : undefined,
    body: payload ? JSON.stringify({ payload }) : undefined,
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (res.status === 401) throw new Error('Your session expired. Sign in again.');
  if (data.error) throw new Error(String(data.error));
  return data;
}

function toBool(v: unknown): boolean {
  return v === true || String(v ?? '').trim().toUpperCase() === 'TRUE';
}

function normalizeRow(raw: Record<string, unknown>): RestaurantRecord {
  return {
    restaurant_id: String(raw.restaurant_id ?? '').trim(),
    restaurant_name: String(raw.restaurant_name ?? '').trim(),
    owner_contact: String(raw.owner_contact ?? '').trim(),
    appscript_url: String(raw.appscript_url ?? '').trim(),
    sheet_id: String(raw.sheet_id ?? '').trim(),
    theme_key: String(raw.theme_key ?? 'demo').trim(),
    active: toBool(raw.active),
    expiry_date: String(raw.expiry_date ?? '').slice(0, 10),
    plan_amount: (raw.plan_amount ?? '') as string | number,
    onboarded_at: String(raw.onboarded_at ?? ''),
    last_checked_at: String(raw.last_checked_at ?? ''),
    notes: String(raw.notes ?? ''),
  };
}

function normalizeRestaurantOut(r: RestaurantRecord | null): RestaurantRecord | null {
  return r ? normalizeRow(r as unknown as Record<string, unknown>) : null;
}

export async function listRestaurants(): Promise<RestaurantRecord[]> {
  const data = await call('listRestaurants');
  const rows = Array.isArray(data.restaurants) ? (data.restaurants as Record<string, unknown>[]) : [];
  return rows.filter((r) => r.restaurant_id).map(normalizeRow);
}

export async function addRestaurant(
  fields: Partial<RestaurantRecord>
): Promise<RestaurantRecord | null> {
  const data = await call('addRestaurant', fields as Record<string, unknown>);
  return normalizeRestaurantOut((data.restaurant as RestaurantRecord) ?? null);
}

export async function updateRestaurant(
  fields: Partial<RestaurantRecord>
): Promise<RestaurantRecord | null> {
  const data = await call('updateRestaurant', fields as Record<string, unknown>);
  return normalizeRestaurantOut((data.restaurant as RestaurantRecord) ?? null);
}

export async function pushSettingsToRestaurant(
  appscriptUrl: string,
  settings: { menu_active?: boolean; expiry_date?: string; restaurant_name?: string }
): Promise<void> {
  if (!appscriptUrl) return;
  const payload: Record<string, unknown> = {};
  if (settings.menu_active !== undefined) payload.menu_active = settings.menu_active ? 'TRUE' : 'FALSE';
  if (settings.expiry_date !== undefined) payload.expiry_date = settings.expiry_date;
  if (settings.restaurant_name !== undefined) payload.restaurant_name = settings.restaurant_name;
  if (Object.keys(payload).length === 0) return;

  // Each restaurant runs its own Apps Script with the same SHARED_SECRET. The
  // auth Worker proxies to a fixed Admin URL, so this call still needs the
  // secret. It goes through the reconciler's authenticated endpoint instead.
  const res = await fetch(`${AUTH_WORKER}/api/admin/updateSettings`, {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appscript_url: appscriptUrl, payload }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.status === 401) throw new Error('Your session expired. Sign in again.');
  if (data.error) throw new Error(String(data.error));
}
