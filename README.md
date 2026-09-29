# MenuSheet

QR-code digital menu SaaS for restaurants — **₹100/month**. Owners manage their menu in
their own Google Sheet; customers scan a QR code and get a fast, branded menu page.

## Architecture

```
                ①  Reload (operator button, or the restaurant's own sheet menu)
Restaurant Sheet ──Apps Script──► Cloudflare Worker ──► Cloudflare KV
                                                              │
                                              ②  every page load, from KV
                                                              ▼
                                                  /r/{id} menu page
```

One Worker (`worker/`) and one KV namespace pair do everything privileged:

- **The roster** — the restaurant list, billing fields, active flag and expiry date live
  in KV, not in a spreadsheet. This replaces the old Admin Sheet.
- **The menu cache** — the Worker holds the last fetched menu per restaurant and serves
  it to every visitor. A restaurant's Google Sheet is read **only** when somebody
  explicitly reloads it: the *Reload menu now* button in the dashboard, or
  *MenuSheet → Reload menu on website* in the restaurant's own sheet.
- **The kill switch** — `active` and `expiry_date` are evaluated from KV on every
  request, so deactivating a restaurant or letting a subscription lapse takes effect
  immediately. Nothing is written back to the owner's sheet.
- **Sign-in** — the same Worker verifies the operator credentials and issues a signed
  session token, so `SHARED_SECRET` is never exposed to the browser. The token is
  replayed as an `Authorization: Bearer` header rather than relied on as a cookie:
  the dashboard is a static export on `pages.dev` while the Worker is on
  `workers.dev`, so a session cookie is third-party and Safari drops it outright
  (as does any browser with third-party cookies off). The Worker still sets the
  cookie for curl and the test suite, and accepts either credential.

There is no cron, no reconciler, and no background job. Nothing runs unless a person
asks it to.

### Cache lifetime

Each restaurant has a `cache_ttl_seconds`, editable from its detail page. The menu is
served from KV until that window elapses, after which the public page shows a
"waiting for reload" state and the owner or operator republishes. `0` means "never
expires — serve until the next Reload", which is the default for new restaurants.

### New restaurants need no deploy

Restaurants in `data/restaurants.json` get a pre-rendered page with server-rendered
metadata and JSON-LD. Anything else falls through a `/r/*` catch-all to a client
shell that asks the API. So a restaurant added in the dashboard is live at its QR URL
as soon as somebody presses Reload — the next deploy only adds the pre-rendered
version, which improves SEO and load time.

```
├── app/                     # Next.js App Router (output: 'export')
│   ├── r/[id]/page.tsx      # Pre-rendered themed menu pages (one per manifest entry)
│   ├── r-shell/             # Catch-all page for any other id
│   └── admin/               # Login + protected dashboard (route group)
├── components/              # Landing/admin/public components
├── themes/                  # Per-restaurant theme modules (+ demo)
├── lib/                     # Menu API, admin API, auth, caching, types
├── data/restaurants.json      # ids that get a pre-rendered /r/{id} page (hand-edited)
├── scripts/generate-static-data.js   # prebuild: manifest -> public/_redirects
├── apps-script/             # restaurant-template.gs (read-only, one Menu tab, per restaurant)
├── worker/                  # The platform Worker: API, auth, KV (Wrangler project)
└── docs/                    # onboarding checklist + sheet templates
```

## Local development

```bash
npm install
cp .env.example .env.local   # fill in values (see file comments)
npm run dev                  # http://localhost:3000
npm test --prefix worker     # Worker smoke tests, no test runner needed
```

Every restaurant's menu comes from the API at runtime, so the site has no menu fixtures
in it. `/r/demo` is a seeded sample whose menu is written straight into KV, which is
what the landing page links to and what you get with no Google setup at all.

## Deploy

The site deploys to Cloudflare Pages. The API deploys separately to Workers.

### 1. The Worker

```bash
cd worker
npm install
node scripts/set-secrets.mjs     # generates the four secrets, sets them, saves worker/.dev.vars
npm run deploy
```

Or set them by hand:

```bash
npx wrangler secret put ADMIN_EMAIL      # operator sign-in email
npx wrangler secret put ADMIN_PASSWORD   # operator sign-in password
npx wrangler secret put SESSION_SECRET   # session token signing key
npx wrangler secret put SHARED_SECRET    # the key a sheet's Reload button authenticates with
```

`ADMIN_PASSWORD` and `SHARED_SECRET` are unrecoverable once set — `wrangler` will not
show them back — so keep the copy `set-secrets.mjs` writes to `worker/.dev.vars`
(gitignored), or record them somewhere safe.

`wrangler.toml` already contains the real KV namespace ids. `DEFAULT_MENU_TTL_SECONDS`
(3600) is the fallback cache lifetime for any record that has no explicit value.

### 2. Seed the roster (one time)

```bash
cd worker
npm install                        # once - wrangler is a devDependency here
node scripts/seed-kv.mjs           # dry run: prints what it would write
node scripts/seed-kv.mjs --write
```

This reads `data/restaurants.json` and writes one KV record per restaurant plus the id
index, then seeds `menu:demo` so the landing page's sample works with no Google setup.
It authenticates through `wrangler login`, so there is no API token to configure.

Run it before anyone starts using the dashboard — `--write` overwrites the roster.

### 3. The site

Production deploys are a **git push**. Cloudflare Pages is connected to this repo and
runs `npm run build`, then serves the `out/` directory.

| Setting | Value |
| --- | --- |
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `out` |
| Root directory | `/` |

### Environment variables (Cloudflare Pages)

`next.config.js` sets `output: 'export'`, which means this is a fully static site and
**all `NEXT_PUBLIC_*` values are inlined into the JS bundle at build time**. They are
never read at runtime, so Cloudflare's runtime variables have no effect on them.

Set these under **Settings → Environment variables** as **Plaintext**, for **both**
Production and Preview:

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin, e.g. `https://menusheetapp.pages.dev` |
| `NEXT_PUBLIC_API_URL` | Public URL of the platform Worker |
| `NEXT_PUBLIC_MENU_CACHE_TTL_MINUTES` | Optional browser-side cache, defaults to `5` |

`.env.local` is gitignored, so it is **only** for local development and local builds —
it never reaches the Cloudflare build container. `next build` fails loudly if any
required variable above is missing, rather than shipping a bundle with empty values.

### Local deploy (fallback)

```bash
npm run deploy              # build + deploy out/ to Pages (production branch)
npm run deploy:preview      # same, on the preview branch
```

Both go through `scripts/deploy-pages.mjs`, which refuses to build when
`NEXT_PUBLIC_SITE_URL` is a localhost address. Building with a plain
`npm run build` picks up `.env.local`, whose site URL is localhost, and would
publish `canonical: http://localhost:3000` and a localhost sitemap. The script
defaults the three `NEXT_PUBLIC_*` values to the production URLs and deploys to
the project name `menusheetapp` — deploying to `menusheet` would silently update
a different Pages project and leave production untouched.

Wrangler is a devDependency of `worker/`, not the app root; the script finds it
in either place. Install it with `npm --prefix worker install` if it is missing.

## Ops docs

- [`docs/onboarding-checklist.md`](docs/onboarding-checklist.md) — full runbook:
  platform setup, per-restaurant onboarding, renewals, SHARED_SECRET rotation.
- [`themes/README.md`](themes/README.md) — theme generation prompt template.
- [`worker/`](worker/) — the platform Worker.
