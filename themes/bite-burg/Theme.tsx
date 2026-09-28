'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { PriceDisplay, PriceOptions } from '@/components/public/PriceDisplay';
import type { PriceTone } from '@/components/public/PriceDisplay';
import type { MenuItem, ThemeProps } from '@/lib/types';

const cssVars = {
  '--ms-primary': '#E31E24',
  '--ms-secondary': '#F4DD00',
  '--ms-background': '#D9E2DF',
  '--ms-surface': '#EEF3F1',
  '--ms-dark': '#292116',
  '--ms-text': '#292116',
  '--ms-muted': '#68706D',
  '--ms-font-heading': "'Archivo Black', 'Arial Black', 'Inter', sans-serif",
  '--ms-font-body': "'Archivo', 'Inter', ui-sans-serif, system-ui, 'Segoe UI', Arial, sans-serif",
} as React.CSSProperties;

const headingFont = { fontFamily: 'var(--ms-font-heading)' } as React.CSSProperties;
const bodyFont = { fontFamily: 'var(--ms-font-body)' } as React.CSSProperties;

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'section'
  );
}

function VegMark({ isVeg }: { isVeg: boolean }) {
  const color = isVeg ? '#1F7A3D' : 'var(--ms-primary)';
  return (
    <span
      role="img"
      aria-label={isVeg ? 'Vegetarian' : 'Non-vegetarian'}
      title={isVeg ? 'Vegetarian' : 'Non-vegetarian'}
      className="inline-flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-[3px] border border-solid"
      style={{ borderColor: color }}
    >
      <span className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: color }} />
    </span>
  );
}

const priceTone: PriceTone = {
  accent: 'var(--ms-primary)',
  muted: 'var(--ms-muted)',
  surface: 'color-mix(in srgb, var(--ms-primary) 10%, transparent)',
  border: 'color-mix(in srgb, var(--ms-primary) 35%, transparent)',
  radius: 'rounded-md',
  priceClassName: 'whitespace-nowrap px-2 py-[3px] text-[13px] font-black leading-none sm:text-sm',
  rangeClassName: 'whitespace-nowrap px-2 py-[3px] text-[12px] font-black leading-none sm:text-[13px]',
  labelClassName: 'text-[11px] font-extrabold',
  uppercase: true,
};

const priceBadge = {
  background: 'color-mix(in srgb, var(--ms-primary) 10%, transparent)',
  boxShadow: 'inset 0 0 0 1.5px color-mix(in srgb, var(--ms-primary) 35%, transparent)',
} as React.CSSProperties;

function ItemCard({ item }: { item: MenuItem }) {
  const unavailable = !item.isAvailable;
  return (
    <li
      className={`relative flex gap-3 rounded-2xl p-2.5 sm:gap-4 sm:p-3 ${
        unavailable ? 'opacity-50 saturate-0' : ''
      }`}
      style={{
        ...bodyFont,
        background: 'var(--ms-surface)',
        boxShadow: unavailable
          ? 'none'
          : '0 1px 0 0 color-mix(in srgb, var(--ms-dark) 10%, transparent)',
      }}
    >
      <div
        className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-[18px] sm:h-[92px] sm:w-[92px]"
        style={{ background: 'color-mix(in srgb, var(--ms-dark) 6%, var(--ms-surface))' }}
      >
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt={item.name} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ background: 'color-mix(in srgb, var(--ms-primary) 8%, var(--ms-surface))' }}
          >
            <svg viewBox="0 0 48 48" className="h-7 w-7" fill="none" aria-hidden="true">
              <circle cx="24" cy="26" r="13" stroke="var(--ms-primary)" strokeWidth="2.5" />
              <path d="M13 19h22" stroke="var(--ms-primary)" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M18 13c0-2 2-2 2-4M28 13c0-2 2-2 2-4" stroke="var(--ms-secondary)" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <h3
            dir="auto"
            className="min-w-0 truncate text-[15px] font-extrabold uppercase leading-tight tracking-tight sm:text-[17px]"
            style={{ ...headingFont, color: 'var(--ms-dark)' }}
          >
            {item.name}
          </h3>
          <VegMark isVeg={item.isVeg} />
        </div>

        {item.description ? (
          <p dir="auto" className="mt-1 line-clamp-2 text-[12.5px] leading-snug" style={{ color: 'var(--ms-muted)' }}>
            {item.description}
          </p>
        ) : null}

        {unavailable ? null : (
          <PriceOptions variants={item.priceVariants} tone={priceTone} className="mt-2" />
        )}

        <div className="mt-auto flex items-end justify-between gap-2 pt-1.5">
          {unavailable ? (
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--ms-muted)' }}>
              Unavailable
            </span>
          ) : (
            <PriceDisplay
              base={item.price}
              variants={item.priceVariants}
              tone={priceTone}
              style={priceBadge}
            />
          )}
        </div>
      </div>
    </li>
  );
}

