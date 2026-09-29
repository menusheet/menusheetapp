/**
 * One-time: generate the Worker's secrets, set them in production, and keep a
 * local copy in worker/.dev.vars (gitignored) so `wrangler dev` also works.
 *
 *   node scripts/set-secrets.mjs
 */
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const WORKER_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = path.join(WORKER_DIR, '..');

const candidates = [
  path.join(WORKER_DIR, 'node_modules', 'wrangler', 'bin', 'wrangler.js'),
  path.join(REPO_ROOT, 'node_modules', 'wrangler', 'bin', 'wrangler.js'),
];
const entry = candidates.find(existsSync);
if (!entry) throw new Error('wrangler is not installed. Run `npm install` inside worker/ first.');

function put(name, value) {
  process.stdout.write(`  ${name} ... `);
  const out = execFileSync(process.execPath, [entry, 'secret', 'put', name], {
    cwd: WORKER_DIR,
    encoding: 'utf8',
    input: value,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  console.log(/success/i.test(out) ? 'set' : 'done');
}

const secret = () => randomBytes(32).toString('base64url');
const password = () => randomBytes(12).toString('base64url');

const values = {
  ADMIN_EMAIL: 'menusheet@gmail.com',
  ADMIN_PASSWORD: password(),
  SESSION_SECRET: secret(),
  SHARED_SECRET: secret(),
};

console.log('Setting production secrets on menusheet-api\n');
for (const [k, v] of Object.entries(values)) put(k, v);

const devVars = Object.entries(values)
  .map(([k, v]) => `${k}="${v}"`)
  .concat(['DEFAULT_MENU_TTL_SECONDS="3600"'])
  .join('\n');
writeFileSync(path.join(WORKER_DIR, '.dev.vars'), devVars + '\n', 'utf8');
console.log('\nWrote worker/.dev.vars (gitignored) for local wrangler dev.');

console.log('\n--- save these, they are not recoverable from Cloudflare ---');
console.log(`ADMIN_EMAIL      ${values.ADMIN_EMAIL}`);
console.log(`ADMIN_PASSWORD   ${values.ADMIN_PASSWORD}`);
console.log(`SHARED_SECRET    ${values.SHARED_SECRET}`);
console.log('SESSION_SECRET   (generated, not printed)');
