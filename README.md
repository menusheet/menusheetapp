# MenuSheet

QR-code digital menu SaaS for restaurants — **₹100/month**. Owners manage their menu in
their own Google Sheet; customers scan a QR code and get a fast, branded menu page.
No backend server anywhere: Google Sheets is the database, Apps Script is the API,
a Cloudflare Worker is the only cron logic, and Cloudflare Pages serves a fully static
Next.js export with free unlimited bandwidth.

## Architecture

```
Restaurant Sheet ──Apps Script──► /r/{id} page (static export + live client fetch)
Admin Sheet ──Admin Apps Script──► Admin Dashboard (Cloudflare auth Worker)
                ▲                        │
                └── Cloudflare Worker ───┘   (daily 00:00 IST reconciliation cron)
```

- **Public pages** are pre-rendered at build time from `data/` snapshots; after load,
  the browser fetches `?action=getMenu` from the restaurant's own Apps Script with a
  localStorage cache (6 h TTL) so repeat QR scans never hit quota.
- **Billing state** lives in the Admin Sheet (source of truth). The Worker reconciles
  every restaurant's Settings tab nightly and auto-deactivates expired accounts.
- **Admin Dashboard** (`/admin`, unlisted + noindex) authenticates through the
  `admin-auth-worker/` Cloudflare Worker. It holds the operator credentials, signs an
  HttpOnly session cookie, and proxies every privileged Apps Script call — so
  `SHARED_SECRET` is never exposed to the browser.

```
├── app/                     # Next.js App Router (output: 'export')
│   ├── page.tsx             # Landing (marketing)
│   ├── r/[id]/page.tsx      # Public themed menu pages
│   ├── sitemap.ts robots.ts # SEO plumbing (admin excluded)
│   └── admin/               # Login + protected dashboard (route group)
├── components/              # Landing/admin/public components
├── themes/                  # Per-restaurant theme modules (+ demo)
├── lib/                     # Auth, admin API, caching, types
├── data/                    # Build-time manifest + menu snapshots (committed seed)
├── scripts/generate-static-data.js   # prebuild sync from Admin Sheet
├── apps-script/             # restaurant-template.gs + admin.gs
├── cloudflare-worker/       # nightly reconciliation cron (Wrangler project)
└── docs/                    # onboarding checklist + sheet templates
```

## Local development

```bash
npm install
cp .env.example .env.local   # fill in values (see file comments)
npm run dev                  # http://localhost:3000 — demo restaurant works with no env
```

`/r/demo` renders "The Green Fork" from the committed fixture
(`data/menus/demo.json`) without any Google setup.

## Deploy

Production deploys are a **git push**. Cloudflare Pages is connected to this repo and
runs `npm run build`, then serves the `out/` directory.

### Build settings (Cloudflare Pages)

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
| `NEXT_PUBLIC_MENU_CACHE_TTL_HOURS` | Optional, defaults to `6` |
| `NEXT_PUBLIC_ADMIN_AUTH_WORKER_URL` | Public URL of the auth Worker |

`.env.local` is gitignored, so it is **only** for local development and local builds —
it never reaches the Cloudflare build container. `next build` fails loudly if any
required variable above is missing, rather than shipping a bundle with empty values.

### Secrets that must NOT be build-time vars

`ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SESSION_SECRET` and `SHARED_SECRET` are encrypted
secrets on the auth Worker. They are set once with `wrangler secret put` and are never
exposed to the browser. See `admin-auth-worker/`.

### Local deploy (fallback)

```bash
npm run deploy    # npm run build && npx wrangler pages deploy out
```

Note the project name in that script must match your Pages project.

`prebuild` pulls fresh data from your Admin Sheet when `ADMIN_APPS_SCRIPT_URL` +
`SHARED_SECRET` are set (falls back to committed data otherwise). New restaurants or
themes require this redeploy; day-to-day menu edits do not.

## Ops docs

- [`docs/onboarding-checklist.md`](docs/onboarding-checklist.md) — full runbook:
  platform setup, per-restaurant onboarding, renewals, SHARED_SECRET rotation.
- [`themes/README.md`](themes/README.md) — theme generation prompt template.
- [`cloudflare-worker/`](cloudflare-worker/) — Wrangler project (`30 18 * * *` = 00:00 IST).
