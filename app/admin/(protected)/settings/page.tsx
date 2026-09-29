import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Settings',
  robots: { index: false, follow: false },
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL || '(not set)';

export default function AdminSettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          How the platform is wired. Billing and cache state are edited per restaurant on the
          dashboard, not here.
        </p>
      </div>

      <Card title="Platform Worker">
        <p className="text-sm leading-relaxed text-gray-600">
          One Worker holds everything privileged: the restaurant roster, the cached menus, sign-in
          and the session cookie. The browser talks only to this URL, and only ever sends a session
          cookie with it. Nothing about the roster or the sheets is exposed to the client bundle.
        </p>
        <Row label="Public API URL" value={apiUrl} mono />
        <Hint>
          Env var: <code>NEXT_PUBLIC_API_URL</code>. Because this project uses{' '}
          <code>output: &quot;export&quot;</code>, changing it requires a rebuild &amp; redeploy.
        </Hint>
      </Card>

      <Card title="Admin access">
        <p className="text-sm leading-relaxed text-gray-600">
          Sign-in is handled by the platform Worker, which verifies your credentials and issues a
          signed, HttpOnly, SameSite=None session cookie. Credentials and the session signing key
          live as encrypted secrets on the Worker, so they are never sent to the browser and never
          appear in this page&apos;s JavaScript.
        </p>
        <Row label="Holds ADMIN_EMAIL" value="Platform Worker (secret)" />
        <Row label="Holds ADMIN_PASSWORD" value="Platform Worker (secret)" />
        <Hint>
          Change them with{' '}
          <code className="rounded bg-canvas px-1.5 py-0.5 font-mono text-xs">
            wrangler secret put ADMIN_PASSWORD
          </code>{' '}
          from the <code className="font-mono text-xs">worker/</code> directory. No deploy or
          rebuild needed, and every existing session keeps working.
        </Hint>
      </Card>

      <Card title="Shared secret (Apps Script)">
        <p className="text-sm leading-relaxed text-gray-600">
          <code>SHARED_SECRET</code> authenticates the Worker to each restaurant&apos;s Apps Script
          web app. It lives only on the Worker and is injected server-side, so it is not embedded
          anywhere in this dashboard. It is also still present in each owner&apos;s deployed script,
          because the Worker presents it when it asks for a menu.
        </p>
        <Row label="Holds SHARED_SECRET" value="Platform Worker (secret)" />
        <Hint>
          Rotation runbook: <code>docs/onboarding-checklist.md</code>, SHARED_SECRET rotation.
          Restaurants&apos; deployed scripts keep the old secret until you redeploy their script,
          so rotate the Worker first, then the scripts.
        </Hint>
      </Card>

      <Card title="How often things update">
        <ul className="list-inside list-disc space-y-1.5 text-sm text-gray-600">
          <li>
            <strong className="font-semibold text-gray-700">Live, no deploy:</strong> adding a
            restaurant, editing billing, toggling active, switching theme, editing a menu. These
            write to KV and take effect on the next page load.
          </li>
          <li>
            <strong className="font-semibold text-gray-700">On demand only:</strong> menus are
            fetched from a restaurant&apos;s Google Sheet when an operator presses Reload here, or
            when the owner presses{' '}
            <em>MenuSheet &rarr; Reload menu on website</em> in their own sheet. Nothing is fetched
            on a schedule.
          </li>
          <li>
            <strong className="font-semibold text-gray-700">Needs a rebuild:</strong> a brand-new
            theme, because themes are compiled into the client bundle. A new restaurant using an
            existing theme does not.
          </li>
          <li>
            Deploy command:{' '}
            <code className="rounded bg-canvas px-1.5 py-0.5 font-mono text-xs">npm run deploy</code>
          </li>
        </ul>
        <Link href="/admin" className="mt-4 inline-block text-sm font-semibold text-forest-700 hover:underline">
          Back to dashboard
        </Link>
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-gray-100 sm:p-8">
      <h2 className="mb-3 font-bold tracking-tight">{title}</h2>
      {children}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="mt-3 flex items-baseline justify-between gap-4 border-t border-gray-100 pt-3 first:border-0 first:pt-0">
      <span className="text-sm text-gray-400">{label}</span>
      <span className={`text-right font-semibold ${mono ? 'break-all font-mono text-xs' : 'text-sm'}`}>
        {value}
      </span>
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 rounded-lg bg-canvas px-3 py-2 text-xs leading-relaxed text-gray-500">{children}</p>;
}
