import { expect, test } from '@playwright/test';
import { avaaLaulu, osiot } from './apu';

test('osiot nimetään ja toistuvat lajit numeroidaan', async ({ page }) => {
  await avaaLaulu(page);
  await expect.poll(() => osiot(page)).toEqual(['Verse 1', 'Chorus', 'Verse 2']);
});

test('osion siirto vie koko rivilohkon mukanaan', async ({ page }) => {
  await avaaLaulu(page);
  await page.getByLabel('Move section Chorus down').click();

  await expect.poll(() => osiot(page)).toEqual(['Verse 1', 'Verse 2', 'Chorus']);
  const rivit = await page.$$eval('.line input.text', (els) =>
    els.map((e) => (e as HTMLInputElement).value),
  );
  expect(rivit.slice(2)).toEqual(['toinen säkeistö tässä', 'älä katso taakse', 'aamu tulee kohta']);
});

test('siirto laulun reunan yli on estetty', async ({ page }) => {
  await avaaLaulu(page);
  await expect(page.getByLabel('Move section Verse 1 up')).toBeDisabled();
  await expect(page.getByLabel('Move section Verse 2 down')).toBeDisabled();
});

test('rivin voi merkitä osioksi ja osio syntyy oikeaan kohtaan', async ({ page }) => {
  await avaaLaulu(page);
  await page.locator('.line').nth(1).getByLabel('Line settings').click();
  await page.getByRole('button', { name: 'Bridge', exact: true }).click();
  await page.getByRole('button', { name: 'Save' }).click();

  await expect.poll(() => osiot(page)).toEqual(['Verse 1', 'Bridge', 'Chorus', 'Verse 2']);
});
