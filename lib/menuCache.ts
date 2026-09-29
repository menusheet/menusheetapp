import type { MenuPayload } from './types';

const PREFIX = 'menusheet_menu_';

const ttlMinutes = Number(process.env.NEXT_PUBLIC_MENU_CACHE_TTL_MINUTES);
const DEFAULT_TTL_MINUTES = Number.isFinite(ttlMinutes) && ttlMinutes > 0 ? ttlMinutes : 5;
/* Inactive/expired are kill-switches, so they refresh faster than live menus. */
const SHORT_TTL_MINUTES = 15;

interface CacheEntry {
  payload: MenuPayload;
  timestamp: number;
}

export interface CachedMenu extends CacheEntry {
  fresh: boolean;
}

function ttlFor(payload: MenuPayload): number {
  if (payload.status === 'ok') return DEFAULT_TTL_MINUTES * 60 * 1000;
  return SHORT_TTL_MINUTES * 60 * 1000;
}

function isValidPayload(value: unknown): value is MenuPayload {
  if (!value || typeof value !== 'object') return false;
  const v = value as MenuPayload;
  if (!['ok', 'inactive', 'expired'].includes(v.status)) return false;
  if (v.menu !== undefined && !Array.isArray(v.menu)) return false;
  return true;
}

export function readCache(restaurantId: string): CachedMenu | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`${PREFIX}${restaurantId}`);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (!entry || typeof entry.timestamp !== 'number' || !isValidPayload(entry.payload)) {
      window.localStorage.removeItem(`${PREFIX}${restaurantId}`);
      return null;
    }
    const fresh = Date.now() - entry.timestamp < ttlFor(entry.payload);
    return { ...entry, fresh };
  } catch {
    return null;
  }
}

export function writeCache(restaurantId: string, payload: MenuPayload): void {
  if (typeof window === 'undefined') return;
  try {
    const entry: CacheEntry = { payload, timestamp: Date.now() };
    window.localStorage.setItem(`${PREFIX}${restaurantId}`, JSON.stringify(entry));
  } catch {
    /* storage full or blocked — caching is best-effort */
  }
}

export function clearCache(restaurantId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(`${PREFIX}${restaurantId}`);
  } catch {
    /* noop */
  }
}
