/**
 * Tallennuspohjan yhteensopivuus.
 *
 * Kannan versio nousi ja varmuuskopion muoto sai uusia kenttiä. Molemmissa on
 * sama vaara: jo olemassa oleva data lakkaa toimimasta. Käyttäjällä on oikeita
 * lauluja laitteessa ja oikeita varmuuskopiotiedostoja tallessa, joten näitä
 * kahta ei voi jättää testaamatta.
 */
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { kirjastoToiminto } from './apu';

/** Vanhan version 1 kanta: vain laulut ja nauhoitteet. */
async function kylvaVanhaKanta(page: Page) {
  // Sovellus avaa kannan heti käynnistyessään versiolla 2, minkä jälkeen
  // version 1 avaaminen ei ole enää mahdollista. Ladataan siksi ensin
  // pelkkä kuvatiedosto: sama lähde, ei sovellusta.
  await page.goto('/icon.svg');
  await page.evaluate(() => localStorage.setItem('sanoittaja.lang', 'en'));
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('sanoittaja', 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          db.createObjectStore('songs', { keyPath: 'id' });
          db.createObjectStore('recordings', { keyPath: 'id' }).createIndex('songId', 'songId');
        };
        req.onsuccess = () => {
          const tx = req.result.transaction('songs', 'readwrite');
          tx.objectStore('songs').put({
            id: 'vanha',
            title: 'Vanhassa kannassa',
            songKey: 'Am',
            lines: [{ id: 'l1', text: 'kuu valaisee yön', chords: [{ id: 'c1', pos: 0, symbol: 'Am' }] }],
            createdAt: 1,
            updatedAt: 2,
          });
          tx.oncomplete = () => {
            req.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      }),
  );
}

test('version 1 kannassa olevat laulut säilyvät päivityksessä', async ({ page }) => {
  await kylvaVanhaKanta(page);
  await page.goto('/');

  await expect(page.locator('.song-card .title')).toHaveText('Vanhassa kannassa');
  await page.locator('.song-card').first().click();
  await expect(page.locator('.line input.text').first()).toHaveValue('kuu valaisee yön');
  await expect(page.locator('.line .chord').first()).toHaveText('Am');
});

test('uudet taulut syntyvät vanhan kannan päälle', async ({ page }) => {
  await kylvaVanhaKanta(page);
  await page.goto('/');
  await page.waitForSelector('.song-card');

  const taulut = await page.evaluate(
    () =>
      new Promise<string[]>((resolve, reject) => {
        const req = indexedDB.open('sanoittaja');
        req.onsuccess = () => {
          const names = Array.from(req.result.objectStoreNames);
          req.result.close();
          resolve(names);
        };
        req.onerror = () => reject(req.error);
      }),
  );
  expect(taulut).toEqual(expect.arrayContaining(['songs', 'recordings', 'setlists', 'annotations']));
});

test('version 1 varmuuskopio kelpaa edelleen tuontiin', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('sanoittaja.lang', 'en'));
  await page.reload();

  // Täsmälleen se muoto, jonka aiemmat versiot kirjoittivat.
  const vanhaPaketti = JSON.stringify({
    app: 'sanoittaja',
    version: 1,
    exportedAt: 1,
    songs: [
      {
        id: 'kopiosta',
        title: 'Vanhasta varmuuskopiosta',
        songKey: 'C',
        lines: [{ id: 'l1', text: 'palautettu rivi', chords: [] }],
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    recordings: [],
  });

  await page.locator('input[type="file"]').setInputFiles({
    name: 'vanha.json',
    mimeType: 'application/json',
    buffer: Buffer.from(vanhaPaketti),
  });

  await expect(page.locator('.song-card .title')).toHaveText('Vanhasta varmuuskopiosta');
});

test('uusi varmuuskopio sisältää settilistat ja merkinnät', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('sanoittaja.lang', 'en'));
  await page.reload();

  const lataus = page.waitForEvent('download');
  await kirjastoToiminto(page, 'Back up');
  const tiedosto = await lataus;
  const polku = await tiedosto.path();
  const sisalto = JSON.parse(readFileSync(polku!, 'utf8'));

  expect(sisalto.version).toBe(2);
  expect(sisalto.setlists).toEqual([]);
  expect(sisalto.annotations).toEqual([]);
});

test('uudemman version varmuuskopio torjutaan selvällä virheellä', async ({ page }) => {
  /*
   * Vanha paketti kelpaa, uusi ei. Uudessa voi olla tietuelaji jota tämä versio
   * ei tunne, ja se päätyisi kantaan asti ennen kuin mikään huomaa mitään —
   * vika näkyisi vasta piirtovaiheessa, väärässä paikassa. Aiemmin versiota ei
   * tarkistettu lainkaan.
   */
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('sanoittaja.lang', 'en'));
  await page.reload();

  const tulevaPaketti = JSON.stringify({
    app: 'sanoittaja',
    version: 99,
    exportedAt: 1,
    songs: [
      {
        id: 'tulevaisuudesta',
        title: 'Tulevasta versiosta',
        songKey: 'C',
        lines: [{ id: 'l1', text: 'ei pitäisi näkyä', chords: [] }],
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    recordings: [],
  });

  await page.locator('input[type="file"]').setInputFiles({
    name: 'uusi.json',
    mimeType: 'application/json',
    buffer: Buffer.from(tulevaPaketti),
  });

  // Virhe kerrotaan, eikä laulu päädy kirjastoon.
  await expect(page.getByText(/uudemmasta versiosta/i)).toBeVisible();
  await expect(page.locator('.song-card')).toHaveCount(0);
});
