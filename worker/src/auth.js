/**
 * MenuSheet — admin session auth.
 *
 * Unchanged from the retired admin-auth-worker: the dashboard is a fully static
 * Next.js export with no server runtime, so this module is what stands between
 * the browser and the restaurant roster. It issues an HS256 session cookie and
 * verifies it on every privileged route.
 *
 * Credentials come from ADMIN_EMAIL / ADMIN_PASSWORD. Set them with
 * `wrangler secret put` so they stay out of git.
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
 * Kept as a fallback for curl, the test suite, and browsers where the
 * third-party cookie does survive. SameSite=None is required for that cookie
 * to cross from pages.dev to workers.dev at all.
 *
 * That removes the SameSite layer of CSRF protection, so the strict Origin
 * allow-list in isAllowedOrigin() is what actually prevents another site from
 * riding this cookie. Do not relax ALLOWED_ORIGINS to '*'.
 *
 * If the Worker is ever moved onto the same site as the app (e.g.
 * api.menusheet.app), switch this back to 'Strict'.
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

/** Returns the bearer token from the Authorization header, or null. */
function bearerToken(request) {
  const match = /^Bearer\s+(.+)$/i.exec((request.headers.get('Authorization') || '').trim());
  return match ? match[1].trim() : null;
}

/**
 * Returns the session payload for the request's credentials, or null when signed out.
 *
 * The bearer token is checked first and is what the dashboard actually uses. The
 * dashboard is a static export served from menusheetapp.pages.dev while this
 * Worker lives on menusheet.workers.dev, so its session cookie is a *third-party*
 * cookie: Safari rejects those outright, and Chrome and Firefox drop them
 * whenever 3P cookies are off. That made sign-in fail for most operators while
 * still working for whoever had third-party cookies enabled. A bearer token
 * travels in a normal request header, so it is not subject to any of that.
 *
 * The cookie is still accepted so that curl, the test suite, and any browser
 * where the cookie does survive both keep working.
 */
export async function sessionFrom(request, env) {
  const secret = env.SESSION_SECRET || env.SHARED_SECRET;
  // Awaited one at a time on purpose: verifyToken returns a promise, so
  // `verifyToken(a) || verifyToken(b)` would compare two truthy promises and
  // never fall through to the cookie.
  const bearer = await verifyToken(bearerToken(request), secret);
  if (bearer) return bearer;
  return verifyToken(readCookie(request, SESSION_COOKIE), secret);
}

export async function handleLogin(request, env, json, cors) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

  if (rateLimited(ip)) {
    return json({ error: 'Too many attempts. Try again in a few minutes.' }, 429, cors);
  }

  let body = null;
  try {
    body = await request.json();
  } catch {
    /* handled below as a bad-credentials attempt */
  }

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

  return json({ email, token }, 200, { ...cors, 'Set-Cookie': cookieHeader(token, SESSION_TTL_SECONDS) });
}

export function handleLogout(request, env, json, cors) {
  return json({ ok: true }, 200, { ...cors, 'Set-Cookie': cookieHeader('', 0) });
}

export async function handleSession(request, env, json, cors) {
  const payload = await sessionFrom(request, env);
  if (!payload) return json({ email: null }, 200, cors);
  return json({ email: payload.sub }, 200, cors);
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
