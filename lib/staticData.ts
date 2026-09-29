import fs from 'fs';
import path from 'path';
import type { RestaurantRecord, RestaurantsManifest } from './types';

/**
 * The build-time pre-render manifest.
 *
 * It answers one question only: which restaurant ids get their own
 * pre-rendered /r/{id} page, so they get server-rendered metadata and JSON-LD.
 * Everything else — the roster itself, billing state, cached menus — lives in
 * the platform's KV and is read at runtime by the Worker.
 *
 * This list is NOT the source of truth. The KV roster is. Keeping an id out of
 * this file costs a restaurant its pre-rendered page, and it falls back to the
 * /r-shell catch-all, which serves the identical menu from the API. So drift
 * here is cosmetic, not dangerous, and the file is only edited by hand.
 */
const DATA_DIR = path.join(process.cwd(), 'data');

export function loadManifest(): RestaurantsManifest {
  const file = path.join(DATA_DIR, 'restaurants.json');
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  return {
    restaurants: (parsed.restaurants ?? []) as RestaurantRecord[],
  };
}

export function getRestaurant(id: string): RestaurantRecord | null {
  const manifest = loadManifest();
  return manifest.restaurants.find((r) => r.restaurant_id === id) ?? null;
}
