import { test, expect } from './fixtures';

const HOME_TITLE = 'Project Hos Erof — Preserving the Hymns of the Coptic Church';

const routes: { path: string; title: string; h1: RegExp }[] = [
  { path: '/', title: HOME_TITLE, h1: /Project Hos Erof/ },
  { path: '/privacy', title: 'Privacy Policy · Project Hos Erof', h1: /Privacy Policy/ },
  { path: '/terms', title: 'Terms of Service · Project Hos Erof', h1: /Terms of Service/ },
  { path: '/dmca', title: 'Copyright Policy · Project Hos Erof', h1: /Copyright Policy/ },
  { path: '/login', title: 'Sign in · Project Hos Erof', h1: /Project Hos Erof/ },
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
