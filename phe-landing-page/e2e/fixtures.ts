import { test as base, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Every test gets a page whose network is fully faked:
 *  - api.test       → the Worker API (stats, subscribe, uploads)
 *  - r2.test        → the presigned storage PUT
 *  - supabase.test  → auth (signed out)
 *  - challenges.cloudflare.com → a Turnstile stand-in that passes at once
 * Anything else outside localhost is blocked, so a stray call fails loudly.
 */

export interface MockOptions {
  /** readyRecordings returned by GET /stats/community. */
  readyRecordings: number;
}

/** Captured request bodies, for assertions. */
export interface Captured {
  initiate: Record<string, unknown>[];
  subscribe: Record<string, unknown>[];
}

const TURNSTILE_STUB = `
  window.turnstile = {
    render(el, opts) {
      setTimeout(() => opts && opts.callback && opts.callback('test-token'), 0);
      return 'widget-' + Math.random().toString(36).slice(2);
    },
    reset() {}, remove() {}, execute() {},
    getResponse() { return 'test-token'; },
    isExpired() { return false; },
    ready(cb) { cb(); },
  };
  // The library may wait for its onload callback name in the query string.
  const s = document.currentScript && document.currentScript.src;
  const m = s && s.match(/[?&]onload=([^&]+)/);
  if (m && typeof window[m[1]] === 'function') window[m[1]]();
`;

async function mockNetwork(page: Page, opts: MockOptions, captured: Captured) {
  await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());

  await page.route('https://challenges.cloudflare.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: TURNSTILE_STUB }),
  );
  await page.route('http://supabase.test/**', (route) => route.fulfill({ status: 404, body: '{}' }));

  await page.route('http://api.test/stats/community', (route) =>
    route.fulfill({
      json: { readyRecordings: opts.readyRecordings, totalRecordings: opts.readyRecordings, readySeconds: 0, contributors: 1 },
    }),
  );
  await page.route('http://api.test/subscribe', async (route) => {
    captured.subscribe.push(route.request().postDataJSON());
    await route.fulfill({ json: { ok: true, message: 'Check your email to confirm your subscription.' } });
  });
  await page.route('http://api.test/uploads/initiate', async (route) => {
    captured.initiate.push(route.request().postDataJSON());
    await route.fulfill({
      json: {
        recordingId: '0f1e2d3c-4b5a-4968-8776-655443322110',
        uploadUrl: 'http://r2.test/put',
        requiredHeaders: {},
        expiresAt: new Date(Date.now() + 900_000).toISOString(),
        maxBytes: 209_715_200,
      },
    });
  });
  await page.route('http://r2.test/**', (route) => route.fulfill({ status: 200, body: '' }));
  await page.route(/http:\/\/api\.test\/uploads\/[^/]+\/complete/, (route) =>
    route.fulfill({ json: { recordingId: 'x', uploadStatus: 'completed', reviewStatus: 'processing' } }),
  );
}

export const test = base.extend<{ mock: MockOptions; captured: Captured }>({
  mock: [{ readyRecordings: 1 }, { option: true }],
  captured: async ({ page, mock }, provide) => {
    const captured: Captured = { initiate: [], subscribe: [] };
    await mockNetwork(page, mock, captured);
    await provide(captured);
  },
  // Make sure every test's page has the mocks installed, even if it never
  // asks for `captured`.
  page: async ({ page, mock }, provide) => {
    await mockNetwork(page, mock, { initiate: [], subscribe: [] });
    await provide(page);
  },
});

export { expect };

/** Wait for entrance animations (≤ 1.5 s) so contrast is measured at rest. */
export async function settle(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1600);
}

/** WCAG 2.2 AA violations on the current page (empty array = pass). */
export async function axeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return results.violations.map((v) => `${v.impact} ${v.id} (${v.nodes.length}): ${v.nodes[0]?.target.join(' ')}`);
}
