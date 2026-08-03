/**
 * Kuvakepainikkeiden koko ja selkeys. Tekstisymbolit (§, ↶, ⚙︎) jäivät
 * puhelimessa pieniksi ja himmeiksi; nämä testit pitävät huolen ettei
 * kosketusalue pääse kutistumaan takaisin.
 */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { avaaLaulu, avaaLista } from './apu';

/** Applen ja Googlen ohjeistama vähimmäiskoko kosketuskohteelle. */
const MIN_KOSKETUS = 44;

async function koko(nappi: Locator): Promise<{ w: number; h: number }> {
  const laatikko = await nappi.boundingBox();
  if (!laatikko) throw new Error('painike ei ole näkyvissä');
  return { w: laatikko.width, h: laatikko.height };
}

/** Kuvake on piirretty, ei kirjasimen varassa. */
async function onSvgKuvake(nappi: Locator): Promise<boolean> {
  return (await nappi.locator('svg.icon').count()) > 0;
}

test('laululistan asetuspainike on riittävän suuri ja piirretty', async ({ page }) => {
  await avaaLista(page);
  const asetukset = page.getByLabel('Settings');

  expect(await onSvgKuvake(asetukset)).toBe(true);
  const { w, h } = await koko(asetukset);
  expect(w).toBeGreaterThanOrEqual(MIN_KOSKETUS);
  expect(h).toBeGreaterThanOrEqual(MIN_KOSKETUS);
});

test('editorin yläpalkin painikkeet ovat riittävän suuria', async ({ page }) => {
  await avaaLaulu(page);

  for (const nimi of ['Songs', 'Undo']) {
    const nappi = page.getByLabel(nimi);
    expect(await onSvgKuvake(nappi), `${nimi} on piirretty kuvake`).toBe(true);
    const { w, h } = await koko(nappi);
    expect(w, `${nimi} leveys`).toBeGreaterThanOrEqual(MIN_KOSKETUS);
    expect(h, `${nimi} korkeus`).toBeGreaterThanOrEqual(MIN_KOSKETUS);
  }
});

test('soinnun siirtopainikkeet ovat riittävän suuria', async ({ page }) => {
  await avaaLaulu(page);
  await page.locator('.chord-row .chord').first().click();

  for (const nimi of ['Move one character left', 'Move one character right']) {
    const nappi = page.getByLabel(nimi);
    expect(await onSvgKuvake(nappi)).toBe(true);
    const { h } = await koko(nappi);
    expect(h, `${nimi} korkeus`).toBeGreaterThanOrEqual(MIN_KOSKETUS);
  }
});

test('rivin asetuspainike erottuu taustastaan', async ({ page }) => {
  await avaaLaulu(page);
  // Merkitty osio piirtyy korostusvärillä; heikoin tapaus on merkitsemätön rivi.
  const merkki = page.locator('.line .section-mark:not(.set)').first();
  expect(await onSvgKuvake(merkki)).toBe(true);

  // Aiemmin merkin väri oli sama kuin reunaviivan: käytännössä näkymätön
  // tummalla pinnalla. Mitataan todellinen kontrasti eikä pelkkä värien ero.
  const suhde = await merkki.evaluate((el) => {
    const luvut = (v: string) => (v.match(/[\d.]+/g) ?? []).map(Number);
    const tyyli = getComputedStyle(el);
    const [r, g, b] = luvut(tyyli.color);
    const peite = Number(tyyli.opacity);
    const tausta = luvut(getComputedStyle(document.querySelector('.lyrics')!).backgroundColor);

    // Läpinäkyvä kuvake sekoittuu taustaansa; kontrasti lasketaan sekoituksesta.
    const sekoitus = [r, g, b].map((k, i) => k * peite + tausta[i] * (1 - peite));
    const kirkkaus = (kanavat: number[]) => {
      const [lr, lg, lb] = kanavat.map((k) => {
        const s = k / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
    };
    const a = kirkkaus(sekoitus);
    const t = kirkkaus(tausta);
    return (Math.max(a, t) + 0.05) / (Math.min(a, t) + 0.05);
  });

  // WCAG:n raja käyttöliittymäkuvakkeille.
  expect(suhde).toBeGreaterThanOrEqual(3);
});

test('kuvakkeet eivät levitä sivua', async ({ page }: { page: Page }) => {
  await avaaLaulu(page);
  const ylivuoto = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(ylivuoto).toBeLessThanOrEqual(0);
});
