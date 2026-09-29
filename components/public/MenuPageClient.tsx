'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getTheme } from '@/themes';
import { clearCache, readCache, writeCache } from '@/lib/menuCache';
import { fetchMenuPayload, menuApiConfigured } from '@/lib/menuApi';
import { normalizeMenuPayload } from '@/lib/normalizeMenu';
import type { MenuPayload, RestaurantInfo } from '@/lib/types';

interface Props {
  restaurantId: string;
  /**
   * The theme to render. The pre-rendered /r/{id} pages get this from the build
   * manifest; the catch-all shell passes '' because it serves ids the build has
   * never heard of and learns the theme from the API instead.
   */
  themeKey: string;
  initialPayload: MenuPayload;
  fallbackName: string;
  /**
   * Rewrite document.title once the real name is known. Only the shell needs
   * this — a pre-rendered page already has a correct server-rendered title and
   * overwriting it client-side would just risk drifting from it.
   */
  updateDocumentTitle?: boolean;
}

function timeAgo(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} d ago`;
}

function ThemePending() {
  return (
    <div className="grid min-h-screen place-items-center bg-neutral-50">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600"
        role="status"
        aria-label="Loading menu"
      />
    </div>
  );
}

export default function MenuPageClient({
  restaurantId,
  themeKey,
  initialPayload,
  fallbackName,
  updateDocumentTitle = false,
}: Props) {
  const configured = menuApiConfigured();

  const [payload, setPayload] = useState<MenuPayload>(
    configured ? { ...initialPayload, status: 'loading' } : initialPayload
  );
  /* The theme is chosen by the roster, not by the build, so a theme change
     takes effect on the next page load with no redeploy. The build-time key is
     only the first guess, used until the API answers. */
  const [activeThemeKey, setActiveThemeKey] = useState(themeKey);
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
    return fetchMenuPayload(restaurantId, normalizeMenuPayload);
  }, [restaurantId]);

  /* The Worker answers from an edge cache, so a retry is only insurance against
     a dropped connection rather than a cold start. Two attempts is enough. */
  const fetchLiveWithRetry = useCallback(async (): Promise<MenuPayload | null> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const live = await fetchLive();
      if (live) return live;
      if (attempt < 1) await new Promise((r) => setTimeout(r, 600));
    }
    return null;
  }, [fetchLive]);

  useEffect(() => {
    if (!configured) return undefined;

    const cached = readCache(restaurantId);
    let cancelled = false;

    if (cached?.fresh) {
      setPayload(cached.payload);
      setActiveThemeKey(cached.payload.theme_key || themeKey);
      setUpdatedAt(cached.timestamp);
      return undefined;
    }

    /* Stale cache: show it immediately so the page never sits on the spinner,
       then swap in fresh data when the network round-trip finishes. */
    if (cached) {
      setPayload(cached.payload);
      setActiveThemeKey(cached.payload.theme_key || themeKey);
      setUpdatedAt(cached.timestamp);
    }

    (async () => {
      const live = await fetchLiveWithRetry();
      if (cancelled) return;
      if (live) {
        setPayload(live);
        if (live.theme_key) setActiveThemeKey(live.theme_key);
        setUpdatedAt(Date.now());
        writeCache(restaurantId, live);
      } else if (!cached) {
        /* Nothing cached and the request failed — fall back to the build-time
           snapshot so the loading screen can't spin forever. The Refresh pill
           stays available to retry. */
        setPayload(initialPayload);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [restaurantId, configured, fetchLiveWithRetry, initialPayload, themeKey]);

  const onRefresh = useCallback(async () => {
    if (!configured || refreshing) return;
    setRefreshing(true);
    clearCache(restaurantId);
    const live = await fetchLive();
    if (live) {
      setPayload(live);
      if (live.theme_key) setActiveThemeKey(live.theme_key);
      setUpdatedAt(Date.now());
      writeCache(restaurantId, live);
    }
    setRefreshing(false);
  }, [configured, restaurantId, refreshing, fetchLive]);

  const theme = activeThemeKey ? getTheme(activeThemeKey) : null;

  const themeProps = useMemo(() => {
    if (!theme) return null;
    const cfg = theme.config;
    const live = payload.restaurant;
    const restaurant: RestaurantInfo = {
      name: cfg.name || live?.name || payload.restaurant_name || fallbackName,
      tagline: cfg.tagline || live?.tagline,
      logoUrl: cfg.logoUrl || undefined,
      heroImageUrl: cfg.heroImageUrl || undefined,
    };
    return { restaurant, menu: payload.menu ?? [], status: payload.status };
  }, [theme, payload, fallbackName]);

  /* Read off themeProps before the early return below, and keep the effect with
     the other hooks — a hook after a conditional return does not run on the
     render that bails out, which loses a hook and breaks the next render. */
  const resolvedName = themeProps?.restaurant.name;
  const resolvedTagline = themeProps?.restaurant.tagline;

  useEffect(() => {
    if (!updateDocumentTitle || !resolvedName) return;
    document.title = resolvedTagline ? `${resolvedName} — ${resolvedTagline}` : `${resolvedName} — Menu`;
  }, [updateDocumentTitle, resolvedName, resolvedTagline]);

  /* Pre-rendered pages always arrive with a theme key from the build manifest.
     The /r-shell catch-all does not: it serves any restaurant id, so it only
     learns the theme from the API response. Hold a neutral spinner for that
     one round trip rather than flashing the fallback theme. */
  if (!theme || !themeProps) return <ThemePending />;

  const ThemeComponent = theme.Component;

  return (
    <>
      <ThemeComponent {...themeProps} />
      {configured ? (
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
