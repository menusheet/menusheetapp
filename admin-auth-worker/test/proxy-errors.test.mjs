import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
const mod = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));

const env = {
  ADMIN_EMAIL: 'a@b.com',
  ADMIN_PASSWORD: 'pw',
  SESSION_SECRET: 's1',
  SHARED_SECRET: 's2',
  ADMIN_APPS_SCRIPT_URL: 'https://script.google.com/macros/s/F/exec',
  ALLOWED_ORIGINS: 'https://menusheetapp.pages.dev',
};
const f = mod.default.fetch;

const lr = await f(
  new Request('https://w/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://menusheetapp.pages.dev' },
    body: JSON.stringify({ email: 'a@b.com', password: 'pw' }),
  }),
  env
);
const tok = (lr.headers.get('set-cookie') || '').split(';')[0].split('=')[1];
const H = { Cookie: 'menusheet_session=' + tok, Origin: 'https://menusheetapp.pages.dev' };

const real = globalThis.fetch;
const stub = (body, ct, status = 200) => {
  globalThis.fetch = async () => new Response(body, { status, headers: { 'Content-Type': ct } });
};

const cases = [
  ['script threw (HTML)', '<html><body>Error: restaurant not found: x</body></html>', 'text/html'],
  ['needs login (HTML)', '<html>Sign in - accounts.google.com</html>', 'text/html'],
  ['bad key (JSON)', '{"error":"unauthorized"}', 'application/json'],
  ['happy path', '{"status":"ok","restaurants":[{"restaurant_id":"test"}]}', 'application/json'],
];

for (const [label, body, ct] of cases) {
  stub(body, ct);
  const method = label === 'script threw (HTML)' || label === 'bad key (JSON)' ? 'POST' : 'GET';
  const path = method === 'POST' ? 'updateRestaurant' : 'listRestaurants';
  const r = await f(
    new Request('https://w/api/admin/' + path, {
      method,
      headers: { ...H, ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) },
      body: method === 'POST' ? JSON.stringify({ payload: { restaurant_id: 'x' } }) : undefined,
    }),
    env
  );
  const acao = r.headers.get('Access-Control-Allow-Origin');
  const acac = r.headers.get('Access-Control-Allow-Credentials');
  const ok = acao === 'https://menusheetapp.pages.dev' && acac === 'true' ? 'ACAO ok' : '*** ACAO MISSING ***';
  console.log(label.padEnd(20), '->', r.status, ok, (await r.text()).slice(0, 90));
}

globalThis.fetch = real;
