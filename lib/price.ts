/**
 * Price grammar — the single source of truth for how a `price` cell in the
 * restaurant's Google Sheet becomes a price (or a set of price variations).
 *
 * A variation lives in the SAME `price` cell as the base price, so no sheet
 * migration is needed and owners only ever learn one field. The documented
 * syntax is comma-separated `Label-Amount` pairs:
 *
 *   320                                  single price
 *   Small-120, Medium-180, Large-240     variations
 *   Half-90, Full-150                    variations
 *   Regular-199, Cheese Burst-259       any labels the owner wants
 *   1,200                                a single grouped price, NOT two variants
 *   120, 180                             an unnamed range, shown as "₹120 – ₹180"
 *
 * Accepted leniencies (all intentional, so an owner never sees a wrong price
 * because of punctuation): `₹`/`Rs.`/`INR` anywhere, a trailing `/-`, `:` or
 * `=` instead of `-` as the label separator, and `|` instead of `,` between
 * options. Amounts may be grouped with commas (`Large-1,200`).
 *
 * `parsePrice` is mirrored by `parsePriceCell_()` in
 * `apps-script/restaurant-template.gs` — keep the two in lockstep.
 */

export interface PriceVariant {
  label: string;
  price: number;
}

export interface ParsedPrice {
  /** Lowest price across all variants, or the single price. Never negative. */
  base: number;
  /** Ordered options. Empty when the item has a single price. */
  variants: PriceVariant[];
}

export const CURRENCY_SYMBOL = '₹';

/** Hard cap so a mis-pasted cell cannot blow up the payload. */
const MAX_VARIANTS = 8;

/** Labels longer than this are truncated so they cannot break card layout. */
const MAX_LABEL_LENGTH = 24;

/** `1,200` or `12,00,000` — grouped digits only, so it is one price not many. */
const GROUPED_NUMBER = /^\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?$/;

/** The last digit run in a segment is always the amount, never part of a label. */
const AMOUNT_RUN = /\d[\d,]*(?:\.\d+)?/g;

const LABEL_TRIM = /^[\s\-:–—_|]+|[\s\-:–—_|]+$/g;

const NO_PRICE: ParsedPrice = { base: 0, variants: [] };

/**
 * Strip currency decoration so only the digits remain. Order matters: the
 * trailing `/-` must go before the `Rs.` rule, which would otherwise leave it
 * stranded.
 */
