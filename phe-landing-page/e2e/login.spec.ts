import { test, expect } from './fixtures';

test('sign-in has a way back to the site', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('link', { name: '← Back to Project Hos Erof' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('sign-in links to the Terms and the Privacy Policy', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('link', { name: 'Terms' }).click();
  await expect(page.locator('h1')).toHaveText('Terms of Service');

  await page.goto('/login');
  await page.getByRole('link', { name: 'Privacy Policy' }).click();
  await expect(page.locator('h1')).toHaveText('Privacy Policy');
});
