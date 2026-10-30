import { test, expect, settle, axeViolations } from './fixtures';

/** axe-core, WCAG 2.2 AA tags, on every public route — at rest, after animations. */
const paths = ['/', '/privacy', '/terms', '/dmca', '/login', '/subscribed', '/unsubscribed', '/does-not-exist'];

for (const path of paths) {
  test(`${path} has no WCAG 2.2 AA violations`, async ({ page }) => {
    await page.goto(path);
    await settle(page);
    expect(await axeViolations(page)).toEqual([]);
  });
}

test('the upload form and an open FAQ answer have no violations', async ({ page }) => {
  await page.goto('/#upload');
  await expect(page.locator('#upload form')).toBeVisible();
  await page.locator('#faq summary').first().click();
  await settle(page);
  expect(await axeViolations(page)).toEqual([]);
});
