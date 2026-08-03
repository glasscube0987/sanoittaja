import { expect, test } from '@playwright/test';
import { avaaLista } from './apu';

const AVAIN = 'sanoittaja.lastBackup';

test('ilman varmuuskopiota listalla on huomautus', async ({ page }) => {
  await avaaLista(page);
  const huomautus = page.locator('.backup-note');
  await expect(huomautus).toContainText('No backup yet');
  await expect(huomautus).toHaveClass(/stale/);
});

test('tuore varmuuskopio ei korostu', async ({ page }) => {
  await avaaLista(page);
  await page.evaluate((k) => localStorage.setItem(k, String(Date.now() - 2 * 86_400_000)), AVAIN);
  await page.reload();

  const huomautus = page.locator('.backup-note');
  await expect(huomautus).toContainText('2 days ago');
  await expect(huomautus).not.toHaveClass(/stale/);
});

test('vanha varmuuskopio korostuu ja kehottaa uuteen', async ({ page }) => {
  await avaaLista(page);
  await page.evaluate((k) => localStorage.setItem(k, String(Date.now() - 20 * 86_400_000)), AVAIN);
  await page.reload();

  const huomautus = page.locator('.backup-note');
  await expect(huomautus).toContainText('20 days ago');
  await expect(huomautus).toHaveClass(/stale/);
});

test('varmuuskopiointi merkitsee ajankohdan ja päivittää huomautuksen', async ({ page }) => {
  await avaaLista(page);
  await page.evaluate((k) => localStorage.setItem(k, String(Date.now() - 20 * 86_400_000)), AVAIN);
  await page.reload();
  await expect(page.locator('.backup-note')).toHaveClass(/stale/);

  // Selaintestissä lataus menee Playwrightin lataustapahtumaan; jakovalikkoa ei ole.
  const lataus = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Back up' }).click();
  await lataus;

  await expect(page.locator('.backup-note')).toContainText('Backed up today');
  await expect(page.locator('.backup-note')).not.toHaveClass(/stale/);

  const merkitty = await page.evaluate((k) => localStorage.getItem(k), AVAIN);
  expect(Number(merkitty)).toBeGreaterThan(Date.now() - 60_000);
});

test('varmuuskopio ladataan kun jakamista ei tueta', async ({ page }) => {
  await avaaLista(page);
  const lataus = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Back up' }).click();
  const tiedosto = await lataus;
  expect(tiedosto.suggestedFilename()).toMatch(/^sanoittaja-varmuuskopio-\d{4}-\d{2}-\d{2}\.json$/);
});
