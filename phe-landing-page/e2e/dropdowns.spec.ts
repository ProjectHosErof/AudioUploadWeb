import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import { choose, fillRequired } from './upload-helpers';
import vocab from '../src/vocab.generated.json' with { type: 'json' };

/** The hymn names, and each season + service list, straight from the vocabulary. */
const name = new Map(vocab.hymns.map((h) => [h.slug, h.label]));
const list = (season: string, service: string) =>
  new Set(vocab.placements.filter(([, se, sv]) => se === season && sv === service).map(([h]) => h as string));

const menu = (page: Page) => page.locator('.react-select__menu');
const optionTexts = (page: Page) => menu(page).locator('.react-select__option').allTextContents();

async function openHymns(page: Page, service: string, season: string) {
  await choose(page, 'upload-service', service);
  await choose(page, 'upload-season', season);
  await page.locator('#upload-hymn').click();
  await expect(menu(page)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/#upload');
  await expect(page.locator('#upload form')).toBeVisible();
});

test('a season + service list is alphabetical, without headings, and ends with "isn\'t listed"', async ({ page }) => {
  await openHymns(page, 'Midnight Praises', 'Kiahk');
  const texts = await optionTexts(page);
  expect(texts.at(-1)).toBe("My hymn isn't listed — show all hymns");
  const hymns = texts.slice(0, -1);
  expect(hymns).toEqual([...hymns].sort((a, b) => a.localeCompare(b)));
  await expect(menu(page).locator('.react-select__group-heading')).toHaveCount(0);
});

test('the full list never repeats a name', async ({ page }) => {
  await openHymns(page, 'Baptism', 'Nativity (Paramoune)');
  const texts = await optionTexts(page);
  expect(texts.length).toBe(vocab.hymns.filter((h) => h.active).length);
  expect(new Set(texts).size).toBe(texts.length);
  expect(texts).toContain('Trisagion (Agios) — Resurrection');
});

test('"my hymn isn\'t listed" opens the whole catalogue and flags the upload', async ({ page, captured }) => {
  await fillRequired(page);
  await choose(page, 'upload-service', 'Midnight Praises');
  await choose(page, 'upload-season', 'Annual');
  expect(list('annual', 'midnight-praises').has('doxa-patri')).toBe(false);

  await page.locator('#upload-hymn').click();
  await page.locator('#upload-hymn').fill('not listed');
  await page.keyboard.press('Enter');
  await expect(page.locator('#upload')).toContainText('A reviewer will confirm where this one is sung.');
  await page.locator('#upload-hymn').fill('Doxa Patri');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Share Recording' }).click();
  await expect(page.getByText('Thank you — your recording is in.')).toBeVisible();
  expect(captured.initiate[0]).toMatchObject({ hymn_slug: 'doxa-patri', hymn_not_listed: true });
});

test('a hymn from the list is not flagged', async ({ page, captured }) => {
  await fillRequired(page);
  await page.getByRole('button', { name: 'Share Recording' }).click();
  await expect(page.getByText('Thank you — your recording is in.')).toBeVisible();
  expect(captured.initiate[0]).toMatchObject({ hymn_not_listed: false });
});

test('hymns can be found by their Arabic name', async ({ page }) => {
  const pair = list('kiahk', 'midnight-praises');
  const hymn = vocab.hymns.find((h) => pair.has(h.slug) && h.labelAr)!;
  await openHymns(page, 'Midnight Praises', 'Kiahk');
  await page.locator('#upload-hymn').fill(hymn.labelAr!.split(' ').slice(0, 2).join(' '));
  await expect(menu(page).getByText(hymn.label, { exact: true })).toBeVisible();
});

test('a season change swaps in the same hymn for the new season, and says so', async ({ page }) => {
  await choose(page, 'upload-service', 'St. Basil');
  await choose(page, 'upload-season', 'Annual');
  await choose(page, 'upload-hymn', 'Trisagion');
  await choose(page, 'upload-season', 'Resurrection');
  await expect(page.locator('#upload-hymn').locator('xpath=ancestor::div[contains(@class,"react-select__control")]'))
    .toContainText('Trisagion (Agios)');
  await expect(page.locator('#upload')).toContainText('Switched to the Resurrection · St. Basil Divine Liturgy version of “Trisagion (Agios)”.');
});

test('a hymn with no counterpart is cleared, and says so', async ({ page }) => {
  // A hymn in Annual · St. Basil whose name isn't in Nativity (Paramoune) · St. Basil.
  const target = list('nativity-paramoune', 'st-basil-liturgy');
  const names = new Set([...target].map((s) => name.get(s)));
  const slug = [...list('annual', 'st-basil-liturgy')].find((s) => !names.has(name.get(s)))!;
  await choose(page, 'upload-service', 'St. Basil');
  await choose(page, 'upload-season', 'Annual');
  await choose(page, 'upload-hymn', name.get(slug)!);
  await choose(page, 'upload-season', 'Nativity (Paramoune)');
  await expect(page.locator('#upload')).toContainText(`“${name.get(slug)}” isn't on the list for Nativity (Paramoune) · St. Basil Divine Liturgy`);
  await expect(page.locator('#upload-hymn').locator('xpath=ancestor::div[contains(@class,"react-select__control")]'))
    .toContainText('Select or type a hymn');
});

test('a long hymn name is shown in full once chosen', async ({ page }) => {
  const long = 'Adam Praise on the Sunday Adam Psali for the Lord Jesus (I praise the Virgin)';
  await choose(page, 'upload-service', 'Midnight Praises');
  await choose(page, 'upload-season', 'Kiahk');
  await choose(page, 'upload-hymn', 'Adam Praise on the Sunday');
  const value = page.locator('.react-select__single-value', { hasText: 'Adam Praise' });
  await expect(value).toHaveText(long);
  expect(await value.evaluate((e) => e.scrollWidth <= e.clientWidth && e.scrollHeight <= e.clientHeight + 1)).toBe(true);
});

test('every menu opens fully on screen', async ({ page }) => {
  const height = page.viewportSize()!.height;
  for (const id of ['upload-service', 'upload-season', 'upload-language']) {
    await page.locator(`#${id}`).click();
    await expect(menu(page)).toBeVisible();
    const box = (await menu(page).boundingBox())!;
    expect(box.y, `${id} menu top`).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height, `${id} menu bottom`).toBeLessThanOrEqual(height);
    await page.keyboard.press('Escape');
  }
  await openHymns(page, 'Midnight Praises', 'Kiahk');
  const box = (await menu(page).boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(height);
});

test('the lists use the corrected names and order', async ({ page }) => {
  await page.locator('#upload-service').click();
  expect((await optionTexts(page))[0]).toBe('Vespers (Evening Raising of Incense)');
  await page.keyboard.press('Escape');
  await page.locator('#upload-season').click();
  const seasons = await optionTexts(page);
  expect(seasons).toContain("Nineveh's Fast");
  expect(seasons).toContain("Apostles' Feast");
  await page.keyboard.press('Escape');
  await page.locator('#upload-language').click();
  expect(await optionTexts(page)).toEqual(['Coptic', 'Arabic', 'English', 'Greek']);
});
