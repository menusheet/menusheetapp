import type { Metadata } from 'next';
import RestaurantDetailShell from '@/components/admin/RestaurantDetailShell';

export const metadata: Metadata = {
  title: 'Edit restaurant',
  robots: { index: false, follow: false },
};

/**
 * /admin/restaurants/{id} is served from a single generated file for every id.
 *
 * This used to pre-render one page per restaurant from the build manifest,
 * which meant a restaurant added in the portal had no page until the next
 * deploy, and the dashboard carried a workaround that quietly rerouted new
 * rows to the "quick edit" form. Now that the roster is live in KV there is
 * nothing to pre-render from, so the page reads its own id from the address bar
 * and fetches the record from the API.
 *
 * scripts/generate-static-data.js emits the matching _redirects rule.
 */
export function generateStaticParams() {
  return [{ id: '_shell' }];
}

export default function RestaurantDetailPage() {
  return <RestaurantDetailShell />;
}
