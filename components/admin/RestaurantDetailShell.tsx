'use client';

import { useEffect, useState } from 'react';
import RestaurantDetail from '@/components/admin/RestaurantDetail';

/**
 * Resolves the restaurant id from the current /admin/restaurants/{id} URL.
 *
 * The detail page is generated once for every id (see the page's
 * generateStaticParams) and reads its own id here, so a restaurant created in
 * the portal opens correctly without a rebuild.
 */
export default function RestaurantDetailShell() {
  const [restaurantId, setRestaurantId] = useState('');

  useEffect(() => {
    const match = window.location.pathname.match(/^\/admin\/restaurants\/([^/?#]+)/);
    if (!match) return;
    const id = decodeURIComponent(match[1]);
    // The generated shell file is addressable directly during local testing.
    if (id && id !== '_shell') setRestaurantId(id);
  }, []);

  // There is no id to load until the effect runs, which is a single tick.
  if (!restaurantId) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <div
          className="h-7 w-7 animate-spin rounded-full border-2 border-gray-200 border-t-gray-500"
          role="status"
          aria-label="Loading"
        />
      </div>
    );
  }

  return <RestaurantDetail restaurantId={restaurantId} />;
}
