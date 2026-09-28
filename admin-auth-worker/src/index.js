/**
 * MenuSheet — admin auth + privileged API Worker.
 *
 * Replaces Supabase Auth. The dashboard is a fully static Next.js export, so
 * there is no server runtime to host sessions. This Worker provides it:
 *
 *   POST /api/login          email + password -> signed session cookie
 *   POST /api/logout         clears the session cookie
 *   GET  /api/session        current identity, for the client auth guard
 *   ANY  /api/admin/*        authenticated proxy to the Admin Apps Script
 *
 * Two secrets never leave this Worker:
 *   - SHARED_SECRET gates every Apps Script write. It used to be inlined into
 *     the public JS bundle as NEXT_PUBLIC_SHARED_SECRET, which meant anyone
 *     could read it from devtools and call the write API directly.
 *   - ADMIN_PASSWORD gates sign-in.
 *
 * Credentials live in ADMIN_EMAIL / ADMIN_PASSWORD. Set them with
 * `wrangler secret put` rather than [vars] so they stay out of git.
 */

const SESSION_COOKIE = 'menusheet_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12h
const LOGIN_WINDOW_SECONDS = 60 * 10;
const LOGIN_MAX_ATTEMPTS = 8;

/** In-memory only. Resets on isolate restart — a backstop, not real rate limiting. */
const loginAttempts = new Map();

const encoder = new TextEncoder();

function b64url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlToBytes(s) {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/** Sign `payload` as a compact JWS (HS256). Format: base64url(header).base64url(body).base64url(sig) */
async function signToken(payload, secret) {
  const header = b64url(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = b64url(encoder.encode(JSON.stringify(payload)));
  const data = `${header}.${body}`;
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return `${data}.${b64url(new Uint8Array(sig))}`;
}

/** Verify signature and expiry. Returns the payload, or null. */
async function verifyToken(token, secret) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const key = await hmacKey(secret);
  let ok = false;
  try {
    ok = await crypto.subtle.verify(
      'HMAC',
      key,
      b64urlToBytes(parts[2]),
      encoder.encode(`${parts[0]}.${parts[1]}`)
    );
  } catch {
    return null;
  }
  if (!ok) return null;

  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1])));
  } catch {
    return null;
  }

  if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) return null;
  return payload;
}

/** Constant-time string compare so a wrong password cannot be timed out character by character. */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function readCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
}

/**
 * SameSite=None so the browser will attach the cookie to the cross-site call
 * from the Pages app (menusheetapp.pages.dev -> *.workers.dev).
 *
 * That removes the SameSite layer of CSRF protection, so the strict Origin
 * allow-list in isAllowedOrigin() is what actually prevents another site from
 * riding this cookie. Do not relax ALLOWED_ORIGINS to '*'.
 *
 * If the Worker is ever moved onto the same site as the app (e.g.
 * auth.menusheet.app), switch this back to 'Strict'.
 */
