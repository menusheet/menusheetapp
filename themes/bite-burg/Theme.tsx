'use client';

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PriceDisplay, PriceOptions } from '@/components/public/PriceDisplay';
import type { PriceTone } from '@/components/public/PriceDisplay';
import type { MenuItem, ThemeProps } from '@/lib/types';

/* ───────────── tokens ───────────── */
const cssVars = {
  '--ms-primary': '#E31E24',
  '--ms-secondary': '#F4DD00',
  '--ms-background': '#F5F5F7',
  '--ms-surface': '#FFFFFF',
  '--ms-text': '#1D1D1F',
  '--ms-muted': '#6E6E73',
  '--ms-line': 'rgba(0,0,0,0.08)',
  '--ms-font-heading': "'Archivo Black', 'Arial Black', 'Inter', sans-serif",
  '--ms-font-body': "'Archivo', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
} as React.CSSProperties;

const heading = { fontFamily: 'var(--ms-font-heading)' } as React.CSSProperties;
const body = { fontFamily: 'var(--ms-font-body)' } as React.CSSProperties;
const glass = {
  background: 'rgba(255,255,255,0.78)',
  backdropFilter: 'saturate(180%) blur(20px)',
  WebkitBackdropFilter: 'saturate(180%) blur(20px)',
} as React.CSSProperties;

const priceTone: PriceTone = {
  accent: 'var(--ms-text)',
  muted: 'var(--ms-muted)',
  surface: 'transparent',
  border: 'transparent',
  radius: 'rounded-md',
  priceClassName: 'whitespace-nowrap text-[15px] font-semibold',
  rangeClassName: 'whitespace-nowrap text-[13px] font-semibold',
  labelClassName: 'text-[11px] font-medium',
  uppercase: false,
};

/* ───────────── image cache ─────────────
   Module-level, so the menu list and the cart share one cache.
   Browser HTTP cache serves the bytes; this Set lets <CachedImg> skip the fade
   for images already loaded and lets us preload cart images instantly. */
const loadedImages = new Set<string>();
function preload(url?: string) {
  if (!url || typeof window === 'undefined' || loadedImages.has(url)) return;
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => loadedImages.add(url);
  img.src = url;
}

function CachedImg({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [ready, setReady] = useState(() => loadedImages.has(src));
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      decoding="async"
      loading={ready ? 'eager' : 'lazy'}
      onLoad={() => {
        loadedImages.add(src);
        setReady(true);
      }}
      className={className}
      style={{ opacity: ready ? 1 : 0, transition: ready ? 'opacity .25s ease' : 'none' }}
    />
  );
}

const SAMPLE_HERO =
  'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1200&q=70';

function SampleLogo({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} role="img" aria-label="Logo" className="shrink-0">
      <rect width="64" height="64" rx="16" fill="#E31E24" />
      <path d="M14 30c0-9 8-15 18-15s18 6 18 15z" fill="#F4DD00" />
      <circle cx="26" cy="23" r="1.5" fill="#fff" />
      <circle cx="34" cy="20.5" r="1.5" fill="#fff" />
      <circle cx="41" cy="24" r="1.5" fill="#fff" />
      <rect x="12" y="33" width="40" height="5" rx="2.5" fill="#fff" />
      <path d="M14 41h36c0 6-5 9-18 9s-18-3-18-9z" fill="#F4DD00" />
    </svg>
  );
}

function Logo({ url, size }: { url?: string | null; size: number }) {
  const [bad, setBad] = useState(false);
  if (url && !bad) {
    return (
      <img
        src={url}
        alt="Logo"
        onError={() => setBad(true)}
        className="shrink-0 bg-white object-contain"
        style={{ width: size, height: size, borderRadius: size * 0.25 }}
      />
    );
  }
  return <SampleLogo size={size} />;
}

