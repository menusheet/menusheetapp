/**
 * Deploy the static export to Cloudflare Pages.
 *
 * Guards the two failure modes that have actually bitten this project:
 *
 *  1. `next build` inlines NEXT_PUBLIC_* at build time. Building without them
 *     set falls back to .env.local, whose NEXT_PUBLIC_SITE_URL is
 *     http://localhost:3000 -- so the live site ends up advertising
 *     "canonical: http://localhost:3000" to search engines. This script
 *     requires a real SITE_URL instead of quietly building a localhost bundle.
 *
 *  2. The Pages project is `menusheetapp`, NOT `menusheet`. Deploying to the
 *     wrong name silently creates/updates a different project and leaves
 *     production untouched, which reads as "the deploy did nothing".
 *
 * Usage:
 *   node scripts/deploy-pages.mjs [--preview]
 *
 * Defaults to the production values below. Override with the env vars to
 * target a different site or a preview build.
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const DEFAULTS = {
  NEXT_PUBLIC_SITE_URL: 'https://menusheetapp.pages.dev',
  NEXT_PUBLIC_API_URL: 'https://menusheet-api.menusheet.workers.dev',
  NEXT_PUBLIC_MENU_CACHE_TTL_MINUTES: '5',
};

// Must match the Cloudflare Pages project. See README "Deploy".
const PAGES_PROJECT = 'menusheetapp';

const preview = process.argv.includes('--preview');

const env = { ...process.env };
for (const [key, fallback] of Object.entries(DEFAULTS)) {
  if (!env[key]) env[key] = fallback;
}

const siteUrl = env.NEXT_PUBLIC_SITE_URL;
if (!/^https?:\/\//.test(siteUrl)) {
  throw new Error(`NEXT_PUBLIC_SITE_URL must be an absolute URL, got: ${siteUrl}`);
}
if (siteUrl.includes('localhost') && !preview) {
  throw new Error(
    `Refusing to build a production bundle with NEXT_PUBLIC_SITE_URL=${siteUrl}.\n` +
      'That would ship localhost as the canonical origin and in the sitemap.\n' +
      'Pass a real site URL, or use --preview if localhost is genuinely intended.'
  );
}

function run(command, args) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: ROOT,
    env,
    stdio: 'inherit',
    // No shell: node lives at "C:\Program Files\nodejs\node.exe" on Windows,
    // and shell: true would split that path on the space.
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }
}

/** Wrangler is installed in worker/, not the app root. Check both. */
function findWrangler() {
  const candidates = [
    path.join(ROOT, 'node_modules', 'wrangler', 'bin', 'wrangler.js'),
    path.join(ROOT, 'worker', 'node_modules', 'wrangler', 'bin', 'wrangler.js'),
  ];
  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    throw new Error(
      'wrangler not found. Install it with: npm --prefix worker install'
    );
  }
  return found;
}

console.log(`Deploying to Cloudflare Pages project "${PAGES_PROJECT}" (${preview ? 'preview' : 'production'})`);
console.log(`  NEXT_PUBLIC_SITE_URL  = ${siteUrl}`);
console.log(`  NEXT_PUBLIC_API_URL   = ${env.NEXT_PUBLIC_API_URL}`);

run(process.execPath, [path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next'), 'build']);

run(process.execPath, [findWrangler(), 'pages', 'deploy', 'out', '--project-name', PAGES_PROJECT, ...(preview ? ['--branch', 'preview'] : ['--branch', 'main'])]);

console.log('\nDone. Confirm the canonical tag is the site URL, not localhost:');
console.log(`  curl -s ${siteUrl}/r/demo | Select-String canonical`);
