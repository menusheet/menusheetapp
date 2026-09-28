'use client';

import { useMemo } from 'react';
import { PriceDisplay, PriceOptions } from '@/components/public/PriceDisplay';
import type { PriceTone } from '@/components/public/PriceDisplay';
import type { MenuItem, ThemeProps } from '@/lib/types';

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'section';
}

function VegMark({ isVeg }: { isVeg: boolean }) {
  const color = isVeg ? '#16A34A' : '#DC2626';
  return (
    <span
      title={isVeg ? 'Vegetarian' : 'Non-vegetarian'}
      className="inline-grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border-2"
      style={{ borderColor: color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
    </span>
  );
}

const priceTone: PriceTone = {
  accent: 'var(--ms-primary)',
  muted: 'var(--ms-muted)',
  surface: 'color-mix(in srgb, var(--ms-primary) 8%, transparent)',
  border: 'color-mix(in srgb, var(--ms-primary) 22%, transparent)',
  radius: 'rounded-full',
  priceClassName: 'text-base font-semibold',
  labelClassName: 'text-[11px] font-medium',
};

function ItemCard({ item }: { item: MenuItem }) {
  const unavailable = !item.isAvailable;
  return (
    <div
      className={`relative overflow-hidden rounded-2xl p-3 transition ${unavailable ? 'opacity-50 saturate-0' : ''}`}
      style={{
        backgroundColor: 'var(--ms-surface)',
        boxShadow: '0 1px 3px rgba(36,48,31,0.08)',
        border: '1px solid rgba(36,48,31,0.06)',
      }}
    >
      <div className="flex gap-3">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.name}
            loading="lazy"
            className="h-20 w-20 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <div
            className="grid h-20 w-20 shrink-0 place-items-center rounded-xl text-xl"
            style={{ background: 'color-mix(in srgb, var(--ms-primary) 10%, transparent)' }}
          >
            🍽️
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <VegMark isVeg={item.isVeg} />
              <h3 className="truncate text-[15px] font-semibold leading-tight">{item.name}</h3>
            </div>
            <PriceDisplay base={item.price} variants={item.priceVariants} tone={priceTone} />
          </div>
          {item.description ? (
            <p
              className="mt-1 line-clamp-2 text-[13px] leading-snug"
              style={{ color: 'var(--ms-muted)' }}
            >
              {item.description}
            </p>
          ) : null}
          {unavailable ? null : (
            <PriceOptions variants={item.priceVariants} tone={priceTone} className="mt-2" />
          )}
          {unavailable ? (
            <span
              className="mt-2 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
              style={{
                background: 'color-mix(in srgb, var(--ms-accent) 15%, transparent)',
                color: 'var(--ms-accent)',
              }}
            >
              Sold out today
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Skeleton() {
  const pulse = 'rgba(0,0,0,0.06)';
  const pulseLight = 'rgba(0,0,0,0.04)';
  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-6">
      <div className="h-44 animate-pulse rounded-2xl" style={{ background: pulse }} />
      <div className="space-y-2 px-1">
        <div className="h-3 w-1/3 animate-pulse rounded" style={{ background: pulseLight }} />
      </div>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex gap-3 rounded-2xl p-3" style={{ background: 'var(--ms-surface)', boxShadow: '0 1px 3px rgba(36,48,31,0.08)' }}>
          <div className="h-20 w-20 shrink-0 animate-pulse rounded-xl" style={{ background: pulse }} />
          <div className="flex-1 space-y-2 py-1">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 shrink-0 animate-pulse rounded" style={{ background: pulse }} />
              <div className="h-4 w-2/3 animate-pulse rounded" style={{ background: pulse }} />
            </div>
            <div className="h-3 w-full animate-pulse rounded" style={{ background: pulseLight }} />
            <div className="flex items-center justify-between">
              <div className="h-3 w-1/4 animate-pulse rounded" style={{ background: pulseLight }} />
              <div className="h-4 w-12 animate-pulse rounded" style={{ background: 'color-mix(in srgb, var(--ms-primary) 12%, transparent)' }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusScreen({ emoji, title, subtitle }: { emoji: string; title: string; subtitle: string }) {
  return (
    <div className="grid min-h-[60vh] place-items-center px-6">
      <div
        className="w-full max-w-sm rounded-3xl p-8 text-center"
        style={{
          backgroundColor: 'var(--ms-surface)',
          boxShadow: '0 10px 40px -12px rgba(36,48,31,0.15)',
          border: '1px solid rgba(36,48,31,0.06)',
        }}
      >
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full text-3xl"
          style={{ background: 'color-mix(in srgb, var(--ms-primary) 10%, transparent)' }}>
          {emoji}
        </div>
        <h1 className="font-heading text-2xl font-bold">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--ms-muted)' }}>{subtitle}</p>
      </div>
    </div>
  );
}

export default function GreenForkTheme({ restaurant, menu, status }: ThemeProps) {
  const categories = useMemo(() => {
    const seen: string[] = [];
    for (const item of menu) {
      if (!seen.includes(item.category)) seen.push(item.category);
    }
    return seen;
  }, [menu]);

  const cssVars = {
    '--ms-primary': '#2E5D34',
    '--ms-accent': '#C96F4A',
    '--ms-bg': '#FAF7F0',
    '--ms-surface': '#FFFFFF',
    '--ms-text': '#24301F',
    '--ms-muted': '#7A8271',
  } as React.CSSProperties;

  const shell = 'min-h-screen font-sans antialiased';

  if (status === 'loading') {
    return (
      <div className={shell} style={cssVars}>
        <Skeleton />
      </div>
    );
  }

  if (status === 'inactive') {
    return (
      <div className={shell} style={{ ...cssVars, background: 'var(--ms-bg)', color: 'var(--ms-text)', fontFamily: "'Inter', sans-serif" }}>
        <StatusScreen
          emoji="🍽️"
          title="Menu temporarily unavailable"
          subtitle={`${restaurant.name} will be back shortly. Please check again in a little while.`}
        />
        <PoweredBy />
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className={shell} style={{ ...cssVars, background: 'var(--ms-bg)', color: 'var(--ms-text)', fontFamily: "'Inter', sans-serif" }}>
        <StatusScreen
          emoji="📋"
          title="This menu is no longer active"
          subtitle={`The digital menu for ${restaurant.name} is currently unavailable.`}
        />
        <PoweredBy />
      </div>
    );
  }

  return (
    <div
      className={shell}
      style={{
        ...cssVars,
        background: 'var(--ms-bg)',
        color: 'var(--ms-text)',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <header className="relative">
        {restaurant.heroImageUrl ? (
          <div className="relative h-52 w-full overflow-hidden sm:h-64">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={restaurant.heroImageUrl}
              alt={restaurant.name}
              className="h-full w-full object-cover"
            />
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to top, var(--ms-bg) 4%, rgba(250,247,240,0) 55%)' }}
            />
          </div>
        ) : (
          <div className="h-28" style={{ background: 'var(--ms-primary)' }} />
        )}
        <div className="mx-auto -mt-14 max-w-md px-5 pb-2">
          <div className="flex items-end gap-4">
            {restaurant.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={restaurant.logoUrl}
                alt={`${restaurant.name} logo`}
                className="h-20 w-20 rounded-2xl object-cover ring-4"
                style={{ boxShadow: '0 8px 24px rgba(36,48,31,0.18)' }}
              />
            ) : (
              <div
                className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl font-heading text-2xl font-bold text-white ring-4 ring-white/70"
                style={{
                  background: 'linear-gradient(135deg, var(--ms-primary), color-mix(in srgb, var(--ms-primary) 70%, var(--ms-accent)))',
                  boxShadow: '0 8px 24px rgba(36,48,31,0.25)',
                }}
              >
                {(restaurant.name || 'M')
                  .split(' ')
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </div>
            )}
            <div className="pb-1">
              <h1 className="font-heading text-[26px] font-bold leading-tight">{restaurant.name}</h1>
              {restaurant.tagline ? (
                <p className="mt-0.5 text-[13px]" style={{ color: 'var(--ms-muted)' }}>
                  {restaurant.tagline}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {categories.length > 0 ? (
        <nav
          className="sticky top-0 z-20 border-b backdrop-blur"
          style={{
            background: 'color-mix(in srgb, var(--ms-surface) 88%, transparent)',
            borderColor: 'rgba(36,48,31,0.08)',
          }}
        >
          <div className="mx-auto flex max-w-md gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {categories.map((cat) => (
              <a
                key={cat}
                href={`#cat-${slugify(cat)}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(`cat-${slugify(cat)}`)?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="shrink-0 rounded-full px-4 py-2 text-[13px] font-medium transition hover:opacity-80"
                style={{ background: 'color-mix(in srgb, var(--ms-primary) 9%, transparent)', color: 'var(--ms-primary)' }}
              >
                {cat}
              </a>
            ))}
          </div>
        </nav>
      ) : null}

      <main className="mx-auto max-w-md px-4 pb-10 pt-5">
        {categories.length === 0 ? (
          <div className="py-20 text-center">
            <div className="mb-3 text-4xl">🧑‍🍳</div>
            <p className="font-medium">Menu coming soon</p>
            <p className="mt-1 text-sm" style={{ color: 'var(--ms-muted)' }}>
              Dishes are being plated as we speak.
            </p>
          </div>
        ) : (
          categories.map((cat) => (
            <section key={cat} id={`cat-${slugify(cat)}`} className="scroll-mt-20 pt-5 first:pt-1">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="font-heading text-xl font-bold">{cat}</h2>
                <span className="text-xs" style={{ color: 'var(--ms-muted)' }}>
                  {menu.filter((m) => m.category === cat).length} items
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
        <p className="text-xs" style={{ color: 'var(--ms-muted)' }}>
          © {new Date().getFullYear()} {restaurant.name}
        </p>
        <PoweredBy />
      </footer>
    </div>
  );
}

function PoweredBy() {
  return (
    <p className="pb-6 pt-2 text-center text-[11px]" style={{ color: 'var(--ms-muted)' }}>
      Powered by{' '}
      <a href="/" className="underline underline-offset-2" style={{ color: 'var(--ms-primary)' }}>
        MenuSheet
      </a>
    </p>
  );
}
