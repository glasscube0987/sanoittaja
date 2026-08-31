/**
 * H-sointu ja sointujen merkintätapa.
 *
 * Suomalais-saksalaisessa perinteessä h-sävel kirjoitetaan H:lla. Sovellus ei
 * tunnistanut sitä lainkaan, joten H-alkuiset soinnut palautuivat
 * transponoinnista muuttumattomina — sävellajin vaihto rikkoi lapun hiljaa, ja
 * vika löytyi vasta keikalla.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { avaaLaulu, kirjastoToiminto, laulu } from './apu';

const soinnut = (page: Page) => page.locator('.line').first().locator('.chord').allInnerTexts();

function hLaulu() {
  return laulu({
    songKey: 'Hm',
    lines: [
      {
        id: 'l1',
        text: 'kuu valaisee yön',
        section: { kind: 'verse' },
        chords: [
          { id: 'c1', pos: 0, symbol: 'Hm' },
          { id: 'c2', pos: 5, symbol: 'H7' },
        ],
      },
    ],
  });
}

test('H-soinnut transponoituvat', async ({ page }) => {
  await avaaLaulu(page, hLaulu());
  expect(await soinnut(page)).toEqual(['Hm', 'H7']);

  await page.getByLabel('Up a semitone').click();

  expect(await soinnut(page)).toEqual(['Cm', 'C7']);
});

test('H-sävellaji transponoituu kenttänä', async ({ page }) => {
  await avaaLaulu(page, hLaulu());
  const kentta = page.locator('.song-meta, header, .screen').getByLabel('Key').first();
  await expect(kentta).toHaveValue('Hm');

  await page.getByLabel('Up a semitone').click();

  await expect(kentta).toHaveValue('Cm');
});

test('B-merkinnässä transponointi kirjoittaa B:n', async ({ page }) => {
  // Oletusasetus: nykyinen käytös säilyy kaikille.
  await avaaLaulu(page, hLaulu());
  // Hm on sävelluokka 11; kaksi askelta alas on A, ja sieltä kaksi ylös on B.
  await page.getByLabel('Down a semitone').click();
  await page.getByLabel('Down a semitone').click();
  expect(await soinnut(page)).toEqual(['Am', 'A7']);

  await page.getByLabel('Up a semitone').click();
  await page.getByLabel('Up a semitone').click();
  expect(await soinnut(page)).toEqual(['Bm', 'B7']);
});

test('H-merkinnässä transponointi kirjoittaa H:n', async ({ page }) => {
  await avaaLaulu(page, hLaulu());

  await page.getByLabel('Songs').click();
  await kirjastoToiminto(page, 'H / Bb');
  await page.locator('.sheet').getByRole('button', { name: 'Save' }).click();
  await page.locator('.song-card').first().click();

  await page.getByLabel('Down a semitone').click();
  await page.getByLabel('Down a semitone').click();
  expect(await soinnut(page)).toEqual(['Am', 'A7']);

  await page.getByLabel('Up a semitone').click();
  await page.getByLabel('Up a semitone').click();
  expect(await soinnut(page)).toEqual(['Hm', 'H7']);
});
