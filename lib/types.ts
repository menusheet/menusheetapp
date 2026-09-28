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
}

export interface RestaurantsManifest {
  generatedAt: string;
  source: 'live' | 'cache' | 'seed';
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
