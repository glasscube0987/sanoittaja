import { expect, test } from '@playwright/test';
import { avaaLaulu } from './apu';

const soinnut = (page: import('@playwright/test').Page) =>
  page.locator('.line').first().locator('.chord').allInnerTexts();

test('palautuspainike näkyy vasta kun laulu on transponoitu', async ({ page }) => {
  await avaaLaulu(page);
  const palautus = page.getByLabel(/Transposed/);
  await expect(palautus).toHaveCount(0);

  await page.getByLabel('Up a semitone').click();
  await expect(palautus).toBeVisible();
  await expect(palautus).toHaveText('+1 ↺');
});

test('siirtymä kertyy molempiin suuntiin', async ({ page }) => {
  await avaaLaulu(page);
  await page.getByLabel('Up a semitone').click();
  await page.getByLabel('Up a semitone').click();
  await expect(page.getByLabel(/Transposed/)).toHaveText('+2 ↺');

  await page.getByLabel('Down a semitone').click();
  await page.getByLabel('Down a semitone').click();
  await page.getByLabel('Down a semitone').click();
  await expect(page.getByLabel(/Transposed/)).toHaveText('-1 ↺');
});

test('palautus vie takaisin alkuperäiseen sävellajiin', async ({ page }) => {
  await avaaLaulu(page);
  const alku = await soinnut(page);
  const savellaji = await page.locator('.title-row input.key').inputValue();

  for (let i = 0; i < 4; i++) await page.getByLabel('Up a semitone').click();
  expect(await soinnut(page)).not.toEqual(alku);

  await page.getByLabel(/Transposed/).click();

  expect(await soinnut(page)).toEqual(alku);
  expect(await page.locator('.title-row input.key').inputValue()).toBe(savellaji);
  await expect(page.getByLabel(/Transposed/)).toHaveCount(0);
});

test('kirjoitusasun vaihto ei nollaa siirtymää', async ({ page }) => {
  await avaaLaulu(page);
  await page.getByLabel('Up a semitone').click();
  // ♭ ja ♯ vaihtavat vain kirjoitusasun, eivät sävelkorkeutta.
  await page.getByTitle('Write with flats').click();
  await expect(page.getByLabel(/Transposed/)).toHaveText('+1 ↺');
});

test('palautus säilyy tallennettuna', async ({ page }) => {
  await avaaLaulu(page);
  await page.getByLabel('Up a semitone').click();
  await page.waitForTimeout(600);
  await page.reload();
  await page.locator('.song-card').first().click();

  // Siirtymä on osa laulua, joten se muistetaan myös uudelleen avattaessa.
  await expect(page.getByLabel(/Transposed/)).toHaveText('+1 ↺');
});
