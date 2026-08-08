import type { MiddlewareHandler } from 'hono';

/** Client IP used as the rate-limit key. */
function clientIp(headerLookup: (name: string) => string | undefined): string {
  return (
    headerLookup('cf-connecting-ip') ??
    headerLookup('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

/**
 * IP-based rate limiting backed by Cloudflare's native rate-limit binding
 * (`env.RATE_LIMITER`), enforced across all isolates at the edge — unlike a
 * per-isolate in-memory counter, which each isolate resets independently.
 * The limit/period are configured on the `ratelimit` binding in wrangler.jsonc.
 */
export function rateLimit(): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const ip = clientIp((n) => c.req.header(n));
    const { success } = await c.env.RATE_LIMITER.limit({ key: ip });
    if (!success) {
      return c.json(
        { error: 'Too many requests. Please slow down and try again shortly.' },
        429,
      );
    }
    await next();
  };
}
