import { NextResponse, type NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Simple in-process rate limiter (token bucket per IP).
// Resets when the server process restarts; sufficient for edge deployments
// without Redis. For production at scale, replace with an upstash/redis bucket.
// ---------------------------------------------------------------------------

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const rateLimitStore = new Map<string, Bucket>();

/**
 * Rate-limit config per route prefix.
 * capacity   = max burst
 * refillRate = tokens added per second
 */
const RATE_LIMITS: { prefix: string; capacity: number; refillRate: number }[] = [
  { prefix: '/api/admin', capacity: 30, refillRate: 2 },  // admin API — strict
  { prefix: '/api/', capacity: 120, refillRate: 10 },     // other API routes
];

function checkRateLimit(ip: string, path: string): { allowed: boolean; remaining: number } {
  const config = RATE_LIMITS.find((r) => path.startsWith(r.prefix));
  if (!config) return { allowed: true, remaining: Infinity };

  const key = `${ip}:${config.prefix}`;
  const now = Date.now();

  let bucket = rateLimitStore.get(key);
  if (!bucket) {
    bucket = { tokens: config.capacity, lastRefill: now };
  } else {
    // Refill tokens based on elapsed time
    const elapsed = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(config.capacity, bucket.tokens + elapsed * config.refillRate);
    bucket.lastRefill = now;
  }

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    rateLimitStore.set(key, bucket);
    return { allowed: true, remaining: Math.floor(bucket.tokens) };
  }

  rateLimitStore.set(key, bucket);
  return { allowed: false, remaining: 0 };
}



// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1';

  // 1. Rate limiting for API routes
  if (pathname.startsWith('/api/')) {
    const { allowed, remaining } = checkRateLimit(ip, pathname);
    if (!allowed) {
      return new NextResponse(
        JSON.stringify({ error: 'طلبات كثيرة جداً، يرجى الانتظار قليلاً.' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Retry-After': '10',
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }

    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Remaining', String(remaining));
    // Strip sensitive response headers
    response.headers.delete('X-Powered-By');
    return response;
  }

  // 2. Security Headers & Header Sanitization
  const response = NextResponse.next();
  response.headers.delete('X-Powered-By');
  response.headers.delete('Server');
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon/logo/manifest
     * - robots.txt, sitemap.xml
     */
    '/((?!_next/static|_next/image|favicon|logo\\.png|manifest|robots\\.txt|sitemap\\.xml).*)',
  ],
};
