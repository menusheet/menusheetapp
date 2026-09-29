/**
 * MenuSheet — the single Worker.
 *
 * Serves every API call in the product. It replaced two previous deployments:
 *
 *   admin-auth-worker  session auth + a proxy to the Admin Apps Script
 *   cloudflare-worker  a nightly reconciler that pushed billing state into
 *                      each restaurant's Settings tab
 *
 * Both are gone. The roster and billing state are KV records written directly
 * by the admin portal, the kill switch is evaluated from those records, and
 * menus are read from a KV cache that only an explicit reload refreshes.
 *
 * Routes
 * ------
 *   GET  /api/menu/:id       public   cached menu for a restaurant
 *   GET  /api/health         public   liveness + KV reachability
 *
 *   POST /api/login          session  email + password -> signed cookie
 *   POST /api/logout         session
 *   GET  /api/session        session  current identity for the client guard
 *
 *   GET  /api/admin/listRestaurants     session
 *   POST /api/admin/addRestaurant       session
 *   POST /api/admin/updateRestaurant    session
 *   DELETE /api/admin/deleteRestaurant  session
 *   POST /api/admin/reloadMenu          session  the only Apps Script caller
 *   GET  /api/admin/menuStatus          session
 *
 *   POST /api/reload         shared key  machine endpoint for the
 *                                        "Reload menu" button in a
 *                                        restaurant's own Google Sheet
 */

import { handleLogin, handleLogout, handleSession, sessionFrom } from './auth.js';
import { corsHeaders, isAllowedOrigin, json } from './http.js';
import { menuStatus, readMenuResponse, reloadMenu } from './reload.js';
import {
  HttpError,
  addRestaurant,
  deleteRestaurant,
  getRestaurant,
  listRestaurants,
  updateRestaurant,
} from './store.js';

const PUBLIC_CACHE_SECONDS = 60;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (request.method === 'OPTIONS') {
      // no-store matters: a cached 204 keeps a stale Access-Control-Allow-Origin
      // after ALLOWED_ORIGINS changes, which breaks the dashboard until the
      // cache expires.
      return new Response(null, {
        status: 204,
        headers: { ...corsHeaders(request, env), 'Cache-Control': 'no-store' },
      });
    }

    // ---- public, no credentials, no Origin restriction -------------------
    // The menu endpoint is what every customer's phone calls. It carries no
    // personal data and no cookie, so it is readable cross-origin and cached
    // at the edge. Everything below the admin block is not.
    if (path === '/api/health' && request.method === 'GET') {
      return json({ ok: true, service: 'menusheet-api' });
    }

    if (path.startsWith('/api/menu/') && request.method === 'GET') {
      return handlePublicMenu(request, env, path.slice('/api/menu/'.length));
    }

    // ---- everything else is same-origin-only and credentialed -------------
    if (!isAllowedOrigin(request, env)) {
      return json({ error: 'Origin not allowed.' }, 403);
    }

    const cors = corsHeaders(request, env);

    if (path === '/api/login' && request.method === 'POST') {
      return handleLogin(request, env, json, cors);
    }
    if (path === '/api/logout' && request.method === 'POST') {
      return handleLogout(request, env, json, cors);
    }
    if (path === '/api/session' && request.method === 'GET') {
      return handleSession(request, env, json, cors);
    }

    // Shared-key machine endpoint, used by the Apps Script reload button.
    // It is a *different* credential from the session cookie: the button runs
    // server-side inside Google's infrastructure, so it has no cookie to send.
    if (path === '/api/reload' && request.method === 'POST') {
      return handleMachineReload(request, env, url, cors);
    }

    if (path.startsWith('/api/admin/')) {
      const session = await sessionFrom(request, env);
      if (!session) return json({ error: 'Not authenticated.' }, 401, cors);

      const action = path.slice('/api/admin/'.length);
      try {
        return await handleAdminAction(action, request, env, cors);
      } catch (err) {
        if (err instanceof HttpError) return json({ error: err.message }, err.status, cors);
        console.error(`[menusheet] admin ${action} failed:`, err);
        return json({ error: err.message || 'Unexpected error.' }, 500, cors);
      }
    }

    return json({ error: 'Not found.' }, 404, cors);
  },
};

async function handlePublicMenu(request, env, rawId) {
  let id;
  try {
    id = decodeURIComponent(rawId);
  } catch {
    return json({ error: 'Invalid restaurant id.' }, 400);
  }
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(id)) {
    return json({ error: 'Invalid restaurant id.' }, 400);
  }

  const payload = await readMenuResponse(env, id);
  const body = JSON.stringify(payload);

  // A weak ETag over the body: a customer's phone reloading the page gets a
  // 304 instead of a full menu, and the kill switch still short-circuits.
  const etag = `W/"${body.length.toString(16)}-${hash(body)}"`;
  if (request.headers.get('If-None-Match') === etag) {
    return new Response(null, { status: 304, headers: publicHeaders(etag) });
  }

  return new Response(body, { status: 200, headers: publicHeaders(etag) });
}

