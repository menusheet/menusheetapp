#!/usr/bin/env node

/**
 * MenuSheet — Worker smoke test.
 *
 * No test runner and no dependencies: it loads the Worker the way wrangler
 * would, hands it a stubbed fetch and an in-memory KV, and asserts the routes
 * that matter. Run it with `npm test` from the worker/ directory.
 *
 * What it covers:
 *   - the public menu endpoint resolves status from the KV roster, not from
 *     Apps Script, and never calls Apps Script
 *   - an expired subscription blocks the menu even when a good one is cached
 *   - a reload is the only thing that writes the menu cache
 *   - the reload button's shared key is enforced
 *   - admin routes reject a request with no session cookie
 */

import assert from 'node:assert/strict';

const ORIGIN = 'https://menusheetapp.pages.dev';

const RESTAURANT = {
  restaurant_id: 'thottara-kitchen',
  restaurant_name: 'Thottara Kitchen',
  owner_contact: '+91 98765 43210',
  appscript_url: 'https://script.google.com/macros/s/AAA/exec',
  sheet_id: 'sheet-123',
  theme_key: 'thottara-kitchen',
  active: true,
  expiry_date: '2099-12-31',
  plan_amount: 100,
  onboarded_at: '2026-01-01',
  last_checked_at: '',
  notes: '',
  cache_ttl_seconds: 3600,
};

const MENU_FROM_SHEET = {
  status: 'ok',
  restaurant: { name: 'Thottara Kitchen' },
  menu: [{ id: 'M1', category: 'Starters', name: 'Paneer Tikka', price: 320 }],
};

function kvStub(seed = {}) {
  const data = new Map(Object.entries(seed));
  return {
    data,
    RESTAURANTS: {
      async get(key) {
        const v = data.get(key);
        return v === undefined ? null : JSON.parse(v);
      },
      async put(key, value) {
        data.set(key, typeof value === 'string' ? value : JSON.stringify(value));
      },
      async delete(key) {
        data.delete(key);
      },
    },
    MENUS: {
      async get(key) {
        const v = data.get(key);
        return v === undefined ? null : JSON.parse(v);
      },
      async put(key, value) {
        data.set(key, typeof value === 'string' ? value : JSON.stringify(value));
      },
      async delete(key) {
        data.delete(key);
      },
    },
  };
}

function seeded(overrides = {}) {
  return kvStub({
    'index:ids': JSON.stringify([RESTAURANT.restaurant_id]),
    [`restaurant:${RESTAURANT.restaurant_id}`]: JSON.stringify({ ...RESTAURANT, ...overrides }),
  });
}

const ENV = {
  ALLOWED_ORIGINS: ORIGIN,
  ADMIN_EMAIL: 'operator@example.com',
  ADMIN_PASSWORD: 'correct horse battery staple',
  SESSION_SECRET: 'session-secret',
  SHARED_SECRET: 'shared-secret',
  DEFAULT_MENU_TTL_SECONDS: '3600',
  ...kvStub(),
};

let appsScriptCalls = 0;
globalThis.fetch = async (input) => {
  const url = String(input);
  if (url.includes('script.google.com')) {
    appsScriptCalls++;
    return new Response(JSON.stringify(MENU_FROM_SHEET), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  throw new Error(`unexpected outbound fetch: ${url}`);
};

const { default: worker } = await import('../src/index.js');

const api = (path, init = {}, env = ENV) =>
  worker.fetch(
    new Request(`https://menusheet-api.test${path}`, {
      ...init,
      headers: { Origin: ORIGIN, ...(init.headers || {}) },
    }),
    env
  );

const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (err) {
    results.push({ name, ok: false, err });
  }
}

const seedEnv = (overrides) => {
  const stub = seeded(overrides);
  return { ...ENV, RESTAURANTS: stub.RESTAURANTS, MENUS: stub.MENUS, data: stub.data };
};

await test('public menu for an unknown restaurant is inactive, not an error', async () => {
  const res = await api('/api/menu/does-not-exist');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'inactive');
  assert.equal(body.reason, 'unknown_restaurant');
});

await test('serving a cached menu never calls Apps Script', async () => {
  const env = seedEnv();
  await env.MENUS.put(
    'menu:thottara-kitchen',
    JSON.stringify({ status: 'ok', restaurant: { name: 'x' }, menu: MENU_FROM_SHEET.menu, fetched_at: new Date().toISOString() })
  );
  const before = appsScriptCalls;
  const res = await api('/api/menu/thottara-kitchen', {}, env);
  const body = await res.json();
  assert.equal(body.status, 'ok');
  assert.equal(body.item_count, 1);
  assert.equal(appsScriptCalls, before, 'Apps Script must not be hit on a read');
});

await test('a deactivated restaurant is blocked even with a good cache entry', async () => {
  const env = seedEnv({ active: false });
  await env.MENUS.put(
    'menu:thottara-kitchen',
    JSON.stringify({ status: 'ok', menu: MENU_FROM_SHEET.menu, fetched_at: new Date().toISOString() })
  );
  const body = await (await api('/api/menu/thottara-kitchen', {}, env)).json();
  assert.equal(body.status, 'inactive');
});

