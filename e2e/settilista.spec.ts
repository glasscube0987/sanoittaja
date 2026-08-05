/**
 * Settilistat: keikkakohtainen kokoelma lauluja, jonka läpi pääsee live-tilassa
 * poistumatta esitysnäkymästä.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { avaaMonta } from './apu';

const BIISIT = ['Ensimmäinen', 'Toinen', 'Kolmas'];

/** Laulujen nimet ilman setin järjestysnumeroa. */
function nimet(page: Page): Promise<string[]> {
  return page.$$eval('.song-card .title', (els) =>
    els.map((e) => {
      const kopio = e.cloneNode(true) as HTMLElement;
      kopio.querySelector('.song-number')?.remove();
      return (kopio.textContent ?? '').trim();
    }),
  );
}

/** Luo setin nimellä; nimi kysytään selaimen kyselyllä. */
async function luoSetti(page: Page, nimi: string) {
  page.once('dialog', (d) => d.accept(nimi));
  await page.getByRole('button', { name: '+ New set' }).click();
  await expect(page.getByRole('button', { name: nimi, exact: true })).toBeVisible();
}

async function lisaaLauluja(page: Page, lauluNimet: string[]) {
  await page.getByRole('button', { name: 'Add songs' }).first().click();
  for (const nimi of lauluNimet) {
    await page.locator('.picker-row', { hasText: nimi }).locator('input').check();
  }
  await page.locator('.sheet').getByRole('button', { name: 'Add songs' }).click();
}

test('setin luonti ja laulujen lisääminen', async ({ page }) => {
  await avaaMonta(page, BIISIT);
  await luoSetti(page, 'Keikka');

  await expect(page.locator('.empty-note')).toContainText('No songs in this set yet');

  await lisaaLauluja(page, ['Kolmas', 'Ensimmäinen']);
  // Laulut tulevat setin loppuun valintajärjestyksessä, eivät kirjaston.
  expect(await nimet(page)).toEqual(['Kolmas', 'Ensimmäinen']);
});

test('kaikki laulut näkyy aina, myös setin ulkopuoliset', async ({ page }) => {
  await avaaMonta(page, BIISIT);
  await luoSetti(page, 'Keikka');
  await lisaaLauluja(page, ['Toinen']);
  expect(await nimet(page)).toEqual(['Toinen']);

  await page.getByRole('button', { name: 'All songs' }).click();
  expect(await nimet(page)).toEqual(BIISIT);
});

test('setin järjestystä voi muuttaa', async ({ page }) => {
  await avaaMonta(page, BIISIT);
  await luoSetti(page, 'Keikka');
  await lisaaLauluja(page, BIISIT);

  await page.getByLabel('Move Kolmas up').click();
  expect(await nimet(page)).toEqual(['Ensimmäinen', 'Kolmas', 'Toinen']);

  await page.getByLabel('Move Ensimmäinen down').click();
  expect(await nimet(page)).toEqual(['Kolmas', 'Ensimmäinen', 'Toinen']);
});

test('järjestystä ei voi siirtää setin reunojen yli', async ({ page }) => {
  await avaaMonta(page, BIISIT);
  await luoSetti(page, 'Keikka');
  await lisaaLauluja(page, BIISIT);

  await expect(page.getByLabel('Move Ensimmäinen up')).toBeDisabled();
  await expect(page.getByLabel('Move Kolmas down')).toBeDisabled();
});

test('laulun poisto setistä ei poista laulua kirjastosta', async ({ page }) => {
  await avaaMonta(page, BIISIT);
  await luoSetti(page, 'Keikka');
  await lisaaLauluja(page, BIISIT);

  await page.getByLabel('Remove Toinen from the set').click();
  expect(await nimet(page)).toEqual(['Ensimmäinen', 'Kolmas']);

  await page.getByRole('button', { name: 'All songs' }).click();
  expect(await nimet(page)).toEqual(BIISIT);
});

test('setti säilyy uudelleenlatauksen yli', async ({ page }) => {
  await avaaMonta(page, BIISIT);
  await luoSetti(page, 'Keikka');
  await lisaaLauluja(page, ['Kolmas', 'Toinen']);

  await page.reload();
  await page.getByRole('button', { name: 'Keikka', exact: true }).click();
  expect(await nimet(page)).toEqual(['Kolmas', 'Toinen']);
});

test('jo setissä olevaa laulua ei voi lisätä toiseen kertaan', async ({ page }) => {
  await avaaMonta(page, BIISIT);
  await luoSetti(page, 'Keikka');
  await lisaaLauluja(page, ['Toinen']);

  await page.getByRole('button', { name: 'Add songs' }).first().click();
  const rivi = page.locator('.picker-row', { hasText: 'Toinen' }).locator('input');
  await expect(rivi).toBeChecked();
  await expect(rivi).toBeDisabled();
});

test('setin poisto ei koske lauluihin', async ({ page }) => {
  await avaaMonta(page, BIISIT);
  await luoSetti(page, 'Keikka');
  await lisaaLauluja(page, BIISIT);

  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Delete', exact: true }).click();

  await expect(page.getByRole('button', { name: 'Keikka', exact: true })).toHaveCount(0);
  expect(await nimet(page)).toEqual(BIISIT);
});

test('live-tila selaa setin läpi', async ({ page }) => {
  await avaaMonta(page, BIISIT);
  await luoSetti(page, 'Keikka');
  await lisaaLauluja(page, BIISIT);

  await page.locator('.button-row').getByRole('button', { name: 'Live' }).click();
  await expect(page.locator('.live-view')).toBeVisible();

  await expect(page.locator('.live-position')).toContainText('1/3');
  await expect(page.locator('.live-view h1')).toHaveText('Ensimmäinen');

  await page.getByLabel('Next song').click();
  await expect(page.locator('.live-position')).toContainText('2/3');
  await expect(page.locator('.live-view h1')).toHaveText('Toinen');

  await page.getByLabel('Previous song').click();
  await expect(page.locator('.live-view h1')).toHaveText('Ensimmäinen');
});

test('live-tila pysähtyy setin päihin', async ({ page }) => {
  await avaaMonta(page, BIISIT);
  await luoSetti(page, 'Keikka');
  await lisaaLauluja(page, BIISIT);
  await page.locator('.button-row').getByRole('button', { name: 'Live' }).click();

  await expect(page.getByLabel('Previous song')).toBeDisabled();
  await page.getByLabel('Next song').click();
  await page.getByLabel('Next song').click();
  await expect(page.getByLabel('Next song')).toBeDisabled();
});

test('yksittäisen laulun live-tilassa ei ole setin selausta', async ({ page }) => {
  await avaaMonta(page, BIISIT);
  await page.locator('.song-card').first().click();
  await page.getByRole('button', { name: 'Live', exact: true }).click();

  await expect(page.locator('.live-view')).toBeVisible();
  await expect(page.locator('.live-nav')).toHaveCount(0);
});
