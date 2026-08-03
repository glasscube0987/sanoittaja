import { expect, test, type Page } from '@playwright/test';
import { avaaLaulu, laulu, PITKA_RIVI } from './apu';

/** Riittävän pitkä laulu, jotta live-näkymässä on jotain vieritettävää. */
function pitkaLaulu() {
  return laulu({
    lines: Array.from({ length: 40 }, (_, i) => ({
      id: `l${i}`,
      text: `${i} ${PITKA_RIVI.slice(0, 30)}`,
      chords: [{ id: `c${i}`, pos: 0, symbol: 'Am' }],
      ...(i % 8 === 0 ? { section: { kind: 'verse' as const } } : {}),
    })),
  });
}

async function avaaLive(page: Page) {
  await avaaLaulu(page, pitkaLaulu());
  await page.getByRole('button', { name: 'Live', exact: true }).click();
  await expect(page.locator('.live-view')).toBeVisible();
}

const sijainti = (page: Page) => page.locator('.live-scroll').evaluate((el) => el.scrollTop);

test('live-tila näyttää laulun ja alkaa paikaltaan', async ({ page }) => {
  await avaaLive(page);
  await expect(page.locator('.live-view .song-sheet')).toBeVisible();
  expect(await sijainti(page)).toBe(0);
});

test('toisto vierittää näkymää ja tauko pysäyttää sen', async ({ page }) => {
  await avaaLive(page);
  await page.getByLabel('Play').click();

  await expect.poll(() => sijainti(page), { timeout: 5000 }).toBeGreaterThan(5);

  await page.getByLabel('Pause').click();
  const pysahtyi = await sijainti(page);
  await page.waitForTimeout(600);
  expect(await sijainti(page)).toBe(pysahtyi);
});

test('suurempi nopeus vierittää nopeammin', async ({ page }) => {
  await avaaLive(page);

  const mittaa = async () => {
    await page.locator('.live-scroll').evaluate((el) => (el.scrollTop = 0));
    await page.getByLabel('Play').click();
    await page.waitForTimeout(1200);
    await page.getByLabel('Pause').click();
    return sijainti(page);
  };

  const hidas = await mittaa();
  for (let i = 0; i < 6; i++) await page.getByLabel('Faster').click();
  const nopea = await mittaa();

  expect(nopea).toBeGreaterThan(hidas);
});

test('tekstikoon muutos säilyy live-tilaan palatessa', async ({ page }) => {
  await avaaLive(page);
  const koko = () =>
    page.locator('.live-scroll').evaluate((el) => getComputedStyle(el).fontSize);

  const alku = await koko();
  await page.getByLabel('Larger text').click();
  await page.getByLabel('Larger text').click();
  const suurennettu = await koko();
  expect(parseFloat(suurennettu)).toBeGreaterThan(parseFloat(alku));

  await page.getByLabel('Exit live mode').click();
  await expect(page.locator('.live-view')).toHaveCount(0);
  await page.getByRole('button', { name: 'Live', exact: true }).click();
  expect(await koko()).toBe(suurennettu);
});

test('näkymän napautus pysäyttää ja jatkaa', async ({ page }) => {
  await avaaLive(page);
  await page.getByLabel('Play').click();
  await expect.poll(() => sijainti(page), { timeout: 5000 }).toBeGreaterThan(5);

  // Esiintyessä ruutua napautetaan mihin tahansa, ei pieneen painikkeeseen.
  await page.locator('.live-scroll').click({ position: { x: 200, y: 400 } });
  const pysahtyi = await sijainti(page);
  await page.waitForTimeout(600);
  expect(await sijainti(page)).toBe(pysahtyi);
});

test('live-tilasta pääsee pois eikä editori jää taakse rikki', async ({ page }) => {
  await avaaLive(page);
  await page.getByLabel('Exit live mode').click();
  await expect(page.locator('.live-view')).toHaveCount(0);
  await expect(page.locator('.lyrics')).toBeVisible();
});