await test('an expired subscription blocks the menu', async () => {
  const env = seedEnv({ expiry_date: '2000-01-01' });
  const body = await (await api('/api/menu/thottara-kitchen', {}, env)).json();
  assert.equal(body.status, 'expired');
});

await test('an empty cache reports loading, never a false expiry', async () => {
  const env = seedEnv();
  const body = await (await api('/api/menu/thottara-kitchen', {}, env)).json();
  assert.equal(body.status, 'loading');
  assert.equal(body.reason, 'awaiting_reload');
});

await test('admin routes reject an unauthenticated caller', async () => {
  const res = await api('/api/admin/listRestaurants');
  assert.equal(res.status, 401);
});

await test('a foreign Origin is refused', async () => {
  const res = await worker.fetch(
    new Request('https://menusheet-api.test/api/session', { headers: { Origin: 'https://evil.example' } }),
    ENV
  );
  assert.equal(res.status, 403);
});

await test('the reload button needs the shared key', async () => {
  const res = await api('/api/reload', {
    method: 'POST',
    body: JSON.stringify({ restaurant_id: RESTAURANT.restaurant_id }),
  });
  assert.equal(res.status, 401);
});

await test('the reload button with the right key fetches Apps Script and fills the cache', async () => {
  const env = seedEnv();
  const before = appsScriptCalls;
  const res = await worker.fetch(
    new Request('https://menusheet-api.test/api/reload?key=shared-secret', {
      method: 'POST',
      body: JSON.stringify({ restaurant_id: RESTAURANT.restaurant_id }),
    }),
    env
  );
  assert.equal(res.status, 200);
  assert.equal(appsScriptCalls, before + 1, 'reload must be the only Apps Script caller');

  const cached = await env.MENUS.get('menu:thottara-kitchen');
  assert.equal(cached.menu.length, 1);
  assert.ok(cached.fetched_at);
});

await test('reloadMenu is refused without a session', async () => {
  const res = await api('/api/admin/reloadMenu', {
    method: 'POST',
    body: JSON.stringify({ restaurant_id: RESTAURANT.restaurant_id }),
  });
  assert.equal(res.status, 401);
});

await test('login then reloadMenu works end to end', async () => {
  const env = seedEnv();
  const login = await worker.fetch(
    new Request('https://menusheet-api.test/api/login', {
      method: 'POST',
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'operator@example.com', password: 'correct horse battery staple' }),
    }),
    env
  );
  assert.equal(login.status, 200);
  const cookie = login.headers.get('Set-Cookie').split(';')[0];

  const res = await worker.fetch(
    new Request('https://menusheet-api.test/api/admin/reloadMenu', {
      method: 'POST',
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ restaurant_id: RESTAURANT.restaurant_id }),
    }),
    env
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'ok');
  assert.equal(body.menu.item_count, 1);
  assert.equal(body.cache.cached, true);
  assert.ok(body.restaurant.last_checked_at, 'reload should stamp last_checked_at');
});

await test('a bearer token authorises admin calls with no cookie at all', async () => {
  // This is the path the dashboard actually uses. The app is a static export on
  // pages.dev and the Worker is on workers.dev, so the session cookie is
  // third-party and gets dropped by Safari and by any browser with 3P cookies
  // off. The token has to work on its own.
  const env = seedEnv();
  const login = await worker.fetch(
    new Request('https://menusheet-api.test/api/login', {
      method: 'POST',
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'operator@example.com', password: 'correct horse battery staple' }),
    }),
    env
  );
  assert.equal(login.status, 200);
  const { token } = await login.json();
  assert.ok(token, 'login should hand back a token in the body');

  const session = await worker.fetch(
    new Request('https://menusheet-api.test/api/session', {
      headers: { Origin: ORIGIN, Authorization: `Bearer ${token}` },
    }),
    env
  );
  assert.deepEqual(await session.json(), { email: 'operator@example.com' });

  const res = await worker.fetch(
    new Request('https://menusheet-api.test/api/admin/listRestaurants', {
      headers: { Origin: ORIGIN, Authorization: `Bearer ${token}` },
    }),
    env
  );
  assert.equal(res.status, 200);
  assert.equal((await res.json()).restaurants.length, 1);
});

await test('a garbage or missing bearer token is refused', async () => {
  const env = seedEnv();
  for (const headers of [
    { Origin: ORIGIN },
    { Origin: ORIGIN, Authorization: 'Bearer not-a-real-token' },
    { Origin: ORIGIN, Authorization: 'Basic dXNlcjpwYXNz' },
  ]) {
    const res = await worker.fetch(
      new Request('https://menusheet-api.test/api/admin/listRestaurants', { headers }),
      env
    );
    assert.equal(res.status, 401);
  }
});

await test('CORS preflight allows the Authorization header', async () => {
  const res = await worker.fetch(
    new Request('https://menusheet-api.test/api/admin/listRestaurants', {
      method: 'OPTIONS',
      headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization' },
    }),
    ENV
  );
  assert.equal(res.status, 204);
  assert.match(res.headers.get('Access-Control-Allow-Headers') || '', /Authorization/i);
});

