'use client';

import { useId, useState } from 'react';
import { formatAmount, isOptionList, priceRange, CURRENCY_SYMBOL } from '@/lib/price';
import type { PriceVariant } from '@/lib/price';

/**
 * Price presentation shared by every theme, so an item with price variations
 * looks and behaves the same way no matter which theme renders it.
 *
 * `PriceDisplay` goes in the card's price column. `PriceOptions` goes in the
 * card body and is what turns a bare `₹120 – ₹240` into something the customer
 * can actually choose from.
 */
export interface PriceTone {
  /** Colour of the price itself, and of the options trigger. */
  accent: string;
  /** Tailwind classes for the price text, e.g. `'text-[15px] font-semibold'`. */
  priceClassName: string;
  /** Tailwind classes for the price text when a range is shown. Defaults to `priceClassName`. */
  rangeClassName?: string;
  /** Colour of the options trigger and per-option labels. */
  muted?: string;
  /** Background for the options trigger. */
  surface?: string;
  /** Border colour for the options trigger. */
  border?: string;
  /** Tailwind radius class shared by the trigger and option rows. */
  radius?: string;
  /** Tailwind classes for per-option labels. */
  labelClassName?: string;
  /** Force option labels uppercase (theme-typical for menu cards). */
  uppercase?: boolean;
}

interface DisplayProps {
  base: number;
  variants?: PriceVariant[];
  tone: PriceTone;
  className?: string;
  /** Escape hatch for theme decoration that is not typography, e.g. a badge background. */
  style?: React.CSSProperties;
}

export function PriceDisplay({ base, variants, tone, className, style }: DisplayProps) {
  const { min, max } = priceRange(base, variants);
  if (min <= 0 && max <= 0) return null;

  if (min === max) {
    return (
      <span
        className={`${tone.priceClassName} ${className ?? ''}`}
        style={{ color: tone.accent, ...style }}
      >
        {CURRENCY_SYMBOL}
        {formatAmount(min)}
      </span>
    );
  }

  return (
    <span
      className={`${tone.rangeClassName ?? tone.priceClassName} ${className ?? ''}`}
      style={{ color: tone.accent, ...style }}
    >
      {CURRENCY_SYMBOL}
      {formatAmount(min)}
      <span className="px-[0.15em] opacity-55">&ndash;</span>
      {CURRENCY_SYMBOL}
      {formatAmount(max)}
    </span>
  );
}

interface OptionsProps {
  variants?: PriceVariant[];
  tone: PriceTone;
  className?: string;
}

export function PriceOptions({ variants, tone, className }: OptionsProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  if (!isOptionList(variants)) return null;
  const list = variants as PriceVariant[];

  const radius = tone.radius ?? 'rounded-md';
  const labelClassName = tone.labelClassName ?? 'text-[11px]';
  const labelCase = tone.uppercase ? 'uppercase tracking-wide' : '';

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className={`inline-flex items-center gap-1 border px-2 py-1 text-[11px] font-semibold leading-none transition-opacity hover:opacity-75 active:scale-[0.97] ${radius} ${labelClassName} ${labelCase}`}
        style={{
          color: tone.accent,
          background: tone.surface ?? 'transparent',
          borderColor: tone.border ?? 'transparent',
        }}
      >
        {list.length} options
        <svg
          viewBox="0 0 12 12"
          aria-hidden="true"
          className={`h-2.5 w-2.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
        >
          <path
            d="M2.5 4.5 6 8l3.5-3.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open ? (
        <ul id={panelId} className="mt-1.5 space-y-0.5">
          {list.map((variant, i) => (
            <li
              key={`${variant.label}-${variant.price}-${i}`}
              className={`flex items-baseline justify-between gap-3 border-b border-dashed px-2 py-1 last:border-b-0 ${radius}`}
              style={{
                borderColor: tone.border ?? `color-mix(in srgb, ${tone.muted ?? tone.accent} 18%, transparent)`,
              }}
            >
              <span
                className={`min-w-0 truncate ${labelClassName} ${labelCase}`}
                style={{ color: tone.muted ?? tone.accent }}
              >
                {variant.label}
              </span>
              <span
                className={`shrink-0 tabular-nums ${tone.priceClassName}`}
                style={{ color: tone.accent }}
              >
                {CURRENCY_SYMBOL}
                {formatAmount(variant.price)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
