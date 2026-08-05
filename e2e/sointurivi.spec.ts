import { expect, test, type Locator, type Page } from '@playwright/test';
import { avaaLaulu, laulu } from './apu';

/** Laulu, jonka ensimmäinen rivi on valmis sointuriviksi muunnettavaksi. */
function laulunPohja() {
  return laulu({
    lines: [
      { id: 'v1', text: '', section: { kind: 'solo' }, chords: [] },
      { id: 'l1', text: 'sanoitettu rivi', section: { kind: 'verse' }, chords: [] },
    ],
  });
}

/**
 * Teksti sellaisenaan: `toHaveText` normalisoi välit, ja juuri välit kertovat
 * tahtien tasauksen.
 */
const teksti = (locator: Locator) => locator.evaluate((el) => el.textContent);

/** Muuntaa ensimmäisen rivin sointuriviksi §-painikkeen kautta. */
async function teeSointurivi(page: Page) {
  await page.locator('.line').first().getByLabel('Line settings').click();
  await page.getByRole('button', { name: 'Chord bars', exact: true }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  // Muunnos avaa tahtinäkymän suoraan, jotta tahdit voi täyttää heti.
  await expect(page.locator('.sheet')).toBeVisible();
}

/** Kirjoittaa valittuun tahtiin ja siirtyy seuraavaan. */
async function kirjoitaTahti(page: Page, sisalto: string) {
  await page.locator('.sheet input').fill(sisalto);
  await page.keyboard.press('ArrowRight');
}

test('rivin voi muuntaa sointuriviksi §-painikkeesta', async ({ page }) => {
  await avaaLaulu(page, laulunPohja());
  const rivi = page.locator('.line').first();

  // Ennen muunnosta rivi on tavallinen sanoitusrivi.
  await expect(rivi.locator('.chord-row')).toHaveCount(1);
  await expect(rivi.locator('.bar-row')).toHaveCount(0);

  await teeSointurivi(page);
  await page.getByRole('button', { name: 'Cancel' }).click();

  await expect(rivi.locator('.bar-row')).toHaveCount(1);
  await expect(rivi.locator('.chord-row')).toHaveCount(0);
  await expect(rivi.locator('input.text')).toHaveCount(0);
});

test('tahteihin kirjoitetut soinnut näkyvät rivillä tahtiviivoin', async ({ page }) => {
  await avaaLaulu(page, laulunPohja());
  await teeSointurivi(page);

  await kirjoitaTahti(page, 'Am');
  await kirjoitaTahti(page, 'F');
  await kirjoitaTahti(page, 'C');
  await page.locator('.sheet input').fill('G');
  await page.getByRole('button', { name: 'Save' }).click();

  expect(await teksti(page.locator('.line').first().locator('.bar-row'))).toBe('| Am | F  | C  | G  |');
});

test('tahtiin mahtuu useampi sointu', async ({ page }) => {
  await avaaLaulu(page, laulunPohja());
  await teeSointurivi(page);

  // Oletuksena tahteja on neljä; täytetään kaksi ja jätetään kaksi tyhjäksi.
  await kirjoitaTahti(page, 'Am F');
  await page.locator('.sheet input').fill('C');
  await page.getByRole('button', { name: 'Save' }).click();

  expect(await teksti(page.locator('.line').first().locator('.bar-row'))).toBe(
    '| Am F | C    |      |      |',
  );
});

test('tahteja voi lisätä ja poistaa', async ({ page }) => {
  await avaaLaulu(page, laulunPohja());
  await teeSointurivi(page);

  await expect(page.locator('.nudge-info')).toContainText('bar 1/4');
  await page.getByRole('button', { name: '+ Bar' }).click();
  await expect(page.locator('.nudge-info')).toContainText('bar 2/5');
  await page.getByRole('button', { name: '− Bar' }).click();
  // Poisto vie valinnan seuraavaan tahtiin, ei alkuun.
  await expect(page.locator('.nudge-info')).toContainText('bar 2/4');
});

test('transponointi siirtää myös tahtien soinnut', async ({ page }) => {
  await avaaLaulu(page, laulunPohja());
  await teeSointurivi(page);
  await kirjoitaTahti(page, 'Am F');
  await page.locator('.sheet input').fill('C');
  await page.getByRole('button', { name: 'Save' }).click();

  await page.getByLabel('Up a semitone').click();
  await page.getByLabel('Up a semitone').click();

  // Molemmat saman tahdin soinnut nousevat, ei vain ensimmäinen.
  expect(await teksti(page.locator('.line').first().locator('.bar-row'))).toBe(
    '| Bm G | D    |      |      |',
  );
});

test('sointurivi näkyy tulostusnäkymässä ja live-tilassa', async ({ page }) => {
  await avaaLaulu(page, laulunPohja());
  await teeSointurivi(page);
  await kirjoitaTahti(page, 'Am');
  await page.locator('.sheet input').fill('F');
  await page.getByRole('button', { name: 'Save' }).click();

  await page.getByRole('button', { name: 'Live', exact: true }).click();
  expect(await teksti(page.locator('.live-view .sheet-bars').first())).toBe('| Am | F  |    |    |');
  await page.getByLabel('Exit live mode').click();

  await page.emulateMedia({ media: 'print' });
  expect(await teksti(page.locator('.song-sheet .sheet-bars').first())).toBe('| Am | F  |    |    |');
});

test('rivin soinnut siirtyvät tahdeiksi muunnettaessa', async ({ page }) => {
  // Sointuriviksi muunto neljälle tyhjälle tahdille pakotti kirjoittamaan
  // rivillä jo olevat soinnut uudelleen.
  await avaaLaulu(
    page,
    laulu({
      lines: [
        {
          id: 'v1',
          text: '',
          section: { kind: 'solo' },
          chords: [
            { id: 'c1', pos: 0, symbol: 'Am' },
            { id: 'c2', pos: 8, symbol: 'F' },
            { id: 'c3', pos: 16, symbol: 'C' },
          ],
        },
      ],
    }),
  );

  await teeSointurivi(page);
  await page.getByRole('button', { name: 'Save' }).click();

  expect(await teksti(page.locator('.bar-row'))).toBe('| Am | F  | C  |');
});

test('tyhjä rivi saa edelleen tyhjät tahdit', async ({ page }) => {
  await avaaLaulu(page, laulunPohja());
  await teeSointurivi(page);
  await page.getByRole('button', { name: 'Save' }).click();

  expect(await teksti(page.locator('.bar-row'))).toBe('|    |    |    |    |');
});

test('sointuvalinta lisää tahtiin toisen soinnun ensimmäistä hävittämättä', async ({ page }) => {
  await avaaLaulu(page, laulunPohja());
  await teeSointurivi(page);

  await page.locator('.sheet input').fill('Am');
  // Aiemmin valinta korvasi koko tahdin, joten toista sointua ei saanut lisättyä.
  await page.locator('.chip-row').getByRole('button', { name: 'F', exact: true }).click();
  await expect(page.locator('.sheet input')).toHaveValue('Am F');

  await page.getByRole('button', { name: 'Save' }).click();
  expect(await teksti(page.locator('.bar-row'))).toBe('| Am F |      |      |      |');
});

test('sointuvalinta täyttää tyhjän tahdin sellaisenaan', async ({ page }) => {
  await avaaLaulu(page, laulunPohja());
  await teeSointurivi(page);

  await page.locator('.chip-row').getByRole('button', { name: 'C', exact: true }).click();
  await expect(page.locator('.sheet input')).toHaveValue('C');
});

test('tahdin voi jakaa kahdeksi tahtiviivan kohdalta', async ({ page }) => {
  await avaaLaulu(page, laulunPohja());
  await teeSointurivi(page);

  await page.locator('.sheet input').fill('Am F');
  await page.getByRole('button', { name: 'Split bar' }).click();

  await page.getByRole('button', { name: 'Save' }).click();
  expect(await teksti(page.locator('.bar-row'))).toBe('| Am | F  |    |    |    |');
});

test('jakaminen on pois käytöstä kun tahdissa on yksi sointu', async ({ page }) => {
  await avaaLaulu(page, laulunPohja());
  await teeSointurivi(page);

  const jaa = page.getByRole('button', { name: 'Split bar' });
  await expect(jaa).toBeDisabled();

  await page.locator('.sheet input').fill('Am');
  await expect(jaa).toBeDisabled();

  await page.locator('.sheet input').fill('Am F');
  await expect(jaa).toBeEnabled();
});
