/**
 * MenuSheet — the restaurant roster, in KV.
 *
 * This module is the successor to the retired Admin Google Sheet. Every field
 * that used to be a column in the `Restaurants` tab is a key in the RESTAURANTS
 * namespace.
 *
 *   restaurant:{id}  -> one record, see blankRecord()
 *   index:ids         -> ordered array of ids, the only way to enumerate
 *
 * KV cannot list keys, so the index is maintained by hand on every write.
 *
 * Consistency: KV is eventually consistent, and a write is not guaranteed to
 * be visible in every colo for up to 60 seconds. That is why every mutating
 * function here returns the complete refreshed list as well as the record it
 * touched — the dashboard writes the returned list straight into its state
 * instead of re-reading, so an operator never sees their own edit disappear
 * and come back. Reads that do go back to KV are the initial page load and the
 * menu reads, both of which tolerate staleness by design.
 */

const IST_TZ = 'Asia/Kolkata';

export const FIELDS = [
  'restaurant_id',
  'restaurant_name',
  'owner_contact',
  'appscript_url',
  'sheet_id',
  'theme_key',
  'active',
  'expiry_date',
  'plan_amount',
  'onboarded_at',
  'last_checked_at',
  'notes',
  'cache_ttl_seconds',
];

/** Menu cache TTLs below this are pointless: KV treats anything under 60s as 60s. */
const MIN_TTL_SECONDS = 60;
const MAX_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days, KV's own ceiling

export function todayISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: IST_TZ }).format(new Date());
}

export function plusDaysISO(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return new Intl.DateTimeFormat('en-CA', { timeZone: IST_TZ }).format(d);
}

function isExpired(expiryStr) {
  return Boolean(
    expiryStr && /^\d{4}-\d{2}-\d{2}$/.test(expiryStr) && expiryStr < todayISO()
  );
}

function truthy(v) {
  return v === true || String(v ?? '').trim().toUpperCase() === 'TRUE';
}

function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'restaurant';
}

