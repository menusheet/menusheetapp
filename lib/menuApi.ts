import type { MenuPayload } from '@/lib/types';

/**
 * The public menu API.
 *
 * Every customer page load used to hit the restaurant's own Google Apps Script
 * directly, cross-origin, with a 3-attempt retry budget to ride out Apps
 * Script's cold starts. It now hits the platform's own Worker, which answers
 * from a KV cache, so there is nothing to ride out: a cold edge read is still
 * sub-10ms and the retry loop has been kept only as insurance against a
 * transient network blip.
 *
 * The Worker never calls Apps Script on a read. It serves whatever was last
 * written there by an explicit reload, and applies the subscription kill switch
 * itself, so deactivating a customer takes effect immediately instead of
 * waiting for a nightly job.
 */

const API = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '');

export function menuApiConfigured(): boolean {
  return Boolean(API);
}

export function menuEndpoint(restaurantId: string): string {
  return `${API}/api/menu/${encodeURIComponent(restaurantId)}`;
}

export async function fetchMenuPayload(
  restaurantId: string,
  normalize: (data: Record<string, unknown>) => MenuPayload | null,
  timeoutMs = 12000,
  bypassHttpCache = false
): Promise<MenuPayload | null> {
  if (!menuApiConfigured()) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(menuEndpoint(restaurantId), {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      /* The Worker sends max-age=60, stale-while-revalidate=300, so the default
         cache mode replays the previous response from the browser's HTTP cache
         instead of asking again. Clearing localStorage is not enough for that
         layer — the Refresh pill has to opt out of it explicitly. */
      cache: bypassHttpCache ? 'no-store' : 'default',
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!data) return null;
    return normalize(data);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
