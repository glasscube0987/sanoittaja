import { expect, test, type Page } from '@playwright/test';
import {
  avaaLista,
  kirjauduDropboxiin,
  kirjastoToiminto,
  laulu,
  paketti,
  tallennettuLaulu,
  vaarennaPilvikopiot,
} from './apu';

/**
 * Pilvestä haettu kopio yhdistetään – se ei korvaa kirjastoa.
 *
 * Erän ydin on turvasääntö: vanhempi versio ei saa ylikirjoittaa uudempaa.
 * Juuri se mekanismi hävitti työtä kahdella laitteella.
 */

async function avaaPilvi(page: Page) {
  await kirjauduDropboxiin(page);
  await kirjastoToiminto(page, 'To cloud');
  await expect(page.locator('.sheet')).toBeVisible();
}

/** Laulu «testi» muokattuna annettuun aikaan ja tekstiin. */
const versio = (text: string, updatedAt: number) =>
  laulu({ updatedAt, lines: [{ id: 'l1', text, chords: [] }] });

test('pilvestä haettu kopio listataan ja yhdistetään', async ({ page }) => {
  await vaarennaPilvikopiot(page, [
    { name: 'sanoittaja-varmuuskopio-2026-10-20-iPad-a3f1.json', sisalto: paketti(versio('iPadilta', 9)) },
  ]);
  await avaaLista(page, versio('puhelimesta', 5));
  await avaaPilvi(page);

  await page.getByRole('button', { name: 'Fetch from cloud' }).click();
  await expect(page.locator('.cloud-files button')).toHaveCount(1);
  await expect(page.locator('.cloud-file-name')).toContainText('iPad-a3f1');

  await page.locator('.cloud-files button').click();

  // Kopio on uudempi, joten se voittaa.
  await expect
    .poll(async () => JSON.parse(await tallennettuLaulu(page)).lines[0].text)
    .toBe('iPadilta');
});

/*
 * Koko erän ydin. Ilman turvasääntöä tuleva versio voittaisi aina, ja
 * puhelimessa myöhemmin tehty työ palautuisi vanhaan asuunsa.
 */
test('vanhempi kopio ei ylikirjoita uudempaa laulua', async ({ page }) => {
  await vaarennaPilvikopiot(page, [
    { name: 'sanoittaja-varmuuskopio-2026-10-20-iPad-a3f1.json', sisalto: paketti(versio('vanha iPadilta', 3)) },
  ]);
  await avaaLista(page, versio('uusi puhelimesta', 11));
  await avaaPilvi(page);

  await page.getByRole('button', { name: 'Fetch from cloud' }).click();
  await page.locator('.cloud-files button').click();

  // Status kertoo että jotain jätettiin tarkoituksella väliin.
  await expect(page.locator('.sheet .status').last()).toContainText('1');

  expect(JSON.parse(await tallennettuLaulu(page)).lines[0].text).toBe('uusi puhelimesta');
});

/*
 * Kirjautuminen voi olla voimassa ilman lukuoikeutta, koska vanha token ei saa
 * uusia lupia takautuvasti. Sen on näyttävä selvänä ohjeena eikä hiljaisena
 * epäonnistumisena.
 */
test('puuttuva lukuoikeus kerrotaan selvästi', async ({ page }) => {
  await vaarennaPilvikopiot(page, [], 403);
  await avaaLista(page);
  await avaaPilvi(page);

  await page.getByRole('button', { name: 'Fetch from cloud' }).click();

  await expect(page.locator('.sheet .status').last()).toContainText('Kirjaudu uudelleen');
  await expect(page.locator('.cloud-files')).toHaveCount(0);
});
