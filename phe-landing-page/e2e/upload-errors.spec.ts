import { test, expect } from './fixtures';
import { fillRequired } from './upload-helpers';

/**
 * When an upload fails, the contributor is told what happened and what to do,
 * in a focused alert, never a raw server message.
 */
const cases: { name: string; route: string | RegExp; reply: 'abort' | { status: number; json?: object }; message: string }[] = [
  {
    name: 'too many uploads in a short time',
    route: 'http://api.test/uploads/initiate',
    reply: { status: 429, json: { error: 'Too many requests' } },
    message: "You've sent several recordings in a short time — please wait a minute, then try again.",
  },
  {
    name: 'a server error',
    route: 'http://api.test/uploads/initiate',
    reply: { status: 500, json: { error: 'Could not create submission.' } },
    message: "Something went wrong on our side and your recording wasn't sent. Please try again in a moment.",
  },
  {
    name: 'a hymn that doesn’t fit the season and service',
    route: 'http://api.test/uploads/initiate',
    reply: { status: 400, json: { error: 'Hymn is not used in that season/service', fields: ['hymn_slug'] } },
    message: "That hymn isn't listed for the season and service you chose — please pick it again from the list.",
  },
  {
    name: 'storage refusing the file',
    route: 'http://r2.test/**',
    reply: { status: 500 },
    message: "Your file didn't finish uploading. Please try again.",
  },
  {
    name: 'the connection dropping mid-upload',
    route: 'http://r2.test/**',
    reply: 'abort',
    message: 'The connection dropped while uploading. Please check your connection and try again.',
  },
];

for (const c of cases) {
  test(`${c.name} gets a plain explanation`, async ({ page }) => {
    // Registered after the fixture's mocks, so it takes precedence.
    await page.route(c.route, (route) =>
      c.reply === 'abort' ? route.abort('connectionreset') : route.fulfill({ status: c.reply.status, json: c.reply.json ?? {} }),
    );
    await page.goto('/#upload');
    await expect(page.locator('#upload form')).toBeVisible();
    await fillRequired(page);
    await page.getByRole('button', { name: 'Share Recording' }).click();

    const alert = page.locator('#upload-error');
    await expect(alert).toHaveAttribute('role', 'alert');
    await expect(alert).toHaveText(c.message);
    await expect(alert).toBeFocused();
  });
}
