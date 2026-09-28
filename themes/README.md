# MenuSheet Themes

Every restaurant gets a self-contained theme module under `themes/{theme_key}/`:

```
themes/
├── demo/                 ← sample restaurant ("The Green Fork")
│   ├── Theme.tsx         ← themed React component (renders ONLY from props)
│   └── theme.config.json ← colors, fonts, logo, hero image, tagline
└── index.ts              ← static import registry (add new themes here)
```

## Rules

- `Theme.tsx` exports a default component receiving `{ restaurant, menu, status }`.
  It must never hardcode menu data.
- **Prices must use the shared components** `PriceDisplay` and `PriceOptions` from
  `components/public/PriceDisplay.tsx` — do NOT write a local `Price` component.
  Menu items may have price variations (sizes etc.) parsed from the sheet's
  `price` cell; the shared components render a single price, a `₹120 – ₹240`
  range, and the tappable option list for you.
  - `item.price` is the **lowest** price (safe for any fallback use).
  - `item.priceVariants` is `[{ label, price }, ...]`, empty when no variations.
  - `PriceDisplay` goes in the card's price column; `PriceOptions` goes below the
    description, typically `{ unavailable ? null : <PriceOptions …/> }`.
- `status`: `"ok" | "inactive" | "expired" | "loading"` — the component must render a
  sensible state for each (see the demo theme for reference).
- Only Tailwind utility classes plus the theme's hex colors as CSS variables
  (`--ms-primary`, `--ms-accent`, …). No global stylesheet changes.
- Mobile-first. This page is scanned on phones.

## Adding a restaurant's theme (operator flow)

1. Generate `Theme.tsx` + `theme.config.json` using the AI prompt template below,
   filling in the restaurant's brand details.
2. Save both files into `themes/{restaurant_id}/`.
3. Register it in `themes/index.ts`:

   ```ts
   import SpiceRouteTheme from './spice-route/Theme';
   import spiceRouteConfig from './spice-route/theme.config.json';

   export const themes: Record<string, ThemeModule> = {
     demo: { Component: DemoTheme, config: demoConfig as ThemeModule['config'] },
     'spice-route': { Component: SpiceRouteTheme, config: spiceRouteConfig as ThemeModule['config'] },
   };
   ```

4. Map `theme_key = spice-route` on the restaurant row (dashboard → Edit).
5. Rebuild + redeploy:

   ```
   npm run deploy
   ```

Themes are statically imported at build time (required for pure static export), so a
new theme always needs one deploy. Day-to-day menu edits do **not**.

---

## Theme Generation Prompt Template

Fill in the blanks per restaurant and hand to your AI coding agent:

```
You are generating a single self-contained React (Next.js, TypeScript, Tailwind CSS) theme
component for a QR-code digital menu page inside the MenuSheet platform.

Restaurant name: {{RESTAURANT_NAME}}
Brand vibe / cuisine type: {{VIBE_DESCRIPTION}}   e.g. "cozy Italian trattoria, warm terracotta
  and olive tones, rustic serif headings"
Primary color: {{PRIMARY_HEX}}
Secondary/accent color: {{ACCENT_HEX}}
Logo URL: {{LOGO_URL}}
Hero/banner image URL: {{HERO_IMAGE_URL}}
Font pairing preference: {{FONT_PAIR}}   e.g. "Playfair Display for headings, Inter for body"

Requirements:
1. Export a default React component `Theme(props)` where props = { restaurant, menu, status }.
   - restaurant: { name, tagline, logoUrl, heroImageUrl }
   - menu: array of { id, category, name, description, price, priceVariants, imageUrl, isVeg, isAvailable }
     where price is the LOWEST price and priceVariants is `[{ label, price }, ...]`
     (empty array when the item has a single price).
   - status: "ok" | "inactive" | "expired" | "loading"
2. Do NOT hardcode any menu item data — always render from `props.menu`.
3. Group items by `category`, in the order categories first appear.
4. Show a veg/non-veg indicator per item (small colored dot/icon).
5. Grey out or hide items where `isAvailable === false`.
6. For prices, import and use the shared components from
   `components/public/PriceDisplay.tsx`: `PriceDisplay` (in the card's price
   column, pass `base={item.price}` and `variants={item.priceVariants}`) and
   `PriceOptions` (below the description, only when the item is available).
   Do not write your own price component.
7. If `status === "inactive"` render a clean "Menu temporarily unavailable" state.
8. If `status === "expired"` render a neutral "This menu is no longer active" state (no
   mention of billing/payment to end customers).
9. If `status === "loading"` render a skeleton loader that matches the theme's visual style:
   - Pulsing placeholders (`animate-pulse`) for hero image, category header, and 3-4 menu item cards.
   - Each skeleton card should mirror the real card layout: image placeholder (left), text lines (right),
     and a price placeholder using `color-mix(in srgb, var(--ms-primary) 12%, transparent)`.
   - Use the theme's CSS variables (`--ms-surface`, `--ms-primary`) so the skeleton blends with the
     theme colors. Avoid hardcoded colors where possible.
   - The skeleton is the ONLY thing shown while the menu loads — make it feel polished.
10. Fully mobile-first — this is scanned on phones via QR code. Large tap targets, readable
    type, sticky category nav if the menu is long.
11. Include a subtle footer: "Powered by MenuSheet" linking to the MenuSheet landing page.
12. Only use Tailwind utility classes plus the two hex colors provided as CSS variables —
    do not introduce a global stylesheet change.
13. Output exactly two files: `Theme.tsx` and `theme.config.json` (containing the colors,
    fonts, logo, hero image, tagline). No other files, no explanations outside the code.
```

Reference implementation: [`demo/Theme.tsx`](demo/Theme.tsx) — copy its structure
(status screens, veg mark, sticky category nav, skeleton) when generating new themes.
