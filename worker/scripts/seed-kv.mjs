#!/usr/bin/env node

/**
 * MenuSheet — one-time migration of the roster into KV.
 *
 * Before this Worker existed the roster lived in an operator-owned Admin Google
 * Sheet, read through apps-script/admin.gs. That sheet is retired. This script
 * is the bridge: it reads the committed manifest (data/restaurants.json) and
 * writes one KV record per restaurant, plus the id index KV needs to enumerate.
 *
 * It is idempotent — running it twice is harmless — but running it after the
 * admin portal has been in use would overwrite newer edits, so run it once,
 * before anyone starts using the portal.
 *
 *   npm run seed            # dry run, prints the plan
 *   npm run seed -- --write # actually writes
 *
 * Auth comes from wrangler itself (`npx wrangler login`), so there is no API
 * token to set up. The namespace id is read out of wrangler.toml so the two
 * cannot drift.
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WORKER_DIR = path.join(HERE, '..');
const REPO_ROOT = path.join(WORKER_DIR, '..');
const MANIFEST = path.join(REPO_ROOT, 'data', 'restaurants.json');
const WRANGLER_TOML = path.join(WORKER_DIR, 'wrangler.toml');

const WRITE = process.argv.includes('--write');

/**
 * Run the locally installed wrangler as a plain node script.
 *
 * Not via `npx`, because npx on Windows is a .cmd shim and Node refuses to
 * spawn one (CVE-2024-27980, EINVAL). Running the JS entry with the current
 * interpreter sidesteps that and skips npx's download check on every call.
 *
 * The path is built by hand rather than via require.resolve, because wrangler's
 * "exports" map does not expose its bin script to subpath resolution.
 */
