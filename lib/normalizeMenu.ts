import { parsePrice } from './price';
import type { MenuItem, MenuPayload } from './types';

/* Shared by the client (live getMenu fetch) and the server (build-time
   snapshots), so a snapshot and a live payload always look the same to themes
   regardless of whether the source used snake_case or camelCase keys. */

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
  if (!['ok', 'inactive', 'expired'].includes(status)) return null;
  if (status !== 'ok') return { status: status as MenuPayload['status'] };
  const rawMenu = Array.isArray((data as { menu?: unknown }).menu)
    ? ((data as { menu: unknown[] }).menu as Record<string, unknown>[])
    : [];
  const rawRestaurant = ((data as { restaurant?: Record<string, unknown> }).restaurant || {}) as Record<string, unknown>;
  return {
    status: 'ok',
    restaurant: {
      name: String(rawRestaurant.name ?? ''),
      tagline: rawRestaurant.tagline ? String(rawRestaurant.tagline) : undefined,
    },
    menu: rawMenu.map(normalizeMenuItem),
  };
}