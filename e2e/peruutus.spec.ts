import { expect, test } from '@playwright/test';
import { avaaLaulu, laulu, tallennettuLaulu } from './apu';

function sanoituslaulu() {
  return laulu({
    lines: [
      {
        id: 'l1',
        text: 'kuu valaisee yön',
        section: { kind: 'verse' },
        chords: [{ id: 'c1', pos: 4, symbol: 'Am' }],
      },
    ],
  });
}

const rivinTeksti = (page: import('@playwright/test').Page) =>
  page.locator('.line input.text').first().inputValue();

/*
 * Käyttäjän kokema tilanne: rivi muuttui vahingossa sointuriviksi ja sanat
 * katosivat. Muunnos ei enää hävitä niitä, ja peruutus palauttaa rivin.
 */
test('sanat palaavat kun sointurivi muutetaan takaisin sanoitusriviksi', async ({ page }) => {
  await avaaLaulu(page, sanoituslaulu());
  const rivi = page.locator('.line').first();

  await rivi.getByLabel('Line settings').click();
  await page.getByRole('button', { name: 'Chord bars', exact: true }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(rivi.locator('.bar-row')).toHaveCount(1);

  await rivi.getByLabel('Line settings').click();
  await page.getByRole('button', { name: 'Lyrics', exact: true }).click();
  await page.getByRole('button', { name: 'Save' }).click();

  expect(await rivinTeksti(page)).toBe('kuu valaisee yön');
  await expect(rivi.locator('.chord')).toHaveText(['Am']);
});

test('peruutus kumoaa vahingossa tehdyn sointurivimuunnoksen', async ({ page }) => {
  await avaaLaulu(page, sanoituslaulu());
  const rivi = page.locator('.line').first();

  await rivi.getByLabel('Line settings').click();
  await page.getByRole('button', { name: 'Chord bars', exact: true }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(rivi.locator('.bar-row')).toHaveCount(1);

  await page.getByLabel('Undo').click();

  await expect(rivi.locator('.bar-row')).toHaveCount(0);
  expect(await rivinTeksti(page)).toBe('kuu valaisee yön');
});

test('peruutuspainike on pois käytöstä kunnes jotain on muutettu', async ({ page }) => {
  await avaaLaulu(page, sanoituslaulu());
  const undo = page.getByLabel('Undo');
  await expect(undo).toBeDisabled();

  await page.getByLabel('Up a semitone').click();
  await expect(undo).toBeEnabled();

  await undo.click();
  await expect(page.locator('.line').first().locator('.chord')).toHaveText(['Am']);
  await expect(undo).toBeDisabled();
});

test('peruutus on käytettävissä ilman rullausta', async ({ page }) => {
  await avaaLaulu(page, laulu({ lines: Array.from({ length: 40 }, (_, i) => ({ id: `l${i}`, text: `rivi ${i}`, chords: [] })) }));
  await page.getByLabel('Up a semitone').click();
  await page.evaluate(() => window.scrollTo(0, 900));

  const nakyy = await page.getByLabel('Undo').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= window.innerHeight && r.width > 0;
  });
  expect(nakyy).toBe(true);
});

test('kirjoittaminen peruuntuu kerralla eikä kirjain kerrallaan', async ({ page }) => {
  await avaaLaulu(page, sanoituslaulu());
  const kentta = page.locator('.line input.text').first();

  await kentta.click();
  await kentta.press('End');
  await kentta.pressSequentially(' ja tie', { delay: 30 });
  expect(await rivinTeksti(page)).toBe('kuu valaisee yön ja tie');

  await page.getByLabel('Undo').click();
  // Yksi peruutus vie koko kirjoitusrupeaman alkuun, ei yhtä merkkiä taaksepäin.
  expect(await rivinTeksti(page)).toBe('kuu valaisee yön');
});

test('peruutus ei jätä kantaan peruutettua tilaa', async ({ page }) => {
  await avaaLaulu(page, sanoituslaulu());
  await page.getByLabel('Up a semitone').click();
  await page.getByLabel('Undo').click();

  // Odottava tallennus sisälsi peruutetun tilan; jos sitä ei peruta, se
  // kirjoittuisi kantaan hetkeä myöhemmin ja peruutus kumoutuisi itsestään.
  await page.waitForTimeout(700);
  const tallennettu = await tallennettuLaulu(page);
  expect(tallennettu).toContain('"symbol":"Am"');
  expect(tallennettu).not.toContain('"symbol":"Bm"');
});

/*
 * Yläpalkki on position: sticky; top: 0, joten vieritettäessä se tarttuu
 * näkymän yläreunaan – #root-elementin turva-aluetäytön yläpuolelle.
 * iPhonella se jäi kameran ja tilapalkin taakse. Turva-alue emuloidaan
 * oikeasti eikä tarkisteta pelkkää CSS-tekstiä.
 */
test('yläpalkki pysyy kameran ja tilapalkin alapuolella vieritettäessä', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'turva-alueen emulointi on Chromium-kohtainen');
  await avaaLaulu(
    page,
    laulu({ lines: Array.from({ length: 40 }, (_, i) => ({ id: `l${i}`, text: `rivi ${i}`, chords: [] })) }),
  );

  const YLAREUNA = 59;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: YLAREUNA } });

  // Turva-alue on nyt palkin omassa täytössä, joten se on voimassa sekä ennen
  // vieritystä että sen jälkeen.
  const alussa = await page.getByLabel('Undo').boundingBox();
  expect(alussa!.y, 'ennen vieritystä').toBeGreaterThanOrEqual(YLAREUNA);

  await page.evaluate(() => window.scrollTo(0, 900));
  const vieritettyna = await page.getByLabel('Undo').boundingBox();
  expect(vieritettyna!.y, 'vieritettynä').toBeGreaterThanOrEqual(YLAREUNA);
});

test('laululistan yläpalkki pysyy kameran alapuolella', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'turva-alueen emulointi on Chromium-kohtainen');
  await avaaLaulu(page);
  await page.getByLabel('Songs').click();

  const YLAREUNA = 59;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: YLAREUNA } });

  const asetukset = await page.getByLabel('Settings').boundingBox();
  expect(asetukset!.y).toBeGreaterThanOrEqual(YLAREUNA);
});
