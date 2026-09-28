import type { Metadata } from 'next';
import RestaurantDetail from '@/components/admin/RestaurantDetail';
import { loadManifest } from '@/lib/staticData';

export const metadata: Metadata = {
  title: 'Edit restaurant',
  robots: { index: false, follow: false },
};

export function generateStaticParams() {
  try {
    return loadManifest().restaurants.map((r) => ({ id: r.restaurant_id }));
  } catch {
    return [];
  }
}

export default async function RestaurantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RestaurantDetail restaurantId={id} />;
}
