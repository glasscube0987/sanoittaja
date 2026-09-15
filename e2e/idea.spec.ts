import { expect, test } from '@playwright/test';
import {
  avaaLista,
  laulujenNimet,
  mikkiAuki,
  nauhoitteet,
  vaakaYlivuoto,
  vaarennaMikrofoni,
} from './apu';

/**
 * Idean talteenotto: nauhoitus ilman laulua.
 *
 * Tärkein sääntö on järjestys – laulu syntyy vasta lopetuksesta – joten
 * peruutustesti on tämän tiedoston ydin eikä reunatapaus.
 *
 * **Nauhoitteen tallentumista kantaan ei voi tarkistaa WebKitissä.** Sen
 * väliaikainen istunto ei ota vastaan blobia lainkaan (`kanta-blob.spec.ts`
 * mittaa ja dokumentoi sen), joten kantatarkistukset ovat siellä ehdon takana.
 * Kaikki muu – lakanan avautuminen, peruutuksen tyhjä jälki, päiväysnimi,
 * kohdistussäännöt ja yläpalkin leveys – ajetaan molemmilla moottoreilla.
 */

const PAIVAYSNIMI = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;

test.beforeEach(async ({ page }) => {
  await vaarennaMikrofoni(page);
  await avaaLista(page);
});

test('yläpalkin mikrofoni nauhoittaa idean lauluksi', async ({ page, browserName }) => {
  await page.getByLabel('Record an idea').click();
  await expect(page.locator('.idea-elapsed')).toBeVisible();

  await page.getByRole('button', { name: 'Stop and save' }).click();

  // Editori aukeaa: nimenä on päiväys eikä tyhjä.
  const nimi = page.getByPlaceholder('Song title');
  await expect(nimi).toHaveValue(PAIVAYSNIMI);

  // Näppäimistö ei saa ponnahtaa esiin: käyttäjä tuli katsomaan mitä tallentui.
  await expect(nimi).not.toBeFocused();
  await expect(page.locator('.lyrics input').first()).not.toBeFocused();

  // Kanta ei ota vastaan blobia WebKitissä; ks. tiedoston yläkommentti.
  if (browserName !== 'webkit') {
    await expect
      .poll(() => nauhoitteet(page))
      .toEqual([expect.objectContaining({ name: expect.any(String) })]);
    const tallennetut = await nauhoitteet(page);
    expect(tallennetut[0].songId).not.toBe('testi');
  }

  expect(await laulujenNimet(page)).toHaveLength(2);
  expect(await mikkiAuki(page)).toBe(0);
});

test('peruutus ei luo laulua eikä nauhoitetta', async ({ page }) => {
  await page.getByLabel('Record an idea').click();
  await expect(page.locator('.idea-elapsed')).toBeVisible();

  await page.getByRole('button', { name: 'Cancel' }).click();

  // Lakana sulkeutuu ja lista jää näkyviin – editoriin ei siirrytä.
  await expect(page.locator('.idea-elapsed')).toHaveCount(0);
  await expect(page.locator('.song-card')).toHaveCount(1);

  expect(await laulujenNimet(page)).toEqual(['Kuu valaisee']);
  expect(await nauhoitteet(page)).toEqual([]);
  // Mikrofoni vapautuu myös peruutettaessa; muuten nauhoitusvalo jää palamaan.
  await expect.poll(() => mikkiAuki(page)).toBe(0);
});

test('luontilakanan rivi tekee saman kuin yläpalkin painike', async ({ page, browserName }) => {
  await page.getByRole('button', { name: '+ New song' }).click();
  // Rajattu lakanaan: sama teksti on myös yläpalkin painikkeen nimenä.
  await page.locator('.sheet').getByRole('button', { name: 'Record an idea' }).click();
  await expect(page.locator('.idea-elapsed')).toBeVisible();

  await page.getByRole('button', { name: 'Stop and save' }).click();

  await expect(page.getByPlaceholder('Song title')).toHaveValue(PAIVAYSNIMI);
  // Kanta ei ota vastaan blobia WebKitissä; ks. tiedoston yläkommentti.
  if (browserName !== 'webkit') expect(await nauhoitteet(page)).toHaveLength(1);
});

test('tyhjä laulu kohdistaa ensimmäisen rivin', async ({ page }) => {
  await page.getByRole('button', { name: '+ New song' }).click();
  await page.getByRole('button', { name: 'Blank song' }).click();

  await expect(page.locator('.lyrics input').first()).toBeFocused();
});

test('yläpalkki ei vuoda yli puhelimen leveydellä', async ({ page }) => {
  expect(await vaakaYlivuoto(page)).toBeLessThanOrEqual(0);

  await page.getByLabel('Record an idea').click();
  await expect(page.locator('.idea-elapsed')).toBeVisible();
  expect(await vaakaYlivuoto(page)).toBeLessThanOrEqual(0);
});
