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

test('pilvivienti kertoo puuttuvasta client id:stä eikä yritä verkkoon', async ({ page }) => {
  await avaaLista(page);
  await page.getByRole('button', { name: 'To cloud' }).click();
  await page.getByRole('button', { name: 'Sign in to Dropbox' }).click();
  await expect(page.locator('.sheet .status').last()).toContainText('add a client id');
});

test('pilveen viety paketti on sama palautuva varmuuskopio', async ({ page }) => {
  await avaaLista(page);
  await page.evaluate(() => {
    localStorage.setItem('sanoittaja.dropbox.clientId', 'testi-avain');
    localStorage.setItem('sanoittaja.dropbox.token', 'testi-token');
  });

  // Dropbox katkaistaan rajapinnan reunalta: testi tarkistaa mitä lähetettiin,
  // ei sitä että Dropbox toimii.
  let arg = '';
  let runko = '';
  await page.route('https://content.dropboxapi.com/**', async (route) => {
    arg = route.request().headers()['dropbox-api-arg'] ?? '';
    runko = route.request().postData() ?? '';
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.getByRole('button', { name: 'To cloud' }).click();
  await page.getByRole('button', { name: 'Back up to Dropbox' }).click();
  await expect(page.locator('.sheet .status').last()).toContainText('Backed up to Dropbox');

  expect(JSON.parse(arg).path).toMatch(/^\/sanoittaja-varmuuskopio-\d{4}-\d{2}-\d{2}\.json$/);
  // Ratkaiseva kohta: aiemmin pilveen meni paljas Song, jonka tuonti hylkäsi.
  const paketti = JSON.parse(runko);
  expect(paketti.app).toBe('sanoittaja');
  expect(paketti.songs.map((s: { title: string }) => s.title)).toEqual(['Kuu valaisee']);
});

test('pilvivienti nollaa varmuuskopiomuistutuksen', async ({ page }) => {
  await avaaLista(page);
  await page.evaluate(
    (k) => {
      localStorage.setItem(k, String(Date.now() - 20 * 86_400_000));
      localStorage.setItem('sanoittaja.dropbox.clientId', 'testi-avain');
      localStorage.setItem('sanoittaja.dropbox.token', 'testi-token');
    },
    AVAIN,
  );
  await page.reload();
  await expect(page.locator('.backup-note')).toHaveClass(/stale/);

  await page.route('https://content.dropboxapi.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  );
  await page.getByRole('button', { name: 'To cloud' }).click();
  await page.getByRole('button', { name: 'Back up to Dropbox' }).click();
  await expect(page.locator('.sheet .status').last()).toContainText('Backed up to Dropbox');

  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('.backup-note')).toContainText('Backed up today');
  await expect(page.locator('.backup-note')).not.toHaveClass(/stale/);
});
