'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { addRestaurant, listRestaurants, updateRestaurant } from '@/lib/adminApi';
import { getThemeKeys } from '@/themes';
import type { RestaurantRecord } from '@/lib/types';
import {
  ErrorBanner,
  Field,
  PrimaryButton,
  SecondaryButton,
  Select,
  Spinner,
  inputClass,
} from '@/components/admin/ui';

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'restaurant'
  );
}

function defaultExpiry(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

/* Same presets as the detail page, so an operator never sees two vocabularies. */
const TTL_PRESET_LABELS = [
  'Never expires (until next Reload)',
  '15 minutes',
  '1 hour',
  '6 hours',
  '24 hours',
  '7 days',
];
const TTL_PRESET_VALUES = ['0', '900', '3600', '21600', '86400', '604800'];

export default function NewRestaurantForm() {
  return (
    <Suspense fallback={<Spinner label="Loading form…" />}>
      <Form />
    </Suspense>
  );
}

function Form() {
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');

  const [loadingRecord, setLoadingRecord] = useState<boolean>(Boolean(editId));
  const [record, setRecord] = useState<RestaurantRecord | null>(null);
  const [name, setName] = useState('');
  const [restaurantId, setRestaurantId] = useState('');
  const [idManuallyEdited, setIdManuallyEdited] = useState(false);
  const [contact, setContact] = useState('');
  const [appscriptUrl, setAppscriptUrl] = useState('');
  const [sheetId, setSheetId] = useState('');
  const [themeKey, setThemeKey] = useState('demo');
  const [expiryDate, setExpiryDate] = useState(defaultExpiry());
  const [planAmount, setPlanAmount] = useState('100');
  const [notes, setNotes] = useState('');
  const [active, setActive] = useState(false);
  const [cacheTtl, setCacheTtl] = useState('0');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<RestaurantRecord | null>(null);

  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    setLoadingRecord(true);
    listRestaurants()
      .then((rows) => {
        if (cancelled) return;
        const found = rows.find((r) => r.restaurant_id === editId) || null;
        if (found) {
          setRecord(found);
          setName(found.restaurant_name);
          setRestaurantId(found.restaurant_id);
          setIdManuallyEdited(true);
          setContact(found.owner_contact);
          setAppscriptUrl(found.appscript_url);
          setSheetId(found.sheet_id);
          setThemeKey(found.theme_key || 'demo');
          setExpiryDate(found.expiry_date || defaultExpiry());
          setPlanAmount(String(found.plan_amount ?? '100'));
          setNotes(found.notes);
          setActive(found.active);
          setCacheTtl(String(found.cache_ttl_seconds ?? 0));
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoadingRecord(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editId]);

  useEffect(() => {
    if (idManuallyEdited || record) return;
    setRestaurantId(slugify(name));
  }, [name, idManuallyEdited, record]);

  const themeOptions = useMemo(() => getThemeKeys(), []);
  const isEdit = Boolean(record);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError(null);
    setBusy(true);
    const fields: Partial<RestaurantRecord> = {
      restaurant_name: name.trim(),
      owner_contact: contact.trim(),
      appscript_url: appscriptUrl.trim(),
      sheet_id: sheetId.trim(),
      theme_key: themeKey.trim() || 'demo',
      expiry_date: expiryDate,
      plan_amount: Number(planAmount) || 100,
      notes: notes.trim(),
      active,
      cache_ttl_seconds: Number(cacheTtl) || 0,
    };
    try {
      let saved: RestaurantRecord;
      if (isEdit && record) {
        const result = await updateRestaurant({ ...fields, restaurant_id: record.restaurant_id });
        saved = result.restaurant;
      } else {
        const result = await addRestaurant({ ...fields, restaurant_id: slugify(restaurantId || name) });
        saved = result.restaurant;
      }
      setDone(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (done) return <SuccessPanel record={done} wasEdit={isEdit} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          {isEdit ? `Quick edit — ${record?.restaurant_name}` : 'Add a new restaurant'}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {isEdit
            ? 'Quick edit for a restaurant that is already in the live roster. Saves straight to the platform database.'
            : 'Creates the record in the platform database. The public menu URL works as soon as you press Reload — no build, no deploy.'}
        </p>
      </div>

      {loadingRecord ? (
        <Spinner label="Loading restaurant…" />
      ) : (
        <form onSubmit={submit} className="max-w-2xl space-y-5 rounded-2xl bg-white p-6 shadow-card ring-1 ring-gray-100 sm:p-8">
          {!isEdit ? (
            <Field label="Restaurant name" hint="Used for the display name and to auto-generate the ID below.">
              <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Spice Route" className={inputClass} />
            </Field>
          ) : null}

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Owner contact" hint="Phone or email of the restaurant owner.">
              <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="+91 98765 43210" className={inputClass} />
            </Field>
            <Field label="Plan amount (₹/month)">
              <input type="number" min="0" value={planAmount} onChange={(e) => setPlanAmount(e.target.value)} className={inputClass} />
            </Field>
          </div>

          <Field
            label={isEdit ? 'Restaurant ID' : 'Restaurant ID'}
            hint={isEdit ? 'Fixed for existing restaurants.' : 'Public URL slug — /r/{id}. Lowercase letters, numbers, dashes.'}
          >
            <input
              required
              value={restaurantId}
              disabled={isEdit}
              onChange={(e) => {
                setIdManuallyEdited(true);
                setRestaurantId(slugify(e.target.value));
              }}
              placeholder="spice-route"
              className={`${inputClass} ${isEdit ? 'opacity-60' : 'font-mono'}`}
            />
          </Field>

          <Field
            label="Apps Script Web App URL"
            hint='The /exec URL from deploying apps-script/restaurant-template.gs on the owner’s sheet.'
          >
            <input value={appscriptUrl} onChange={(e) => setAppscriptUrl(e.target.value)} placeholder="https://script.google.com/macros/s/AKfy…/exec" className={`${inputClass} font-mono text-xs`} />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Google Sheet ID" hint="Optional — lets you open their sheet quickly.">
              <input value={sheetId} onChange={(e) => setSheetId(e.target.value)} className={`${inputClass} font-mono text-xs`} />
            </Field>
            <Field label="Theme key" hint={`Installed themes: ${themeOptions.join(', ')}. Add new ones under themes/.`}>
              <Select value={themeKey} onChange={setThemeKey} options={themeOptions} placeholder="Choose a theme…" />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Expiry date" hint="Enforced by the platform on every customer page load.">
              <input type="date" required value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Cache lifetime" hint="How long a fetched menu is served before it lapses.">
              <Select
                value={cacheTtl}
                onChange={setCacheTtl}
                options={TTL_PRESET_LABELS}
                values={TTL_PRESET_VALUES}
                placeholder="Custom…"
              />
            </Field>
          </div>

          <Field label="Active now?" hint="You can also toggle this later from the dashboard.">
            <button
              type="button"
              onClick={() => setActive(!active)}
              className={`inline-flex h-[42px] w-full items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition ${
                active ? 'border-forest-200 bg-forest-50 text-forest-800' : 'border-gray-200 bg-white text-gray-500'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${active ? 'bg-forest-500' : 'bg-gray-300'}`} />
              {active ? 'Active' : 'Inactive (default)'}
            </button>
          </Field>

          <Field label="Notes" hint="Free text — anything worth remembering about this account.">
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
          </Field>

          {error ? <ErrorBanner message={error} /> : null}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <PrimaryButton type="submit" disabled={busy}>
              {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create restaurant'}
            </PrimaryButton>
            <Link href="/admin">
              <SecondaryButton>Cancel</SecondaryButton>
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}

function SuccessPanel({ record, wasEdit }: { record: RestaurantRecord; wasEdit: boolean }) {
  const steps = [
    { done: true, text: 'Saved in the platform database' },
    {
      done: Boolean(record.sheet_id),
      text: 'Owner creates a blank Google Sheet and pastes the script there',
    },
    {
      done: Boolean(record.appscript_url),
      text: 'Deploy apps-script/restaurant-template.gs on that sheet → paste the /exec URL above',
    },
    {
      done: false,
      text: 'Press Reload menu now to fetch the sheet and publish it at this URL',
    },
    { done: false, text: 'Download QR from the dashboard and hand it over 🎉' },
  ];

  return (
    <div className="mx-auto max-w-xl">
      <div className="rounded-2xl bg-white p-8 text-center shadow-card ring-1 ring-gray-100">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-forest-50 text-2xl">✅</span>
        <h1 className="mt-4 text-xl font-extrabold tracking-tight">
          {wasEdit ? 'Changes saved' : `${record.restaurant_name} is onboarded!`}
        </h1>
        <p className="mt-1 font-mono text-sm text-gray-400">/r/{record.restaurant_id}</p>

        {!wasEdit && !record.appscript_url ? (
          <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-left text-xs leading-relaxed text-amber-800">
            <strong className="font-semibold">No Apps Script URL yet.</strong> Until the owner
            deploys their copy of the script and you paste the /exec URL here, pressing Reload
            will fail — there is nothing to read the menu from.
          </p>
        ) : null}

        {!wasEdit ? (
          <p className="mt-4 rounded-xl bg-forest-50 px-4 py-3 text-left text-xs leading-relaxed text-forest-800">
            <strong className="font-semibold">No deploy needed.</strong> The /r/ fallback page
            picks up any id the platform knows about, so this URL is live as soon as the first
            Reload succeeds. It gets a proper pre-rendered page on the next deploy, which only
            improves SEO and load time.
          </p>
        ) : null}

        <div className="mt-6 space-y-2.5 text-left">
          {steps.map((s, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl border border-gray-100 px-4 py-3">
              <span
                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                  s.done ? 'bg-forest-100 text-forest-700' : 'bg-canvas text-gray-400'
                }`}
              >
                {i + 1}
              </span>
              <p className={`text-sm leading-snug ${s.done ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{s.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href={`/admin/restaurants/${record.restaurant_id}`}>
            <PrimaryButton>Open restaurant page</PrimaryButton>
          </Link>
          <Link href="/admin">
            <SecondaryButton>Back to dashboard</SecondaryButton>
          </Link>
        </div>
      </div>
    </div>
  );
}