function HeroImg({ src, alt }: { src: string; alt: string }) {
  const [bad, setBad] = useState(false);
  const [ready, setReady] = useState(() => loadedImages.has(src));
  if (bad) return null;
  return (
    <img
      src={src}
      alt={alt}
      decoding="async"
      onError={() => setBad(true)}
      onLoad={() => { loadedImages.add(src); setReady(true); }}
      className="h-full w-full object-cover"
      style={{ opacity: ready ? 1 : 0, transition: 'opacity .3s ease' }}
    />
  );
}

function Thumb({ url, alt, size }: { url?: string | null; alt: string; size: number }) {
  return (
    <div
      className="shrink-0 overflow-hidden"
      style={{ width: size, height: size, borderRadius: size * 0.22, background: '#EDEDF0' }}
    >
      {url ? <CachedImg src={url} alt={alt} className="h-full w-full object-cover" /> : null}
    </div>
  );
}

/* ───────────── cart model ───────────── */
type CartLine = {
  key: string;
  id: string;
  name: string;
  variant?: string;
  price: number;
  qty: number;
  imageUrl?: string | null;
  isVeg?: boolean;
};
type Cart = Record<string, CartLine>;
type Variant = { label: string; price: number };

function getVariants(item: MenuItem): Variant[] {
  const raw = ((item as any).priceVariants || []) as any[];
  return raw
    .map((v) => ({ label: String(v.label ?? v.name ?? v.size ?? ''), price: Number(v.price) }))
    .filter((v) => Number.isFinite(v.price));
}

function slugify(v: string) {
  return v.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/g, '-').replace(/^-+|-+$/g, '') || 'section';
}

/* ───────────── small UI ───────────── */
function VegMark({ isVeg }: { isVeg: boolean }) {
  const c = isVeg ? '#1F7A3D' : 'var(--ms-primary)';
  return (
    <span
      role="img"
      aria-label={isVeg ? 'Vegetarian' : 'Non-vegetarian'}
      className="inline-flex h-[13px] w-[13px] shrink-0 items-center justify-center rounded-[3px] border"
      style={{ borderColor: c }}
    >
      <span className="h-[6px] w-[6px] rounded-full" style={{ background: c }} />
    </span>
  );
}

function Stepper({ qty, onMinus, onPlus, small }: { qty: number; onMinus: () => void; onPlus: () => void; small?: boolean }) {
  const h = small ? 32 : 36;
  return (
    <div
      className="inline-flex items-center justify-between rounded-full"
      style={{ height: h, minWidth: small ? 92 : 104, background: '#F0F0F3' }}
    >
      <button type="button" aria-label="Remove one" onClick={onMinus} className="flex h-full w-9 items-center justify-center text-lg font-semibold active:scale-90">
        −
      </button>
      <span className="text-[14px] font-semibold tabular-nums">{qty}</span>
      <button type="button" aria-label="Add one" onClick={onPlus} className="flex h-full w-9 items-center justify-center text-lg font-semibold active:scale-90" style={{ color: 'var(--ms-primary)' }}>
        +
      </button>
    </div>
  );
}

function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" style={body} role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div
        className="relative flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] sm:rounded-[28px]"
        style={{ background: 'var(--ms-background)', color: 'var(--ms-text)', animation: 'ms-up .28s cubic-bezier(.2,.8,.2,1)' }}
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <h2 className="text-[22px] font-bold tracking-tight">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full text-lg" style={{ background: '#E4E4E8' }}>
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer ? <div className="border-t p-4" style={{ borderColor: 'var(--ms-line)', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))', ...glass }}>{footer}</div> : null}
      </div>
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-[52px] w-full items-center justify-center rounded-full text-[16px] font-semibold text-white transition active:scale-[.98] disabled:opacity-40"
      style={{ background: 'var(--ms-primary)' }}
    >
      {children}
    </button>
  );
}

