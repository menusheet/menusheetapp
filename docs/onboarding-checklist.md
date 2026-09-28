# MenuSheet — Operator Onboarding Checklist

Step-by-step runbook for onboarding a new restaurant (target: ~5 minutes of operator
work) plus operational runbooks for deploys, renewals and secret rotation.

---

## One-time platform setup (skip if already done)

1. **Supabase project** — create at <https://supabase.com>, then:
   - Authentication → Providers → enable **Email** (Email/Password).
   - Authentication → Users → create the operator account(s).
   - Settings → API → copy the Project URL and Publishable Key into `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`).
2. **Admin Google Sheet** — copy `docs/sheet-templates/admin-restaurants.csv` into a new
   Google Sheet tab named `Restaurants`.
3. **Admin Apps Script** — paste `apps-script/admin.gs` into that sheet's script editor,
   set `SHARED_SECRET`, deploy as Web App (*Execute as: Me*, *Access: Anyone*).
4. **Cloudflare Worker** — `cd cloudflare-worker`:
   - Fill `ADMIN_APPS_SCRIPT_URL` in `wrangler.toml`.
   - `wrangler secret put SHARED_SECRET`
   - `wrangler deploy`
5. **Frontend env** — fill `.env.local` from `.env.example` (site URL, Supabase keys,
   allow-list, both Apps Script URL/secret pairs). This is for **local dev only**.
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

The dashboard bundle necessarily contains `NEXT_PUBLIC_SHARED_SECRET` (no-backend
trade-off). If it ever leaks:

1. Generate a new secret.
2. Update it in **all four** places:
   - `.env.local` → `NEXT_PUBLIC_SHARED_SECRET` **and** `SHARED_SECRET` → rebuild +
     redeploy the frontend.
   - `apps-script/admin.gs` on the **Admin** Sheet → save a **new deployment**
     (or "Manage deployments" → edit → new version).
   - `cloudflare-worker` → `wrangler secret put SHARED_SECRET`.
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
| Admin login rejected despite valid email | Email not in allow-list | Add to `NEXT_PUBLIC_ADMIN_ALLOWED_EMAILS`, rebuild |
| `getSettings` returns `unauthorized` | Secret mismatch between Worker/script | Align secrets, redeploy both sides |
