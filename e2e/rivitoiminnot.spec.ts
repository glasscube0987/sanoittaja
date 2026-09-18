import { expect, test, type Page } from '@playwright/test';
import { avaaLaulu, avaaMonta, laulu, osiot, tallennettuLaulu } from './apu';

/**
 * Rivin toiminnot: lisäys, monistus ja kopiointi laulusta toiseen.
 *
 * Toiminnot asuvat rivin asetuksissa, koska se on ainoa paikka joka on
 * kaikilla rivityypeillä. Sointurivi on painike eikä tekstikenttä, joten se ei
 * voi saada kohdistusta – eikä siten koskaan näyttänyt rivin työkalurivia.
 */

/**
 * Kantaan tallennettu laulu. Tallennus on viiveen takana (`scheduleSave`),
 * joten sitä odotetaan ehdolla eikä kiinteällä unella.
 */
async function kannassa(page: Page, ehto: (song: Song) => boolean): Promise<Song> {
  await expect.poll(async () => ehto(JSON.parse(await tallennettuLaulu(page)))).toBe(true);
  return JSON.parse(await tallennettuLaulu(page));
}

interface Song {
  lines: { id: string; text: string; bars?: string[]; meters?: string[] }[];
}

/** Avaa rivin asetukset ja napauttaa toimintoa. */
async function rivinToiminto(page: Page, rivi: number, nimi: string) {
  await page.locator('.line').nth(rivi).getByLabel('Line settings').click();
  await page.locator('.sheet').waitFor();
  await page.locator('.sheet').getByRole('button', { name: nimi, exact: true }).click();
  await expect(page.locator('.sheet')).toHaveCount(0);
}

/** Laulu, jonka keskimmäinen osio koostuu pelkistä sointuriveistä. */
function laulunPohja() {
  return laulu({
    lines: [
      { id: 'l1', text: 'ensimmäinen säkeistö', section: { kind: 'verse' }, chords: [] },
      { id: 'v1', text: '', section: { kind: 'solo' }, chords: [], bars: ['Am', 'F'], meters: ['4/4', ''] },
      { id: 'v2', text: '', chords: [], bars: ['C', 'G'] },
      { id: 'l2', text: 'toinen säkeistö', section: { kind: 'verse' }, chords: [] },
    ],
  });
}

/*
 * Raportoitu vika: keskellä olevaan pelkistä sointuriveistä koostuvaan osioon
 * ei päässyt lisäämään riviä millään. Alalaidan «+ Rivi» lisää laulun
 * loppuun, eikä sointurivi voi näyttää omaa työkaluriviään.
 */
test('sointuriviosioon saa lisättyä rivin', async ({ page }) => {
  await avaaLaulu(page, laulunPohja());
  expect(await page.locator('.line').count()).toBe(4);

  await rivinToiminto(page, 1, 'Add line below');

  // Rivi syntyi osion sisään eikä laulun loppuun.
  await expect(page.locator('.line')).toHaveCount(5);
  const tallennettu = await kannassa(page, (s) => s.lines.length === 5);
  expect(tallennettu.lines.slice(0, 2).map((l) => l.id)).toEqual(['l1', 'v1']);
  // Uusi rivi on sointurivien välissä ja on sanoitusrivi.
  expect(tallennettu.lines[2].bars).toBeUndefined();
  expect(tallennettu.lines[3].bars).toEqual(['C', 'G']);
  // Osioita on yhä kolme: uusi rivi kuuluu soolo-osioon eikä aloita omaansa.
  expect(await osiot(page)).toEqual(['Verse 1', 'Solo', 'Verse 2']);
});

test('sointurivin monistus tuottaa samat tahdit', async ({ page }) => {
  await avaaLaulu(page, laulunPohja());

  await rivinToiminto(page, 1, 'Duplicate line');

  const tallennettu = await kannassa(page, (s) => s.lines.length === 5);
  expect(tallennettu.lines[2].bars).toEqual(['Am', 'F']);
  expect(tallennettu.lines[2].meters).toEqual(['4/4', '']);
  expect(tallennettu.lines[2].id).not.toBe('v1');
  expect(await osiot(page)).toEqual(['Verse 1', 'Solo', 'Verse 2']);
});

/* Monistus ei saa katkaista osiota kahtia toistamalla osiomerkinnän. */
test('osion ensimmäisen rivin monistus ei aloita toista osiota', async ({ page }) => {
  await avaaLaulu(page, laulunPohja());

  await rivinToiminto(page, 0, 'Duplicate line');

  expect(await osiot(page)).toEqual(['Verse 1', 'Solo', 'Verse 2']);
  await expect(page.locator('.line')).toHaveCount(5);
});

test('rivin voi kopioida laulusta toiseen', async ({ page }) => {
  await avaaMonta(page, ['Kuu valaisee', 'Toinen laulu']);

  await page.locator('.song-card', { hasText: 'Kuu valaisee' }).click();
  await page.waitForSelector('.lyrics');
  await rivinToiminto(page, 0, 'Copy line');

  await page.getByLabel('Songs').click();
  await page.locator('.song-card', { hasText: 'Toinen laulu' }).click();
  await page.waitForSelector('.lyrics');
  await rivinToiminto(page, 0, 'Paste line below');

  await expect(page.locator('.lyrics input.text').nth(1)).toHaveValue('Kuu valaisee');
});

/* Leikepöytä ei tyhjene, jotta saman rivin voi liittää useaan kohtaan. */
test('liittäminen ei kuluta leikepöytää', async ({ page }) => {
  await avaaLaulu(page, laulunPohja());

  await rivinToiminto(page, 0, 'Copy line');
  await rivinToiminto(page, 0, 'Paste line below');
  await rivinToiminto(page, 0, 'Paste line below');

  await expect(page.locator('.line')).toHaveCount(6);
});

/*
 * Toiminto kulkee tallennuksen mukana. Jos se ajettaisiin omana kutsunaan, se
 * laskisi muutoksensa vanhasta laulusta ja pyyhkisi juuri tehdyn asetuksen.
 */
test('rivityypin vaihto ja toiminto samalla kertaa eivät hävitä toisiaan', async ({ page }) => {
  await avaaLaulu(page, laulunPohja());

  await page.locator('.line').nth(3).getByLabel('Line settings').click();
  await page.locator('.sheet').waitFor();
  await page.locator('.sheet').getByRole('button', { name: 'Chord bars', exact: true }).click();
  await page.locator('.sheet').getByRole('button', { name: 'Add line below', exact: true }).click();
  await expect(page.locator('.sheet')).toHaveCount(0);

  const tallennettu = await kannassa(page, (s) => s.lines.length === 5);
  // Rivityyppi vaihtui...
  expect(tallennettu.lines[3].bars).toBeDefined();
  // ...ja rivi syntyi sen perään.
  expect(tallennettu.lines[4].bars).toBeUndefined();
});
