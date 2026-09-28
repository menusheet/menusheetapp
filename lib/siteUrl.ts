export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://menusheetapp.pages.dev').replace(/\/+$/, '');
}

export function publicMenuUrl(restaurantId: string): string {
  return `${siteUrl()}/r/${restaurantId}`;
}
