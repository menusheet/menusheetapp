const REQUIRED_PUBLIC_ENV = [
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_API_URL',
];

if (process.env.NODE_ENV === 'production') {
  const missing = REQUIRED_PUBLIC_ENV.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required build-time env vars: ${missing.join(', ')}\n` +
        '\n' +
        'This project uses `output: "export"`, so NEXT_PUBLIC_* values are inlined\n' +
        'into the client bundle at build time and are NOT read at runtime.\n' +
        '\n' +
        'Cloudflare Pages (Git build):\n' +
        '  Settings > Environment variables > add each var as Plaintext for BOTH\n' +
        '  Production and Preview. `.env.local` is gitignored and never reaches\n' +
        '  the Cloudflare build container.\n' +
        '\n' +
        'Local build:\n' +
        '  copy the values into `.env.local` (see `.env.example`).\n' +
        '\n' +
        'Note: admin credentials and SHARED_SECRET are NOT build-time vars. They\n' +
        'live as encrypted secrets on the platform Worker (see worker/wrangler.toml)\n' +
        'and are never exposed to the browser. The browser only sees the public\n' +
        'NEXT_PUBLIC_API_URL and reaches it with a session cookie.\n'
    );
  }
}

const nextConfig = {
  output: process.env.NODE_ENV === 'development' ? undefined : 'export',
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ['172.20.10.6'],
};

module.exports = nextConfig;
