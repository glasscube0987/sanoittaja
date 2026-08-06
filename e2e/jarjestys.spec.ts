/**
 * Laululistan järjestys ja käyttöliittymän sijoittelu.
 *
 * Kirjastonlaajuiset toiminnot siirtyivät listan alalaidasta rattaan taakse,
 * koska pitkässä listassa varmuuskopiointi vaati koko listan ohi vierittämisen.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { avaaMonta } from './apu';

const BIISIT = ['Sade', 'Aamu', 'Kuu'];

const nimet = (page: Page): Promise<string[]> =>
  page.$$eval('.song-card .title', (els) =>
    els.map((e) => {
      const kopio = e.cloneNode(true) as HTMLElement;
      kopio.querySelector('.song-number')?.remove();
      return (kopio.textContent ?? '').trim();
    }),
  );

test('laulut ovat oletuksena muokkausjärjestyksessä', async ({ page }) => {
  await avaaMonta(page, BIISIT);
  expect(await nimet(page)).toEqual(BIISIT);
});

test('aakkosjärjestys ja käänteinen aakkosjärjestys', async ({ page }) => {
  await avaaMonta(page, BIISIT);

  await page.locator('.sort-bar').getByRole('button', { name: 'A–Z' }).click();
  expect(await nimet(page)).toEqual(['Aamu', 'Kuu', 'Sade']);

  await page.locator('.sort-bar').getByRole('button', { name: 'Z–A' }).click();
  expect(await nimet(page)).toEqual(['Sade', 'Kuu', 'Aamu']);

  await page.locator('.sort-bar').getByRole('button', { name: 'Edited' }).click();
  expect(await nimet(page)).toEqual(BIISIT);
});

test('valittu järjestys säilyy uudelleenlatauksen yli', async ({ page }) => {
  await avaaMonta(page, BIISIT);
  await page.locator('.sort-bar').getByRole('button', { name: 'A–Z' }).click();

  await page.reload();
  await page.waitForSelector('.song-card');
  expect(await nimet(page)).toEqual(['Aamu', 'Kuu', 'Sade']);
});

test('setissä ei ole lajittelua', async ({ page }) => {
  // Setin järjestys on käyttäjän asettama esitysjärjestys; sitä ei saa
  // lajitella pois alta.
  await avaaMonta(page, BIISIT);
  page.once('dialog', (d) => d.accept('Keikka'));
  await page.getByRole('button', { name: '+ New set' }).click();

  await expect(page.locator('.sort-bar')).toHaveCount(0);
});

test('yhden laulun listalla ei ole lajitteluvalitsinta', async ({ page }) => {
  await avaaMonta(page, ['Ainoa']);
  await expect(page.locator('.sort-bar')).toHaveCount(0);
});

test('kirjaston toiminnot ovat asetuksissa eivätkä listalla', async ({ page }) => {
  await avaaMonta(page, BIISIT);

  await expect(page.getByRole('button', { name: 'Back up', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Import text' })).toHaveCount(0);

  await page.getByLabel('Settings').click();
  for (const nimi of ['Back up', 'To cloud', 'Restore', 'Import text']) {
    await expect(page.getByRole('button', { name: nimi, exact: true })).toBeVisible();
  }
});

test('varmuuskopiohuomautus jää listalle näkyviin', async ({ page }) => {
  // Muistutus eikä toiminto: valikon takana se ei muistuttaisi mistään.
  await avaaMonta(page, BIISIT);
  await expect(page.locator('.backup-note')).toBeVisible();
});

test('pitkän asetusnäkymän otsikkoon pääsee käsiksi', async ({ page }) => {
  /*
   * `.overlay` kohdistaa ponnahduksen alareunaan. Kun sisältö kasvaa ruutua
   * korkeammaksi, flexboxin alareunakohdistus työntää yläreunan vierityksen
   * ulottumattomiin: otsikko ja ensimmäinen osio jäävät näkymättömiin eikä
   * niihin pääse millään. Kirjaston toimintojen siirto asetuksiin teki
   * näkymästä juuri niin pitkän.
   */
  await avaaMonta(page, BIISIT);
  await page.getByLabel('Settings').click();

  const otsikko = page.locator('.sheet h2');
  await expect(otsikko).toBeVisible();
  await otsikko.scrollIntoViewIfNeeded();
  await expect(otsikko).toBeInViewport();
});

test('uusi laulu tarjoaa tyhjän ja tuonnin', async ({ page }) => {
  await avaaMonta(page, BIISIT);
  await page.getByRole('button', { name: '+ New song' }).click();

  await expect(page.getByRole('button', { name: 'Blank song' })).toBeVisible();
  await page.getByRole('button', { name: 'Import from text' }).click();
  await expect(page.locator('.import-sheet')).toBeVisible();
});

test('tyhjä laulu avaa editorin', async ({ page }) => {
  await avaaMonta(page, BIISIT);
  await page.getByRole('button', { name: '+ New song' }).click();
  await page.getByRole('button', { name: 'Blank song' }).click();

  await expect(page.locator('.lyrics')).toBeVisible();
});

test('uuden laulun valinnan voi perua luomatta mitään', async ({ page }) => {
  // Tyhjä laulu tallentuu heti, joten peruutus ei saa jättää sitä kirjastoon.
  await avaaMonta(page, BIISIT);
  await page.getByRole('button', { name: '+ New song' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();

  expect(await nimet(page)).toEqual(BIISIT);
});
