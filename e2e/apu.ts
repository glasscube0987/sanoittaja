/** Yhteiset apurit selaintesteille: laulun kylvö kantaan ja editorin avaus. */
import type { Page } from '@playwright/test';
import type { Song } from '../src/lib/types';

export const PITKA_RIVI =
  'ja tie vie pohjoiseen halki yön ja sateen kunnes aamu tulee ja valo osuu ikkunaan';

export function laulu(overrides: Partial<Song> = {}): Song {
  return {
    id: 'testi',
    title: 'Kuu valaisee',
    songKey: 'Am',
    createdAt: 1,
    updatedAt: 2,
    lines: [
      {
        id: 'l1',
        text: 'kuu valaisee yön',
        section: { kind: 'verse' },
        chords: [
          { id: 'c1', pos: 0, symbol: 'Am' },
          { id: 'c2', pos: 4, symbol: 'F' },
        ],
      },
      { id: 'l2', text: 'ja tie vie pohjoiseen', chords: [{ id: 'c3', pos: 3, symbol: 'C' }] },
      {
        id: 'l3',
        text: 'älä katso taakse',
        section: { kind: 'chorus' },
        chords: [{ id: 'c4', pos: 0, symbol: 'G' }],
      },
      { id: 'l4', text: 'aamu tulee kohta', chords: [] },
      { id: 'l5', text: 'toinen säkeistö tässä', section: { kind: 'verse' }, chords: [] },
    ],
    ...overrides,
  };
}

/**
 * Kirjoittaa laulun suoraan IndexedDB:hen ja avaa sen editoriin. Kannan
 * rakenne on sama kuin src/lib/db.ts luo, jotta sovellus lukee sen sellaisenaan.
 */
/** Kylvää laulun kantaan ja jää laululistaan. */
export async function avaaLista(page: Page, song: Song = laulu()): Promise<void> {
  await page.goto('/');
  // Kieli lukitaan englanniksi, jottei testien odotettu teksti riipu selaimen
  // kieliasetuksesta.
  await page.evaluate(() => localStorage.setItem('sanoittaja.lang', 'en'));
  await page.evaluate(
    (s) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('sanoittaja', 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('songs')) db.createObjectStore('songs', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('recordings')) {
            db.createObjectStore('recordings', { keyPath: 'id' }).createIndex('songId', 'songId');
          }
        };
        req.onsuccess = () => {
          const tx = req.result.transaction('songs', 'readwrite');
          tx.objectStore('songs').put(s);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      }),
    song as unknown as Record<string, unknown>,
  );
  await page.reload();
  await page.waitForSelector('.song-card');
}

/** Kylvää laulun ja avaa sen editoriin. */
export async function avaaLaulu(page: Page, song: Song = laulu()): Promise<void> {
  await avaaLista(page, song);
  await page.locator('.song-card').first().click();
  await page.waitForSelector('.lyrics .section');
}

/** Osioiden otsikot näytön järjestyksessä. */
export function osiot(page: Page): Promise<string[]> {
  return page.$$eval('.section-name', (els) => els.map((e) => (e.textContent ?? '').trim()));
}

/** Kuinka monta pikseliä leveämpi dokumentti on kuin näyttö. */
export function vaakaYlivuoto(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}
