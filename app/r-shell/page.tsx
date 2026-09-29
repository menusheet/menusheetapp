'use client';

import { useEffect, useState } from 'react';
import MenuPageClient from '@/components/public/MenuPageClient';
import type { MenuPayload } from '@/lib/types';

/**
 * The universal menu page.
 *
 * /r/{id} is served two ways, and this file is the second one.
 *
 * Every restaurant in the build manifest gets its own pre-rendered page at
 * app/r/[id]/page.tsx, with server-rendered metadata, JSON-LD and font links.
 * Those win: scripts/generate-static-data.js writes a Cloudflare Pages
 * _redirects rule per known id, and Pages applies the first matching rule.
 *
 * Anything else falls through to this shell, which reads the id out of the
 * address bar and asks the platform API for the menu. That means a restaurant
 * added in the admin portal is live at its QR URL the moment the operator
 * presses Reload — no rebuild, no redeploy. It gets full server rendering on
 * the next deploy, once it is in the manifest.
 *
 * The theme is intentionally passed as '' here. This page has no build-time
 * idea which theme a given id uses, so MenuPageClient holds a plain spinner
 * until the API reports the theme key, rather than flashing the fallback theme.
 */

const LOADING_PAYLOAD: MenuPayload = { status: 'loading' };

function restaurantIdFromPath(pathname: string): string {
  const match = pathname.match(/^\/r\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

export default function MenuShell() {
  const [restaurantId, setRestaurantId] = useState('');

  useEffect(() => {
    setRestaurantId(restaurantIdFromPath(window.location.pathname));
  }, []);

  /* Before the effect runs there is no id, so there is nothing to ask for.
     The page is about to be replaced anyway. */
  if (!restaurantId) return null;

  return (
    <MenuPageClient
      restaurantId={restaurantId}
      themeKey=""
      initialPayload={LOADING_PAYLOAD}
      fallbackName="Menu"
      updateDocumentTitle
    />
  );
}
