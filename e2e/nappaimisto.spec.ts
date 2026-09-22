import { expect, test, type Page } from '@playwright/test';
import { avaaLaulu } from './apu';

/**
 * Näppäimistö ei saa peittää live-tilan työkalupalkkia.
 *
 * iOS ei kutista asetteluikkunaa näppäimistön auetessa, joten `position: fixed`
 * -näkymä jää sen alle – ja sen mukana rivi, jolla tekstikenttä poistetaan.
 * Oikeaa näppäimistöä ei voi avata työpöytäselaimessa, joten `visualViewport`
 * väärennetään: testattava asia on se mitä sovellus tekee kutistuneelle
 * näkyvälle alueelle, ei se milloin iOS kutistaa sen.
 */
async function vaarennaNakyvaAlue(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const kuuntelijat = new Map<string, Set<() => void>>();
    const alue = {
      height: window.innerHeight,
      offsetTop: 0,
      addEventListener: (nimi: string, fn: () => void) => {
        if (!kuuntelijat.has(nimi)) kuuntelijat.set(nimi, new Set());
        kuuntelijat.get(nimi)!.add(fn);
      },
      removeEventListener: (nimi: string, fn: () => void) => kuuntelijat.get(nimi)?.delete(fn),
    };
    Object.defineProperty(window, 'visualViewport', { value: alue, configurable: true });
    (window as unknown as { __nappaimisto: (korkeus: number) => void }).__nappaimisto = (
      korkeus: number,
    ) => {
      alue.height = window.innerHeight - korkeus;
      kuuntelijat.get('resize')?.forEach((fn) => fn());
    };
  });
}

/** Avaa näppäimistön väärennetyllä korkeudella. */
const avaaNappaimisto = (page: Page, korkeus: number) =>
  page.evaluate(
    (h) => (window as unknown as { __nappaimisto: (k: number) => void }).__nappaimisto(h),
    korkeus,
  );

test('työkalupalkki nousee näppäimistön yläpuolelle', async ({ page }) => {
  await vaarennaNakyvaAlue(page);
  await avaaLaulu(page);
  await page.getByRole('button', { name: 'Live', exact: true }).click();

  const palkki = page.locator('.live-bar');
  const ennen = (await palkki.boundingBox())!;
  const korkeus = await page.evaluate(() => window.innerHeight);
  expect(ennen.y + ennen.height).toBeGreaterThan(korkeus - 5);

  await avaaNappaimisto(page, 300);

  const jalkeen = (await palkki.boundingBox())!;
  // Palkin alareuna on nyt näppäimistön yläpuolella eikä sen alla.
  expect(jalkeen.y + jalkeen.height).toBeLessThanOrEqual(korkeus - 300 + 1);
});

test('tekstikentän roskakori on ulottuvilla näppäimistön kanssa', async ({ page }) => {
  await vaarennaNakyvaAlue(page);
  /* Osoittimen kaappaus vaatii oikean osoittimen; testissä se ohitetaan. */
  await page.addInitScript(() => {
    Element.prototype.setPointerCapture = () => {};
  });
  await avaaLaulu(page);
  await page.getByRole('button', { name: 'Live', exact: true }).click();
  await expect(page.locator('.live-view')).toBeVisible();

  await page.getByLabel('Draw on the sheet').click();
  await page.getByRole('button', { name: 'Text', exact: true }).click();
  await expect(page.locator('.draw-attrs')).toBeVisible();

  // Kosketus päällimmäiselle elementille, ei valitulle: kerros valitaan
  // elementFromPointilla kuten oikeassakin kosketuksessa.
  await page.evaluate(() => {
    const el = document.elementFromPoint(120, 200) as HTMLElement;
    el.setPointerCapture = () => {};
    el.dispatchEvent(
      new PointerEvent('pointerdown', {
        pointerId: 1,
        pointerType: 'touch',
        clientX: 120,
        clientY: 200,
        buttons: 1,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await page.locator('.annot-text.editing').waitFor();

  await avaaNappaimisto(page, 300);

  const roskakori = page.getByLabel('Delete text');
  const laatikko = (await roskakori.boundingBox())!;
  const korkeus = await page.evaluate(() => window.innerHeight);
  expect(laatikko.y + laatikko.height).toBeLessThanOrEqual(korkeus - 300 + 1);

  // Ja se poistaa kentän.
  await roskakori.click();
  await expect(page.locator('.annot-text')).toHaveCount(0);
});
