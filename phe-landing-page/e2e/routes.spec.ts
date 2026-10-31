import { test, expect } from './fixtures';

const HOME_TITLE = 'Project Hos Erof — Preserving the Hymns of the Coptic Church';

const routes: { path: string; title: string; h1: RegExp }[] = [
  { path: '/', title: HOME_TITLE, h1: /Project Hos Erof/ },
  { path: '/privacy', title: 'Privacy Policy · Project Hos Erof', h1: /Privacy Policy/ },
  { path: '/terms', title: 'Terms of Service · Project Hos Erof', h1: /Terms of Service/ },
  { path: '/dmca', title: 'Copyright Policy · Project Hos Erof', h1: /Copyright Policy/ },
  { path: '/login', title: 'Sign in · Project Hos Erof', h1: /Sign in/ },
  { path: '/subscribed', title: 'Subscription confirmed · Project Hos Erof', h1: /on the list/ },
  { path: '/subscribed?status=unknown', title: 'Subscription confirmed · Project Hos Erof', h1: /expired/ },
  { path: '/unsubscribed', title: 'Unsubscribed · Project Hos Erof', h1: /won’t hear from us/ },
  { path: '/does-not-exist', title: 'Page not found · Project Hos Erof', h1: /Page not found/ },
];

for (const r of routes) {
  test(`${r.path}: title, one h1, main landmark, no sideways scroll`, async ({ page }) => {
    await page.goto(r.path);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveText(r.h1);
    await expect(page).toHaveTitle(r.title);
    await expect(page.locator('main#main')).toHaveCount(1);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test('a page title does not stick after leaving a legal page', async ({ page }) => {
  await page.goto('/dmca');
  await expect(page).toHaveTitle('Copyright Policy · Project Hos Erof');
  // Client-side navigation, like following a link inside the app.
  await page.evaluate(() => {
    history.pushState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page).toHaveTitle(HOME_TITLE);
});

test('signed-out visitors are sent from private pages to sign in', async ({ page }) => {
  for (const path of ['/dashboard', '/admin']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  }
});

test('the 404 page is not indexable and links home', async ({ page }) => {
  await page.goto('/no/such/page');
  await expect(page.locator('meta[name="robots"][content="noindex"]')).toHaveCount(1);
  await page.getByRole('link', { name: 'Return to Project Hos Erof' }).click();
  await expect(page).toHaveURL(/\/$/);
  // The noindex tag leaves with the 404 page.
  await expect(page.locator('meta[name="robots"][content="noindex"]')).toHaveCount(0);
});

test('each page declares its own address', async ({ page }) => {
  const canonical = page.locator('link[rel="canonical"]');
  for (const { path } of routes) {
    await page.goto(path);
    await expect(canonical).toHaveAttribute('href', `https://hoserof.org${new URL(path, 'http://x').pathname}`);
  }
});

test('the legal pages describe themselves, and the home page gets its own back', async ({ page }) => {
  const description = page.locator('meta[name="description"]');
  await page.goto('/');
  const home = await description.getAttribute('content');
  expect(home).toMatch(/community collection/);

  const seen = new Set<string>();
  for (const path of ['/privacy', '/terms', '/dmca']) {
    await page.goto(path);
    await expect(description).not.toHaveAttribute('content', home!);
    seen.add((await description.getAttribute('content'))!);
  }
  expect(seen.size).toBe(3);

  // Client-side navigation back home (the footer's site link) restores both.
  await page.getByRole('link', { name: 'Project Hos Erof' }).first().click();
  await expect(page).toHaveURL(/\/$/);
  await expect(description).toHaveAttribute('content', home!);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://hoserof.org/');
});
