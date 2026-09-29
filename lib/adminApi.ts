import type { MenuCacheStatus, RestaurantRecord } from '@/lib/types';
import { authHeaders } from '@/lib/auth';

/**
 * All privileged admin calls go through the platform Worker, which holds the
 * session and is the only thing that can read or write the KV roster.
 *
 * The dashboard previously called the Admin Apps Script directly with
 * NEXT_PUBLIC_SHARED_SECRET inlined into the client bundle — readable by anyone
 * who opened devtools, which made the write API callable while logged out.
 * The roster is now KV, so there is no upstream to proxy and no secret to leak.
 *
 * Every mutating call comes back with the full refreshed `restaurants` list as
 * well as the record it touched. The dashboard writes that straight into state
 * instead of re-reading, because KV is eventually consistent and a re-read can
 * miss a write for up to a minute.
 */
const API = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '');

export function adminApiConfigured(): boolean {
  return Boolean(API);
}

function requireConfig() {
  if (!adminApiConfigured()) {
    throw new Error(
      'Admin API is not configured. Set NEXT_PUBLIC_API_URL in .env.local and rebuild.'
    );
  }
}

async function call(
  action: string,
  payload?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  requireConfig();
  const res = await fetch(`${API}/api/admin/${encodeURIComponent(action)}`, {
    method: payload ? 'POST' : 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      ...authHeaders(),
      ...(payload ? { 'Content-Type': 'application/json' } : {}),
    },
    body: payload ? JSON.stringify(payload) : undefined,
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
  const ttl = Number(raw.cache_ttl_seconds);
  return {
    restaurant_id: String(raw.restaurant_id ?? '').trim(),
    restaurant_name: String(raw.restaurant_name ?? '').trim(),
    owner_contact: String(raw.owner_contact ?? '').trim(),
    appscript_url: String(raw.appscript_url ?? '').trim(),
    sheet_id: String(raw.sheet_id ?? '').trim(),
    theme_key: String(raw.theme_key ?? 'demo').trim() || 'demo',
    active: toBool(raw.active),
    expiry_date: String(raw.expiry_date ?? '').slice(0, 10),
    plan_amount: (raw.plan_amount ?? '') as string | number,
    onboarded_at: String(raw.onboarded_at ?? ''),
    last_checked_at: String(raw.last_checked_at ?? ''),
    notes: String(raw.notes ?? ''),
    cache_ttl_seconds: isNaN(ttl) ? 0 : ttl,
  };
}

/**
 * The list the Worker returns alongside a write. Preferred over a fresh
 * read so an operator's own edit is never overwritten by a stale KV read.
 */
function rowsFrom(data: Record<string, unknown>): RestaurantRecord[] | null {
  if (!Array.isArray(data.restaurants)) return null;
  return (data.restaurants as Record<string, unknown>[]).map(normalizeRow);
}

export interface WriteResult {
  restaurant: RestaurantRecord;
  restaurants: RestaurantRecord[] | null;
}

export async function listRestaurants(): Promise<RestaurantRecord[]> {
  const data = await call('listRestaurants');
  return rowsFrom(data) ?? [];
}

export async function addRestaurant(
  fields: Partial<RestaurantRecord>
): Promise<WriteResult> {
  const data = await call('addRestaurant', fields as Record<string, unknown>);
  return {
    restaurant: normalizeRow((data.restaurant as Record<string, unknown>) ?? {}),
    restaurants: rowsFrom(data),
  };
}

export async function updateRestaurant(
  fields: Partial<RestaurantRecord>
): Promise<WriteResult> {
  const data = await call('updateRestaurant', fields as Record<string, unknown>);
  return {
    restaurant: normalizeRow((data.restaurant as Record<string, unknown>) ?? {}),
    restaurants: rowsFrom(data),
  };
}

export async function deleteRestaurant(
  restaurantId: string
): Promise<WriteResult & { restaurants: RestaurantRecord[] }> {
  const data = await call('deleteRestaurant', { restaurant_id: restaurantId });
  return {
    restaurant: { restaurant_id: restaurantId } as RestaurantRecord,
    restaurants: rowsFrom(data) ?? [],
  };
}

export interface ReloadResult {
  restaurant: RestaurantRecord | null;
  restaurants: RestaurantRecord[] | null;
  cache: MenuCacheStatus;
  fetchedAt: string | null;
  itemCount: number;
  ttlSeconds: number;
}

/**
 * The only call that reaches out to a restaurant's Google Sheet.
 *
 * Everything else the Worker serves is already in KV. This one fetches the
 * sheet, normalises it, and writes it back with the restaurant's own cache TTL.
 */
export async function reloadMenu(restaurantId: string): Promise<ReloadResult> {
  const data = await call('reloadMenu', { restaurant_id: restaurantId });
  const menu = (data.menu || {}) as Record<string, unknown>;
  return {
    restaurant: data.restaurant ? normalizeRow(data.restaurant as Record<string, unknown>) : null,
    restaurants: rowsFrom(data),
    cache: normalizeCache(data.cache),
    fetchedAt: (menu.fetched_at as string) ?? null,
    itemCount: Number(menu.item_count ?? 0),
    ttlSeconds: Number(menu.ttl_seconds ?? 0),
  };
}

export async function menuStatus(restaurantId: string): Promise<MenuCacheStatus> {
  const data = await call('menuStatus', { restaurant_id: restaurantId });
  return normalizeCache(data.cache);
}

function normalizeCache(raw: unknown): MenuCacheStatus {
  const c = (raw || {}) as Record<string, unknown>;
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    restaurant_id: String(c.restaurant_id ?? ''),
    cached: c.cached === true,
    fetched_at: (c.fetched_at as string) || null,
    age_seconds: num(c.age_seconds),
    item_count: Number(c.item_count ?? 0),
    cached_status: (c.cached_status as string) || null,
    ttl_seconds: Number(c.ttl_seconds ?? 0),
    expires_in_seconds: num(c.expires_in_seconds),
  };
}
