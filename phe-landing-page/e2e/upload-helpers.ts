import type { Page } from '@playwright/test';

/** Pick an option in a react-select by typing and choosing the first match. */
async function choose(page: Page, inputId: string, text: string) {
  const input = page.locator(`#${inputId}`);
  await input.click();
  await input.fill(text);
  await page.keyboard.press('Enter');
}

/** Complete every required field of the upload form with valid answers. */
export async function fillRequired(page: Page) {
  await choose(page, 'upload-service', 'Liturgy');
  await choose(page, 'upload-season', 'Annual');
  // Any hymn the filtered list offers for this season + service.
  await page.locator('#upload-hymn').click();
  await page.keyboard.press('Enter');
  await choose(page, 'upload-language', 'Coptic');
  await page.locator('#file-input').setInputFiles({
    name: 'voice-memo.m4a',
    mimeType: 'audio/mp4',
    buffer: Buffer.from('fake audio bytes'),
  });
  await page.getByLabel(/I agree to the/).check();
}
