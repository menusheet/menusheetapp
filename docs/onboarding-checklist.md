# MenuSheet — Operator Onboarding Checklist

Step-by-step runbook for onboarding a new restaurant (target: ~5 minutes of operator
work) plus operational runbooks for deploys, renewals and secret rotation.

---

## One-time platform setup (skip if already done)

1. **Platform Worker** — `cd worker`, then set the encrypted secrets and deploy:
   ```bash
   wrangler secret put ADMIN_EMAIL       # operator login email
   wrangler secret put ADMIN_PASSWORD    # operator login password
   wrangler secret put SESSION_SECRET    # long random HMAC key
   wrangler secret put SHARED_SECRET     # the key the Worker presents to each sheet
   wrangler deploy
   ```
   Copy the resulting `*.workers.dev` URL into `NEXT_PUBLIC_API_URL`. That is the only
   API the site talks to, for both the public menu and the dashboard. To serve it from
   your own domain, add a `route` in `worker/wrangler.toml` and list that origin in
   `ALLOWED_ORIGINS` — the dashboard's session cookie is `SameSite=None`, so the
   browser will only send it if the origin matches exactly.
2. **KV namespaces** — already created and wired up in `worker/wrangler.toml`
   (`RESTAURANTS` and `MENUS`). Create them yourself with `npx wrangler kv namespace
   create RESTAURANTS` if you are starting from a blank account.
3. **Seed the roster** — the old Admin Sheet is retired, so the restaurant list has to
   be copied into KV once:
   ```bash
   cd worker
   npm install
   node scripts/seed-kv.mjs              # dry run, prints the plan
   node scripts/seed-kv.mjs --write
   ```
   It authenticates through `wrangler login`, so there is no API token to set up.
   Run this before anyone starts using the dashboard; it overwrites.
4. **Frontend env** — fill `.env.local` from `.env.example` (site URL, API URL, menu
   cache TTL). This is for **local dev only**. Admin credentials and `SHARED_SECRET`
   are deliberately absent: they live only on the Worker.
5. **Cloudflare Pages** — connect this repo (Build command `npm run build`, output
   directory `out`, framework preset `None`), then add every `NEXT_PUBLIC_*` var as
   **Plaintext** under *Settings → Environment variables* for **both** Production and
   Preview. The site is a static export, so these are inlined at build time; the
   gitignored `.env.local` is never visible to the Cloudflare builder. See the
   **Deploy** section of the README for the full table.

---

## Onboarding a new restaurant

### 1. Create their menu sheet (owner does this, ~10 min)

- Owner creates a blank Google Sheet. Nothing else — the script in step 2 creates and
  headers the only tab it needs.
- There is no Settings tab. The restaurant id, name and subscription state all live in
  the platform's database, and the id is hardcoded in the script in step 2.
- Owner fills in dishes after running `initSheet()` (step 2), which lays down the
  **Menu** tab with the columns
  `id, category, name, description, price, image_url, is_veg, is_available, sort_order`
  and a couple of sample rows to overwrite.
- **Price variations live in the price column** — no extra columns,
  no extra tabs.
  A dish with sizes is written as comma-separated `Label-Amount` pairs:
  `Small-220, Medium-320, Large-420`. A single number (`320`) still works and is
  what most dishes should have. The lowest amount is shown as the price and the
  options expand on the menu page.

### 2. Deploy their Apps Script (owner, ~3 min)

- Sheet → Extensions → Apps Script → paste `apps-script/restaurant-template.gs` and set the
  four constants at the top: `RESTAURANT_ID` (the id from the portal), `RESTAURANT_NAME`
  (optional), `API_URL`, `SHARED_SECRET`.
- **Project Settings → tick "Show appsscript.json manifest file in editor"** and paste
  `apps-script/appsscript.json` over it. Not optional: without it the *Reload menu on
  website* button throws
  `You do not have permission to call UrlFetchApp.fetch ... script.external_request`,
  because the scope consent prompt cannot be answered from a menu click. The manifest
  declares the only three scopes the script uses — `spreadsheets.currentonly`,
  `script.container.ui`, `script.external_request`.
- Run `initSheet()` once from the editor. It creates the single **Menu** tab with headers
  and sample rows, and deletes a leftover Settings tab from an older deployment. Approve
  the permission prompt when it appears.
- Deploy → New deployment → **Web app** → *Execute as: Me*, *Who has access: Anyone*.
- Authorize, then copy the `/exec` URL.
- The script adds a **MenuSheet** menu to their sheet with one item,
  *Reload menu on website*. That button is how they publish their own edits without
  calling you — it writes nothing to the sheet, it just asks the platform to re-read it.
- If the script or its manifest is ever changed, **Deploy → Manage deployments → edit →
  New version**. A saved code change does not reach the live `/exec` URL on its own.

### 3. Register them in the dashboard (operator, ~2 min)

- `/admin/restaurants/new` → fill name, contact, expiry, plan, the `/exec` URL, sheet ID.
- The dashboard generates a unique `restaurant_id` slug and writes the record to KV.
- Set the cache lifetime while you are here. `Never expires` is the default and is
  usually right for a restaurant that will press Reload when they change something.
