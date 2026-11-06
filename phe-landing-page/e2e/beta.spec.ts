import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

async function fillJoin(page: Page) {
  await page.getByLabel('Name *').fill('Marina Gerges');
  await page.getByLabel('Email *').fill('marina@example.com');
  await page.getByLabel('iPhone').check();
  await page.getByLabel(/Email me about the beta/).check();
}

test('asking to join sends every answer and says to check email', async ({ page, captured }) => {
  await page.goto('/beta');
  await fillJoin(page);
  await page.getByLabel('Parish or city (optional)').fill('St. Mark, Cleveland');
  await page.getByLabel('Chanter or deacon').check();
  await page.getByLabel('45–64').check();
  await page.getByRole('button', { name: 'Ask to join' }).click();

  const done = page.getByRole('status');
  await expect(done).toContainText('Check your email.');
  await expect(done).toContainText('marina@example.com');
  expect(captured.beta[0]).toMatchObject({
    name: 'Marina Gerges',
    email: 'marina@example.com',
    parish: 'St. Mark, Cleveland',
    device: 'iphone',
    role: 'chanter',
    age_range: '45-64',
    consent: true,
    turnstile_token: 'test-token',
  });
});

test('missing answers are named, and the list shrinks as they are given', async ({ page, captured }) => {
  await page.goto('/beta');
  await page.getByRole('button', { name: 'Ask to join' }).click();
  const alert = page.locator('#beta-error');
  await expect(alert).toBeFocused();
  await expect(alert).toHaveText('Please add your name, an email address, the device you’ll mostly use and your OK to email you about the beta.');
  await page.getByLabel('Name *').fill('Marina');
  await page.getByLabel('Android phone').check();
  await expect(alert).toHaveText('Please add an email address and your OK to email you about the beta.');
  expect(captured.beta).toHaveLength(0);
});

test('the optional answers can be left out', async ({ page, captured }) => {
  await page.goto('/beta');
  await fillJoin(page);
  await page.getByRole('button', { name: 'Ask to join' }).click();
  await expect(page.getByRole('status')).toContainText('Check your email.');
  expect(captured.beta[0]).not.toHaveProperty('parish');
  expect(captured.beta[0]).not.toHaveProperty('role');
  expect(captured.beta[0]).not.toHaveProperty('age_range');
});

test('the link in the confirmation email lands on a clear page, and a stale one offers to ask again', async ({ page }) => {
  await page.goto('/beta/confirmed');
  await expect(page).toHaveTitle('Request received · Project Hos Erof');
  await page.goto('/beta/confirmed?status=unknown');
  await expect(page).toHaveTitle('Link not recognized · Project Hos Erof');
  await page.getByRole('link', { name: 'Ask to join again' }).click();
  await expect(page).toHaveURL(/\/beta$/);
});

test('leaving the beta is confirmed', async ({ page }) => {
  await page.goto('/beta/left');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('You’ve left the beta.');
  await page.goto('/beta/left?status=error');
  await expect(page.locator('main')).toContainText('support@hoserof.org');
});

test.describe('signed in', () => {
  test.use({ mock: { readyRecordings: 1, signedIn: true } });
  test('the email comes from the account', async ({ page }) => {
    await page.goto('/beta');
    await expect(page.getByLabel('Email *')).toHaveValue('mina@example.com');
  });
});
