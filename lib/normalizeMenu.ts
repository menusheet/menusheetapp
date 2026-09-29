import { parsePrice } from './price';
import type { MenuItem, MenuPayload } from './types';

/* Shared by the client (live platform API fetch) and the server (build-time
   snapshots), so a snapshot and a live payload always look the same to themes
   regardless of whether the source used snake_case or camelCase keys.

   'loading' is accepted because that is what the platform answers with when a
   menu's cache has lapsed and nobody has pressed Reload yet. The page stays on
   its spinner and offers the Refresh pill rather than claiming the
   subscription lapsed. */

function bool(v: unknown, fallback: boolean): boolean {
  return v === true || String(v).trim().toUpperCase() === 'TRUE'
    ? true
    : v === false || String(v).trim().toUpperCase() === 'FALSE'
      ? false
      : fallback;
}

function num(v: unknown): number {
  const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function str(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim();
}

export function normalizeMenuItem(raw: Record<string, unknown>): MenuItem {
  const structuredVariants = Array.isArray(raw.priceVariants ?? raw.price_variants)
    ? (raw.priceVariants ?? raw.price_variants) as unknown[]
    : null;
  const price = parsePrice(structuredVariants && structuredVariants.length ? structuredVariants : raw.price);
  return {
    id: str(raw.id) || Math.random().toString(36).slice(2),
    category: str(raw.category) || 'Menu',
    name: str(raw.name),
    description: str(raw.description),
    price: price.base,
    priceVariants: price.variants,
    imageUrl: str(raw.image_url ?? raw.imageUrl),
    isVeg: bool(raw.is_veg ?? raw.isVeg, true),
    isAvailable: bool(raw.is_available ?? raw.isAvailable, true),
    sortOrder: num(raw.sort_order ?? raw.sortOrder),
  };
}

export function normalizeMenuPayload(data: Record<string, unknown>): MenuPayload | null {
  if (!data || typeof data !== 'object') return null;
  const status = String((data as { status?: unknown }).status || '');
  if (!['ok', 'inactive', 'expired', 'loading'].includes(status)) return null;

  const rawRestaurant = ((data as { restaurant?: Record<string, unknown> }).restaurant || {}) as Record<string, unknown>;
  const chrome = {
    theme_key: str((data as { theme_key?: unknown }).theme_key) || undefined,
    restaurant_name: str((data as { restaurant_name?: unknown }).restaurant_name) || undefined,
    reason: str((data as { reason?: unknown }).reason) || undefined,
    fetched_at: (data as { fetched_at?: unknown }).fetched_at ? String((data as { fetched_at: unknown }).fetched_at) : null,
  };

  if (status !== 'ok') return { status: status as MenuPayload['status'], ...chrome };

  const rawMenu = Array.isArray((data as { menu?: unknown }).menu)
    ? ((data as { menu: unknown[] }).menu as Record<string, unknown>[])
    : [];
  return {
    status: 'ok',
    restaurant: {
      name: String(rawRestaurant.name ?? ''),
      tagline: rawRestaurant.tagline ? String(rawRestaurant.tagline) : undefined,
    },
    menu: rawMenu.map(normalizeMenuItem),
    ...chrome,
  };
}