/* ───────────── item row ───────────── */
function ItemRow({ item, qty, onAdd, onRemove }: { item: MenuItem; qty: number; onAdd: () => void; onRemove: () => void }) {
  const unavailable = !item.isAvailable;
  const hasVariants = getVariants(item).length > 0;
  return (
    <li className={`flex gap-4 rounded-[22px] p-3 ${unavailable ? 'opacity-50' : ''}`} style={{ background: 'var(--ms-surface)' }}>
      <div className="relative">
        <Thumb url={item.imageUrl} alt={item.name} size={96} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start gap-2">
          <h3 dir="auto" className="min-w-0 flex-1 text-[16px] font-semibold leading-snug tracking-tight">
            {item.name}
          </h3>
          <span className="mt-1"><VegMark isVeg={item.isVeg} /></span>
        </div>
        {item.description ? (
          <p dir="auto" className="mt-0.5 line-clamp-2 text-[13px] leading-snug" style={{ color: 'var(--ms-muted)' }}>
            {item.description}
          </p>
        ) : null}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div className="min-w-0">
            {unavailable ? (
              <span className="text-[13px] font-medium" style={{ color: 'var(--ms-muted)' }}>Sold out</span>
            ) : (
              <>
                <PriceDisplay base={item.price} variants={item.priceVariants} tone={priceTone} />
              </>
            )}
          </div>
          {unavailable ? null : qty > 0 && !hasVariants ? (
            <Stepper small qty={qty} onMinus={onRemove} onPlus={onAdd} />
          ) : (
            <button
              type="button"
              onClick={onAdd}
              className="relative h-8 rounded-full px-4 text-[14px] font-semibold active:scale-95"
              style={{ background: '#F0F0F3', color: 'var(--ms-primary)' }}
            >
              {hasVariants ? 'Choose' : 'Add'}
              {qty > 0 && hasVariants ? (
                <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] text-white" style={{ background: 'var(--ms-primary)' }}>
                  {qty}
                </span>
              ) : null}
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

/* ───────────── status / skeleton ───────────── */
function PoweredBy() {
  return (
    <footer className="pb-32 pt-10 text-center text-[12px]" style={{ color: 'var(--ms-muted)' }}>
      Powered by <a href="/" className="font-semibold" style={{ color: 'var(--ms-text)' }}>MenuSheet</a>
    </footer>
  );
}

function StatusScreen({ restaurant, title, subtitle }: { restaurant: ThemeProps['restaurant']; title: string; subtitle: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center" style={{ ...cssVars, ...body, background: 'var(--ms-background)', color: 'var(--ms-text)' }}>
      {restaurant.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={restaurant.logoUrl} alt={`${restaurant.name} logo`} className="mb-6 h-14 w-auto object-contain" />
      ) : (
        <span className="mb-6 text-xl" style={heading}>{restaurant.name || 'Menu'}</span>
      )}
      <h1 dir="auto" className="text-[28px] font-bold tracking-tight">{title}</h1>
      <p dir="auto" className="mt-2 max-w-xs text-[15px]" style={{ color: 'var(--ms-muted)' }}>{subtitle}</p>
      <PoweredBy />
    </div>
  );
}

function Skeleton() {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-16">
      <div className="h-12 w-56 animate-pulse rounded-xl" style={{ background: '#E4E4E8' }} />
      <div className="mt-8 space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex animate-pulse gap-4 rounded-[22px] p-3" style={{ background: '#fff' }}>
            <div className="h-24 w-24 rounded-[21px]" style={{ background: '#EDEDF0' }} />
            <div className="flex-1 space-y-2 pt-2">
              <div className="h-4 w-3/5 rounded" style={{ background: '#EDEDF0' }} />
              <div className="h-3 w-4/5 rounded" style={{ background: '#EDEDF0' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────── main ───────────── */
export default function Theme({ restaurant, menu, status }: ThemeProps) {
  const currency: string = (restaurant as any).currency || '₹';
  const money = useCallback(
    (n: number) => `${currency}${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
    [currency]
  );
  const storeKey = `ms-cart:${(restaurant as any).slug || (restaurant as any).id || restaurant.name}`;

  const groups = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, MenuItem[]>();
    for (const item of menu || []) {
      const cat = item.category?.trim() || 'Menu';
      if (!map.has(cat)) { map.set(cat, []); order.push(cat); }
      map.get(cat)!.push(item);
    }
    return order.map((category) => ({ category, items: map.get(category)! }));
  }, [menu]);
  const categories = useMemo(() => groups.map((g) => g.category), [groups]);

  /* cart state (persisted) */
  const [cart, setCart] = useState<Cart>({});
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storeKey) || '{}');
      setCart(saved);
      Object.values<CartLine>(saved).forEach((l) => preload(l.imageUrl || undefined));
    } catch {}
    setHydrated(true);
  }, [storeKey]);
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(storeKey, JSON.stringify(cart)); } catch {}
  }, [cart, hydrated, storeKey]);

  /* warm the image cache as soon as the menu arrives */
  useEffect(() => {
    (menu || []).forEach((m) => preload(m.imageUrl || undefined));
  }, [menu]);

  const lines = Object.values(cart);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const total = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const qtyOf = (id: string) => lines.filter((l) => l.id === id).reduce((s, l) => s + l.qty, 0);

  const change = (item: MenuItem, variant: Variant | null, delta: number) => {
    const key = `${item.id}::${variant?.label || ''}`;
    setCart((prev) => {
      const cur = prev[key];
      const qty = (cur?.qty || 0) + delta;
      const next = { ...prev };
      if (qty <= 0) { delete next[key]; return next; }
      next[key] = cur
        ? { ...cur, qty }
        : { key, id: String(item.id), name: item.name, variant: variant?.label || undefined, price: variant ? variant.price : Number(item.price) || 0, qty, imageUrl: item.imageUrl, isVeg: item.isVeg };
      return next;
    });
  };
  const changeLine = (key: string, delta: number) =>
    setCart((prev) => {
      const cur = prev[key];
      if (!cur) return prev;
      const next = { ...prev };
      if (cur.qty + delta <= 0) delete next[key]; else next[key] = { ...cur, qty: cur.qty + delta };
      return next;
    });

  /* sheets */
  const [sheet, setSheet] = useState<'cart' | 'checkout' | null>(null);
  const [picking, setPicking] = useState<MenuItem | null>(null);
  const closeSheet = useCallback(() => setSheet(null), []);
  const closePicker = useCallback(() => setPicking(null), []);

  const onAdd = (item: MenuItem) => {
    if (getVariants(item).length > 0) setPicking(item); else change(item, null, 1);
  };
  const onRemove = (item: MenuItem) => change(item, null, -1);

  /* checkout */
  const [mode, setMode] = useState<'pickup' | 'delivery'>('pickup');
  const [form, setForm] = useState({ name: '', phone: '', address: '', note: '' });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const valid =
    form.name.trim().length > 1 &&
    form.phone.replace(/\D/g, '').length >= 7 &&
    (mode === 'pickup' || form.address.trim().length > 5);

  const sendWhatsApp = () => {
    const bar = '──────────────';
    const rows = lines.map(
      (l) => `${l.qty} × ${l.name}${l.variant ? ` (${l.variant})` : ''} — ${money(l.qty * l.price)}`
    );
    const text = [
      `*${restaurant.name}* — New order`,
      bar,
      `*Type:* ${mode === 'pickup' ? 'Pickup' : 'Delivery'}`,
      `*Name:* ${form.name.trim()}`,
      `*Phone:* ${form.phone.trim()}`,
      mode === 'delivery' ? `*Address:* ${form.address.trim()}` : '',
      bar,
      ...rows,
      bar,
      `*Items:* ${count}`,
      `*Total:* ${money(total)}`,
      form.note.trim() ? `\n*Note:* ${form.note.trim()}` : '',
    ].filter(Boolean).join('\n');
    // No number: WhatsApp opens its contact picker so the order can be sent to anyone.
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer') || (window.location.href = url);
  };

  /* search */
  const [q, setQ] = useState('');
  const searching = q.trim().length > 0;
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return groups;
    return groups
      .map((g) => ({
        category: g.category,
        items: g.items.filter((i) => `${i.name} ${i.description || ''} ${g.category}`.toLowerCase().includes(t)),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, q]);
  const resultCount = shown.reduce((n, g) => n + g.items.length, 0);

  /* scroll spy + nav.
     Bug fix: clicking a tab used to let the spy re-highlight every category the smooth
     scroll passed. Now the spy is locked while a programmatic scroll runs and only
     resumes ~140ms after scrolling stops. The last section (too short to reach the top)
     is also handled by the "page bottom" rule. */
  const navRef = useRef<HTMLDivElement | null>(null);
  const headRef = useRef<HTMLElement | null>(null);
  const lock = useRef(false);
  const lockTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [active, setActive] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const current = active && categories.includes(active) ? active : categories[0] || null;

  useEffect(() => {
    if (status !== 'ok') return;
    const onScroll = () => {
      setScrolled(window.scrollY > 260);
      if (searching) return;
      if (lock.current) {
        clearTimeout(lockTimer.current);
        lockTimer.current = setTimeout(() => { lock.current = false; onScroll(); }, 140);
        return;
      }
      const offset = (headRef.current?.offsetHeight || 110) + 24;
      let found: string | null = null;
      document.querySelectorAll<HTMLElement>('[data-cat]').forEach((el) => {
        if (el.getBoundingClientRect().top <= offset) found = el.dataset.cat || null;
      });
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        found = categories[categories.length - 1] ?? found;
      }
      setActive(found);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [status, groups, categories, searching]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav || !current) return;
    const btn = nav.querySelector<HTMLElement>(`[data-nav="${CSS.escape(current)}"]`);
    if (btn) nav.scrollTo({ left: btn.offsetLeft - nav.clientWidth / 2 + btn.offsetWidth / 2, behavior: 'smooth' });
  }, [current]);

  const jump = (cat: string) => {
    const el = document.querySelector<HTMLElement>(`[data-cat="${CSS.escape(cat)}"]`);
    if (!el) return;
    setActive(cat);
    lock.current = true;
    clearTimeout(lockTimer.current);
    lockTimer.current = setTimeout(() => { lock.current = false; }, 500);
    const offset = (headRef.current?.offsetHeight || 110) + 8;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior: 'smooth' });
  };

  const shell = { ...cssVars, ...body, background: 'var(--ms-background)', color: 'var(--ms-text)' } as React.CSSProperties;
  if (status === 'loading') return <div className="min-h-screen" style={shell}><Skeleton /></div>;
  if (status === 'inactive')
    return <StatusScreen restaurant={restaurant} title="Menu temporarily unavailable" subtitle="The kitchen is getting ready. Please check back soon." />;
  if (status === 'expired')
    return <StatusScreen restaurant={restaurant} title="This menu is no longer active" subtitle="Please ask for the latest menu." />;

  const pickerVariants = picking ? getVariants(picking) : [];

  return (
    <div className="min-h-[100dvh] w-full" style={shell}>
      <style>{`@keyframes ms-up{from{transform:translateY(24px);opacity:0}to{transform:none;opacity:1}}
        @media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}`}</style>

      {/* hero */}
      <section>
        <div className="relative h-[240px] w-full overflow-hidden sm:h-[320px]" style={{ background: 'linear-gradient(135deg,#E31E24,#6B0B0F)' }}>
          <HeroImg src={restaurant.heroImageUrl || SAMPLE_HERO} alt={`${restaurant.name} featured food`} />
          <div aria-hidden="true" className="absolute inset-0" style={{ background: 'linear-gradient(180deg,rgba(0,0,0,.28) 0%,rgba(0,0,0,0) 40%,rgba(0,0,0,.5) 100%)' }} />
        </div>
        <div className="mx-auto max-w-2xl px-4">
          <div className="-mt-11 inline-block rounded-[24px] bg-white p-1.5" style={{ boxShadow: '0 6px 20px rgba(0,0,0,.18)' }}>
            <Logo url={restaurant.logoUrl} size={72} />
          </div>
          <h1 dir="auto" className="mt-3 text-[32px] leading-[1.05] tracking-tight sm:text-[44px]" style={heading}>
            {restaurant.name}
          </h1>
          <p dir="auto" className="mt-1.5 text-[16px] leading-snug" style={{ color: 'var(--ms-muted)' }}>
            {restaurant.tagline || 'Fresh, hot and made to order.'}
          </p>
        </div>
      </section>

      {/* sticky bar: search + cart + categories */}
      <header
        ref={headRef}
        className="sticky top-0 z-30 mt-4 border-b"
        style={{ ...glass, borderColor: 'var(--ms-line)', paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto flex max-w-2xl items-center px-3 pt-2.5" style={{ paddingBottom: searching || categories.length === 0 ? 10 : 0 }}>
          <div
            className="shrink-0 overflow-hidden transition-all duration-200"
            style={{ width: scrolled ? 40 : 0, marginRight: scrolled ? 8 : 0, opacity: scrolled ? 1 : 0 }}
            aria-hidden={!scrolled}
          >
            <Logo url={restaurant.logoUrl} size={40} />
          </div>
          <div className="relative min-w-0 flex-1">
            <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" fill="none" stroke="var(--ms-muted)" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search the menu"
              aria-label="Search the menu"
              className="h-11 w-full rounded-full pl-10 pr-10 text-[16px] outline-none focus:ring-2 [&::-webkit-search-cancel-button]:hidden"
              style={{ background: '#E9E9ED', ['--tw-ring-color' as string]: 'var(--ms-primary)' }}
            />
            {q ? (
              <button type="button" aria-label="Clear search" onClick={() => setQ('')} className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-base" style={{ color: 'var(--ms-muted)' }}>
                ✕
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setSheet('cart')}
            aria-label={`Open cart, ${count} items`}
            className="relative ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition active:scale-95"
            style={{ background: count ? 'var(--ms-primary)' : '#E9E9ED', color: count ? '#fff' : 'var(--ms-text)' }}
          >
            <svg viewBox="0 0 24 24" className="h-[20px] w-[20px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" />
            </svg>
            {count ? (
              <span className="absolute -right-1 -top-1 flex h-[20px] min-w-[20px] items-center justify-center rounded-full px-1 text-[11px] font-bold" style={{ background: 'var(--ms-secondary)', color: 'var(--ms-text)' }}>
                {count}
              </span>
            ) : null}
          </button>
        </div>

        {categories.length > 0 && !searching ? (
          <nav aria-label="Menu categories" className="mx-auto max-w-2xl">
            <div ref={navRef} className="relative flex gap-1.5 overflow-x-auto px-3 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {categories.map((cat) => {
                const on = cat === current;
                return (
                  <button
                    key={cat}
                    type="button"
                    data-nav={cat}
                    onClick={() => jump(cat)}
                    aria-current={on ? 'true' : undefined}
                    className="h-9 flex-none whitespace-nowrap rounded-full px-4 text-[14px] font-medium transition-colors"
                    style={{ background: on ? 'var(--ms-text)' : '#E9E9ED', color: on ? '#fff' : 'var(--ms-text)' }}
                  >
                    <span dir="auto">{cat}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        ) : null}
      </header>

      {/* menu */}
      <main className="mx-auto max-w-2xl px-3 pt-5 sm:px-4">
        {searching ? (
          <p className="mb-3 px-1 text-[13px]" style={{ color: 'var(--ms-muted)' }}>
            {resultCount} {resultCount === 1 ? 'result' : 'results'} for “{q.trim()}”
          </p>
        ) : null}
        {shown.length === 0 ? (
          <div className="rounded-[22px] px-6 py-14 text-center" style={{ background: 'var(--ms-surface)' }}>
            <p className="text-[17px] font-semibold">{searching ? 'Nothing matches your search' : 'No items available right now'}</p>
            <p className="mt-1 text-[14px]" style={{ color: 'var(--ms-muted)' }}>
              {searching ? 'Try a different word or clear the search.' : 'Please check back soon.'}
            </p>
            {searching ? (
              <button type="button" onClick={() => setQ('')} className="mt-4 h-10 rounded-full px-5 text-[14px] font-semibold text-white" style={{ background: 'var(--ms-primary)' }}>
                Clear search
              </button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-9">
            {shown.map(({ category, items }) => (
              <section key={category} id={`cat-${slugify(category)}`} data-cat={category} aria-labelledby={`h-${slugify(category)}`}>
                <h2 dir="auto" id={`h-${slugify(category)}`} className="mb-3 px-1 text-[26px] font-bold tracking-tight">
                  {category}
                </h2>
                <ul className="grid grid-cols-1 gap-2.5">
                  {items.map((item) => (
                    <ItemRow key={item.id} item={item} qty={qtyOf(String(item.id))} onAdd={() => onAdd(item)} onRemove={() => onRemove(item)} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>
      <PoweredBy />

      {/* floating cart bar */}
      {count > 0 && sheet === null ? (
        <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <button
            type="button"
            onClick={() => setSheet('cart')}
            className="mx-auto flex h-14 w-full max-w-md items-center justify-between rounded-full px-6 text-white shadow-xl transition active:scale-[.98]"
            style={{ background: 'var(--ms-text)', animation: 'ms-up .25s ease' }}
          >
            <span className="text-[15px] font-semibold">View cart · {count} {count === 1 ? 'item' : 'items'}</span>
            <span className="text-[15px] font-semibold tabular-nums">{money(total)}</span>
          </button>
        </div>
      ) : null}

      {/* variant picker */}
      <Sheet open={!!picking} onClose={closePicker} title={picking?.name || ''}>
        <ul className="space-y-2 pb-2">
          {pickerVariants.map((v) => {
            const q = picking ? cart[`${picking.id}::${v.label}`]?.qty || 0 : 0;
            return (
              <li key={v.label} className="flex items-center justify-between rounded-2xl p-3.5" style={{ background: '#fff' }}>
                <div>
                  <p className="text-[15px] font-semibold">{v.label || 'Regular'}</p>
                  <p className="text-[14px]" style={{ color: 'var(--ms-muted)' }}>{money(v.price)}</p>
                </div>
                {q > 0 ? (
                  <Stepper small qty={q} onMinus={() => change(picking!, v, -1)} onPlus={() => change(picking!, v, 1)} />
                ) : (
                  <button type="button" onClick={() => change(picking!, v, 1)} className="h-8 rounded-full px-4 text-[14px] font-semibold" style={{ background: '#F0F0F3', color: 'var(--ms-primary)' }}>
                    Add
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </Sheet>

      {/* cart */}
      <Sheet
        open={sheet === 'cart'}
        onClose={closeSheet}
        title="Your cart"
        footer={
          lines.length ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1 text-[17px] font-semibold">
                <span>Total</span><span className="tabular-nums">{money(total)}</span>
              </div>
              <PrimaryButton onClick={() => setSheet('checkout')}>Checkout</PrimaryButton>
            </div>
          ) : undefined
        }
      >
        {lines.length === 0 ? (
          <p className="py-16 text-center text-[15px]" style={{ color: 'var(--ms-muted)' }}>Your cart is empty. Add something tasty.</p>
        ) : (
          <>
            <ul className="space-y-2 pb-2">
              {lines.map((l) => (
                <li key={l.key} className="flex items-center gap-3 rounded-2xl p-2.5" style={{ background: '#fff' }}>
                  <Thumb url={l.imageUrl} alt={l.name} size={56} />
                  <div className="min-w-0 flex-1">
                    <p dir="auto" className="truncate text-[15px] font-semibold">{l.name}</p>
                    <p className="text-[13px]" style={{ color: 'var(--ms-muted)' }}>
                      {l.variant ? `${l.variant} · ` : ''}{money(l.price)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Stepper small qty={l.qty} onMinus={() => changeLine(l.key, -1)} onPlus={() => changeLine(l.key, 1)} />
                    <span className="text-[13px] font-semibold tabular-nums">{money(l.qty * l.price)}</span>
                  </div>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => setCart({})} className="mt-1 text-[14px] font-medium" style={{ color: 'var(--ms-primary)' }}>
              Clear cart
            </button>
          </>
        )}
      </Sheet>

      {/* checkout */}
      <Sheet
        open={sheet === 'checkout'}
        onClose={closeSheet}
        title="Checkout"
        footer={
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1 text-[17px] font-semibold">
              <span>Total</span><span className="tabular-nums">{money(total)}</span>
            </div>
            <PrimaryButton onClick={sendWhatsApp} disabled={!valid || lines.length === 0}>
              Send order on WhatsApp
            </PrimaryButton>
            <button type="button" onClick={() => setSheet('cart')} className="w-full text-center text-[14px] font-medium" style={{ color: 'var(--ms-muted)' }}>
              Back to cart
            </button>
          </div>
        }
      >
        <div className="mb-4 grid grid-cols-2 rounded-full p-1" style={{ background: '#E4E4E8' }} role="tablist" aria-label="Order type">
          {(['pickup', 'delivery'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className="h-9 rounded-full text-[14px] font-semibold transition"
              style={{ background: mode === m ? '#fff' : 'transparent', boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,.12)' : 'none' }}
            >
              {m === 'pickup' ? 'Pickup' : 'Delivery'}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {[
            { k: 'name' as const, label: 'Full name', type: 'text', ac: 'name' },
            { k: 'phone' as const, label: 'Phone number', type: 'tel', ac: 'tel' },
          ].map((f) => (
            <input
              key={f.k}
              type={f.type}
              autoComplete={f.ac}
              placeholder={f.label}
              aria-label={f.label}
              value={form[f.k]}
              onChange={set(f.k)}
              className="h-12 w-full rounded-2xl px-4 text-[16px] outline-none focus:ring-2"
              style={{ background: '#fff', ['--tw-ring-color' as string]: 'var(--ms-primary)' }}
            />
          ))}
          {mode === 'delivery' ? (
            <textarea
              placeholder="Delivery address"
              aria-label="Delivery address"
              autoComplete="street-address"
              rows={3}
              value={form.address}
              onChange={set('address')}
              className="w-full resize-none rounded-2xl px-4 py-3 text-[16px] outline-none focus:ring-2"
              style={{ background: '#fff', ['--tw-ring-color' as string]: 'var(--ms-primary)' }}
            />
          ) : null}
          <textarea
            placeholder="Note for the kitchen (optional)"
            aria-label="Note"
            rows={2}
            value={form.note}
            onChange={set('note')}
            className="w-full resize-none rounded-2xl px-4 py-3 text-[16px] outline-none focus:ring-2"
            style={{ background: '#fff', ['--tw-ring-color' as string]: 'var(--ms-primary)' }}
          />
        </div>

        <div className="mt-4 rounded-2xl p-4" style={{ background: '#fff' }}>
          {lines.map((l) => (
            <div key={l.key} className="flex justify-between py-0.5 text-[14px]">
              <span dir="auto" className="min-w-0 flex-1 truncate pr-3">{l.qty} × {l.name}{l.variant ? ` (${l.variant})` : ''}</span>
              <span className="tabular-nums" style={{ color: 'var(--ms-muted)' }}>{money(l.qty * l.price)}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 px-1 text-[12px]" style={{ color: 'var(--ms-muted)' }}>
          WhatsApp will open so you can choose who to send the bill to.
        </p>
      </Sheet>
    </div>
  );
}