function cookieHeader(value, maxAge) {
  const attrs = [
    `${SESSION_COOKIE}=${value}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=None',
    `Max-Age=${maxAge}`,
  ];
  return attrs.join('; ');
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extraHeaders },
  });
}

/**
 * CORS is deliberately narrow: only the Pages origins may call this Worker with
 * credentials. An open origin here would let any site on the internet ride the
 * operator's session cookie.
 */
function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const allowed = allowedOrigins(env);
  const headers = {
    Vary: 'Origin',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (origin && allowed.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

function isAllowedOrigin(request, env) {
  const origin = request.headers.get('Origin');
  // Same-origin / non-browser callers (curl, the reconciler) send no Origin.
  if (!origin) return true;
  return allowedOrigins(env).includes(origin);
}

function rateLimited(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now - entry.first > LOGIN_WINDOW_SECONDS * 1000) {
    loginAttempts.set(ip, { count: 1, first: now });
    return false;
  }
  entry.count += 1;
  return entry.count > LOGIN_MAX_ATTEMPTS;
}

function clearAttempts(ip) {
  loginAttempts.delete(ip);
}

function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/**
 * Proxy an authenticated request through to an Apps Script, injecting SHARED_SECRET.
 *
 * `targetOverride` lets a caller reach a specific restaurant's own script. It is
 * restricted to script.google.com so this cannot be turned into an open proxy.
 *
 * `body` must be passed in already parsed — a request body can only be read once.
 */
async function proxyToAppsScript(request, env, action, targetOverride, body) {
  const url = targetOverride || env.ADMIN_APPS_SCRIPT_URL;
  if (!url) return json({ error: 'Admin Apps Script URL is not configured on the Worker.' }, 500);

  if (targetOverride && !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(targetOverride)) {
    return json({ error: 'Invalid target script URL.' }, 400);
  }

  let upstream;
  if (request.method === 'GET') {
    const target = new URL(url);
    target.searchParams.set('action', action);
    target.searchParams.set('key', env.SHARED_SECRET);
    upstream = await fetch(target.toString(), { redirect: 'follow' });
  } else {
    upstream = await fetch(url, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ key: env.SHARED_SECRET, action, payload: body?.payload ?? {} }),
    });
  }

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    if (!isAllowedOrigin(request, env)) {
      return json({ error: 'Origin not allowed.' }, 403);
    }

    const cors = corsHeaders(request, env);

    if (path === '/api/login' && request.method === 'POST') {
      const ip = clientIp(request);

      if (rateLimited(ip)) {
        return json({ error: 'Too many attempts. Try again in a few minutes.' }, 429, cors);
      }

      const body = await readJson(request);
      const email = String(body?.email ?? '').trim().toLowerCase();
      const password = String(body?.password ?? '');

      const expectedEmail = String(env.ADMIN_EMAIL ?? '').trim().toLowerCase();
      const expectedPassword = String(env.ADMIN_PASSWORD ?? '');

      if (!expectedEmail || !expectedPassword) {
        return json({ error: 'Admin credentials are not configured on the Worker.' }, 500, cors);
      }

      // Always run both comparisons so a missing-email request costs the same
      // as a wrong-password one.
      const emailOk = timingSafeEqual(email, expectedEmail);
      const passwordOk = timingSafeEqual(password, expectedPassword);

      if (!emailOk || !passwordOk) {
        return json({ error: 'Incorrect email or password.' }, 401, cors);
      }

      clearAttempts(ip);

      const token = await signToken(
        { sub: email, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS },
        env.SESSION_SECRET || env.SHARED_SECRET
      );

      return json({ email }, 200, { ...cors, 'Set-Cookie': cookieHeader(token, SESSION_TTL_SECONDS) });
    }

    if (path === '/api/logout' && request.method === 'POST') {
      return json({ ok: true }, 200, { ...cors, 'Set-Cookie': cookieHeader('', 0) });
    }

    if (path === '/api/session' && request.method === 'GET') {
      const payload = await verifyToken(readCookie(request, SESSION_COOKIE), env.SESSION_SECRET || env.SHARED_SECRET);
      if (!payload) return json({ email: null }, 200, cors);
      return json({ email: payload.sub }, 200, cors);
    }

    if (path.startsWith('/api/admin/')) {
      const payload = await verifyToken(readCookie(request, SESSION_COOKIE), env.SESSION_SECRET || env.SHARED_SECRET);
      if (!payload) return json({ error: 'Not authenticated.' }, 401, cors);

      const action = path.slice('/api/admin/'.length);
      if (!action) return json({ error: 'Missing action.' }, 400, cors);

      const body = request.method === 'POST' ? (await readJson(request)) || {} : null;

      // A caller may name a specific restaurant script to write to.
      const target =
        action === 'updateSettings' && typeof body?.appscript_url === 'string'
          ? body.appscript_url
          : undefined;

      return proxyToAppsScript(request, env, action, target, body);
    }

    return json({ error: 'Not found.' }, 404, cors);
  },
};