function Skeleton() {
  const block = 'color-mix(in srgb, var(--ms-primary) 12%, transparent)';
  const soft = 'color-mix(in srgb, var(--ms-dark) 8%, var(--ms-surface))';
  return (
    <div className="mx-auto w-full max-w-5xl px-3 pb-24 pt-3 sm:px-5" style={{ ...bodyFont, background: 'var(--ms-background)' }}>
      <div className="h-[34vh] max-h-[340px] w-full animate-pulse rounded-[28px]" style={{ background: block }} />

      <div className="sticky top-0 z-20 -mx-3 mt-3 overflow-x-auto px-3 py-2" style={{ background: 'var(--ms-background)' }}>
        <div className="flex gap-2">
          {[70, 96, 84, 62].map((w, i) => (
            <div key={i} className="h-9 flex-none animate-pulse rounded-md" style={{ width: w, background: block }} />
          ))}
        </div>
      </div>

      <div className="mt-4">
        <div className="h-7 w-44 animate-pulse rounded-md" style={{ background: block }} />
        <ul className="mt-4 grid grid-cols-1 gap-2.5 sm:gap-3">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="flex animate-pulse gap-3 rounded-2xl p-2.5 sm:gap-4 sm:p-3" style={{ background: soft }}>
              <div className="h-[72px] w-[72px] shrink-0 rounded-[18px] sm:h-[92px] sm:w-[92px]" style={{ background: block }} />
              <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
                <div className="h-3.5 w-3/5 rounded" style={{ background: block }} />
                <div className="h-2.5 w-4/5 rounded" style={{ background: block }} />
                <div className="h-2.5 w-2/5 rounded" style={{ background: block }} />
                <div className="mt-1 flex items-center justify-between">
                  <div className="h-5 w-14 rounded-md" style={{ background: block }} />
                  <div className="h-3 w-3 rounded-[3px]" style={{ background: block }} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function PoweredBy() {
  return (
    <footer className="mt-10 flex flex-col items-center gap-1.5 pb-10 text-center">
      <span aria-hidden="true" className="h-[4px] w-10" style={{ background: 'var(--ms-secondary)' }} />
      <p className="text-[11px]" style={{ color: 'var(--ms-muted)' }}>
        Powered by{' '}
        <a href="/" className="font-extrabold uppercase tracking-tight" style={{ color: 'var(--ms-primary)' }}>
          MenuSheet
        </a>
      </p>
    </footer>
  );
}

function StatusScreen({ restaurant, title, subtitle }: { restaurant: ThemeProps['restaurant']; title: string; subtitle: string }) {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-5 py-16 text-center"
      style={{ ...cssVars, ...bodyFont, background: 'var(--ms-background)', color: 'var(--ms-text)' }}
    >
      <div className="w-full max-w-sm rounded-[28px] px-6 py-10" style={{ background: 'var(--ms-surface)', borderTop: '6px solid var(--ms-primary)' }}>
        <div className="flex justify-center">
          {restaurant.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={restaurant.logoUrl} alt={`${restaurant.name} logo`} className="h-14 w-auto object-contain" />
          ) : (
            <span dir="auto" className="text-2xl font-black uppercase leading-none tracking-tight" style={{ ...headingFont, color: 'var(--ms-primary)' }}>
              {restaurant.name || 'Menu'}
            </span>
          )}
        </div>
        <h1 dir="auto" className="mt-5 text-2xl font-black uppercase leading-tight tracking-tight" style={{ ...headingFont, color: 'var(--ms-dark)' }}>
          {title}
        </h1>
        <div aria-hidden="true" className="mx-auto mt-3 h-[5px] w-14" style={{ background: 'var(--ms-secondary)' }} />
        <p dir="auto" className="mt-4 text-sm leading-relaxed" style={{ color: 'var(--ms-muted)' }}>
          {subtitle}
        </p>
      </div>
      <PoweredBy />
    </div>
  );
}

