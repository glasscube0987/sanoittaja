import { expect, test } from '@playwright/test';
import { avaaLista, dropboxViennit, kirjauduDropboxiin, pysaytaDropbox } from './apu';

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

test('kirjautuminen onnistuu ilman omia tunnuksia', async ({ page }) => {
  await avaaLista(page);
  // Sovelluksen oma osoite talteen ennen kirjautumista: sen jälkeen sivu on
  // matkalla muualle eikä page.url() enää kerro mistä lähdettiin.
  const sovellus = new URL(page.url()).origin + '/';

  // Kirjautuminen vie pois sovelluksesta; pysäytetään se ja katsotaan minne oltiin menossa.
  let osoite = '';
  await page.route('https://www.dropbox.com/**', async (route) => {
    osoite = route.request().url();
    await route.abort();
  });

  await page.getByRole('button', { name: 'To cloud' }).click();
  await page.getByRole('button', { name: 'Sign in to Dropbox' }).click();

  await expect.poll(() => osoite).not.toBe('');
  const url = new URL(osoite);
  // Asetuksiin ei ole koskettu: sovelluksen oma tunnus riittää.
  expect(url.searchParams.get('client_id')).toBe('gvl73tnz8a7by9s');
  expect(url.searchParams.get('token_access_type')).toBe('offline');
  expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  // Paluuosoite on täsmälleen se, joka Dropboxiin on rekisteröitävä.
  expect(url.searchParams.get('redirect_uri')).toBe(sovellus);
});

test('pilveen viety paketti on sama palautuva varmuuskopio', async ({ page }) => {
  await pysaytaDropbox(page);
  await avaaLista(page);
  await kirjauduDropboxiin(page);

  await page.getByRole('button', { name: 'To cloud' }).click();
  await page.getByRole('button', { name: 'Back up to Dropbox' }).click();
  await expect(page.locator('.sheet .status').last()).toContainText('Backed up to Dropbox');

  const [vienti] = await dropboxViennit(page);
  expect(JSON.parse(vienti.arg).path).toMatch(/^\/sanoittaja-varmuuskopio-\d{4}-\d{2}-\d{2}\.json$/);
  // Ratkaiseva kohta: aiemmin pilveen meni paljas Song, jonka tuonti hylkäsi.
  const paketti = JSON.parse(vienti.body);
  expect(paketti.app).toBe('sanoittaja');
  expect(paketti.songs.map((s: { title: string }) => s.title)).toEqual(['Kuu valaisee']);
});

test('kirjasto varmuuskopioituu pilveen taustalla ilman käyttäjän toimia', async ({ page }) => {
  await pysaytaDropbox(page);
  await avaaLista(page);
  await kirjauduDropboxiin(page);
  await page.evaluate(() => localStorage.setItem('sanoittaja.libraryChanged', String(Date.now())));

  // Ei yhtään napautusta: pelkkä sovelluksen käynnistys riittää.
  await page.reload();
  await expect.poll(() => dropboxViennit(page).then((v) => v.length)).toBe(1);

  const [vienti] = await dropboxViennit(page);
  expect(JSON.parse(vienti.body).songs.map((s: { title: string }) => s.title)).toEqual(['Kuu valaisee']);
  // Huomautus seuraa taustakopiota ilman uudelleenlatausta.
  await expect(page.locator('.backup-note')).toContainText('Backed up today');
});

test('taustakopio ei toistu ennen kuin väli on kulunut', async ({ page }) => {
  await pysaytaDropbox(page);
  await avaaLista(page);
  await kirjauduDropboxiin(page);
  await page.evaluate(() => {
    localStorage.setItem('sanoittaja.libraryChanged', String(Date.now() - 3 * 3_600_000));
    localStorage.setItem('sanoittaja.autoBackup.at', String(Date.now() - 3_600_000));
  });

  await page.reload();
  await page.waitForSelector('.song-card');
  await expect(page.locator('.backup-note')).toBeVisible();
  expect(await dropboxViennit(page)).toEqual([]);
});

test('pilvivienti nollaa varmuuskopiomuistutuksen', async ({ page }) => {
  await pysaytaDropbox(page);
  await avaaLista(page);
  await kirjauduDropboxiin(page);
  await page.evaluate((k) => localStorage.setItem(k, String(Date.now() - 20 * 86_400_000)), AVAIN);
  await page.reload();
  await expect(page.locator('.backup-note')).toHaveClass(/stale/);

  await page.getByRole('button', { name: 'To cloud' }).click();
  await page.getByRole('button', { name: 'Back up to Dropbox' }).click();
  await expect(page.locator('.sheet .status').last()).toContainText('Backed up to Dropbox');

  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('.backup-note')).toContainText('Backed up today');
  await expect(page.locator('.backup-note')).not.toHaveClass(/stale/);
});
