import type { ComponentType } from 'react';

export type MenuStatus = 'ok' | 'inactive' | 'expired' | 'loading';

export type { PriceVariant } from './price';
import type { PriceVariant } from './price';

export interface MenuItem {
  id: string;
  category: string;
  name: string;
  description: string;
  /**
   * Lowest price, so a plain `₹320` render and any existing consumer keep
   * working unchanged when an item has variations. See `lib/price.ts`.
   */
  price: number;
  /** Ordered price options, or `[]` when the item has a single price. */
  priceVariants: PriceVariant[];
  imageUrl: string;
  isVeg: boolean;
  isAvailable: boolean;
  sortOrder: number;
}

export interface RestaurantInfo {
  name: string;
  tagline?: string;
  logoUrl?: string;
  heroImageUrl?: string;
}

export interface MenuPayload {
  status: MenuStatus;
  restaurant?: RestaurantInfo;
  menu?: MenuItem[];
  /** Theme to render with, from the platform roster. Absent on older payloads. */
  theme_key?: string;
  /** Restaurant name from the platform roster, used when a theme has no name of its own. */
  restaurant_name?: string;
  /** ISO timestamp of when this menu was last pulled from the restaurant's sheet. */
  fetched_at?: string | null;
  /** Machine-readable explanation, e.g. "awaiting_reload" or "subscription_expired". */
  reason?: string;
}

export interface RestaurantRecord {
  restaurant_id: string;
  restaurant_name: string;
  owner_contact: string;
  appscript_url: string;
  sheet_id: string;
  theme_key: string;
  active: boolean;
  expiry_date: string;
  plan_amount: number | string;
  onboarded_at: string;
  last_checked_at: string;
  notes: string;
  /**
   * How long the platform serves this restaurant's cached menu, in seconds.
   * 0 means "never expire" — the menu stays live until someone presses Reload.
   */
  cache_ttl_seconds: number;
}

export interface MenuCacheStatus {
  restaurant_id: string;
  cached: boolean;
  fetched_at: string | null;
  age_seconds: number | null;
  item_count: number;
  cached_status: string | null;
  ttl_seconds: number;
  expires_in_seconds: number | null;
}

export interface RestaurantsManifest {
  /**
   * Only the ids that should get a pre-rendered /r/{id} page. Hand-maintained.
   * The real roster lives in the platform's KV and is edited in the dashboard;
   * an id missing from this list still works, via the /r-shell catch-all.
   */
  restaurants: RestaurantRecord[];
}

export interface ThemeColors {
  primary: string;
  accent: string;
  bg: string;
  surface: string;
  text: string;
  muted?: string;
}

export interface ThemeFonts {
  heading: string;
  body: string;
  headingWeights?: string;
  bodyWeights?: string;
}

export interface ThemeConfig {
  name: string;
  colors: ThemeColors;
  fonts: ThemeFonts;
  logoUrl?: string;
  heroImageUrl?: string;
  tagline?: string;
}

export interface ThemeProps {
  restaurant: RestaurantInfo;
  menu: MenuItem[];
  status: MenuStatus;
}

export interface ThemeModule {
  config: ThemeConfig;
  Component: ComponentType<ThemeProps>;
}