function uniqueId(base, existing) {
  if (!existing.includes(base)) return base;
  let n = 2;
  while (existing.includes(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

function num(v) {
  const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function dateStr(v) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: IST_TZ }).format(d);
}

/** Cache TTL in seconds. 0 means "keep until the next manual reload". */
export function cacheTtlSeconds(record, env) {
  const perRestaurant = num(record?.cache_ttl_seconds);
  const fallback = num(env?.DEFAULT_MENU_TTL_SECONDS) || 3600;
  /* An absent TTL is not the same thing as 0. 0 is a deliberate choice by an
     operator meaning "keep until the next manual reload", so treating a missing
     value as 0 would silently make every migrated restaurant permanent. */
  if (perRestaurant === 0 && !hasExplicitTtl(record)) return clampTtl(fallback);
  if (perRestaurant <= 0) return 0;
  return clampTtl(perRestaurant);
}

function hasExplicitTtl(record) {
  const v = record?.cache_ttl_seconds;
  return v !== '' && v !== null && v !== undefined;
}

function clampTtl(seconds) {
  return Math.min(Math.max(Math.round(seconds), MIN_TTL_SECONDS), MAX_TTL_SECONDS);
}

function blankRecord() {
  const row = {};
  for (const f of FIELDS) row[f] = '';
  return row;
}

/**
 * Coerce an arbitrary stored blob into a well-formed record.
 *
 * `env` is used to resolve an absent cache TTL to the platform default, so
 * every record leaving this function carries a concrete number and a stored 0
 * always means "never expires" rather than "we don't know yet".
 */
export function normalizeRecord(raw, env) {
  const r = blankRecord();
  for (const f of FIELDS) {
    if (f in (raw || {})) r[f] = raw[f];
  }
  r.restaurant_id = String(r.restaurant_id || '').trim();
  r.restaurant_name = String(r.restaurant_name || '').trim();
  r.owner_contact = String(r.owner_contact || '').trim();
  r.appscript_url = String(r.appscript_url || '').trim();
  r.sheet_id = String(r.sheet_id || '').trim();
  r.theme_key = String(r.theme_key || 'demo').trim() || 'demo';
  r.active = truthy(r.active);
  r.expiry_date = dateStr(r.expiry_date);
  r.plan_amount = num(r.plan_amount) || 100;
  r.onboarded_at = dateStr(r.onboarded_at) || todayISO();
  r.last_checked_at = String(r.last_checked_at || '');
  r.notes = String(r.notes || '');
  r.cache_ttl_seconds = hasExplicitTtl(r)
    ? num(r.cache_ttl_seconds)
    : Math.min(Math.max(num(env?.DEFAULT_MENU_TTL_SECONDS) || 3600, MIN_TTL_SECONDS), MAX_TTL_SECONDS);
  return r;
}

async function readIndex(env) {
  const raw = await env.RESTAURANTS.get('index:ids', 'json');
  return Array.isArray(raw) ? raw.filter((x) => typeof x === 'string' && x) : [];
}

async function writeIndex(env, ids) {
  await env.RESTAURANTS.put('index:ids', JSON.stringify(ids));
}

export async function getRestaurant(env, id) {
  if (!id) return null;
  const raw = await env.RESTAURANTS.get(`restaurant:${id}`, 'json');
  if (!raw) return null;
  return normalizeRecord(raw, env);
}

export async function listRestaurants(env) {
  const ids = await readIndex(env);
  const found = await Promise.all(ids.map((id) => env.RESTAURANTS.get(`restaurant:${id}`, 'json')));
  const rows = [];
  for (let i = 0; i < found.length; i++) {
    if (!found[i]) continue;
    rows.push(
      normalizeRecord(
        { ...found[i], restaurant_id: found[i].restaurant_id || ids[i] },
        env
      )
    );
  }
  return rows;
}

export async function addRestaurant(env, payload = {}) {
  const existing = await listRestaurants(env);
  const name = String(payload.restaurant_name || '').trim();
  if (!name) throw new HttpError('restaurant_name is required', 400);

  const ids = existing.map((r) => r.restaurant_id);
  const id =
    String(payload.restaurant_id || '').trim() ||
    uniqueId(slugify(name), ids);

  if (ids.includes(id)) throw new HttpError(`restaurant_id already exists: ${id}`, 409);

  const record = normalizeRecord(
    {
      ...payload,
      restaurant_id: id,
      restaurant_name: name,
      theme_key: String(payload.theme_key || '').trim() || 'demo',
      active: payload.active !== undefined ? truthy(payload.active) : false,
      expiry_date: dateStr(payload.expiry_date) || plusDaysISO(30),
      plan_amount:
        payload.plan_amount === undefined || payload.plan_amount === ''
          ? 100
          : num(payload.plan_amount),
      onboarded_at: todayISO(),
    },
    env
  );

  await env.RESTAURANTS.put(`restaurant:${id}`, JSON.stringify(record));
  await writeIndex(env, [...ids, id]);

  return { record, restaurants: [...existing, record] };
}

export async function updateRestaurant(env, payload = {}) {
  const id = String(payload.restaurant_id || '').trim();
  if (!id) throw new HttpError('restaurant_id is required', 400);

  const current = await getRestaurant(env, id);
  if (!current) throw new HttpError(`restaurant not found: ${id}`, 404);

  // Only fields present in the payload are written, so a partial form save
  // cannot blank out the connection details.
  const next = { ...current };
  for (const f of FIELDS) {
    if (f === 'restaurant_id') continue;
    if (f in payload) next[f] = payload[f];
  }
  const record = normalizeRecord(next, env);

  await env.RESTAURANTS.put(`restaurant:${id}`, JSON.stringify(record));

  const restaurants = await listRestaurants(env);
  return { record, restaurants };
}

export async function deleteRestaurant(env, id) {
  const current = await getRestaurant(env, id);
  if (!current) throw new HttpError(`restaurant not found: ${id}`, 404);
  const ids = await readIndex(env);
  await env.RESTAURANTS.delete(`restaurant:${id}`);
  await env.MENUS.delete(`menu:${id}`);
  await writeIndex(env, ids.filter((x) => x !== id));
  return { id };
}

/** The public kill switch, evaluated from KV alone. Apps Script is not consulted. */
export function publicStatus(record) {
  if (!record || !record.restaurant_id) return 'inactive';
  if (!record.active) return 'inactive';
  if (isExpired(record.expiry_date)) return 'expired';
  return 'ok';
}

export class HttpError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
