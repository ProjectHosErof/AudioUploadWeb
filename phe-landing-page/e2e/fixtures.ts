import { test as base, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Every test gets a page whose network is fully faked:
 *  - api.test       → the Worker API (stats, subscribe, uploads)
 *  - r2.test        → the presigned storage PUT
 *  - supabase.test  → auth, plus the dashboard's REST reads
 *  - api.test/me, /admin → sign-in linking and the review queue
 *  - challenges.cloudflare.com → a Turnstile stand-in that passes at once
 * Anything else outside localhost is blocked, so a stray call fails loudly.
 */

export interface MockOptions {
  /** readyRecordings returned by GET /stats/community. */
  readyRecordings: number;
  /** Start with a saved session, as a returning contributor (and admin) would. */
  signedIn?: boolean;
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

/** One recording in each state a contributor can see, with long-ish titles. */
const SAMPLE_RECORDINGS = [
  ['ready', null, null, 'Tenen Ten Nav'],
  ['processing', null, null, 'Ⲧⲉⲛⲟⲩⲱϣⲧ (Tenouosht) — the long version'],
  ['rejected', 'The recording cuts off halfway through the second verse.', null, 'Golgotha'],
  ['rejected', null, 'a0000000-0000-4000-8000-000000000001', 'Ten Thino'],
].map(([review_status, review_reason, duplicate_of_id, hymn_label], i) => ({
  id: `00000000-0000-4000-8000-00000000000${i}`,
  hymn_label,
  languages: ['coptic', 'arabic'],
  duration_seconds: 245 + i * 61,
  created_at: `2026-10-2${i}T12:00:00Z`,
  review_status,
  error_message: null,
  review_reason,
  duplicate_of_id,
  services: { label: 'Liturgy of St. Basil' },
  seasons: { label: 'Annual' },
}));

/** The review queue: one item with a contributor name, one anonymous. */
const SAMPLE_QUEUE = [
  { contributor: 'Mina A.', originalFilename: 'Voice Memo 2026-10-21 at 19.04.m4a' },
  { contributor: null, originalFilename: 'tenen.mp3' },
].map((extra, i) => ({
  id: `10000000-0000-4000-8000-00000000000${i}`,
  title: i === 0 ? 'Tenen' : 'Golgotha',
  service: 'Liturgy of St. Basil',
  season: 'Annual',
  languages: ['Coptic'],
  durationSeconds: 245,
  sampleRateHz: 44100,
  channels: 1,
  codec: 'aac',
  contentType: 'audio/mp4',
  fileSizeBytes: 3_100_000,
  uploadedAt: '2026-10-28T12:00:00Z',
  isEnriched: true,
  ...extra,
}));

/** A session in the shape supabase-js saves, valid for an hour. */
function savedSession() {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const user = {
    id: '20000000-0000-4000-8000-000000000000',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'mina@example.com',
    user_metadata: { full_name: 'Mina Abadir' },
    app_metadata: { provider: 'google' },
    created_at: '2026-10-01T00:00:00Z',
    // A returning contributor: signed in again well after signing up.
    last_sign_in_at: '2026-10-08T00:00:00Z',
  };
  const accessToken = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user.id, exp, role: 'authenticated', email: user.email })}.sig`;
  return { access_token: accessToken, refresh_token: 'refresh', token_type: 'bearer', expires_in: 3600, expires_at: exp, user };
}

/** localStorage key supabase-js uses for a project at http://supabase.test. */
export const SESSION_KEY = 'sb-supabase-auth-token';

async function mockNetwork(page: Page, opts: MockOptions, captured: Captured) {
  await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());

  await page.route('https://challenges.cloudflare.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: TURNSTILE_STUB }),
  );
  await page.route('http://supabase.test/**', (route) => route.fulfill({ status: 404, body: '{}' }));
  await page.route('http://supabase.test/auth/v1/otp**', (route) => route.fulfill({ json: {} }));
  await page.route('http://supabase.test/auth/v1/logout**', (route) => route.fulfill({ status: 204, body: '' }));
  await page.route('http://supabase.test/rest/v1/recordings**', (route) => route.fulfill({ json: SAMPLE_RECORDINGS }));
  await page.route('http://supabase.test/rest/v1/languages**', (route) =>
    route.fulfill({ json: [{ slug: 'coptic', label: 'Coptic' }, { slug: 'arabic', label: 'Arabic' }] }),
  );
  await page.route('http://api.test/me/link', (route) => route.fulfill({ json: { ok: true } }));
  await page.route('http://api.test/admin/me', (route) => route.fulfill({ json: { isAdmin: true } }));
  await page.route(/http:\/\/api\.test\/admin\/queue/, (route) =>
    route.fulfill({ json: { items: SAMPLE_QUEUE, total: SAMPLE_QUEUE.length, limit: 25, offset: 0 } }),
  );

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
  mock: [{ readyRecordings: 1, signedIn: false }, { option: true }],
  captured: async ({ page, mock }, provide) => {
    const captured: Captured = { initiate: [], subscribe: [] };
    await mockNetwork(page, mock, captured);
    await provide(captured);
  },
  // Make sure every test's page has the mocks installed, even if it never
  // asks for `captured`.
  page: async ({ page, mock }, provide) => {
    await mockNetwork(page, mock, { initiate: [], subscribe: [] });
    if (mock.signedIn) {
      await page.addInitScript(
        ([key, value]) => window.localStorage.setItem(key, value),
        [SESSION_KEY, JSON.stringify(savedSession())] as const,
      );
    }
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