function publicHeaders(etag) {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': `public, max-age=${PUBLIC_CACHE_SECONDS}, stale-while-revalidate=300`,
    ETag: etag,
    Vary: 'Accept-Encoding',
  };
}

/** FNV-1a — only needs to detect that the body changed, not be cryptographic. */
function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

async function handleMachineReload(request, env, url, cors) {
  const key = url.searchParams.get('key');
  if (!env.SHARED_SECRET || key !== env.SHARED_SECRET) {
    return json({ error: 'unauthorized' }, 401, cors);
  }

  let body = {};
  try {
    body = (await request.json()) || {};
  } catch {
    return json({ error: 'invalid JSON body' }, 400, cors);
  }

  const id = String(body.restaurant_id || '').trim();
  if (!id) return json({ error: 'restaurant_id is required' }, 400, cors);

  const record = await getRestaurant(env, id);
  if (!record) return json({ error: `restaurant not found: ${id}` }, 404, cors);

  try {
    const result = await reloadMenu(env, record);
    /* Stamp the fetch time here too, not just on the admin path. Otherwise a
       restaurant that only ever uses the button in its own sheet shows
       "never" in the dashboard's cache panel forever, which is the one place
       an operator looks to judge whether a menu is current. */
    await updateRestaurant(env, { restaurant_id: id, last_checked_at: result.fetched_at });
    return json(
      { status: 'ok', restaurant_id: id, items: result.item_count ?? result.menu.length, fetched_at: result.fetched_at, ttl_seconds: result.ttl_seconds },
      200,
      cors
    );
  } catch (err) {
    return json({ status: 'error', restaurant_id: id, error: err.message }, 502, cors);
  }
}

async function handleAdminAction(action, request, env, cors) {
  switch (action) {
    case 'listRestaurants': {
      const rows = await listRestaurants(env);
      return json({ status: 'ok', restaurants: rows }, 200, cors);
    }

    case 'addRestaurant': {
      const payload = await readPayload(request);
      const { record, restaurants } = await addRestaurant(env, payload);
      return json({ status: 'ok', restaurant: record, restaurants }, 200, cors);
    }

    case 'updateRestaurant': {
      const payload = await readPayload(request);
      const { record, restaurants } = await updateRestaurant(env, payload);
      return json({ status: 'ok', restaurant: record, restaurants }, 200, cors);
    }

    case 'deleteRestaurant': {
      const payload = await readPayload(request);
      const result = await deleteRestaurant(env, String(payload.restaurant_id || ''));
      const restaurants = await listRestaurants(env);
      return json({ status: 'ok', ...result, restaurants }, 200, cors);
    }

    case 'reloadMenu': {
      const payload = await readPayload(request);
      const id = String(payload.restaurant_id || '').trim();
      if (!id) throw new HttpError('restaurant_id is required', 400);

      const record = await getRestaurant(env, id);
      if (!record) throw new HttpError(`restaurant not found: ${id}`, 404);

      const result = await reloadMenu(env, record);

      // A reload is the one moment we learn the sheet is healthy, so stamp the
      // roster record the way the old nightly reconciler used to.
      const stamped = await updateRestaurant(env, { restaurant_id: id, last_checked_at: result.fetched_at });
      const restaurants = stamped.restaurants;
      const status = await menuStatus(env, record);

      return json(
        {
          status: 'ok',
          restaurant: stamped.record,
          restaurants,
          menu: { fetched_at: result.fetched_at, item_count: result.menu.length, ttl_seconds: result.ttl_seconds },
          cache: status,
        },
        200,
        cors
      );
    }

    case 'menuStatus': {
      const payload = await readPayload(request);
      const id = String(payload.restaurant_id || '').trim();
      if (!id) throw new HttpError('restaurant_id is required', 400);
      const record = await getRestaurant(env, id);
      if (!record) throw new HttpError(`restaurant not found: ${id}`, 404);
      return json({ status: 'ok', cache: await menuStatus(env, record) }, 200, cors);
    }

    default:
      throw new HttpError(`Unknown action: ${action}`, 404);
  }
}

async function readPayload(request) {
  if (request.method === 'GET') {
    const url = new URL(request.url);
    const out = {};
    for (const [k, v] of url.searchParams) out[k] = v;
    return out;
  }
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? body : {};
  } catch {
    return {};
  }
}
