'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getTheme } from '@/themes';
import { clearCache, readCache, writeCache } from '@/lib/menuCache';
import { normalizeMenuPayload } from '@/lib/normalizeMenu';
import type { MenuPayload, RestaurantInfo } from '@/lib/types';

interface Props {
  restaurantId: string;
  themeKey: string;
  appscriptUrl: string;
  initialPayload: MenuPayload;
  fallbackName: string;
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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const sep = appscriptUrl.includes('?') ? '&' : '?';
      const res = await fetch(`${appscriptUrl}${sep}action=getMenu`, {
        signal: controller.signal,
        redirect: 'follow',
      });
      if (!res.ok) return null;
      const data = await res.json().catch(() => null);
      if (!data) return null;
      return normalizeMenuPayload(data);
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }, [appscriptUrl]);

  /* Apps Script cold starts are flaky — retry with a short backoff so a single
     slow/failed warm-up request doesn't strand the page on the loading screen. */
  const fetchLiveWithRetry = useCallback(async (): Promise<MenuPayload | null> => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const live = await fetchLive();
      if (live) return live;
      if (attempt < 2) await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
    return null;
  }, [fetchLive]);

  useEffect(() => {
    const cached = readCache(restaurantId);
    let cancelled = false;

    if (cached?.fresh) {
      setPayload(cached.payload);
      setUpdatedAt(cached.timestamp);
      return undefined;
    }

    /* Stale cache: show it immediately so the page never sits on the spinner,
       then swap in fresh data when the network round-trip finishes. */
    if (cached) {
      setPayload(cached.payload);
      setUpdatedAt(cached.timestamp);
    }

    (async () => {
      const live = await fetchLiveWithRetry();
      if (cancelled) return;
      if (live) {
        setPayload(live);
        setUpdatedAt(Date.now());
        writeCache(restaurantId, live);
      } else if (!cached) {
        /* Nothing cached and every attempt failed — fall back to the server's
           snapshot so the loading screen can't spin forever. The Refresh pill
           stays available to retry the live fetch. */
        setPayload(initialPayload);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [restaurantId, fetchLiveWithRetry, initialPayload]);

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
