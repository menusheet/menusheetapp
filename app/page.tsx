import type { Metadata } from 'next';
import Link from 'next/link';
import { Wordmark } from '@/components/brand/Logo';
import { siteUrl } from '@/lib/siteUrl';

export const metadata: Metadata = {
  title: 'MenuSheet — QR Code Digital Menu for ₹100/month',
  description:
    'Turn your paper menu into a beautiful QR-code digital menu. No app downloads, no backend, no monthly developer bills. Live updates from your own Google Sheet. Just ₹100/month.',
  alternates: { canonical: `${siteUrl()}/` },
  openGraph: {
    type: 'website',
    url: `${siteUrl()}/`,
    siteName: 'MenuSheet',
    title: 'MenuSheet — QR Code Digital Menu for ₹100/month',
    description:
      'A digital QR menu your customers will love, powered by your own Google Sheet. ₹100/month, live updates, zero apps to install.',
    images: [
      { url: '/icons/logo.png', width: 512, height: 512, alt: 'MenuSheet' },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'MenuSheet — QR Code Digital Menu for ₹100/month',
    description:
      'A digital QR menu your customers will love, powered by your own Google Sheet. ₹100/month, live updates, zero apps.',
  },
};

const HOW_IT_WORKS = [
  {
    step: '1',
    icon: '📋',
    title: 'Put your menu on a Google Sheet',
    body: 'List your dishes in a simple sheet — name, price, photo, veg or non-veg, availability. If you can edit Excel, you already know how.',
  },
  {
    step: '2',
    icon: '🎨',
    title: 'We design your branded menu page',
    body: 'Your colors, fonts, logo and hero photo — a unique themed page that feels like your restaurant, hosted on a fast public URL.',
  },
  {
    step: '3',
    icon: '🔲',
    title: 'Print your QR code',
    body: 'We hand you a ready-to-print QR code. Stick it on tables, walls or bill folders — customers scan and instantly see your menu.',
  },
  {
    step: '4',
    icon: '⚡',
    title: 'Edit anytime, changes go live instantly',
    body: 'Sold out of biryani today? Flip a cell in your sheet and the menu updates for every customer — no reprints, no waiting.',
  },
];

const FAQS = [
  {
    q: 'Do my customers need to install an app?',
    a: 'No. They scan the QR code with their phone camera and your menu opens instantly in the browser — nothing to download or sign up for.',
  },
  {
    q: 'How do I update my menu?',
    a: 'You edit your own Google Sheet — change a price, mark an item sold out, add a new dish. Changes appear on the menu page within minutes, no reprinting needed.',
  },
  {
    q: 'What do I need to get started?',
    a: 'A free Google account (for your menu sheet), your logo and photos if you have them, and ₹100/month. We handle everything else, including the QR code.',
  },
  {
    q: 'Will it work on slow phones and bad networks?',
    a: 'Yes. Menu pages are lightweight and cached on the visitor’s phone, so repeat scans load instantly even on weak connections.',
  },
  {
    q: 'Can customers see when an item is sold out?',
    a: 'Exactly — items marked unavailable are greyed out with a “sold out” badge, so your staff never has to apologize at the table.',
  },
  {
    q: 'Is there a contract or setup fee?',
    a: 'No contracts, no setup fee. It is a flat ₹100/month per restaurant, billed simply. Stop anytime.',
  },
];

const SAMPLE_ITEMS = [
  { name: 'Burrata Caprese', desc: 'Heirloom tomatoes, basil oil, aged balsamic', price: 420, veg: true },
  { name: 'Charred Paneer Skewers', desc: 'Mint chutney, smoked chilli butter', price: 340, veg: true },
  { name: 'Herb-Crusted Grilled Chicken', desc: 'Jus reduction, roasted baby potatoes', price: 520, veg: false },
  { name: 'Truffle Mushroom Risotto', desc: 'Wild mushrooms, parmesan crisp', price: 480, veg: true },
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      name: 'MenuSheet',
      url: siteUrl(),
      description:
        'QR-code based digital menu SaaS for restaurants, powered by Google Sheets.',
    },
    {
      '@type': 'Product',
      name: 'MenuSheet Digital Menu',
      description:
        'A QR-code digital menu platform for restaurants. Owners manage their menu in Google Sheets; customers scan and browse instantly.',
      offers: {
        '@type': 'Offer',
        price: '100',
        priceCurrency: 'INR',
        availability: 'https://schema.org/InStock',
      },
    },
  ],
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" className="shrink-0">
            <Wordmark className="h-7 sm:h-8" priority />
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-gray-600 md:flex">
            <a href="#how" className="hover:text-gray-900">How it works</a>
            <a href="#pricing" className="hover:text-gray-900">Pricing</a>
            <a href="#example" className="hover:text-gray-900">Live example</a>
            <a href="#faq" className="hover:text-gray-900">FAQ</a>
          </nav>
          <a
            href="#contact"
            className="shrink-0 rounded-full bg-forest-800 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-forest-900 sm:px-5 sm:py-2.5 sm:text-sm"
          >
            Get your QR menu
          </a>
        </div>
        <nav
          className="flex gap-5 overflow-x-auto border-t border-gray-100 px-4 py-2.5 text-sm font-medium text-gray-600 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-6 md:hidden"
          aria-label="Sections"
        >
          <a href="#how" className="whitespace-nowrap">How it works</a>
          <a href="#pricing" className="whitespace-nowrap">Pricing</a>
          <a href="#example" className="whitespace-nowrap">Live example</a>
          <a href="#faq" className="whitespace-nowrap">FAQ</a>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          {/* Decorative only. `relative` on the grid below keeps this blur behind the
              content — absolutely positioned children otherwise paint over it. */}
          <div aria-hidden="true" className="pointer-events-none absolute -top-32 right-0 h-96 w-96 rounded-full bg-forest-50 blur-3xl" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-2 lg:py-24">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-forest-50 px-3 py-1 text-xs font-semibold text-forest-800">
                <span className="h-1.5 w-1.5 rounded-full bg-forest-600" />
                Loved by local restaurants
              </span>
              <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-[3.4rem]">
                Your menu,{' '}
                <span className="bg-gradient-to-r from-forest-700 to-forest-500 bg-clip-text text-transparent">
                  one scan away.
                </span>
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-gray-600">
                MenuSheet turns your Google Sheet into a beautiful, mobile-first digital menu with
                its own QR code. No app, no backend, no headaches — just{' '}
                <strong className="font-semibold text-gray-900">₹100/month</strong>.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <a
                  href="#contact"
                  className="rounded-full bg-forest-800 px-7 py-3.5 text-base font-semibold text-white shadow-float transition hover:bg-forest-900"
                >
                  Get your QR menu →
                </a>
                <Link
                  href="/r/demo"
                  className="rounded-full border border-gray-200 bg-white px-7 py-3.5 text-base font-semibold text-gray-800 transition hover:bg-gray-50"
                >
                  See a live example
                </Link>
              </div>
              <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-gray-500">
                <Check>Live updates from Google Sheets</Check>
                <Check>Veg / non-veg badges</Check>
                <Check>Sold-out toggles</Check>
              </div>
            </div>

            <PhoneMock />
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-28 border-y border-gray-100 bg-[#FAFAF9] py-14 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading
              eyebrow="How it works"
              title="From paper to pixel-perfect in a day"
              subtitle="Four simple steps. You bring the food, we bring the tech."
            />
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {HOW_IT_WORKS.map((s) => (
                <div
                  key={s.step}
                  className="group relative rounded-3xl bg-white p-6 shadow-card ring-1 ring-gray-100 transition hover:-translate-y-1 hover:shadow-float"
                >
                  <div className="absolute right-5 top-5 text-xs font-bold text-gray-200">
                    0{s.step}
                  </div>
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-forest-50 text-xl">
                    {s.icon}
                  </div>
                  <h3 className="mt-4 font-bold leading-snug">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Sample preview */}
        <section id="example" className="scroll-mt-28 py-14 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading
              eyebrow="Live example"
              title="This is what your customers see"
              subtitle="A real themed menu built with MenuSheet. Open it on your phone and try scanning around."
            />
            <div className="mx-auto mt-12 max-w-md">
              <div className="overflow-hidden rounded-[2.5rem] border-[10px] border-gray-900 bg-white shadow-float">
                <div className="relative h-28 bg-forest-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=60"
                    alt=""
                    className="h-full w-full object-cover opacity-80"
                  />
                </div>
                <div className="-mt-6 px-5 pb-5">
                  <div className="inline-grid h-14 w-14 place-items-center rounded-2xl bg-forest-700 text-lg font-bold text-white ring-4 ring-white">
                    GF
                  </div>
                  <h3 className="mt-2 font-heading text-xl font-bold">The Green Fork</h3>
                  <p className="text-xs text-gray-500">Fresh, seasonal & honest — farm to table</p>
                  <div className="mt-4 space-y-2">
                    {SAMPLE_ITEMS.map((item) => (
                      <div key={item.name} className="flex items-start justify-between gap-3 rounded-xl border border-gray-100 p-3">
                        <div className="flex items-start gap-2">
                          <VegDot veg={item.veg} />
                          <div>
                            <p className="text-sm font-semibold leading-tight">{item.name}</p>
                            <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">{item.desc}</p>
                          </div>
                        </div>
                        <span className="shrink-0 text-sm font-bold text-forest-700">₹{item.price}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-6 text-center">
                <Link
                  href="/r/demo"
                  className="inline-flex items-center gap-2 rounded-full bg-forest-800 px-6 py-3 text-sm font-semibold text-white transition hover:bg-forest-900"
                >
                  Open the full interactive demo →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-28 border-y border-gray-100 bg-[#FAFAF9] py-14 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading
              eyebrow="Pricing"
              title="One flat price. Seriously."
              subtitle="Less than a cup of coffee a week keeps your menu always up to date."
            />
            <div className="mx-auto mt-12 max-w-md">
              <div className="rounded-3xl bg-white p-8 shadow-card ring-1 ring-gray-100">
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Per restaurant</p>
                    <p className="mt-1 flex items-baseline gap-1">
                      <span className="text-5xl font-extrabold tracking-tight">₹100</span>
                      <span className="text-lg font-medium text-gray-400">/month</span>
                    </p>
                  </div>
                  <span className="rounded-full bg-forest-50 px-3 py-1 text-xs font-bold text-forest-800">
                    Flat rate
                  </span>
                </div>
                <ul className="mt-8 space-y-3.5 text-sm text-gray-700">
                  <PriceFeature>Your own branded menu page</PriceFeature>
                  <PriceFeature>Printable QR code (PNG + SVG)</PriceFeature>
                  <PriceFeature>Instant updates via Google Sheets</PriceFeature>
                  <PriceFeature>Sold-out &amp; veg/non-veg badges</PriceFeature>
                  <PriceFeature>Works offline-cached on phones</PriceFeature>
                  <PriceFeature>No app, no hardware, no contracts</PriceFeature>
                </ul>
                <a
                  href="#contact"
                  className="mt-8 block rounded-full bg-forest-800 py-3.5 text-center text-base font-semibold text-white transition hover:bg-forest-900"
                >
                  Get started today
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-28 py-14 sm:py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <SectionHeading
              eyebrow="FAQ"
              title="Questions, answered"
              subtitle="Everything restaurant owners ask us before switching."
            />
            <div className="mt-10 space-y-3">
              {FAQS.map((f) => (
                <details
                  key={f.q}
                  className="group rounded-2xl bg-white p-5 shadow-card ring-1 ring-gray-100 open:ring-forest-200"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gray-100 text-gray-500 transition group-open:rotate-45 group-open:bg-forest-100 group-open:text-forest-800">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-gray-600">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Contact CTA */}
        <section id="contact" className="scroll-mt-28 pb-16 sm:pb-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="relative overflow-hidden rounded-[2rem] bg-forest-900 px-8 py-14 text-center sm:px-14">
              <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-forest-700/40 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-20 -right-10 h-64 w-64 rounded-full bg-forest-600/30 blur-3xl" />
              <h2 className="relative text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Ready to ditch the paper menu?
              </h2>
              <p className="relative mx-auto mt-3 max-w-xl text-forest-100">
                Message us on WhatsApp and your digital menu could be live today — QR code included,
                ₹100/month, cancel anytime.
              </p>
              <div className="relative mt-8 flex flex-wrap items-center justify-center gap-4">
                <a
                  href="https://wa.me/919207624728?text=Hi%20MenuSheet!%20I%27d%20like%20a%20QR%20menu%20for%20my%20restaurant."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-white px-7 py-3.5 text-base font-semibold text-forest-900 shadow-float transition hover:bg-forest-50"
                >
                  💬 Chat on WhatsApp
                </a>
                <a
                  href="mailto:menusheet@gmail.com?subject=I%20want%20a%20QR%20menu"
                  className="rounded-full border border-forest-400/50 px-7 py-3.5 text-base font-semibold text-white transition hover:bg-forest-800"
                >
                  menusheet@gmail.com
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-100 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:px-6">
          <Link href="/" className="shrink-0">
            <Wordmark className="h-8 sm:h-9" />
          </Link>
          <p className="text-sm text-gray-500">
            © {new Date().getFullYear()} MenuSheet · Digital menus made simple
          </p>
          <div className="flex gap-6 text-sm font-medium text-gray-600">
            <a href="#how" className="hover:text-gray-900">How it works</a>
            <a href="#pricing" className="hover:text-gray-900">Pricing</a>
            <Link href="/r/demo" className="hover:text-gray-900">Demo</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Check({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      <svg className="h-[18px] w-[18px] shrink-0 text-forest-600" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5" />
      </svg>
      {children}
    </span>
  );
}

function PriceFeature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-forest-100">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </span>
      {children}
    </li>
  );
}

function VegDot({ veg }: { veg: boolean }) {
  const color = veg ? '#16A34A' : '#DC2626';
  return (
    <span className="mt-0.5 inline-grid h-3.5 w-3.5 shrink-0 place-items-center rounded-[3px] border-[1.5px]" style={{ borderColor: color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
    </span>
  );
}

function SectionHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <span className="text-xs font-bold uppercase tracking-[0.2em] text-forest-700">{eyebrow}</span>
      <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h2>
      <p className="mt-3 text-gray-600">{subtitle}</p>
    </div>
  );
}

function PhoneMock() {
  return (
    <div className="relative mx-auto hidden max-w-sm lg:block">
      <div className="rotate-2 overflow-hidden rounded-[2.5rem] border-[10px] border-gray-900 bg-white shadow-float transition duration-300 hover:rotate-0">
        <div className="relative h-36">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=60"
            alt="The Green Fork hero"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent" />
        </div>
        <div className="-mt-10 px-5 pb-6">
          <div className="inline-grid h-16 w-16 place-items-center rounded-2xl bg-forest-700 text-xl font-bold text-white ring-4 ring-white">
            GF
          </div>
          <h3 className="mt-2 font-heading text-2xl font-bold">The Green Fork</h3>
          <p className="text-xs text-gray-500">Fresh, seasonal &amp; honest — farm to table</p>
          <div className="mt-4 flex gap-2 overflow-hidden">
            {['Starters', 'Mains', 'Desserts'].map((c) => (
              <span key={c} className="shrink-0 rounded-full bg-forest-50 px-3 py-1.5 text-xs font-medium text-forest-800">
                {c}
              </span>
            ))}
          </div>
          <div className="mt-4 space-y-2.5">
            {SAMPLE_ITEMS.slice(0, 3).map((item) => (
              <div key={item.name} className="flex items-start justify-between gap-3 rounded-xl border border-gray-100 p-3">
                <div className="flex items-start gap-2">
                  <VegDot veg={item.veg} />
                  <div>
                    <p className="text-sm font-semibold leading-tight">{item.name}</p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">{item.desc}</p>
                  </div>
                </div>
                <span className="shrink-0 text-sm font-bold text-forest-700">₹{item.price}</span>
              </div>
            ))}
            <div className="flex items-start justify-between gap-3 rounded-xl border border-dashed border-gray-200 p-3 opacity-50 grayscale">
              <div className="flex items-start gap-2">
                <VegDot veg={false} />
                <div>
                  <p className="text-sm font-semibold leading-tight">Lamb Shank Rogan</p>
                  <p className="mt-0.5 text-xs text-gray-500">Slow-cooked, saffron pulao</p>
                </div>
              </div>
              <span className="mt-1 shrink-0 rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                SOLD OUT
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute -left-10 top-8 -rotate-6 rounded-2xl bg-white p-3 shadow-card ring-1 ring-gray-100">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-amber-100">📷</span>
          Scan → instant menu
        </div>
      </div>
      <div className="absolute -right-6 bottom-16 rotate-3 rounded-2xl bg-white p-3 shadow-card ring-1 ring-gray-100">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-forest-100">⚡</span>
          Updates in real time
        </div>
      </div>
    </div>
  );
}
