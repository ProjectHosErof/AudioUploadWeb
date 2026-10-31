import { test, expect, settle, axeViolations } from './fixtures';

/**
 * The pages behind sign-in, with a saved session and mocked data: the
 * dashboard has one recording in every status, the review queue two items.
 */
test.use({ mock: { readyRecordings: 1, signedIn: true } });

const STATUS_LABELS = ['In the collection', 'Under review', 'Not added', 'Already collected'];

test.describe('dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Welcome back, Mina.');
  });

  test('every status is on screen without scrolling sideways', async ({ page }) => {
    const width = page.viewportSize()!.width;
    for (const label of STATUS_LABELS) {
      const badge = page.getByText(label, { exact: true }).filter({ visible: true });
      await expect(badge).toHaveCount(1);
      const box = (await badge.boundingBox())!;
      expect(box.x, `${label} starts on screen`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `${label} ends on screen`).toBeLessThanOrEqual(width);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBe(0);
  });

  test('a decline shows the reviewer’s reason', async ({ page }) => {
    await expect(
      page.getByText('The recording cuts off halfway through the second verse.').filter({ visible: true }),
    ).toHaveCount(1);
  });

  test('the three totals sit in one row', async ({ page }) => {
    const tops = await Promise.all(
      ['Total Recordings', 'Duration Uploaded', 'In the Collection'].map(async (label) =>
        Math.round((await page.getByText(label, { exact: true }).boundingBox())!.y),
      ),
    );
    expect(new Set(tops).size).toBe(1);
  });

  test('has no WCAG 2.2 AA violations', async ({ page }) => {
    await settle(page);
    expect(await axeViolations(page)).toEqual([]);
  });
});

test.describe('review queue', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByText('Voice Memo 2026-10-21 at 19.04.m4a')).toBeVisible();
  });

  test('has no WCAG 2.2 AA violations', async ({ page }) => {
    await settle(page);
    expect(await axeViolations(page)).toEqual([]);
  });

  test('date and contributor line up the same way on every card', async ({ page }, info) => {
    const aligns = await page.locator('.queue-meta').evaluateAll((els) => els.map((el) => getComputedStyle(el).textAlign));
    expect(aligns).toHaveLength(2);
    expect(new Set(aligns)).toEqual(new Set([info.project.name === 'mobile' ? 'left' : 'right']));
  });
});

test('signing out returns home and forgets the session', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Welcome back, Mina.');
  const nav = page.getByRole('navigation');
  const menu = nav.getByRole('button', { name: /menu/i });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('button', { name: 'Sign Out' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect.poll(() => page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('sb-')))).toEqual([]);
});

test.describe('dashboard problems', () => {
  test('an expired sign-in asks to sign in again, without raw errors or false totals', async ({ page }) => {
    await page.route('http://supabase.test/rest/v1/recordings**', (route) =>
      route.fulfill({ status: 401, json: { code: 'PGRST301', message: 'JWT expired', details: null, hint: null } }),
    );
    await page.goto('/dashboard');
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('Your sign-in has expired.');
    await expect(page.locator('main')).not.toContainText('JWT');
    await expect(page.locator('main')).not.toContainText('begins with a single hymn');
    for (const label of ['Total Recordings', 'In the Collection']) {
      await expect(page.getByText(label, { exact: true }).locator('xpath=preceding-sibling::p')).toHaveText('—');
    }
    await alert.getByRole('button', { name: 'Sign in again' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('a failed load offers to try again', async ({ page }) => {
    let calls = 0;
    await page.route('http://supabase.test/rest/v1/recordings**', async (route) => {
      calls += 1;
      if (calls === 1) await route.fulfill({ status: 500, json: { code: 'XX000', message: 'internal' } });
      else await route.fallback();
    });
    await page.goto('/dashboard');
    await expect(page.getByRole('alert')).toContainText("We couldn't load your recordings.");
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByText('Golgotha').filter({ visible: true })).toBeVisible();
  });

  test('the community line has no stray dash and says "collection" once', async ({ page }) => {
    await page.goto('/dashboard');
    const line = page.getByText(/^Together,/);
    await expect(line).toBeVisible();
    const text = (await line.textContent())!;
    expect(text).not.toContain('—');
    expect(text.match(/collection/g)?.length ?? 0).toBeLessThanOrEqual(1);
  });
});

test('review queue cards show the language', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByText('Liturgy of St. Basil · Annual · Coptic').first()).toBeVisible();
});
