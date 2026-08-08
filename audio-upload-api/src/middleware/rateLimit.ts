import type { MiddlewareHandler } from 'hono';

/**
 * Lightweight IP-based rate limiter for the anonymous upload path.
 *
 * NOTE: state is an in-memory Map scoped to a single Worker isolate, so limits
 * are approximate and reset on isolate recycle. It's a cheap first line of
 * defense against casual abuse. For hard guarantees, add a Cloudflare WAF
 * rate-limiting rule or back this with KV / a Durable Object.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

function clientIp(headerLookup: (name: string) => string | undefined): string {
  return (
    headerLookup('cf-connecting-ip') ??
    headerLookup('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

export function rateLimit(opts: { limit: number; windowMs: number }): MiddlewareHandler {
  return async (c, next) => {
    const ip = clientIp((n) => c.req.header(n));
    const now = Date.now();
    const bucket = buckets.get(ip);

    if (!bucket || now > bucket.resetAt) {
      buckets.set(ip, { count: 1, resetAt: now + opts.windowMs });
    } else {
      bucket.count += 1;
      if (bucket.count > opts.limit) {
        const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
        return c.json({ error: 'Too many requests. Please slow down and try again shortly.' }, 429, {
          'Retry-After': String(retryAfter),
        });
      }
    }

    // Opportunistic cleanup so the Map can't grow unbounded.
    if (buckets.size > 10_000) {
      for (const [key, value] of buckets) {
        if (now > value.resetAt) buckets.delete(key);
      }
    }

    await next();
  };
}
