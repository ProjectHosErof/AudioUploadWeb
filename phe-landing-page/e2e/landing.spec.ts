import { test, expect } from './fixtures';

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
