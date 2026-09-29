/**
 * MenuSheet — menu cache, and the one place Apps Script is ever called.
 *
 * The direction of travel is deliberately one-way and pull-based:
 *
 *   Apps Script  --(reload only)-->  KV  --(every page load)-->  browser
 *
 * There is no cron, no revalidation on read, and no speculative fetch. A cached
 * menu is served until its KV expirationTtl elapses, and the only thing that
 * writes a fresh entry is an explicit reload triggered by an operator in the
 * admin portal or by the "MenuSheet > Reload menu" button in the restaurant's
 * own Google Sheet.
 *
 * The kill switch (inactive / expired) is evaluated from the KV roster via
 * store.publicStatus() and never from the restaurant's Apps Script, so a
 * subscription lapse takes effect the moment the operator saves it — no sheet
 * round-trip, no propagation delay.
 */

import { cacheTtlSeconds, getRestaurant, publicStatus } from './store.js';

function menuKey(id) {
  return `menu:${id}`;
}

/** Pull a fresh menu out of a restaurant's Apps Script and write it to KV. */
export async function reloadMenu(env, record) {
  if (!record.appscript_url) {
    throw new Error('This restaurant has no Apps Script URL saved. Add one before reloading.');
  }

  const url = new URL(record.appscript_url);
  url.searchParams.set('action', 'getMenu');
  /* Always bypass the script's own CacheService. Without this a reload pressed
     seconds after the owner edited their sheet would happily re-cache and return
     the pre-edit menu, and the operator would see "published" for a menu that is
     not what the customer will see. */
  url.searchParams.set('fresh', '1');

  const res = await fetch(url.toString(), { redirect: 'follow' });
  const text = await res.text();

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    // Apps Script answers with an HTML page when the script throws or the
    // deployment is not public. Turn that into something an operator can act on.
    const reason = !/^https:\/\/script\.google\.com\//.test(record.appscript_url)
      ? 'appscript_url is not a Google Apps Script /exec URL.'
      : /Sign in|accounts\.google\.com\/ServiceLogin/i.test(text)
        ? 'Apps Script deployment is not public (Access: Anyone).'
        : 'Apps Script returned a non-JSON page — the script may be broken or not redeployed.';
    const detail = (text.match(/Error:\s*([^<]+)/) || [])[1];
    throw new Error([reason, detail ? detail.trim() : ''].filter(Boolean).join(' '));
  }

  if (payload.error) throw new Error(String(payload.error));

  // getMenu is documented to always answer with status "ok" and the full menu.
  // If an older deployment is still enforcing its own kill switch, honour what
  // it returned rather than caching a menu the owner meant to hide.
  const status = ['ok', 'inactive', 'expired'].includes(payload.status) ? payload.status : 'ok';
  const entry = {
    status,
    restaurant: payload.restaurant || {},
    menu: Array.isArray(payload.menu) ? payload.menu : [],
    fetched_at: new Date().toISOString(),
  };

  const ttl = cacheTtlSeconds(record, env);
  await env.MENUS.put(
    menuKey(record.restaurant_id),
    JSON.stringify(entry),
    ttl > 0 ? { expirationTtl: ttl } : undefined
  );

  return { ...entry, ttl_seconds: ttl };
}

async function readMenuEntry(env, id) {
  try {
    return await env.MENUS.get(menuKey(id), 'json');
  } catch {
    return null;
  }
}

/**
 * Serve the public menu payload.
 *
 * The response merges the cached menu with the live roster fields the page
 * needs, so the browser makes exactly one request per page load.
 */
export async function readMenuResponse(env, id) {
  const record = await getRestaurant(env, id);
  const status = publicStatus(record);

  // Fields the page always needs, whatever the status is. A brand new page has
  // to know which theme to render before it knows whether the menu is live.
  const chrome = {
    theme_key: record?.theme_key || 'demo',
    restaurant_name: record?.restaurant_name || '',
  };

  if (!record) {
    // Unknown id. Treated exactly like a deactivated restaurant so a mistyped
    // QR code renders the same "menu not available" screen rather than an error.
    return { status: 'inactive', reason: 'unknown_restaurant', ...chrome, menu: [], item_count: 0, fetched_at: null };
  }

  if (status !== 'ok') {
    return {
      status,
      reason: status === 'expired' ? 'subscription_expired' : 'deactivated',
      ...chrome,
      menu: [],
      item_count: 0,
      fetched_at: null,
    };
  }

  const entry = await readMenuEntry(env, id);

  if (!entry) {
    // The TTL elapsed and nobody pressed Reload. "loading" keeps the page on
    // the spinner with its Refresh pill rather than falsely claiming the
    // subscription lapsed.
    return { status: 'loading', reason: 'awaiting_reload', ...chrome, menu: [], item_count: 0, fetched_at: null };
  }

  const menu = Array.isArray(entry.menu) ? entry.menu : [];
  return {
    status: ['ok', 'inactive', 'expired'].includes(entry.status) ? entry.status : 'ok',
    ...chrome,
    restaurant: entry.restaurant || {},
    menu,
    item_count: menu.length,
    fetched_at: entry.fetched_at || null,
  };
}

/** Admin-facing view of what is currently cached, for the reload button label. */
export async function menuStatus(env, record) {
  const entry = await readMenuEntry(env, record.restaurant_id);
  const ttl = cacheTtlSeconds(record, env);
  const age = entry?.fetched_at ? Math.round((Date.now() - Date.parse(entry.fetched_at)) / 1000) : null;
  return {
    restaurant_id: record.restaurant_id,
    cached: Boolean(entry),
    fetched_at: entry?.fetched_at || null,
    age_seconds: age,
    item_count: Array.isArray(entry?.menu) ? entry.menu.length : 0,
    cached_status: entry?.status || null,
    ttl_seconds: ttl,
    expires_in_seconds: ttl > 0 && age !== null ? Math.max(0, ttl - age) : null,
  };
}
