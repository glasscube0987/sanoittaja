import { expect, test, type Locator } from '@playwright/test';
import { avaaLaulu, laulu, tallennettuLaulu } from './apu';

/**
 * Kertausmerkit sointurivillä.
 *
 * Merkit ovat nuottikuvaa: sovellus ei parita niitä eikä toista mitään. Siksi
 * testit koskevat ladontaa ja tallennusta, eivät soittojärjestystä.
 */

/** Teksti sellaisenaan: välit kertovat tahtien tasauksen. */
const teksti = (locator: Locator) => locator.evaluate((el) => el.textContent);

const laulunPohja = () =>
  laulu({
    lines: [
      { id: 'v1', text: '', section: { kind: 'solo' }, chords: [], bars: ['Am', 'F'] },
      { id: 'v2', text: '', chords: [], bars: ['C', 'G'] },
    ],
  });

test('kertausmerkin voi asettaa ja se säilyy uudelleenlatauksen yli', async ({ page }) => {
  await avaaLaulu(page, laulunPohja());

  await page.locator('.bar-row').first().click();
  await page.locator('.sheet').waitFor();
  await page.getByRole('button', { name: 'Open |:', exact: true }).click();
  await page.getByLabel('Move one character right').click();
  await page.getByRole('button', { name: 'Close :|', exact: true }).click();
  await page.getByRole('button', { name: '×4', exact: true }).click();
  await page.getByRole('button', { name: 'Save' }).click();

  expect(await teksti(page.locator('.bar-row').first())).toBe('|: Am | F  :|x4');

  await expect
    .poll(async () => JSON.parse(await tallennettuLaulu(page)).lines[0].repeats)
    .toEqual([{ start: true }, { end: true, times: 4 }]);

  await page.reload();
  await page.locator('.song-card').first().click();
  expect(await teksti(page.locator('.bar-row').first())).toBe('|: Am | F  :|x4');
});

test('kertausmerkit tulevat mukaan live-tilaan ja tulostuslehdelle', async ({ page }) => {
  await avaaLaulu(
    page,
    laulu({
      lines: [
        {
          id: 'v1',
          text: '',
          section: { kind: 'solo' },
          chords: [],
          bars: ['Am', 'F'],
          repeats: [{ start: true }, { end: true }],
        },
      ],
    }),
  );

  await page.getByRole('button', { name: 'Live', exact: true }).click();
  expect(await teksti(page.locator('.live-view .sheet-bars').first())).toBe('|: Am | F  :|');
  await page.getByLabel('Exit live mode').click();

  await page.emulateMedia({ media: 'print' });
  expect(await teksti(page.locator('.song-sheet .sheet-bars').first())).toBe('|: Am | F  :|');
});

/*
 * Avaava merkki on tavallista tahtiviivaa leveämpi, joten ilman varattua tilaa
 * kertaava rivi liukuisi sivuun muista sointuriveistä.
 */
test('kertaava ja kertaamaton rivi pysyvät allekkain', async ({ page }) => {
  await avaaLaulu(
    page,
    laulu({
      lines: [
        {
          id: 'v1',
          text: '',
          section: { kind: 'solo' },
          chords: [],
          bars: ['Am', 'F'],
          repeats: [{ start: true }, {}],
        },
        { id: 'v2', text: '', chords: [], bars: ['C', 'G'] },
      ],
    }),
  );

  const kertaava = (await teksti(page.locator('.bar-row').nth(0))) ?? '';
  const tavallinen = (await teksti(page.locator('.bar-row').nth(1))) ?? '';
  expect(kertaava.indexOf('Am')).toBe(tavallinen.indexOf('C'));
});
