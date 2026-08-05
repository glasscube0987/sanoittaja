/**
 * Tablettiasettelu. Muut testit ajetaan puhelimen koolla, joten ilman näitä
 * isolla näytöllä ei olisi lainkaan katetta – ja juuri asetteluvirheet ovat
 * niitä, jotka näkyvät vain tietyllä leveydellä.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { avaaLaulu, avaaLista, laulu, PITKA_RIVI, vaakaYlivuoto } from './apu';

/** iPad Pro 11" pystyasennossa. */
test.use({ viewport: { width: 1024, height: 1366 } });

const leveys = (page: Page, valitsin: string) =>
  page.locator(valitsin).evaluate((el) => el.getBoundingClientRect().width);

test('palsta levenee isolla näytöllä', async ({ page }) => {
  await avaaLaulu(page);
  // Puhelinasettelun 720 px jättäisi tabletilla kolmanneksen näytöstä tyhjäksi.
  expect(await leveys(page, '.lyrics')).toBeGreaterThan(850);
});

test('pitkä rivi mahtuu näkyviin ilman vaakavieritystä', async ({ page }) => {
  await avaaLaulu(page, laulu({ lines: [{ id: 'l1', text: PITKA_RIVI, chords: [] }] }));

  // Sama rivi vaatii puhelimella vierittämistä; tässä on juuri se hyöty,
  // jonka vuoksi palstaa kannattaa leventää.
  const tila = await page.locator('.lyrics').evaluate((el) => ({
    sisalto: el.scrollWidth,
    nakyva: el.clientWidth,
  }));
  expect(tila.sisalto).toBeLessThanOrEqual(tila.nakyva);
});

test('sivu ei leviä näyttöä leveämmäksi', async ({ page }) => {
  await avaaLaulu(page, laulu({ lines: [{ id: 'l1', text: PITKA_RIVI, chords: [] }] }));
  expect(await vaakaYlivuoto(page)).toBeLessThanOrEqual(0);
});

test('laululista on käytettävissä tabletilla', async ({ page }) => {
  await avaaLista(page);
  await expect(page.getByRole('button', { name: '+ New song' })).toBeVisible();
  await expect(page.locator('.song-card')).toBeVisible();
  expect(await vaakaYlivuoto(page)).toBeLessThanOrEqual(0);
});

test('ponnahdus pysyy luettavan levyisenä eikä veny näytön yli', async ({ page }) => {
  await avaaLaulu(page);
  await page.locator('.chord-row .chord').first().click();

  const sheet = await leveys(page, '.sheet');
  // Ponnahdus ei seuraa palstan leveyttä: liian leveä lomake on hankalampi
  // käyttää kuin kapea, ja painikkeet karkaisivat toisistaan.
  expect(sheet).toBeLessThanOrEqual(720);
  expect(await vaakaYlivuoto(page)).toBeLessThanOrEqual(0);
});

test('live-tila käyttää koko näytön leveyden', async ({ page }) => {
  await avaaLaulu(page);
  await page.getByRole('button', { name: 'Live', exact: true }).click();

  const live = await leveys(page, '.live-view');
  expect(live).toBe(1024);
});
