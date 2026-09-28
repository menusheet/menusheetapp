# MenuSheet — Operator Onboarding Checklist

Step-by-step runbook for onboarding a new restaurant (target: ~5 minutes of operator
work) plus operational runbooks for deploys, renewals and secret rotation.

---

## One-time platform setup (skip if already done)

1. **Auth Worker** — `cd admin-auth-worker`, then set the encrypted secrets and deploy:
   ```bash
   wrangler secret put ADMIN_EMAIL       # operator login email
   wrangler secret put ADMIN_PASSWORD    # operator login password
   wrangler secret put SESSION_SECRET    # long random HMAC key
   wrangler secret put SHARED_SECRET     # same value as the Admin Apps Script
   wrangler deploy
   ```
   Copy the resulting `*.workers.dev` URL into `NEXT_PUBLIC_ADMIN_AUTH_WORKER_URL`.
   To serve it from your own domain (recommended, keeps the session cookie
   same-site), add a route in `admin-auth-worker/wrangler.toml` and list that origin
   in `ALLOWED_ORIGINS`.
2. **Admin Google Sheet** — copy `docs/sheet-templates/admin-restaurants.csv` into a new
   Google Sheet tab named `Restaurants`.
3. **Admin Apps Script** — paste `apps-script/admin.gs` into that sheet's script editor,
   set `SHARED_SECRET`, deploy as Web App (*Execute as: Me*, *Access: Anyone*).
4. **Cloudflare Worker** — `cd cloudflare-worker`:
   - Fill `ADMIN_APPS_SCRIPT_URL` in `wrangler.toml`.
   - `wrangler secret put SHARED_SECRET`
   - `wrangler deploy`
5. **Frontend env** — fill `.env.local` from `.env.example` (site URL, auth Worker URL,
   menu cache TTL). This is for **local dev only**. Note that admin credentials and
   `SHARED_SECRET` are deliberately absent: they live only on the auth Worker.
6. **Cloudflare Pages** — connect this repo (Build command `npm run build`, output
   directory `out`, framework preset `None`), then add every `NEXT_PUBLIC_*` var as
   **Plaintext** under *Settings → Environment variables* for **both** Production and
   Preview. The site is a static export, so these are inlined at build time; the
   gitignored `.env.local` is never visible to the Cloudflare builder. See the
   **Deploy** section of the README for the full table.

---

## Onboarding a new restaurant

### 1. Create their menu sheet (owner does this, ~10 min)

- Owner creates a Google Sheet with two tabs, using
  `docs/sheet-templates/restaurant-menu.csv` and `restaurant-settings.csv` as headers.
- Owner fills in dishes (name, price, description, image link, veg flag, availability,
  sort order) and Settings (`menu_active=TRUE`, `expiry_date`, `restaurant_name`).
- **Price variations live in the price column** — no extra columns, no extra tabs.
  A dish with sizes is written as comma-separated `Label-Amount` pairs:
  `Small-220, Medium-320, Large-420`. A single number (`320`) still works and is
  what most dishes should have. The lowest amount is shown as the price and the
  options expand on the menu page.

### 2. Deploy their Apps Script (owner, ~3 min)

- Sheet → Extensions → Apps Script → paste `apps-script/restaurant-template.gs`,
  replace `REPLACE_ME` with the current `SHARED_SECRET`.
- Deploy → New deployment → **Web app** → *Execute as: Me*, *Who has access: Anyone*.
- Authorize, then copy the `/exec` URL.

### 3. Register them in your Admin Dashboard (operator, ~2 min)

- `/admin/restaurants/new` → fill name, contact, expiry, plan, the `/exec` URL, sheet ID.
- The dashboard generates a unique `restaurant_id` slug and writes the row to the Admin
  Sheet via the Admin Apps Script.
- Leave **Active = Inactive** until step 5.

### 4. Generate & map their theme (operator + AI agent)

- Run the Theme Generation Prompt Template (`themes/README.md`) with the restaurant's
  brand details → get `Theme.tsx` + `theme.config.json`.
- Save to `themes/{restaurant_id}/`, register it in `themes/index.ts`.
- Set `theme_key = {restaurant_id}` on their row (dashboard → Edit).

### 5. Rebuild, redeploy, activate

```
git push
```

Cloudflare Pages rebuilds from the commit. If you deploy locally instead, run
`npm run deploy`.

- Verify `https://<your-domain>/r/{restaurant_id}` renders.
- Toggle **Active** ON in the dashboard.
- Dashboard → **Generate QR** → download PNG/SVG, hand it to the owner for printing.

> Redeploy is required only for **new restaurants / new themes / env changes**.
> Menu edits, price changes, sold-out toggles, expiry changes and active toggles go
> live without any deploy (browser fetch + nightly Worker reconciliation).

---

## Renewals

1. Owner pays ₹100.
2. Dashboard → restaurant → set new **Expiry date** (source of truth) → Save.
3. That night's Worker run pushes `expiry_date` (+ `menu_active=TRUE`) to their sheet.
   Need it live immediately? Ask the owner to flip `expiry_date` themselves — the next
   Worker run will confirm it matches.

## Deactivations / churn

- Dashboard → toggle Active OFF (or let expiry pass; the Worker auto-flips it FALSE).
- Their sheet's Settings are force-synced within 24 h even if they fight back.

---

## SHARED_SECRET rotation runbook

The dashboard bundle no longer contains `SHARED_SECRET` — the auth Worker injects it
server-side. If the secret is ever compromised anyway, or you are rotating it
proactively:

1. Generate a new secret.
2. Update it in **three** places:
   - `admin-auth-worker` → `wrangler secret put SHARED_SECRET` → `wrangler deploy`.
   - `apps-script/admin.gs` on the **Admin** Sheet → save a **new deployment**
     (or "Manage deployments" → edit → new version).
   - `apps-script/restaurant-template.gs` used for **future** onboarding docs.
3. Existing restaurants' already-deployed scripts keep the old secret until you update
   each one manually (open their script, change `SHARED_SECRET`, deploy new version).
   Until updated, the Worker cannot reconcile those sheets — prioritize active accounts.
4. Blast radius of the secret is limited to writing rows in *your* Admin Sheet and
   Settings tabs in *your* restaurants' sheets — nothing else.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Menu page shows baked snapshot, never updates | Wrong `appscript_url`, or Web App not re-deployed after code changes | Re-check the `/exec` URL; ensure latest deployment version |
| Worker marks everything stale | Restaurant scripts still on old secret after rotation | Update each script per rotation runbook |
| New restaurant 404s publicly | Added after last build | Rebuild + redeploy |
| Admin login rejected despite valid credentials | Worker secret not set, or `ALLOWED_ORIGINS` does not include the site origin | `wrangler secret put ADMIN_PASSWORD`; check the origin against `ALLOWED_ORIGINS` in `admin-auth-worker/wrangler.toml` |
| `getSettings` returns `unauthorized` | Secret mismatch between Worker/script | Align secrets, redeploy both sides |
