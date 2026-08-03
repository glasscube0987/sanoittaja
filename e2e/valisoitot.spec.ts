import { expect, test, type Locator, type Page } from '@playwright/test';
import { avaaLaulu, laulu } from './apu';

/*
 * Sanattomalla rivillä sointupaikka rajattiin aiemmin tekstin pituuteen, joka on
 * nolla — jokainen napautus osui paikkaan 0 ja korvasi edellisen soinnun, joten
 * välisoittoa ei voinut kirjoittaa lainkaan.
 */
function valisoittoLaulu() {
  return laulu({
    lines: [
      { id: 'v1', text: '', section: { kind: 'solo' }, chords: [] },
      { id: 'l1', text: 'sanoitettu rivi', section: { kind: 'verse' }, chords: [] },
    ],
  });
}

/** Avaa sointuponnahduksen tyhjästä kohdasta ja siirtää soinnun haluttuun sarakkeeseen. */
async function asetaSointu(page: Page, rivi: Locator, sarake: number, sointu: string) {
  // Napautus kauas oikealle osuu tyhjään kohtaan eikä jo asetettuun sointuun.
  await rivi.locator('.chord-row').click({ position: { x: 250, y: 12 } });
  await expect(page.locator('.sheet')).toBeVisible();

  const teksti = await page.locator('.nudge-info').innerText();
  const nyt = Number(/column (\d+)/.exec(teksti)![1]);
  const nappain = sarake > nyt ? 'ArrowRight' : 'ArrowLeft';
  for (let i = 0; i < Math.abs(sarake - nyt); i++) await page.keyboard.press(nappain);

  // Nimi kirjoitetaan kenttään: pikavalinnat näyttävät vain laulussa jo
  // käytetyt soinnut, joten haluttu sointu ei välttämättä ole niiden joukossa.
  await page.locator('.sheet input').fill(sointu);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.sheet')).toHaveCount(0);
}

test('sanattomalle riville voi asettaa useita sointuja', async ({ page }) => {
  await avaaLaulu(page, valisoittoLaulu());
  const rivi = page.locator('.line').first();

  await asetaSointu(page, rivi, 0, 'Am');
  await asetaSointu(page, rivi, 8, 'F');
  await asetaSointu(page, rivi, 16, 'C');

  await expect(rivi.locator('.chord')).toHaveText(['Am', 'F', 'C']);
  const sarakkeet = await rivi
    .locator('.chord')
    .evaluateAll((els) => els.map((el) => (el as HTMLElement).style.left));
  expect(sarakkeet).toEqual(['calc(0ch + 2px)', 'calc(8ch + 2px)', 'calc(16ch + 2px)']);
});

test('sarakeruudukko näkyy vain sanattomalla rivillä', async ({ page }) => {
  await avaaLaulu(page, valisoittoLaulu());
  await expect(page.locator('.line').first().locator('.chord-row .hint')).toHaveCount(1);
  await expect(page.locator('.line').nth(1).locator('.chord-row .hint')).toHaveCount(0);
});

test('ruudukon pisteet osuvat samoille sarakkeille kuin soinnut', async ({ page }) => {
  await avaaLaulu(page, valisoittoLaulu());
  const rivi = page.locator('.line').first();
  await asetaSointu(page, rivi, 8, 'F');

  const ero = await rivi.evaluate((el) => {
    const hint = el.querySelector('.hint') as HTMLElement;
    const chord = el.querySelector('.chord') as HTMLElement;
    // Ruudukon merkki 8 alkaa hintin vasemmasta reunasta kahdeksan merkin päässä.
    const probe = document.createElement('span');
    probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${getComputedStyle(hint).font}`;
    probe.textContent = '        ';
    document.body.appendChild(probe);
    const leveys = probe.getBoundingClientRect().width;
    probe.remove();
    return (
      chord.getBoundingClientRect().left - (hint.getBoundingClientRect().left + leveys)
    );
  });
  expect(Math.abs(ero)).toBeLessThan(2);
});

test('soinnun voi asettaa myös tekstin loppumisen jälkeen', async ({ page }) => {
  await avaaLaulu(page, valisoittoLaulu());
  const rivi = page.locator('.line').nth(1);
  // 'sanoitettu rivi' on 15 merkkiä; kierrosointu tulee sen jälkeen.
  await asetaSointu(page, rivi, 20, 'G');

  await expect(rivi.locator('.chord')).toHaveText(['G']);
  await expect(rivi.locator('.chord')).toHaveAttribute('style', /20ch/);
});
