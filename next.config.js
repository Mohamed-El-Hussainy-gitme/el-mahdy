const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },

  webpack: (config) => {
    config.resolve.alias['@'] = path.resolve(__dirname, 'src');
    return config;
  },

  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },

  /**
   * HTTP Security Headers — applied to every route.
   * CSP is permissive enough for Supabase + Next.js but blocks unknown origins.
   */
  async headers() {
    const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
      : 'dxkkeilasmafqvpveldi.supabase.co';

    const csp = [
      `default-src 'self'`,
      // Next.js inlines scripts + uses eval in dev; allow unsafe-inline/eval only in dev
      process.env.NODE_ENV === 'development'
        ? `script-src 'self' 'unsafe-inline' 'unsafe-eval'`
        : `script-src 'self' 'unsafe-inline'`,
      `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
      `font-src 'self' https://fonts.gstatic.com data:`,
      `img-src 'self' data: blob: https:`,
      `connect-src 'self' https://${supabaseHost} wss://${supabaseHost}`,
      `media-src 'self' blob:`,
      `frame-src 'none'`,
      `object-src 'none'`,
      `base-uri 'self'`,
      `form-action 'self'`,
      `upgrade-insecure-requests`,
    ].join('; ');

    const securityHeaders = [
      // Clickjacking protection
      { key: 'X-Frame-Options', value: 'DENY' },
      // MIME-type sniffing protection
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      // XSS protection (legacy browsers)
      { key: 'X-XSS-Protection', value: '1; mode=block' },
      // Referrer policy
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      // HSTS — 1 year, includeSubDomains
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains; preload',
      },
      // Restrict browser features
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
      },
      // CSP
      { key: 'Content-Security-Policy', value: csp },
    ];

    return [
      {
        // Apply to all routes
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
