/** Yhteiset apurit selaintesteille: laulun kylvö kantaan ja editorin avaus. */
import type { Page } from '@playwright/test';
import { DB_VERSION } from '../src/lib/db';
import type { Song } from '../src/lib/types';

/**
 * Kannan versio luetaan sovelluksesta eikä kirjoiteta tänne käsin.
 *
 * Testit avaavat kannan itse kylvääkseen dataa. Jos versio olisi kovakoodattu,
 * sovelluksen versionnosto kaataisi ne `VersionError`iin – virheeseen, joka ei
 * liity testattavaan asiaan mitenkään ja jonka syy on hankala nähdä.
 */
export { DB_VERSION };

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
    ({ s, versio }) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('sanoittaja', versio);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('songs')) db.createObjectStore('songs', { keyPath: 'id' });
          for (const name of ['recordings', 'annotations']) {
            if (!db.objectStoreNames.contains(name)) {
              db.createObjectStore(name, { keyPath: 'id' }).createIndex('songId', 'songId');
            }
          }
          if (!db.objectStoreNames.contains('setlists')) {
            db.createObjectStore('setlists', { keyPath: 'id' });
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
    { s: song as unknown as Record<string, unknown>, versio: DB_VERSION },
  );
  await page.reload();
  await page.waitForSelector('.song-card');
}

/** Kylvää useita lauluja ja jää laululistaan; järjestys on annettu järjestys. */
export async function avaaMonta(page: Page, nimet: string[]): Promise<void> {
  // Laululista järjestää muokkausajan mukaan uusin ensin, joten aikaleimat
  // annetaan laskevina – muuten testien odotettu järjestys olisi käänteinen.
  const songs = nimet.map((title, i) =>
    laulu({ id: `s${i}`, title, updatedAt: nimet.length - i, lines: [{ id: `l${i}`, text: title, chords: [] }] }),
  );
  await avaaLista(page, songs[0]);
  for (const song of songs.slice(1)) await kylvaLaulu(page, song);
  await page.reload();
  await page.waitForSelector('.song-card');
}

/** Lisää laulun kantaan ilman sivun uudelleenlatausta. */
async function kylvaLaulu(page: Page, song: Song): Promise<void> {
  await page.evaluate(
    ({ s, versio }) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('sanoittaja', versio);
        req.onsuccess = () => {
          const tx = req.result.transaction('songs', 'readwrite');
          tx.objectStore('songs').put(s);
          tx.oncomplete = () => {
            req.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      }),
    { s: song as unknown as Record<string, unknown>, versio: DB_VERSION },
  );
}

/** Luo setin nimellä; nimi kysytään selaimen kyselyllä. */
export async function luoSetti(page: Page, nimi: string): Promise<void> {
  page.once('dialog', (d) => d.accept(nimi));
  await page.getByRole('button', { name: '+ New set' }).click();
  await page.getByRole('button', { name: nimi, exact: true }).waitFor();
}

/** Lisää nimetyt laulut avoinna olevaan settiin valintanäkymästä. */
export async function lisaaLauluja(page: Page, lauluNimet: string[]): Promise<void> {
  await page.getByRole('button', { name: 'Add songs' }).first().click();
  for (const nimi of lauluNimet) {
    await page.locator('.picker-row', { hasText: nimi }).locator('input').check();
  }
  await page.locator('.sheet').getByRole('button', { name: 'Add songs' }).click();
}

/** Kylvää laulun ja avaa sen editoriin. */
export async function avaaLaulu(page: Page, song: Song = laulu()): Promise<void> {
  await avaaLista(page, song);
  await page.locator('.song-card').first().click();
  await page.waitForSelector('.lyrics .section');
}

/** Kantaan tallennettu laulu JSON-merkkijonona. */
export function tallennettuLaulu(page: Page, songId = 'testi'): Promise<string> {
  return page.evaluate(
    ({ id, versio }) =>
      new Promise<string>((resolve, reject) => {
        const req = indexedDB.open('sanoittaja', versio);
        req.onsuccess = () => {
          const get = req.result.transaction('songs').objectStore('songs').get(id);
          get.onsuccess = () => resolve(JSON.stringify(get.result));
          get.onerror = () => reject(get.error);
        };
        req.onerror = () => reject(req.error);
      }),
    { id: songId, versio: DB_VERSION },
  );
}

/** Osioiden otsikot näytön järjestyksessä. */
export function osiot(page: Page): Promise<string[]> {
  return page.$$eval('.section-name', (els) => els.map((e) => (e.textContent ?? '').trim()));
}

export interface DropboxVienti {
  arg: string;
  body: string;
}

/**
 * Katkaisee Dropbox-latauksen sivun sisällä ja tallentaa mitä lähetettiin.
 *
 * `page.route` ei sieppaa tätä pyyntöä WebKitissä, jolloin testi osuisi
 * oikeaan Dropboxiin. Fetchin korvaaminen toimii samoin joka moottorilla.
 * Kutsuttava ennen ensimmäistä sivunlatausta.
 */
export async function pysaytaDropbox(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __dropbox: DropboxVienti[] };
    w.__dropbox = [];
    const alkuperainen = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      if (!url.startsWith('https://content.dropboxapi.com/')) return alkuperainen(input, init);
      const headers = (init?.headers ?? {}) as Record<string, string>;
      const body = init?.body;
      w.__dropbox.push({
        arg: headers['Dropbox-API-Arg'] ?? '',
        body: body instanceof Blob ? await body.text() : String(body ?? ''),
      });
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
  });
}

/** Mitä Dropboxiin on lähetetty tämän sivunlatauksen aikana. */
export function dropboxViennit(page: Page): Promise<DropboxVienti[]> {
  return page.evaluate(() => (window as unknown as { __dropbox?: DropboxVienti[] }).__dropbox ?? []);
}

/** Voimassa oleva Dropbox-kirjautuminen ilman oikeaa OAuth-kulkua. */
export async function kirjauduDropboxiin(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.setItem('sanoittaja.dropbox.clientId', 'testi-avain');
    localStorage.setItem('sanoittaja.dropbox.token', 'testi-token');
    localStorage.setItem('sanoittaja.dropbox.refresh', 'testi-refresh');
  });
}

/** Kuinka monta pikseliä leveämpi dokumentti on kuin näyttö. */
export function vaakaYlivuoto(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}
