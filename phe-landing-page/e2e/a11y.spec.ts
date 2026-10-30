import AxeBuilder from '@axe-core/playwright';
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

test('headings on the landing page never skip a level', async ({ page }) => {
  await page.goto('/');
  await settle(page);
  const results = await new AxeBuilder({ page }).withRules(['heading-order']).analyze();
  expect(results.violations.map((v) => v.nodes.map((n) => n.target.join(' ')))).toEqual([]);
});
