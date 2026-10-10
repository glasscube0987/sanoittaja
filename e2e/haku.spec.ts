import { expect, test, type Page } from '@playwright/test';
import { avaaLista, avaaMonta, DB_VERSION, laulu, luoSetti, lisaaLauluja } from './apu';

/**
 * Laululistan haku.
 *
 * Haku on johdettu näkymä: se ei muuta kantaa eikä tietomallia, joten testit
 * koskevat suodatusta, katkelmaa ja sitä missä hakukenttä näkyy.
 */

/** Toinen laulu kirjastoon ilman sivunlatausta. */
async function lisaaToinen(page: Page): Promise<void> {
  await page.evaluate(
    (versio) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('sanoittaja', versio);
        req.onsuccess = () => {
          const tx = req.result.transaction('songs', 'readwrite');
          tx.objectStore('songs').put({
            id: 'toinen',
            title: 'Sateen jälkeen',
            songKey: 'G',
            createdAt: 1,
            updatedAt: 5,
            lines: [{ id: 'x', text: 'aamu tulee kohta', chords: [] }],
          });
          tx.oncomplete = () => {
            req.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      }),
    DB_VERSION,
  );
  await page.reload();
  await page.waitForSelector('.song-card');
}

const nimet = (page: Page) => page.locator('.song-card .title').allTextContents();

test('haku suodattaa listan ja näyttää osuman rivin', async ({ page }) => {
  await avaaLista(page);
  await lisaaToinen(page);
  expect(await nimet(page)).toHaveLength(2);

  await page.getByLabel('Search songs').fill('pohjoiseen');

  expect(await nimet(page)).toEqual(['Kuu valaisee']);
  // Osuma ei ole nimessä, joten kortti kertoo miksi laulu on listalla.
  await expect(page.locator('.song-card .snippet')).toHaveText('ja tie vie pohjoiseen');
});

test('nimiosuma ei tuota katkelmaa', async ({ page }) => {
  await avaaLista(page);
  await lisaaToinen(page);

  await page.getByLabel('Search songs').fill('sateen');

  expect(await nimet(page)).toEqual(['Sateen jälkeen']);
  await expect(page.locator('.song-card .snippet')).toHaveCount(0);
});

test('tyhjennys palauttaa koko listan', async ({ page }) => {
  await avaaLista(page);
  await lisaaToinen(page);

  const haku = page.getByLabel('Search songs');
  await haku.fill('sateen');
  expect(await nimet(page)).toHaveLength(1);

  await haku.fill('');
  expect(await nimet(page)).toHaveLength(2);
});

test('osumaton haku kertoo ettei löytynyt mitään', async ({ page }) => {
  await avaaLista(page);
  await lisaaToinen(page);

  await page.getByLabel('Search songs').fill('eiolemassa');

  expect(await nimet(page)).toEqual([]);
  await expect(page.locator('.empty-note')).toContainText('eiolemassa');
});

/* Setissä lista on lyhyt ja järjestys on esitysjärjestys – kuten lajittelukin,
   haku kuuluu vain koko kirjastolle. */
test('haku ei näy setissä', async ({ page }) => {
  await avaaMonta(page, ['Kuu valaisee', 'Sateen jälkeen']);
  await expect(page.getByLabel('Search songs')).toBeVisible();

  await luoSetti(page, 'Keikka');
  await lisaaLauluja(page, ['Kuu valaisee']);

  await expect(page.getByLabel('Search songs')).toHaveCount(0);
});

test('lajittelu koskee suodatettua listaa', async ({ page }) => {
  await avaaMonta(page, ['Alfa laulu', 'Beeta laulu', 'Muu']);

  await page.getByLabel('Search songs').fill('laulu');
  await page.getByRole('button', { name: 'Z–A', exact: true }).click();

  expect(await nimet(page)).toEqual(['Beeta laulu', 'Alfa laulu']);
});

/* Yhden laulun kirjastossa ei ole mitään suodatettavaa. */
test('haku ei näy yhden laulun kirjastossa', async ({ page }) => {
  await avaaLista(page, laulu());
  await expect(page.getByLabel('Search songs')).toHaveCount(0);
});
