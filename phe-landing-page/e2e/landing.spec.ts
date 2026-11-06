import { test, expect, settle } from './fixtures';

test('the hero buttons land on the form and on How it works', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Add Your Voice' }).click();
  await expect(page).toHaveURL(/#upload$/);
  await expect(page.locator('#upload-service')).toBeInViewport();

  await page.goto('/');
  await page.getByRole('link', { name: /How it works/ }).first().click();
  await expect(page).toHaveURL(/#how-it-works$/);
  await expect(page.locator('#how-it-works')).toBeInViewport();
});

test.describe('counter, early days', () => {
  test.use({ mock: { readyRecordings: 1 } });
  test('invites people to be among the first instead of showing "1 of 500"', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#how-it-works')).toContainText('Be one of the first contributors');
    await expect(page.locator('#how-it-works')).not.toContainText('of 500');
  });
});

test.describe('counter, established', () => {
  test.use({ mock: { readyRecordings: 30 } });
  test('shows the count once there are enough recordings', async ({ page }) => {
    await page.goto('/');
    await page.locator('#how-it-works').scrollIntoViewIfNeeded();
    await expect(page.locator('#how-it-works')).toContainText('30 of 500');
  });
});

test('FAQ answers open from the keyboard', async ({ page }) => {
  await page.goto('/');
  const first = page.locator('#faq details').first();
  await expect(first).not.toHaveAttribute('open', '');
  await first.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(first).toHaveAttribute('open', '');
});

test('the Coptic name renders in a Coptic font', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[lang="cop"]')).toHaveText('ϩⲱⲥ ⲉⲣⲟϥ');
  await expect
    .poll(() => page.evaluate(() => [...document.fonts].some((f) => f.family.includes('Noto Sans Coptic') && f.status === 'loaded')))
    .toBe(true);
});

test('mobile menu opens, closes with Escape, and closes on navigation', async ({ page, isMobile, viewport }) => {
  test.skip(!isMobile && (viewport?.width ?? 0) >= 1024, 'inline nav on wide screens');
  await page.goto('/');
  const button = page.getByRole('button', { name: 'Open menu' });
  await button.click();
  await expect(page.locator('#nav-menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#nav-menu')).toHaveCount(0);

  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.locator('#nav-menu').getByRole('link', { name: 'About' }).click();
  await expect(page.locator('#nav-menu')).toHaveCount(0);
  await expect(page).toHaveURL(/#about$/);
});

test('newsletter signup sends a bot-check token', async ({ page, captured }) => {
  await page.goto('/#notify');
  await page.locator('#notify-email').fill('someone@example.com');
  await page.getByRole('button', { name: 'Notify Me' }).click();
  await expect(page.locator('#notify')).toContainText('Check your email.');
  expect(captured.subscribe[0]).toMatchObject({ email: 'someone@example.com', turnstile_token: 'test-token' });
});

test.describe('a phone held sideways', () => {
  test.use({ viewport: { width: 844, height: 390 } });
  test('shows "Add Your Voice" on the first screen', async ({ page }) => {
    await page.goto('/');
    await settle(page); // measured at rest, after the entrance animation
    const cta = page.getByRole('link', { name: 'Add Your Voice' });
    await expect(cta).toBeVisible();
    const box = (await cta.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(390);
  });
});

test('the recording guidelines match the FAQ and the form', async ({ page }) => {
  await page.goto('/#upload');
  await page.getByText('What to record — full guidelines').click();
  const panel = page.locator('#upload details');
  await expect(panel).toContainText('never sold or published as a dataset');
  await expect(panel).toContainText("My hymn isn't listed");
  await expect(panel).not.toContainText('training dataset');
  await expect(panel).not.toContainText('Ordination');
});

test('search engines and phones get a sitemap and a home-screen icon', async ({ page, request }) => {
  for (const path of ['/sitemap.xml', '/apple-touch-icon.png']) {
    expect((await request.get(path)).status(), path).toBe(200);
  }
  expect(await (await request.get('/robots.txt')).text()).toContain('Sitemap: https://hoserof.org/sitemap.xml');
  await page.goto('/');
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/apple-touch-icon.png');
});
