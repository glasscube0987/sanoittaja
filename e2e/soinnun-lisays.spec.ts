/**
 * Soinnun lisäämisen löydettävyys.
 *
 * Sointu lisättiin napauttamalla tyhjää tilaa tekstin yllä, eikä sitä löytänyt
 * kukaan jolle sitä ei näytetty: vihje oli vain hiiren työkaluvihjeenä. Nyt
 * kirjoitettavan rivin yllä näkyy kohdistimen kohdalla soinnun paikka, ja
 * laulun soinnut ovat rivin työkaluissa pikavalintoina.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { avaaLaulu, tallennettuLaulu } from './apu';

/** Toinen rivi on 'ja tie vie pohjoiseen' ja sillä on C kohdassa 3. */
async function kohdista(page: Page, sarake: number): Promise<void> {
  const kentta = page.locator('.line input.text').nth(1);
  await kentta.click();
  await page.keyboard.press('Home');
  for (let i = 0; i < sarake; i++) await page.keyboard.press('ArrowRight');
}

async function soinnut(page: Page, lineId: string): Promise<{ pos: number; symbol: string }[]> {
  const laulu = JSON.parse(await tallennettuLaulu(page));
  const rivi = laulu.lines.find((l: { id: string }) => l.id === lineId);
  return rivi.chords.map((c: { pos: number; symbol: string }) => ({ pos: c.pos, symbol: c.symbol }));
}

test('kirjoitettavan rivin yllä näkyy soinnun paikka kohdistimen kohdalla', async ({ page }) => {
  await avaaLaulu(page);
  // Kohdistamattomalla rivillä ei ole lokeroa.
  await expect(page.locator('.chord-slot')).toHaveCount(0);

  await kohdista(page, 7);
  const lokero = page.locator('.line').nth(1).locator('.chord-slot');
  await expect(lokero).toBeVisible();

  // Lokero on sarakkeen 7 kohdalla: samassa kohdassa kuin siihen asetettu
  // sointu. Merkin leveys luetaan rivin omasta mittarista (kymmenen nollaa).
  const sarake = await page.locator('.line').nth(1).evaluate((rivi) => {
    const sointurivi = rivi.querySelector<HTMLElement>('.chord-row')!;
    const mittari = sointurivi.querySelector<HTMLElement>('span[aria-hidden]')!;
    const ch = mittari.getBoundingClientRect().width / 10;
    const lokero = rivi.querySelector<HTMLElement>('.chord-slot')!;
    return (lokero.getBoundingClientRect().left - sointurivi.getBoundingClientRect().left - 2) / ch;
  });
  expect(sarake).toBeCloseTo(7, 1);

  // Kohdistin liikkuu, lokero seuraa.
  await page.keyboard.press('ArrowRight');
  const siirretty = await lokero.evaluate((el) => el.style.left);
  expect(siirretty).toContain('8ch');
});

test('lokeron napautus avaa sointuponnahduksen siihen kohtaan', async ({ page }) => {
  await avaaLaulu(page);
  await kohdista(page, 7);
  await page.locator('.line').nth(1).locator('.chord-slot').click();

  await expect(page.locator('.nudge-info')).toContainText('column 7/');
  await page.locator('.sheet input').fill('Dm');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect.poll(() => soinnut(page, 'l2')).toEqual([
    { pos: 3, symbol: 'C' },
    { pos: 7, symbol: 'Dm' },
  ]);
});

/* Olemassa olevaa sointua napautetaan sen omasta merkistä; lokero sen päällä
   peittäisi soinnun. */
test('lokeroa ei näy kohdassa jossa on jo sointu', async ({ page }) => {
  await avaaLaulu(page);
  await kohdista(page, 3);
  await expect(page.locator('.chord-slot')).toHaveCount(0);
});

test('pikasointu asettuu kohdistimen kohdalle ilman ponnahdusta', async ({ page }) => {
  await avaaLaulu(page);
  await kohdista(page, 10);

  const pikat = page.getByRole('group', { name: 'Chords in this song' });
  // Laulun soinnut esiintymisjärjestyksessä.
  await expect(pikat.getByRole('button')).toHaveText(['Am', 'F', 'C', 'G']);
  await pikat.getByRole('button', { name: 'G', exact: true }).click();

  await expect(page.locator('.sheet')).toHaveCount(0);
  await expect.poll(() => soinnut(page, 'l2')).toEqual([
    { pos: 3, symbol: 'C' },
    { pos: 10, symbol: 'G' },
  ]);

  // Kohdistus palaa riville, joten seuraavan soinnun voi asettaa heti.
  await expect(page.locator('.line input.text').nth(1)).toBeFocused();
  await page.keyboard.press('End');
  await pikat.getByRole('button', { name: 'Am', exact: true }).click();
  await expect.poll(() => soinnut(page, 'l2')).toEqual([
    { pos: 3, symbol: 'C' },
    { pos: 10, symbol: 'G' },
    // Rivi on 21 merkkiä pitkä, ja End vie kohdistimen sen loppuun.
    { pos: 21, symbol: 'Am' },
  ]);
});

test('pikasointu korvaa samassa kohdassa olevan soinnun', async ({ page }) => {
  await avaaLaulu(page);
  await kohdista(page, 3);
  await page.getByRole('group', { name: 'Chords in this song' }).getByRole('button', { name: 'F', exact: true }).click();
  await expect.poll(() => soinnut(page, 'l2')).toEqual([{ pos: 3, symbol: 'F' }]);
});
