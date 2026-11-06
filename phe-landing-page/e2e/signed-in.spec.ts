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

test('a hymn picked as "not listed" asks the reviewer to confirm where it\'s sung', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByText("Not on our list for Annual · Liturgy of St. Basil — please confirm where it's sung.")).toBeVisible();
  await expect(page.getByText('Not on our list')).toHaveCount(1);
});

test('the dashboard fits a 320px screen, even with long names', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.route('http://supabase.test/rest/v1/recordings**', (route) =>
    route.fulfill({
      json: [{
        id: '00000000-0000-4000-8000-000000000009',
        hymn_label: 'Adam Praise on the Sunday Adam Psali for the Lord Jesus (I praise the Virgin)',
        languages: ['lang-coptic', 'lang-greek'],
        duration_seconds: 300,
        created_at: '2026-11-01T12:00:00Z',
        review_status: 'processing',
        error_message: null,
        review_reason: null,
        duplicate_of_id: null,
        services: { label: 'Vespers (Evening Raising of Incense)' },
        seasons: { label: "Saint Mary's Fast/Feast" },
      }],
    }),
  );
  await page.goto('/dashboard');
  await expect(page.getByText('Under review', { exact: true }).filter({ visible: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  for (const label of ['Total Recordings', 'Duration Uploaded', 'In the Collection']) {
    const fits = await page.getByText(label, { exact: true }).evaluate((el) => {
      const card = el.parentElement!.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      return r.left >= card.left - 0.5 && r.right <= card.right + 0.5 && el.scrollWidth <= el.clientWidth + 1;
    });
    expect(fits, label).toBe(true);
  }
  // The badge isn't squeezed: its text fits on one line.
  const badge = page.getByText('Under review', { exact: true }).filter({ visible: true });
  expect(await badge.evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
});

test('the review page names languages without downloading the hymn list', async ({ page }) => {
  const chunks: string[] = [];
  page.on('request', (r) => chunks.push(new URL(r.url()).pathname));
  await page.goto('/admin');
  await expect(page.getByText('Liturgy of St. Basil · Annual · Coptic').first()).toBeVisible();
  expect(chunks.filter((c) => /\/assets\/options\.data-/.test(c))).toEqual([]);
});

test.describe('beta admin', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/beta');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Beta testers');
  });

  test('lists who is waiting, and accepting moves them to the testers', async ({ page, captured }) => {
    await expect(page.getByRole('heading', { name: 'Waiting · 2' })).toBeVisible();
    const marina = page.getByRole('listitem').filter({ hasText: 'Marina Gerges' });
    await expect(marina).toContainText('St. Mark, Cleveland · iPhone · Chanter or deacon · 45–64');
    await marina.getByRole('button', { name: 'Accept' }).click();

    await expect(page.getByRole('status')).toContainText('Marina Gerges is in. Their welcome email is on its way.');
    await expect(page.getByRole('heading', { name: 'Waiting · 1' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Testers · 3' })).toBeVisible();
    expect(captured.betaDecisions[0]).toMatchObject({ id: '30000000-0000-4000-8000-000000000001', body: { decision: 'accept', notify: true } });
  });

  test('declining without a note says so to the server', async ({ page, captured }) => {
    const bishoy = page.getByRole('listitem').filter({ hasText: 'Bishoy Fahmy' });
    await bishoy.getByLabel('Send a short note if declined').uncheck();
    await bishoy.getByRole('button', { name: 'Decline' }).click();
    await expect(page.getByRole('status')).toContainText('Bishoy Fahmy was declined.');
    expect(captured.betaDecisions[0].body).toEqual({ decision: 'decline', notify: false });
  });

  test('shows each tester\'s progress and flags anyone stuck', async ({ page }) => {
    const view = page.locator('.beta-cards, .beta-table').filter({ visible: true });
    await expect(view).toContainText('Mina Abadir');
    await expect(view.getByText('May be stuck')).toHaveCount(1);
    const kirollos = view.locator('li, tr').filter({ hasText: 'Kirollos Hanna' });
    await expect(kirollos.getByText('May be stuck')).toBeVisible();
    await expect(view.locator('li, tr').filter({ hasText: 'Mina Abadir' })).toContainText('4');
  });

  test('ending the beta asks first, wants an https link, then reports what was sent', async ({ page, captured }) => {
    const end = page.locator('section').filter({ has: page.getByRole('heading', { name: 'End the beta' }) });
    await expect(end).toContainText('2 haven’t had it yet');
    await end.getByLabel('Survey link').fill('http://forms.gle/abc');
    await expect(end).toContainText('The link must start with https://');
    await expect(end.getByRole('button', { name: 'Send survey' })).toBeDisabled();

    await end.getByLabel('Survey link').fill('https://forms.gle/abc');
    await end.getByRole('button', { name: 'Send survey' }).click();
    await expect(end).toContainText('Send to 2 testers?');
    await end.getByRole('button', { name: 'Yes, send' }).click();
    await expect(end.getByRole('status')).toContainText('Sent to 2 testers.');
    expect(captured.betaEnd[0]).toEqual({ surveyUrl: 'https://forms.gle/abc' });
  });

  test('admins see a Beta link in the header', async ({ page }, info) => {
    await page.goto('/');
    if (info.project.name === 'mobile') await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Beta', exact: true })).toBeVisible();
  });

  test('has no WCAG 2.2 AA violations', async ({ page }) => {
    await settle(page);
    expect(await axeViolations(page)).toEqual([]);
  });
});
