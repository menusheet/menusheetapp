'use client';

import { useMemo } from 'react';
import { PriceDisplay, PriceOptions } from '@/components/public/PriceDisplay';
import type { PriceTone } from '@/components/public/PriceDisplay';
import type { MenuItem, ThemeProps } from '@/lib/types';

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'section';
}

function VegChip({ isVeg }: { isVeg: boolean }) {
  const color = isVeg ? 'var(--mc-emerald)' : 'var(--mc-coral)';
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-[3px] text-[10px] font-semibold uppercase tracking-wide"
      style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}
    >
      <span className="h-[6px] w-[6px] rounded-full" style={{ backgroundColor: color }} />
      {isVeg ? 'Veg' : 'Non-veg'}
    </span>
  );
}

const priceTone: PriceTone = {
  accent: 'var(--mc-text)',
  muted: 'var(--mc-muted)',
  surface: 'color-mix(in srgb, var(--mc-emerald) 9%, transparent)',
  border: 'color-mix(in srgb, var(--mc-emerald) 25%, transparent)',
  radius: 'rounded-full',
  priceClassName: 'text-[17px] font-bold',
  labelClassName: 'text-[11px] font-medium',
};

function ItemCard({ item }: { item: MenuItem }) {
  const unavailable = !item.isAvailable;
  return (
    <div
      className={`group relative flex gap-4 rounded-[26px] bg-[var(--mc-surface)] p-3 transition-all ${
        unavailable ? 'opacity-45 saturate-0' : 'hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-20px_rgba(21,19,15,0.35)]'
      }`}
      style={{ boxShadow: '0 8px 24px -18px rgba(21,19,15,0.25)' }}
    >
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[20px]">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div
            className="grid h-full w-full place-items-center text-2xl"
            style={{ background: 'color-mix(in srgb, var(--mc-emerald) 12%, transparent)' }}
          >
            🍽️
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="truncate text-[15.5px] font-semibold leading-snug" style={{ color: 'var(--mc-text)' }}>
            {item.name}
          </h3>
          <PriceDisplay base={item.price} variants={item.priceVariants} tone={priceTone} />
        </div>
        <div className="mt-1.5">
          <VegChip isVeg={item.isVeg} />
        </div>
        {item.description ? (
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug" style={{ color: 'var(--mc-muted)' }}>
            {item.description}
          </p>
        ) : null}
        {unavailable ? null : (
          <PriceOptions variants={item.priceVariants} tone={priceTone} className="mt-2" />
        )}
        {unavailable ? (
          <span
            className="mt-2 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
            style={{ background: 'color-mix(in srgb, var(--mc-coral) 14%, transparent)', color: 'var(--mc-coral)' }}
          >
            Sold out today
          </span>
        ) : null}
      </div>
    </div>
  );
}

