import { expect, test } from '@playwright/test';
import { avaaLaulu, laulu, osiot, PITKA_RIVI, vaakaYlivuoto } from './apu';

function pitkaLaulu() {
  return laulu({
    lines: [
      {
        id: 'l1',
        text: PITKA_RIVI,
        section: { kind: 'verse' },
        chords: [
          { id: 'c1', pos: 0, symbol: 'Am' },
          { id: 'c2', pos: 70, symbol: 'F#m7' },
        ],
      },
      { id: 'l2', text: 'lyhyt rivi', section: { kind: 'chorus' }, chords: [] },
    ],
  });
}

/*
 * Pitkä sointurivi on moninkertaisesti näyttöä leveämpi ja kuuluu vierittää
 * .lyrics-laatikon sisällä. Jos leveys karkaa sivulle, selain kasvattaa
 * asetteluikkunaa ja koko näkymä zoomautuu ulos.
 */
test('pitkä rivi ei levitä sivua', async ({ page }) => {
  await avaaLaulu(page, pitkaLaulu());
  expect(await vaakaYlivuoto(page)).toBeLessThanOrEqual(0);
});

test('sivu pysyy näytön levyisenä myös sointuponnahdus auki', async ({ page }) => {
  await avaaLaulu(page, pitkaLaulu());
  await page.locator('.chord', { hasText: 'F#m7' }).click();
  await expect(page.locator('.sheet')).toBeVisible();

  expect(await vaakaYlivuoto(page)).toBeLessThanOrEqual(0);
  const leveys = await page.evaluate(() => ({
    sheet: Math.round(document.querySelector('.sheet')!.getBoundingClientRect().width),
    vw: window.innerWidth,
  }));
  expect(leveys.sheet).toBe(leveys.vw);
});

/*
 * Varmistetaan suojaus eikä vain nykyistä mitoitusta: pakotetaan lohkot
 * sisältönsä levyisiksi, kuten jokin moottori voisi ne mitoittaa.
 */
for (const [nimi, css] of Object.entries({
  '.lyrics': '.lyrics { width: max-content; }',
  '.line-body': '.line-body { min-width: auto; width: max-content; }',
  'näkymän lohko': '.screen > * { flex: none; width: max-content; }',
})) {
  test(`sivu ei leviä vaikka ${nimi} mitoittuisi sisältönsä mukaan`, async ({ page }) => {
    await avaaLaulu(page, pitkaLaulu());
    await page.addStyleTag({ content: css });
    expect(await vaakaYlivuoto(page)).toBeLessThanOrEqual(0);
  });
}

test('pitkän rivin sisältö on saavutettavissa vierittämällä', async ({ page }) => {
  await avaaLaulu(page, pitkaLaulu());
  const vieritys = await page.evaluate(() => {
    const el = document.querySelector('.lyrics')!;
    el.scrollLeft = 99999;
    return { client: el.clientWidth, scroll: el.scrollWidth, left: Math.round(el.scrollLeft) };
  });
  expect(vieritys.scroll).toBeGreaterThan(vieritys.client);
  expect(vieritys.left).toBeGreaterThan(300);
});

test('yläpalkki pysyy kiinni vieritettäessä', async ({ page }) => {
  await avaaLaulu(page, pitkaLaulu());
  await page.evaluate(() => window.scrollTo(0, 400));
  const top = await page.evaluate(() => document.querySelector('.topbar')!.getBoundingClientRect().top);
  expect(Math.abs(top)).toBeLessThan(2);
});

test('osiorakenne renderöityy samoin kaikilla moottoreilla', async ({ page }) => {
  await avaaLaulu(page);
  await expect.poll(() => osiot(page)).toEqual(['Verse 1', 'Chorus', 'Verse 2']);
  expect(await vaakaYlivuoto(page)).toBeLessThanOrEqual(0);
});
