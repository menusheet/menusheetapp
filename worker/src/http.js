/**
 * MenuSheet — the response envelope and the origin allow-list.
 *
 * CORS is deliberately narrow for anything the dashboard touches: only the
 * Pages origins may call this Worker with credentials. An open origin here
 * would let any site on the internet ride the operator's session cookie.
 */

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extraHeaders },
  });
}

export function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const allowed = allowedOrigins(env);
  const headers = {
    Vary: 'Origin',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  if (origin && allowed.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

export function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

export function isAllowedOrigin(request, env) {
  const origin = request.headers.get('Origin');
  // Same-origin / non-browser callers (curl, the Apps Script reload button)
  // send no Origin.
  if (!origin) return true;
  return allowedOrigins(env).includes(origin);
}