export default function Theme({ restaurant, menu, status }: ThemeProps) {
  const groups = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, MenuItem[]>();
    for (const item of menu || []) {
      const cat = item.category?.trim() || 'Menu';
      if (!map.has(cat)) {
        map.set(cat, []);
        order.push(cat);
      }
      map.get(cat)!.push(item);
    }
    return order.map((cat) => ({ category: cat, items: map.get(cat)! }));
  }, [menu]);

  const categories = useMemo(() => groups.map((g) => g.category), [groups]);

  const [activeCat, setActiveCat] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const active = activeCat && categories.includes(activeCat) ? activeCat : categories[0] || null;

  useEffect(() => {
    if (status !== 'ok' || !scrollerRef.current || !active) return;
    const el = scrollerRef.current.querySelector<HTMLElement>(`[data-cat="${CSS.escape(active)}"]`);
    if (!el) return;
    const onScroll = () => {
      const past = el.getBoundingClientRect().top <= 150;
      setActiveCat(past ? active : null);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [active, status]);

  useEffect(() => {
    if (!navRef.current || !active) return;
    const btn = navRef.current.querySelector<HTMLElement>(`[data-nav="${CSS.escape(active)}"]`);
    if (btn) btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [active]);

  const jump = (cat: string) => {
    setActiveCat(cat);
    const el = scrollerRef.current?.querySelector<HTMLElement>(`[data-cat="${CSS.escape(cat)}"]`);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 118;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen w-full" style={{ ...cssVars, background: 'var(--ms-background)' }}>
        <Skeleton />
      </div>
    );
  }

  if (status === 'inactive') {
    return (
      <StatusScreen
        restaurant={restaurant}
        title="Menu temporarily unavailable"
        subtitle="Please check back a little later — our kitchen is getting things ready."
      />
    );
  }

  if (status === 'expired') {
    return (
      <StatusScreen
        restaurant={restaurant}
        title="This menu is no longer active"
        subtitle="Please ask for the latest menu."
      />
    );
  }

  return (
    <div
      className="relative min-h-screen w-full"
      style={{ ...cssVars, ...bodyFont, background: 'var(--ms-background)', color: 'var(--ms-text)' }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[560px] overflow-hidden">
        <div
          className="absolute -left-16 -top-24 h-64 w-64 rounded-[42%_58%_61%_39%/45%_38%_62%_55%]"
          style={{ background: 'color-mix(in srgb, var(--ms-secondary) 22%, transparent)' }}
        />
        <div
          className="absolute -right-20 top-24 h-72 w-72 rounded-[55%_45%_38%_62%/48%_58%_42%_52%]"
          style={{ background: 'color-mix(in srgb, var(--ms-primary) 10%, transparent)' }}
        />
      </div>

      <header className="mx-auto w-full max-w-5xl px-3 pt-3 sm:px-5 sm:pt-5">
        <div
          className="relative overflow-hidden rounded-[28px] px-4 py-5 sm:px-6"
          style={{ background: 'var(--ms-dark)' }}
        >
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex min-w-0 flex-1 flex-col items-start">
              {restaurant.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={restaurant.logoUrl} alt={`${restaurant.name} logo`} className="h-14 w-auto object-contain sm:h-20" />
              ) : (
                <span dir="auto" className="text-lg font-black uppercase leading-none tracking-tight sm:text-2xl" style={{ ...headingFont, color: 'var(--ms-secondary)' }}>
                  {restaurant.name}
                </span>
              )}
              <h1
                dir="auto"
                className="mt-2 text-xl font-black uppercase leading-none tracking-tight sm:text-3xl"
                style={{ ...headingFont, color: 'var(--ms-surface)' }}
              >
                {restaurant.name}
              </h1>
              {restaurant.tagline ? (
                <p dir="auto" className="mt-1.5 text-[12.5px] leading-snug sm:text-sm" style={{ color: 'color-mix(in srgb, var(--ms-surface) 70%, transparent)' }}>
                  {restaurant.tagline}
                </p>
              ) : null}
            </div>
            <span aria-hidden="true" className="hidden h-16 w-2 flex-none rounded-full sm:block" style={{ background: 'var(--ms-primary)' }} />
          </div>
          <span aria-hidden="true" className="absolute bottom-0 right-0 h-3 w-24 sm:w-36" style={{ background: 'var(--ms-secondary)' }} />
        </div>

        {restaurant.heroImageUrl ? (
          <section className="mt-3" aria-label="Featured dishes">
            <div
              className="relative h-[36vh] max-h-[340px] w-full overflow-hidden rounded-[28px] sm:h-[40vh] sm:max-h-[420px]"
              style={{ background: 'color-mix(in srgb, var(--ms-dark) 8%, var(--ms-surface))' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={restaurant.heroImageUrl} alt={`${restaurant.name} featured food`} className="h-full w-full object-cover" />
              <div
                aria-hidden="true"
                className="absolute inset-0"
                style={{ background: 'linear-gradient(180deg, color-mix(in srgb, var(--ms-dark) 30%, transparent) 0%, transparent 45%)' }}
              />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3 sm:p-5">
                <span dir="auto" className="rounded-lg px-3 py-1.5 text-base font-black uppercase leading-none tracking-tight sm:text-xl" style={{ ...headingFont, background: 'var(--ms-primary)', color: '#FFFFFF' }}>
                  {restaurant.tagline || restaurant.name}
                </span>
                <span aria-hidden="true" className="h-2.5 w-16 flex-none rounded-full sm:w-24" style={{ background: 'var(--ms-secondary)' }} />
              </div>
            </div>
          </section>
        ) : (
          <section className="mt-3" aria-hidden="true">
            <div className="flex h-14 items-center gap-3 rounded-2xl px-4" style={{ background: 'var(--ms-primary)' }}>
              <span className="h-6 w-1.5 flex-none rounded-full" style={{ background: 'var(--ms-secondary)' }} />
              <span dir="auto" className="truncate text-sm font-black uppercase tracking-tight text-white" style={headingFont}>
                {restaurant.tagline || restaurant.name}
              </span>
            </div>
          </section>
        )}

        {categories.length > 0 ? (
          <nav
            aria-label="Menu categories"
            className="sticky top-0 z-30 -mx-3 mt-3 px-3 py-2 sm:-mx-5 sm:px-5"
            style={{
              ...bodyFont,
              background: 'var(--ms-background)',
              boxShadow: '0 6px 0 -5px color-mix(in srgb, var(--ms-dark) 18%, transparent)',
            }}
          >
            <div ref={navRef} className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {categories.map((cat) => {
                const isActive = cat === active;
                return (
                  <button
                    key={cat}
                    type="button"
                    data-nav={cat}
                    onClick={() => jump(cat)}
                    aria-current={isActive ? 'true' : undefined}
                    className="relative flex-none whitespace-nowrap rounded-md px-3 py-2 text-[13px] font-extrabold uppercase tracking-tight transition-colors sm:px-4 sm:text-sm"
                    style={{
                      minHeight: 40,
                      color: isActive ? '#FFFFFF' : 'var(--ms-dark)',
                      background: isActive ? 'var(--ms-primary)' : 'transparent',
                    }}
                  >
                    <span dir="auto">{cat}</span>
                    {isActive ? (
                      <span aria-hidden="true" className="absolute inset-x-2 -bottom-0.5 h-[3px] rounded-full" style={{ background: 'var(--ms-secondary)' }} />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </nav>
        ) : null}
      </header>

      <main ref={scrollerRef} className="mx-auto w-full max-w-5xl px-3 pt-4 sm:px-5 sm:pt-5">
        {groups.length === 0 ? (
          <div className="rounded-2xl px-5 py-10 text-center" style={{ background: 'var(--ms-surface)' }}>
            <p className="font-bold" style={headingFont}>
              No items available right now
            </p>
            <p className="mt-1 text-sm" style={{ color: 'var(--ms-muted)' }}>
              Please check back soon.
            </p>
          </div>
        ) : (
          <div className="space-y-7 sm:space-y-9">
            {groups.map(({ category, items }) => (
              <section key={category} id={`cat-${slugify(category)}`} data-cat={category} aria-labelledby={`h-${slugify(category)}`} className="scroll-mt-24">
                <div className="mb-2.5 flex items-end justify-between gap-3 sm:mb-3">
                  <h2
                    dir="auto"
                    id={`h-${slugify(category)}`}
                    className="relative pb-1 text-xl font-black uppercase leading-none tracking-tight sm:text-2xl md:text-3xl"
                    style={{ ...headingFont, color: 'var(--ms-primary)' }}
                  >
                    {category}
                    <span aria-hidden="true" className="absolute bottom-0 left-0 h-[5px] w-10 sm:w-16" style={{ background: 'var(--ms-secondary)' }} />
                  </h2>
                  <span className="pb-0.5 text-[10px] font-bold uppercase tracking-widest tabular-nums" style={{ color: 'var(--ms-muted)' }}>
                    {items.length} {items.length === 1 ? 'item' : 'items'}
                  </span>
                </div>
                <ul className="grid grid-cols-1 gap-2.5 sm:gap-3">
                  {items.map((item) => (
                    <ItemCard key={item.id} item={item} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>

      <PoweredBy />
    </div>
  );
}