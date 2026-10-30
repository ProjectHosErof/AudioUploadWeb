import { test, expect } from './fixtures';
import { fillRequired } from './upload-helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/#upload');
  await expect(page.locator('#upload form')).toBeVisible();
});

test('an empty submit names every missing field, in a focused alert', async ({ page }) => {
  await page.getByRole('button', { name: 'Share Recording' }).click();
  const alert = page.locator('#upload-error');
  await expect(alert).toHaveAttribute('role', 'alert');
  await expect(alert).toBeFocused();
  await expect(alert).toHaveText('Please choose a service, a season, a hymn, at least one language and an audio file.');
});

test('the email field is optional and always visible', async ({ page }) => {
  await expect(page.getByLabel('Email (optional)')).toBeVisible();
  await expect(page.locator('#upload-email-hint')).toHaveText("We'll let you know when your recording has been reviewed.");
});

test('the updates opt-in needs an email first', async ({ page }) => {
  const updates = page.getByLabel(/Also send me project updates/);
  await expect(updates).toBeDisabled();
  await page.getByLabel('Email (optional)').fill('chanter@example.com');
  await expect(updates).toBeEnabled();
  await page.getByLabel('Email (optional)').fill('');
  await expect(updates).toBeDisabled();
});

test('an invalid email is caught when leaving the field', async ({ page }) => {
  await page.getByLabel('Email (optional)').fill('not-an-email');
  await page.getByLabel('Email (optional)').blur();
  await expect(page.locator('#upload-email-error')).toHaveText('Please enter a valid email address.');
});

test('unsupported and oversized files are rejected as soon as they are chosen', async ({ page }) => {
  await page.locator('#file-input').setInputFiles({ name: 'notes.pdf', mimeType: 'application/pdf', buffer: Buffer.from('x') });
  await expect(page.locator('#file-error')).toContainText("isn't supported");

  // A 201 MB file, without allocating it: only File.size matters to the check.
  await page.evaluate(() => {
    const input = document.getElementById('file-input') as HTMLInputElement;
    const big = new File([new Uint8Array(1)], 'long-liturgy.wav', { type: 'audio/wav' });
    Object.defineProperty(big, 'size', { value: 201 * 1024 * 1024 });
    const dt = new DataTransfer();
    dt.items.add(big);
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(page.locator('#file-error')).toContainText('the limit is 200.0 MB');
});

test('a phone recording uploads, sending the email without joining the newsletter', async ({ page, captured }) => {
  await fillRequired(page);
  await page.getByLabel('Email (optional)').fill('chanter@example.com');
  await page.getByRole('button', { name: 'Share Recording' }).click();

  await expect(page.getByText('Thank you — your recording is in.')).toBeVisible();
  await expect(page.getByRole('status')).toBeFocused();
  expect(captured.initiate).toHaveLength(1);
  expect(captured.initiate[0]).toMatchObject({
    email: 'chanter@example.com',
    wants_updates: false,
    content_type: 'audio/mp4',
    accepted_terms_version: '2026-1',
    turnstile_token: 'test-token',
  });
});

test('ticking the opt-in sends wants_updates', async ({ page, captured }) => {
  await fillRequired(page);
  await page.getByLabel('Email (optional)').fill('chanter@example.com');
  await page.getByLabel(/Also send me project updates/).check();
  await page.getByRole('button', { name: 'Share Recording' }).click();
  await expect(page.getByText('Thank you — your recording is in.')).toBeVisible();
  expect(captured.initiate[0]).toMatchObject({ email: 'chanter@example.com', wants_updates: true });
});

test('without an email, nothing is sent and nobody is subscribed', async ({ page, captured }) => {
  await fillRequired(page);
  await page.getByRole('button', { name: 'Share Recording' }).click();
  await expect(page.getByText('Thank you — your recording is in.')).toBeVisible();
  expect(captured.initiate[0]).not.toHaveProperty('email');
  expect(captured.initiate[0]).toMatchObject({ wants_updates: false });
});
