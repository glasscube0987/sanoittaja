/**
 * Settilistat: keikkakohtainen kokoelma lauluja, jonka läpi pääsee live-tilassa
 * poistumatta esitysnäkymästä.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { avaaMonta, lisaaLauluja, luoSetti } from './apu';

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


/**
 * Liu'uttaa nimetyn rivin vasemmalle annetun matkan.
 *
 * Tapahtumat lähetetään yksitellen, koska ele elää Reactin tilassa: saman
 * kierroksen sisällä `pointermove` näkisi vielä vanhan arvon. Playwrightin
 * hiiri ei myöskään aseta `pointerType`-arvoa, joten kosketus syntetisoidaan.
 */
async function liuuta(page: Page, nimi: string, matka: number, dy = 0) {
  const rivi = page.locator('.swipe-row', { hasText: nimi }).locator('.swipe-content');
  const box = (await rivi.boundingBox())!;
  const x0 = box.x + box.width - 20;
  const y0 = box.y + box.height / 2;

  const laheta = (tapahtuma: string, x: number, y: number) =>
    rivi.evaluate(
      (el, [nimi2, cx, cy]) => {
        el.setPointerCapture = () => {};
        el.dispatchEvent(
          new PointerEvent(nimi2 as string, {
            pointerId: 1,
            pointerType: 'touch',
            clientX: cx as number,
            clientY: cy as number,
            buttons: 1,
            bubbles: true,
            cancelable: true,
          }),
        );
      },
      [tapahtuma, x, y] as const,
    );

  await laheta('pointerdown', x0, y0);
  await laheta('pointermove', x0 + matka * 0.3, y0 + dy * 0.3);
  await laheta('pointermove', x0 + matka, y0 + dy);
  await laheta('pointerup', x0 + matka, y0 + dy);
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

test('lyhyt liu\'utus paljastaa poistopainikkeen ja se poistaa vain setistä', async ({ page }) => {
  await avaaMonta(page, BIISIT);
  await luoSetti(page, 'Keikka');
  await lisaaLauluja(page, BIISIT);

  await liuuta(page, 'Toinen', -110);
  const poista = page.getByLabel('Remove Toinen from the set');
  await expect(poista).toBeVisible();
  await poista.click();

  expect(await nimet(page)).toEqual(['Ensimmäinen', 'Kolmas']);

  // Laulu on yhä kirjastossa: setistä poisto ei ole laulun poisto.
  await page.getByRole('button', { name: 'All songs' }).click();
  expect(await nimet(page)).toEqual(BIISIT);
});

test('pitkä liu\'utus poistaa setistä suoraan', async ({ page }) => {
  await avaaMonta(page, BIISIT);
  await luoSetti(page, 'Keikka');
  await lisaaLauluja(page, BIISIT);

  await liuuta(page, 'Toinen', -320);
  await expect.poll(() => nimet(page)).toEqual(['Ensimmäinen', 'Kolmas']);

  await page.getByRole('button', { name: 'All songs' }).click();
  expect(await nimet(page)).toEqual(BIISIT);
});

test('lyhyt nykäisy ei poista eikä avaa riviä', async ({ page }) => {
  await avaaMonta(page, BIISIT);
  await luoSetti(page, 'Keikka');
  await lisaaLauluja(page, BIISIT);

  await liuuta(page, 'Toinen', -20);
  expect(await nimet(page)).toEqual(BIISIT);
  // Painike on DOM:issa mutta sisällön alla, joten avautuminen luetaan rivistä.
  await expect(page.locator('.swipe-row.open')).toHaveCount(0);
});

test('pystyveto jää listan vieritykselle', async ({ page }) => {
  // Muuten listaa ei voisi vierittää rivien päältä ilman että ne lähtevät
  // liikkeelle – ja settilistassa sormi on juuri rivien päällä.
  await avaaMonta(page, BIISIT);
  await luoSetti(page, 'Keikka');
  await lisaaLauluja(page, BIISIT);

  await liuuta(page, 'Toinen', -60, 90);
  expect(await nimet(page)).toEqual(BIISIT);
  await expect(page.locator('.swipe-row.open')).toHaveCount(0);
});

test('liu\'utus ei avaa laulua', async ({ page }) => {
  await avaaMonta(page, BIISIT);
  await luoSetti(page, 'Keikka');
  await lisaaLauluja(page, BIISIT);

  await liuuta(page, 'Toinen', -110);
  // Editori ei auennut: laululista on yhä näkyvissä.
  await expect(page.locator('.setlist-bar')).toBeVisible();
  await expect(page.locator('.lyrics')).toHaveCount(0);
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
