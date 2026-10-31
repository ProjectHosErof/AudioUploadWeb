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

/** Visible text smaller than 12px, ignoring decoration hidden from assistive tech. */
async function tinyText(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const found: string[] = [];
    document.querySelectorAll('body *').forEach((el) => {
      if (el.closest('[aria-hidden="true"]')) return;
      const own = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim());
      const r = el.getBoundingClientRect();
      if (!own || r.width === 0 || r.height === 0) return;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size < 12) found.push(`${size}px "${el.textContent!.trim().slice(0, 40)}"`);
    });
    return found;
  });
}

for (const path of ['/', '/login']) {
  test(`${path} has no text under 12px`, async ({ page }) => {
    await page.goto(path);
    await settle(page);
    expect(await tinyText(page)).toEqual([]);
  });
}

test.describe('signed in', () => {
  test.use({ mock: { readyRecordings: 1, signedIn: true } });
  test('/dashboard has no text under 12px', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Golgotha').filter({ visible: true })).toBeVisible();
    expect(await tinyText(page)).toEqual([]);
  });
});

test('footer links are comfortable to tap (24px or more)', async ({ page }) => {
  await page.goto('/privacy');
  const footer = page.locator('footer');
  for (const name of ['Privacy', 'Terms', 'Copyright', 'contact@hoserof.org']) {
    const box = (await footer.getByRole('link', { name, exact: true }).boundingBox())!;
    expect(box.height, name).toBeGreaterThanOrEqual(24);
  }
});
