'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getTheme } from '@/themes';
import { clearCache, readCache, writeCache } from '@/lib/menuCache';
import type { MenuPayload, MenuItem, RestaurantInfo } from '@/lib/types';

interface Props {
  restaurantId: string;
  themeKey: string;
  appscriptUrl: string;
  initialPayload: MenuPayload;
  fallbackName: string;
}

function normalizeItem(raw: Record<string, unknown>): MenuItem {
  const bool = (v: unknown, fallback: boolean) =>
    v === true || String(v).trim().toUpperCase() === 'TRUE'
      ? true
      : v === false || String(v).trim().toUpperCase() === 'FALSE'
        ? false
        : fallback;
  const num = (v: unknown) => {
    const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, ''));
    return isNaN(n) ? 0 : n;
  };
  const str = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());
  return {
    id: str(raw.id) || Math.random().toString(36).slice(2),
    category: str(raw.category) || 'Menu',
    name: str(raw.name),
    description: str(raw.description),
    price: num(raw.price),
    imageUrl: str(raw.image_url ?? raw.imageUrl),
    isVeg: bool(raw.is_veg ?? raw.isVeg, true),
    isAvailable: bool(raw.is_available ?? raw.isAvailable, true),
    sortOrder: num(raw.sort_order ?? raw.sortOrder),
  };
}

function normalizePayload(data: Record<string, unknown>): MenuPayload | null {
  if (!data || typeof data !== 'object') return null;
  const status = String((data as { status?: unknown }).status || '');
  if (!['ok', 'inactive', 'expired'].includes(status)) return null;
  if (status !== 'ok') return { status: status as MenuPayload['status'] };
  const rawMenu = Array.isArray((data as { menu?: unknown }).menu)
    ? ((data as { menu: unknown[] }).menu as Record<string, unknown>[])
    : [];
  const rawRestaurant = ((data as { restaurant?: Record<string, unknown> }).restaurant || {}) as Record<string, unknown>;
  return {
    status: 'ok',
    restaurant: {
      name: String(rawRestaurant.name ?? ''),
      tagline: rawRestaurant.tagline ? String(rawRestaurant.tagline) : undefined,
    },
    menu: rawMenu.map(normalizeItem),
  };
}

function timeAgo(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} d ago`;
}

export default function MenuPageClient({
  restaurantId,
  themeKey,
  appscriptUrl,
  initialPayload,
  fallbackName,
}: Props) {
  const theme = getTheme(themeKey);
  const [payload, setPayload] = useState<MenuPayload>(
    appscriptUrl ? { ...initialPayload, status: 'loading' } : initialPayload
  );
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const fetchLive = useCallback(async (): Promise<MenuPayload | null> => {
    if (!appscriptUrl) return null;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const sep = appscriptUrl.includes('?') ? '&' : '?';
      const res = await fetch(`${appscriptUrl}${sep}action=getMenu`, {
        signal: controller.signal,
        redirect: 'follow',
      });
      clearTimeout(timer);
      if (!res.ok) return null;
      return normalizePayload(await res.json());
    } catch {
      return null;
    }
  }, [appscriptUrl]);

  useEffect(() => {
    const cached = readCache(restaurantId);
    if (cached) {
      setPayload(cached.payload);
      setUpdatedAt(cached.timestamp);
      if (cached.fresh) return;
    }
    let cancelled = false;
    (async () => {
      const live = await fetchLive();
      if (cancelled || !live) return;
      setPayload(live);
      setUpdatedAt(Date.now());
      writeCache(restaurantId, live);
    })();
    return () => {
      cancelled = true;
    };
  }, [restaurantId, fetchLive]);

  const onRefresh = useCallback(async () => {
    if (!appscriptUrl || refreshing) return;
    setRefreshing(true);
    clearCache(restaurantId);
    const live = await fetchLive();
    if (live) {
      setPayload(live);
      setUpdatedAt(Date.now());
      writeCache(restaurantId, live);
    }
    setRefreshing(false);
  }, [appscriptUrl, restaurantId, refreshing, fetchLive]);

  const themeProps = useMemo(() => {
    const cfg = theme.config;
    const live = payload.restaurant;
    const restaurant: RestaurantInfo = {
      name: cfg.name || live?.name || fallbackName,
      tagline: cfg.tagline || live?.tagline,
      logoUrl: cfg.logoUrl || undefined,
      heroImageUrl: cfg.heroImageUrl || undefined,
    };
    return { restaurant, menu: payload.menu ?? [], status: payload.status };
  }, [theme, payload, fallbackName]);

  const ThemeComponent = theme.Component;

  return (
    <>
      <ThemeComponent {...themeProps} />
      {appscriptUrl ? (
        <div
          className="fixed bottom-3 left-1/2 z-30 -translate-x-1/2 opacity-0 transition-opacity duration-300 hover:opacity-100 focus-within:opacity-100"
          style={{ opacity: refreshing ? 1 : undefined }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = '1';
          }}
          onMouseLeave={(e) => {
            if (!refreshing) (e.currentTarget as HTMLElement).style.opacity = '';
          }}
        >
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] shadow-sm transition active:scale-95"
            style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(6px)' }}
          >
            <span className={refreshing ? 'inline-block animate-spin' : 'inline-block'}>↻</span>
            {refreshing ? 'Refreshing…' : 'Refresh menu'}
            {updatedAt && !refreshing ? (
              <span className="opacity-60">· {timeAgo(updatedAt)}</span>
            ) : null}
          </button>
        </div>
      ) : null}
    </>
  );
}