function Skeleton() {
  const pulse = 'rgba(21,19,15,0.07)';
  const pulseLight = 'rgba(21,19,15,0.05)';
  return (
    <div className="mx-auto max-w-md space-y-5 px-4 pb-6 pt-0">
      <div className="h-[38vh] w-full animate-pulse rounded-b-[40px]" style={{ background: pulse }} />
      <div className="space-y-2 px-2">
        <div className="h-4 w-1/2 animate-pulse rounded-full" style={{ background: pulseLight }} />
        <div className="h-3 w-1/3 animate-pulse rounded-full" style={{ background: pulseLight }} />
      </div>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex gap-4 rounded-[26px] bg-[var(--mc-surface)] p-3" style={{ boxShadow: '0 8px 24px -18px rgba(21,19,15,0.25)' }}>
          <div className="h-24 w-24 shrink-0 animate-pulse rounded-[20px]" style={{ background: pulse }} />
          <div className="flex-1 space-y-2 py-1.5">
            <div className="h-4 w-2/3 animate-pulse rounded-full" style={{ background: pulse }} />
            <div className="h-3 w-1/4 animate-pulse rounded-full" style={{ background: pulseLight }} />
            <div className="h-3 w-full animate-pulse rounded-full" style={{ background: pulseLight }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusScreen({ emoji, title, subtitle }: { emoji: string; title: string; subtitle: string }) {
  return (
    <div className="grid min-h-[80vh] place-items-center px-6">
      <div className="w-full max-w-sm rounded-[32px] bg-[var(--mc-surface)] p-9 text-center" style={{ boxShadow: '0 24px 60px -24px rgba(21,19,15,0.3)' }}>
        <div
          className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full text-3xl"
          style={{ background: 'color-mix(in srgb, var(--mc-amber) 16%, transparent)' }}
        >
          {emoji}
        </div>
        <h1 className="text-[22px] font-bold" style={{ color: 'var(--mc-text)' }}>
          {title}
        </h1>
        <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: 'var(--mc-muted)' }}>
          {subtitle}
        </p>
      </div>
    </div>
  );
}

function PoweredBy() {
  return (
    <p className="pb-8 pt-2 text-center text-[11px]" style={{ color: 'var(--mc-muted)' }}>
      Powered by{' '}
      <a href="/" className="font-semibold underline underline-offset-2" style={{ color: 'var(--mc-text)' }}>
        MenuSheet
      </a>
    </p>
  );
}

export default function Theme({ restaurant, menu, status }: ThemeProps) {
  const categories = useMemo(() => {
    const seen: string[] = [];
    for (const item of menu) {
      if (!seen.includes(item.category)) seen.push(item.category);
    }
    return seen;
  }, [menu]);

  const cssVars = {
    '--mc-amber': '#FF9F1C',
    '--mc-emerald': '#0B6E4F',
    '--mc-coral': '#E4572E',
    '--mc-bg': '#F4F5F1',
    '--mc-surface': '#FFFFFF',
    '--mc-text': '#15130F',
    '--mc-muted': '#78766F',
  } as React.CSSProperties;

  const shell = 'min-h-screen font-sans antialiased';

  if (status === 'loading') {
    return (
      <div className={shell} style={{ ...cssVars, background: 'var(--mc-bg)' }}>
        <Skeleton />
      </div>
    );
  }

  if (status === 'inactive' || status === 'expired') {
    const isInactive = status === 'inactive';
    return (
      <div
        className={shell}
        style={{ ...cssVars, background: 'var(--mc-bg)', color: 'var(--mc-text)', fontFamily: "'Inter', sans-serif" }}
      >
        <StatusScreen
          emoji={isInactive ? '⏳' : '🌙'}
          title={isInactive ? 'Menu temporarily unavailable' : 'This menu is no longer active'}
          subtitle={
            isInactive
              ? `${restaurant.name} will be back shortly. Please check again in a little while.`
              : `The digital menu for ${restaurant.name} is currently unavailable.`
          }
        />
        <PoweredBy />
      </div>
    );
  }

  return (
    <div
      className={shell}
      style={{ ...cssVars, background: 'var(--mc-bg)', color: 'var(--mc-text)', fontFamily: "'Inter', sans-serif" }}
    >
      {/* Hero */}
      <header className="relative">
        <div className="relative h-[34vh] min-h-[220px] w-full overflow-hidden rounded-b-[40px] sm:h-[40vh]">
          {restaurant.heroImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={restaurant.heroImageUrl} alt={restaurant.name} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full" style={{ background: 'linear-gradient(145deg, var(--mc-emerald), #073B2B)' }} />
          )}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(21,19,15,0.05) 0%, rgba(21,19,15,0.55) 100%)' }} />
        </div>

        {/* Floating glass identity card, overlapping the hero */}
        <div className="mx-auto -mt-14 max-w-md px-5">
          <div
            className="flex items-center gap-4 rounded-[28px] p-4 backdrop-blur-xl"
            style={{
              background: 'color-mix(in srgb, var(--mc-surface) 88%, transparent)',
              boxShadow: '0 20px 50px -20px rgba(21,19,15,0.35)',
            }}
          >
            {restaurant.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={restaurant.logoUrl} alt={`${restaurant.name} logo`} className="h-14 w-14 shrink-0 rounded-2xl object-cover" />
            ) : (
              <div
                className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-lg font-bold text-white"
                style={{ background: 'linear-gradient(145deg, var(--mc-amber), var(--mc-coral))' }}
              >
                {(restaurant.name || 'T')
                  .split(' ')
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-[19px] font-bold leading-tight">{restaurant.name}</h1>
              {restaurant.tagline ? (
                <p className="mt-0.5 truncate text-[12.5px]" style={{ color: 'var(--mc-muted)' }}>
                  {restaurant.tagline}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {categories.length > 0 ? (
        <nav className="sticky top-0 z-20 mt-5 pb-1 pt-3" style={{ background: 'linear-gradient(180deg, var(--mc-bg) 70%, transparent)' }}>
          <div className="mx-auto flex max-w-md gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {categories.map((cat) => (
              <a
                key={cat}
                href={`#cat-${slugify(cat)}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(`cat-${slugify(cat)}`)?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold backdrop-blur-md transition hover:opacity-80"
                style={{
                  background: 'color-mix(in srgb, var(--mc-surface) 92%, transparent)',
                  color: 'var(--mc-text)',
                  boxShadow: '0 4px 14px -8px rgba(21,19,15,0.3)',
                }}
              >
                {cat}
              </a>
            ))}
          </div>
        </nav>
      ) : null}

      <main className="mx-auto max-w-md px-4 pb-10 pt-2">
        {categories.length === 0 ? (
          <div className="py-24 text-center">
            <div className="mb-3 text-4xl">🍽️</div>
            <p className="font-semibold">Menu coming soon</p>
            <p className="mt-1 text-sm" style={{ color: 'var(--mc-muted)' }}>
              Our kitchen is preparing something wonderful.
            </p>
          </div>
        ) : (
          categories.map((cat) => (
            <section key={cat} id={`cat-${slugify(cat)}`} className="scroll-mt-24 pt-7 first:pt-3">
              <div className="mb-4 flex items-baseline justify-between">
                <h2 className="text-[21px] font-bold tracking-tight">{cat}</h2>
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={{ background: 'color-mix(in srgb, var(--mc-emerald) 12%, transparent)', color: 'var(--mc-emerald)' }}
                >
                  {menu.filter((m) => m.category === cat).length}
                </span>
              </div>
              <div className="space-y-3">
                {menu
                  .filter((m) => m.category === cat)
                  .map((item) => (
                    <ItemCard key={item.id} item={item} />
                  ))}
              </div>
            </section>
          ))
        )}
      </main>

      <footer className="pb-10 pt-4 text-center">
        <p className="text-xs" style={{ color: 'var(--mc-muted)' }}>
          © {new Date().getFullYear()} {restaurant.name}
        </p>
        <PoweredBy />
      </footer>
    </div>
  );
}