function wranglerEntry() {
  const candidates = [
    path.join(WORKER_DIR, 'node_modules', 'wrangler', 'bin', 'wrangler.js'),
    path.join(REPO_ROOT, 'node_modules', 'wrangler', 'bin', 'wrangler.js'),
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  throw new Error('wrangler is not installed. Run `npm install` inside worker/ first.');
}

function wrangler(args) {
  return execFileSync(process.execPath, [wranglerEntry(), ...args], {
    cwd: WORKER_DIR,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/** Read config straight out of wrangler.toml so the two can't drift. */
async function wranglerConfig() {
  const toml = await readFile(WRANGLER_TOML, 'utf8');
  const block = toml.match(/\[\[kv_namespaces\]\][^[]*?binding\s*=\s*"RESTAURANTS"[^[]*?id\s*=\s*"([^"]+)"/s);
  if (!block) throw new Error('Could not find the RESTAURANTS binding in wrangler.toml');
  const ttl = toml.match(/DEFAULT_MENU_TTL_SECONDS\s*=\s*"(\d+)"/);
  return {
    namespaceId: block[1],
    defaultTtl: ttl ? Number(ttl[1]) : 3600,
  };
}

let DEFAULT_TTL = 3600;

/**
 * The landing page links to /r/demo, and it has no Google Sheet behind it. Its
 * menu is written straight into the MENUS namespace by this script, so the
 * project has a working example with no configuration at all.
 */
const DEMO_MENU = {
  status: 'ok',
  restaurant: { id: 'demo', name: 'The Green Fork' },
  menu: [
    { id: 'M001', category: 'Starters', name: 'Paneer Tikka', description: 'Charred cottage cheese, mint chutney', price: 320, priceVariants: [], imageUrl: '', isVeg: true, isAvailable: true, sortOrder: 1 },
    { id: 'M002', category: 'Starters', name: 'Chicken 65', description: 'Crispy fried, curry leaf & chilli', price: 340, priceVariants: [], imageUrl: '', isVeg: false, isAvailable: true, sortOrder: 2 },
    { id: 'M003', category: 'Main Course', name: 'Dal Makhani', description: 'Slow-cooked black lentils, butter', price: 280, priceVariants: [], imageUrl: '', isVeg: true, isAvailable: true, sortOrder: 3 },
    { id: 'M004', category: 'Main Course', name: 'Butter Chicken', description: 'Tomato gravy, cream, tandoori chicken', price: 380, priceVariants: [], imageUrl: '', isVeg: false, isAvailable: true, sortOrder: 4 },
    { id: 'M005', category: 'Main Course', name: 'Margherita Pizza', description: 'San Marzano tomato, fior di latte, basil', price: 220, priceVariants: [{ label: 'Small', price: 220 }, { label: 'Medium', price: 320 }, { label: 'Large', price: 420 }], imageUrl: '', isVeg: true, isAvailable: true, sortOrder: 5 },
    { id: 'M006', category: 'Beverages', name: 'Masala Chai', description: 'House spice blend', price: 80, priceVariants: [], imageUrl: '', isVeg: true, isAvailable: true, sortOrder: 6 },
    { id: 'M007', category: 'Desserts', name: 'Gulab Jamun', description: 'Warm, rose syrup, pistachio', price: 120, priceVariants: [], imageUrl: '', isVeg: true, isAvailable: false, sortOrder: 7 },
  ],
  fetched_at: new Date().toISOString(),
};

async function main() {
  const config = await wranglerConfig();
  DEFAULT_TTL = config.defaultTtl;

  if (!existsSync(MANIFEST)) {
    console.error(`[seed] ${MANIFEST} not found. Nothing to seed.`);
    process.exit(1);
  }

  const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
  const rows = Array.isArray(manifest.restaurants) ? manifest.restaurants : [];

  if (!rows.length) {
    console.log('[seed] the manifest is empty — nothing to do.');
    return;
  }

  const records = rows.map(normalize).filter((r) => r.restaurant_id);

  console.log(`[seed] ${records.length} restaurant(s) found in data/restaurants.json`);
  console.log(`[seed] target namespace: ${config.namespaceId}`);
  console.log(`[seed] default cache TTL: ${DEFAULT_TTL}s (0 = never expires)`);
  console.log(`[seed] mode: ${WRITE ? 'WRITE' : 'DRY RUN — pass --write to apply'}\n`);

  for (const r of records) {
    console.log(
      `  ${r.restaurant_id.padEnd(20)} active=${String(r.active).padEnd(5)} ` +
        `expires=${r.expiry_date || '(none)'} theme=${r.theme_key} ttl=${r.cache_ttl_seconds}`
    );
  }

  if (!WRITE) {
    console.log('\n[seed] dry run complete. Re-run with --write to push these into KV.');
    return;
  }

  const rosterPayload = [
    ...records.map((r) => ({ key: `restaurant:${r.restaurant_id}`, value: JSON.stringify(r) })),
    { key: 'index:ids', value: JSON.stringify(records.map((r) => r.restaurant_id)) },
  ];
  await bulkPut('RESTAURANTS', config.namespaceId, rosterPayload, 'roster');

  const menuPayload = [
    { key: 'menu:demo', value: JSON.stringify(DEMO_MENU) },
  ];
  const menusId = await menusNamespaceId();
  await bulkPut('MENUS', menusId, menuPayload, 'demo menu');

  console.log('\n[seed] done.');
  console.log('[seed] next: open the admin portal, and press "Reload menu now" per restaurant');
  console.log('[seed]       (skip the demo, its menu is already there).');
}

async function menusNamespaceId() {
  const toml = await readFile(WRANGLER_TOML, 'utf8');
  const block = toml.match(/\[\[kv_namespaces\]\][^[]*?binding\s*=\s*"MENUS"[^[]*?id\s*=\s*"([^"]+)"/s);
  if (!block) throw new Error('Could not find the MENUS binding in wrangler.toml');
  return block[1];
}

/**
 * wrangler kv bulk put takes a file containing a JSON array of {key, value}
 * objects. Its help text still says JSONL, but 4.143 rejects that outright, so
 * the array form is what we write.
 *
 * --remote is essential: without it wrangler writes to the local emulator and
 * the migration silently goes nowhere.
 */
async function bulkPut(binding, namespaceId, entries, label) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'menusheet-seed-'));
  const file = path.join(dir, `${binding}.json`);

  try {
    await writeFile(file, JSON.stringify(entries), 'utf8');
    const out = wrangler([
      'kv', 'bulk', 'put', file,
      '--namespace-id', namespaceId,
      '--config', WRANGLER_TOML,
      '--remote',
    ]);
    console.log(`[seed] wrote ${entries.length} key(s) to ${binding} (${label})`);
    if (out.trim()) console.log(out.trim().split('\n').map((l) => `        ${l}`).join('\n'));
  } catch (err) {
    const detail = [err.stdout, err.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`wrangler kv bulk put into ${binding} failed: ${detail || err.message}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Mirrors store.normalizeRecord() so the seeded shape matches what the Worker writes.
 *
 * The Admin Sheet never had a cache TTL column, so almost every row arriving
 * here is missing it. That has to resolve to the platform default — defaulting
 * it to 0 would mean "never expires" and would quietly pin every existing
 * restaurant's menu in KV forever.
 */
function normalize(raw) {
  const num = (v, fallback) => {
    const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, ''));
    return isNaN(n) ? fallback : n;
  };
  const str = (v) => (v === null || v === undefined ? '' : String(v).trim());
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

  const expiry = str(raw.expiry_date);
  const hasTtl =
    raw.cache_ttl_seconds !== undefined &&
    raw.cache_ttl_seconds !== null &&
    str(raw.cache_ttl_seconds) !== '';
  return {
    restaurant_id: str(raw.restaurant_id),
    restaurant_name: str(raw.restaurant_name),
    owner_contact: str(raw.owner_contact),
    appscript_url: str(raw.appscript_url),
    sheet_id: str(raw.sheet_id),
    theme_key: str(raw.theme_key) || 'demo',
    active: raw.active === true || str(raw.active).toUpperCase() === 'TRUE',
    expiry_date: /^\d{4}-\d{2}-\d{2}$/.test(expiry) ? expiry : today,
    plan_amount: num(raw.plan_amount, 100) || 100,
    onboarded_at: str(raw.onboarded_at) || today,
    last_checked_at: str(raw.last_checked_at),
    notes: str(raw.notes),
    cache_ttl_seconds: hasTtl ? num(raw.cache_ttl_seconds, DEFAULT_TTL) : DEFAULT_TTL,
  };
}

main().catch((err) => {
  console.error('[seed] failed:', err.message);
  process.exit(1);
});
