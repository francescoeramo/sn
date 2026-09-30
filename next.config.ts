import type { NextConfig } from 'next';
const config: NextConfig = {
  // Vercel already creates its optimized deployment output. Next 16.3's standalone
  // finalization conflicts with Vercel's build adapter, while local standalone use remains supported.
  output: process.env.VERCEL ? undefined : 'standalone',
  // The dev-tools launcher overlaps the fixed mobile navigation during Playwright runs.
  // Runtime and compilation errors remain visible when the launcher is disabled.
  devIndicators: process.env.E2E_DEV_SERVER ? false : { position: 'bottom-left' },
  experimental: {
    // TypeScript 6 still exposes the compiler API. This avoids Next's detached CLI
    // checker, whose piped stdout is unavailable in restricted build environments.
    useTypeScriptCli: false,
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          ...(process.env.NODE_ENV === 'production'
            ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
            : []),
        ],
      },
    ];
  },
};
export default config;