function stripCurrencyNoise(value: string): string {
  return value
    .replace(/[₹$€£¥]/g, ' ')
    .replace(/\brs\.?/gi, ' ')
    .replace(/\binr\b/gi, ' ')
    .replace(/\/\s*[-\u2010-\u2015]\s*$/, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toAmount(raw: string): number | null {
  const n = Number(raw.replace(/,/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function cleanLabel(raw: string): string {
  return raw.replace(LABEL_TRIM, '').replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL_LENGTH);
}

/** Split one option into `{ label, price }`, or null if it holds no amount. */
function parseSegment(segment: string): PriceVariant | null {
  const cleaned = stripCurrencyNoise(segment);
  if (!cleaned) return null;

  const runs = cleaned.match(AMOUNT_RUN);
  if (!runs || !runs.length) return null;

  // The last run is the amount; anything before it is the label. This keeps
  // digits inside a label ("Regular 500ml") from being read as the price.
  const price = toAmount(runs[runs.length - 1]);
  if (price === null) return null;

  const amountStart = cleaned.lastIndexOf(runs[runs.length - 1]);
  return { label: cleanLabel(cleaned.slice(0, amountStart)), price };
}

/** Later duplicates win, so correcting a label in the sheet just works. */
function dedupeByLabel(variants: PriceVariant[]): PriceVariant[] {
  const seen = new Map<string, number>();
  const out: PriceVariant[] = [];
  for (const variant of variants) {
    const key = variant.label.toLowerCase();
    if (!key) {
      out.push(variant);
      continue;
    }
    const at = seen.get(key);
    if (at === undefined) {
      seen.set(key, out.length);
      out.push(variant);
    } else {
      out[at] = variant;
    }
  }
  return out;
}

/** Split the cell on option separators, keeping comma-grouped amounts intact
 *  so `Large-1,200` reads as ₹1,200 and not as two options. */
function splitCell(text: string): string[] {
  const parts = text.split(/[,|]/);
  if (parts.length < 2) return parts;
  const out: string[] = [];
  for (const part of parts) {
    if (out.length) {
      const prev = out[out.length - 1];
      if (hasLabel(prev) && leftIsGroupable(prev) && isBareAmount(part)) {
        out[out.length - 1] = `${prev},${part}`;
        continue;
      }
    }
    out.push(part);
  }
  return out;
}

/** A bare 2–3 digit amount (the right half of a grouped `Label-1,200`). */
function isBareAmount(value: string): boolean {
  return /^\s*(?:₹|rs\.?|inr)?\s*\d{2,3}(?:\.\d{1,2})?\s*(?:\/-)?$/i.test(value);
}

/** Whether the text before its last amount holds a label. */
function hasLabel(value: string): boolean {
  const runs = value.match(AMOUNT_RUN);
  if (!runs || !runs.length) return false;
  const last = runs[runs.length - 1];
  return cleanLabel(value.slice(0, value.lastIndexOf(last))) !== '';
}

/** Whether the last amount of the text could be the start of a grouped number,
 *  i.e. it is 1–2 digits only — the shape real grouped amounts take
 *  (`1,200`, `12,000`). Stops `Small-120, 200` from being eaten as one price. */
function leftIsGroupable(value: string): boolean {
  const runs = value.match(AMOUNT_RUN);
  if (!runs || !runs.length) return false;
  const integerPart = runs[runs.length - 1].split('.')[0].replace(/,/g, '');
  return /^\d{1,2}$/.test(integerPart);
}

function fromSegments(segments: string[]): ParsedPrice {
  const parsed = segments
    .map(parseSegment)
    .filter((v): v is PriceVariant => v !== null)
    .slice(0, MAX_VARIANTS);

  if (!parsed.length) return NO_PRICE;
  if (parsed.length === 1) return { base: parsed[0].price, variants: [] };

  // Unnamed entries are a range, not a set of choices. "120, 180, 240" is a
  // span; only the ends of that span are worth showing.
  if (parsed.every((v) => !v.label)) {
    const prices = parsed.map((v) => v.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return {
      base: min,
      variants: min === max ? [{ label: '', price: min }] : [{ label: '', price: min }, { label: '', price: max }],
    };
  }

  const variants = dedupeByLabel(parsed);
  return { base: Math.min(...variants.map((v) => v.price)), variants };
}

/** Accept the structured shape too, so a future JSON column just works. */
function fromStructured(value: unknown[]): ParsedPrice {
  const parts = value
    .map((entry) => {
      if (typeof entry === 'number') return String(entry);
      if (entry && typeof entry === 'object') {
        const v = entry as { label?: unknown; price?: unknown };
        const label = cleanLabel(String(v.label ?? ''));
        const amount = toAmount(stripCurrencyNoise(String(v.price ?? '')));
        return amount === null ? '' : label ? `${label}-${amount}` : String(amount);
      }
      return String(entry ?? '');
    })
    .filter(Boolean);
  return fromSegments(parts);
}

/**
 * Parse whatever is in the `price` cell (or a `price` field from JSON) into a
 * base price plus optional variations. Never throws — an unreadable cell
 * yields a price of 0, which the UI renders as "no price".
 */
export function parsePrice(raw: unknown): ParsedPrice {
  if (raw === null || raw === undefined) return NO_PRICE;
  if (Array.isArray(raw)) return raw.length ? fromStructured(raw) : NO_PRICE;

  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw > 0 ? { base: raw, variants: [] } : NO_PRICE;
  }

  const text = stripCurrencyNoise(String(raw));
  if (!text) return NO_PRICE;

  // A bare grouped number wins over the comma-split, so "1,200" stays 1200.
  if (GROUPED_NUMBER.test(text)) {
    const amount = toAmount(text);
    return amount ? { base: amount, variants: [] } : NO_PRICE;
  }

  return fromSegments(splitCell(text));
}

/** Lowest and highest price to display. Falls back to `base` for a single price. */
export function priceRange(base: number, variants?: PriceVariant[]): { min: number; max: number } {
  if (variants && variants.length >= 2) {
    const prices = variants.map((v) => v.price);
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }
  return { min: base, max: base };
}

export function hasVariations(variants?: PriceVariant[]): boolean {
  return Array.isArray(variants) && variants.length >= 2;
}

/** Variations that are real, user-facing choices — i.e. they carry a label. */
export function isOptionList(variants?: PriceVariant[]): boolean {
  return hasVariations(variants) && variants!.some((v) => v.label.length > 0);
}

export function formatAmount(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded)
    ? rounded.toLocaleString('en-IN')
    : rounded.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