- Leave **Active = Inactive** until step 5.

### 4. Theme (operator + AI agent, only for a new look)

- Using one of the themes already under `themes/`? Just pick it. No deploy needed.
- Need a bespoke theme? Run the Theme Generation Prompt Template
  (`themes/README.md`) → save to `themes/{restaurant_id}/`, register it in
  `themes/index.ts`, then `npm run deploy`. Set `theme_key = {restaurant_id}`.
- Themes are compiled into the client bundle, so a brand-new theme is the only thing
  that still forces a rebuild.

### 5. Publish, activate, hand over the QR

- Dashboard → the restaurant → **Reload menu now**. This is the one action that reads
  their Google Sheet, and it fills the KV cache. It must succeed before the page works.
- Verify `https://<your-domain>/r/{restaurant_id}` renders.
- Toggle **Active** ON in the dashboard. It takes effect on the next page load.
- Dashboard → **Generate QR** → download PNG/SVG, hand it to the owner for printing.

> No deploy is required for new restaurants using an existing theme. Only a **new
> theme** or an **env change** forces a rebuild. Menu edits, price changes and sold-out
> toggles go live when someone presses Reload.

---

## Renewals

1. Owner pays ₹100.
2. Dashboard → restaurant → set the new **Expiry date** → Save.
3. That is the whole job. The Worker reads `expiry_date` from KV on every request, so
   the menu is either served or blocked immediately. Nothing is written to the owner's
   sheet and there is no nightly job to wait for.

## Deactivations / churn

- Dashboard → toggle Active OFF, or let the expiry date pass. Both are enforced by the
  Worker on the next page load.
- Their sheet is never touched, so there is nothing for them to undo and no
  reconciliation to catch up on. If you want their cached menu gone too, use
  `deleteRestaurant` — that removes both the roster record and the menu entry.

---

## Publishing a menu on a schedule

There is no scheduler. If you want menus to refresh without a human, run your own
timer against the machine endpoint rather than reintroducing a cron in the Worker:

```bash
curl -X POST "https://<worker>/api/reload?key=$SHARED_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"restaurant_id":"thottara-kitchen"}'
```

It is safe to call per restaurant, and it stamps `last_checked_at` so the dashboard's
cache panel stays accurate.

---

## SHARED_SECRET rotation runbook

The dashboard bundle does not contain `SHARED_SECRET` — the Worker injects it
server-side. If the secret is ever compromised, or you are rotating it proactively:

1. Generate a new secret.
2. Update it in **two** places:
   - `worker/` → `wrangler secret put SHARED_SECRET` → `wrangler deploy`.
   - `apps-script/restaurant-template.gs`, so future onboarding docs hand out the new one.
3. Existing restaurants' already-deployed scripts keep the old secret until you update
   each one (open their script, change `SHARED_SECRET`, deploy a new version). Until
   then, a reload for that restaurant fails with an authentication error. Prioritise
   active accounts. The already-cached menus keep serving throughout, so nothing
   customer-facing breaks while you work through the list.
4. Blast radius of the secret is limited to *reading* the menu out of a restaurant's
   sheet. It grants no write access and no access to the roster.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| "This restaurant has no Apps Script URL saved" | Never pasted their `/exec` URL | Add it on the detail page, then Reload |
| Owner's Reload button says "Could not reach MenuSheet: You do not have permission to call UrlFetchApp.fetch" | The script was deployed without an `appsscript.json` declaring `script.external_request` | Project Settings → show the manifest → paste `apps-script/appsscript.json` → run `initSheet()` and approve → new deployment version |
| Reload returns an authentication error | The sheet still has the old `SHARED_SECRET` after a rotation | Update that script per the rotation runbook |
| Reload returns "not a Google Apps Script /exec URL" | A Sheets *sharing* URL was pasted instead | Use the `/exec` URL from Deploy → New deployment |
| Reload returns "deployment is not public" | Web App *Who has access* is not Anyone | Redeploy as a Web App with access Anyone |
| Reload returns a non-JSON page | Script is broken, or a new version was saved without being deployed | Create a new deployment version |
| Page shows "waiting for a reload" | The cache TTL elapsed and nobody pressed Reload | Press Reload, or set the lifetime to `Never expires` |
| Page shows "menu not available" | `active` is off, the subscription expired, or the id is wrong | Check both on the dashboard detail page |
| New restaurant 404s publicly | They have never had a successful Reload, or `NEXT_PUBLIC_API_URL` is wrong at build time | Reload once; if already done, check the build env var |
| Admin login rejected despite valid credentials | Secret not set, or `ALLOWED_ORIGINS` does not include the site origin | `wrangler secret put ADMIN_PASSWORD`; check `ALLOWED_ORIGINS` in `worker/wrangler.toml` |
| Dashboard edits appear then revert | Two people editing at once against an eventually consistent KV | Reload the page; the Worker returns the full list on every write to reduce this |
| Menu shows the old version after an edit | The script cache answered | Reload again — the Worker always requests `fresh=1`; if it persists, the owner edited a different tab or the script needs redeploying |