await test('addRestaurant returns the full list so the dashboard never re-reads', async () => {
  const env = seedEnv();
  const login = await worker.fetch(
    new Request('https://menusheet-api.test/api/login', {
      method: 'POST',
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'operator@example.com', password: 'correct horse battery staple' }),
    }),
    env
  );
  const cookie = login.headers.get('Set-Cookie').split(';')[0];

  const res = await worker.fetch(
    new Request('https://menusheet-api.test/api/admin/addRestaurant', {
      method: 'POST',
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ restaurant_name: 'Cafe Mocha' }),
    }),
    env
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.restaurant.restaurant_id, 'cafe-mocha');
  assert.equal(body.restaurants.length, 2);
  assert.ok(body.restaurant.expiry_date, 'new restaurants get a default expiry');
});

await test('a reload always asks Apps Script to bypass its own cache', async () => {
  /* The script caches its built payload in CacheService. Without fresh=1 a
     reload pressed right after the owner edits their sheet would return the
     pre-edit menu and report success. */
  let lastUrl = '';
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    lastUrl = String(input);
    return new Response(JSON.stringify(MENU_FROM_SHEET), {
      headers: { 'Content-Type': 'application/json' },
    });
  };
  try {
    const env = seedEnv();
    const res = await worker.fetch(
      new Request('https://menusheet-api.test/api/reload?key=shared-secret', {
        method: 'POST',
        body: JSON.stringify({ restaurant_id: RESTAURANT.restaurant_id }),
      }),
      env
    );
    assert.equal(res.status, 200);
    assert.ok(lastUrl.includes('action=getMenu'), 'asks for the menu');
    assert.ok(lastUrl.includes('fresh=1'), `bypasses the script cache, got ${lastUrl}`);
  } finally {
    globalThis.fetch = realFetch;
  }
});

await test('a sheet-triggered reload stamps last_checked_at too', async () => {
  /* Otherwise a restaurant that only ever uses its own sheet button looks like
     it has never been fetched in the dashboard's cache panel. */
  const env = seedEnv();
  const res = await worker.fetch(
    new Request('https://menusheet-api.test/api/reload?key=shared-secret', {
      method: 'POST',
      body: JSON.stringify({ restaurant_id: RESTAURANT.restaurant_id }),
    }),
    env
  );
  assert.equal(res.status, 200);
  const record = await env.RESTAURANTS.get(`restaurant:${RESTAURANT.restaurant_id}`);
  assert.ok(record.last_checked_at, 'the sheet button should stamp last_checked_at');
});

await test('a record with no cache TTL gets the platform default, not "never"', async () => {
  /* 0 means "never expires". Defaulting a missing value to 0 would silently make
     every restaurant migrated from the old Admin Sheet permanent. */
  const env = seedEnv({ cache_ttl_seconds: undefined });
  const record = await env.RESTAURANTS.get(`restaurant:${RESTAURANT.restaurant_id}`);
  delete record.cache_ttl_seconds;

  const login = await worker.fetch(
    new Request('https://menusheet-api.test/api/login', {
      method: 'POST',
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'operator@example.com', password: 'correct horse battery staple' }),
    }),
    env
  );
  const cookie = login.headers.get('Set-Cookie').split(';')[0];

  const res = await worker.fetch(
    new Request('https://menusheet-api.test/api/admin/listRestaurants', {
      headers: { Origin: ORIGIN, Cookie: cookie },
    }),
    env
  );
  const body = await res.json();
  assert.equal(
    body.restaurants[0].cache_ttl_seconds,
    3600,
    'a missing TTL should resolve to DEFAULT_MENU_TTL_SECONDS'
  );
});

await test('an explicit cache TTL of 0 really does mean "never expires"', async () => {
  const env = seedEnv({ cache_ttl_seconds: 0 });
  const res = await api('/api/admin/menuStatus', { method: 'POST' }, env);
  assert.equal(res.status, 401, 'needs a session, we only care about the store below');

  const login = await worker.fetch(
    new Request('https://menusheet-api.test/api/login', {
      method: 'POST',
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'operator@example.com', password: 'correct horse battery staple' }),
    }),
    env
  );
  const cookie = login.headers.get('Set-Cookie').split(';')[0];

  const status = await worker.fetch(
    new Request('https://menusheet-api.test/api/admin/menuStatus', {
      method: 'POST',
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ restaurant_id: RESTAURANT.restaurant_id }),
    }),
    env
  );
  const body = await status.json();
  assert.equal(body.cache.ttl_seconds, 0, '0 stays 0, it is a deliberate choice');
  assert.equal(body.cache.expires_in_seconds, null, 'a permanent cache has no expiry');
});

let failed = 0;
for (const r of results) {
  if (r.ok) {
    console.log(`  PASS  ${r.name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${r.name}`);
    console.log(`        ${r.err.message}`);
  }
}
console.log(`\n${results.length - failed}/${results.length} passing`);
process.exit(failed ? 1 : 0);
