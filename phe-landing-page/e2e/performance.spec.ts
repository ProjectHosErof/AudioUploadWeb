import { test, expect, SESSION_KEY } from './fixtures';
import type { Page } from '@playwright/test';

/** Records which built JS chunks the page downloads. */
function watchChunks(page: Page): string[] {
  const chunks: string[] = [];
  page.on('request', (req) => {
    const m = new URL(req.url()).pathname.match(/^\/assets\/([\w-]+?)-[\w-]{8}\.js$/);
    if (m) chunks.push(m[1]);
  });
  return chunks;
}

test('a signed-out visitor never downloads the sign-in library', async ({ page }) => {
  const chunks = watchChunks(page);
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  expect(chunks).not.toContain('supabase');
});

test('asking for a sign-in link loads it on demand', async ({ page }) => {
  const chunks = watchChunks(page);
  await page.goto('/login');
  await page.getByLabel('Email Address').fill('mina@example.com');
  await page.getByLabel('Email Address').press('Enter');
  await expect(page.getByText('Check your email')).toBeVisible();
  expect(chunks).toContain('supabase');
});

test.describe('a returning contributor', () => {
  test.use({ mock: { readyRecordings: 1, signedIn: true } });

  test('has their saved session restored', async ({ page }) => {
    const chunk = page.waitForRequest((req) => /\/assets\/supabase-[\w-]+\.js$/.test(req.url()));
    // Restoring the session tells the Worker who signed in.
    const linked = page.waitForRequest('http://api.test/me/link');
    await page.goto('/');
    await chunk;
    await linked;
    expect(await page.evaluate((key) => localStorage.getItem(key) !== null, SESSION_KEY)).toBe(true);
  });
});

test('the hero font is preloaded and served', async ({ page }) => {
  const fontResponse = page.waitForResponse((res) => res.url().endsWith('/fonts/cormorant-garamond-latin-300-normal.woff2'));
  await page.goto('/');
  const href = await page.locator('link[rel="preload"][as="font"]').getAttribute('href');
  expect(href).toBe('/fonts/cormorant-garamond-latin-300-normal.woff2');
  expect((await fontResponse).status()).toBe(200);
  await page.waitForLoadState('networkidle');
  expect(await page.evaluate(() => document.fonts.check('300 1em "Cormorant Garamond"'))).toBe(true);
});
