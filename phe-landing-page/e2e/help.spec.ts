import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import { fillRequired } from './upload-helpers';

async function fillHelp(page: Page) {
  await page.getByLabel('Problem uploading').check();
  await page.getByLabel('Your message *').fill('The upload stopped at 40% twice on my iPhone.');
  await page.getByLabel('Email *').fill('mina@example.com');
}

test('a request is sent with its context and the reference is shown', async ({ page, captured }) => {
  await page.goto('/help?from=/dashboard');
  await fillHelp(page);
  await page.getByLabel('Name (optional)').fill('Mina');
  await page.getByRole('button', { name: 'Send' }).click();

  const done = page.getByRole('status');
  await expect(done).toContainText('Thank you — we’ve got it.'.replace('’', "'"));
  await expect(done).toContainText('#K7Q2XM');
  await expect(done).toContainText('mina@example.com');
  await expect(done).toBeFocused();
  expect(captured.help[0]).toMatchObject({
    topic: 'upload',
    message: 'The upload stopped at 40% twice on my iPhone.',
    email: 'mina@example.com',
    name: 'Mina',
    page: '/dashboard',
    signed_in: false,
    turnstile_token: 'test-token',
  });
});

test('missing answers are named in a focused alert that updates as they are given', async ({ page, captured }) => {
  await page.goto('/help');
  await page.getByRole('button', { name: 'Send' }).click();
  const alert = page.locator('#help-error');
  await expect(alert).toBeFocused();
  await expect(alert).toHaveText('Please add what you need help with, a few words about it and an email address we can reply to.');
  await page.getByLabel('Feedback or an idea').check();
  await expect(alert).toHaveText('Please add a few words about it and an email address we can reply to.');
  await page.getByLabel('Your message *').fill('Lovely site, thank you!');
  await page.getByLabel('Email *').fill('mina@example.com');
  await expect(alert).toHaveCount(0);
  expect(captured.help).toHaveLength(0);
});

test('links prefill the topic and the recording reference', async ({ page }) => {
  await page.goto('/help?topic=upload&ref=0f1e2d3c&from=/');
  await expect(page.getByLabel('Problem uploading')).toBeChecked();
  await expect(page.getByLabel('Recording reference (optional)')).toHaveValue('0F1E2D3C');
});

test('if the email can\'t be sent, it offers the address and keeps the message', async ({ page }) => {
  await page.route('http://api.test/help', (route) => route.fulfill({ status: 503, json: { error: 'down' } }));
  await page.goto('/help');
  await fillHelp(page);
  await page.getByRole('button', { name: 'Send' }).click();
  const alert = page.locator('#help-error');
  await expect(alert).toContainText("We couldn't send that just now.");
  await expect(alert.getByRole('link', { name: 'support@hoserof.org' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy my message' })).toBeVisible();
  await expect(page.getByLabel('Your message *')).toHaveValue('The upload stopped at 40% twice on my iPhone.');
});

test('the Beta badge and the Help link lead to the form', async ({ page }, info) => {
  await page.goto('/privacy');
  await page.getByRole('link', { name: 'Beta — get help or send feedback' }).click();
  await expect(page).toHaveURL(/\/help\?topic=feedback&from=%2Fprivacy$/);
  await expect(page.getByLabel('Feedback or an idea')).toBeChecked();

  await page.goto('/');
  if (info.project.name === 'mobile') await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('navigation').getByRole('link', { name: 'Help', exact: true }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Get help');
});

test('the thank-you screen links to help with the upload\'s reference', async ({ page }) => {
  await page.goto('/#upload');
  await fillRequired(page);
  await page.getByRole('button', { name: 'Share Recording' }).click();
  await page.locator('#upload').getByRole('link', { name: 'Get help' }).click();
  await expect(page).toHaveURL(/\/help\?topic=upload&ref=0F1E2D3C&from=\/$/);
  await expect(page.getByLabel('Recording reference (optional)')).toHaveValue('0F1E2D3C');
});

test.describe('signed in', () => {
  test.use({ mock: { readyRecordings: 1, signedIn: true } });
  test('the email is filled in from the account, and the request says so', async ({ page, captured }) => {
    await page.goto('/help');
    await expect(page.getByLabel('Email *')).toHaveValue('mina@example.com');
    await page.getByLabel('Something else').check();
    await page.getByLabel('Your message *').fill('Can I change the name on my account?');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByRole('status')).toContainText('#K7Q2XM');
    expect(captured.help[0]).toMatchObject({ topic: 'other', email: 'mina@example.com', signed_in: true });
  });
});
