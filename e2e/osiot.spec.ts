import { expect, test } from '@playwright/test';
import { avaaLaulu, osiot } from './apu';

test('osiot nimetään ja toistuvat lajit numeroidaan', async ({ page }) => {
  await avaaLaulu(page);
  await expect.poll(() => osiot(page)).toEqual(['Säkeistö 1', 'Kertosäe', 'Säkeistö 2']);
});

test('osion siirto vie koko rivilohkon mukanaan', async ({ page }) => {
  await avaaLaulu(page);
  await page.getByLabel('Siirrä osiota Kertosäe alas').click();

  await expect.poll(() => osiot(page)).toEqual(['Säkeistö 1', 'Säkeistö 2', 'Kertosäe']);
  const rivit = await page.$$eval('.line input.text', (els) =>
    els.map((e) => (e as HTMLInputElement).value),
  );
  expect(rivit.slice(2)).toEqual(['toinen säkeistö tässä', 'älä katso taakse', 'aamu tulee kohta']);
});

test('siirto laulun reunan yli on estetty', async ({ page }) => {
  await avaaLaulu(page);
  await expect(page.getByLabel('Siirrä osiota Säkeistö 1 ylös')).toBeDisabled();
  await expect(page.getByLabel('Siirrä osiota Säkeistö 2 alas')).toBeDisabled();
});

test('rivin voi merkitä osioksi ja osio syntyy oikeaan kohtaan', async ({ page }) => {
  await avaaLaulu(page);
  await page.locator('.line').nth(1).getByLabel('Aloita osio tästä rivistä').click();
  await page.getByRole('button', { name: 'C-osa', exact: true }).click();
  await page.getByRole('button', { name: 'Tallenna' }).click();

  await expect.poll(() => osiot(page)).toEqual(['Säkeistö 1', 'C-osa', 'Kertosäe', 'Säkeistö 2']);
});
