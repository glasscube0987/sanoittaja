import { expect, test } from '@playwright/test';
import { avaaLaulu, laulu, PITKA_RIVI } from './apu';

/**
 * Soinnun sijainti lasketaan ch-yksiköllä, joka on elementin oman fontin
 * merkkileveys. Jos sointurivin ja sanoitusrivin fonttikoko eroaa, virhe kasvaa
 * rivin edetessä – merkin 70 kohdalla se oli aiemmin yli neljä merkkiä.
 */
test('soinnut pysyvät oikean merkin kohdalla myös pitkällä rivillä', async ({ page }) => {
  await avaaLaulu(
    page,
    laulu({
      lines: [
        {
          id: 'l1',
          text: PITKA_RIVI,
          section: { kind: 'verse' },
          chords: [0, 10, 30, 50, 70].map((pos, i) => ({ id: `c${i}`, pos, symbol: 'X' })),
        },
      ],
    }),
  );

  const virheet = await page.evaluate(() => {
    const line = document.querySelector('.line')!;
    const input = line.querySelector('input.text') as HTMLInputElement;
    const probe = document.createElement('span');
    probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${getComputedStyle(input).font}`;
    document.body.appendChild(probe);
    const tulos = [...line.querySelectorAll<HTMLElement>('.chord')].map((chord) => {
      const merkki = Number(/(\d+)ch/.exec(chord.style.left)![1]);
      probe.textContent = input.value.slice(0, merkki);
      const odotettu = input.getBoundingClientRect().left + probe.getBoundingClientRect().width;
      return chord.getBoundingClientRect().left - odotettu;
    });
    probe.remove();
    return tulos;
  });

  // Vakiosiirtymä sallitaan, ryömintä ei: virhe ei saa kasvaa rivin edetessä.
  const vaihtelu = Math.max(...virheet) - Math.min(...virheet);
  expect(vaihtelu, `kohdistusvirheet: ${virheet.map((v) => v.toFixed(1)).join(', ')}`).toBeLessThan(3);
});

test('sointua siirretään nuolinäppäimillä ja esikatselu seuraa mukana', async ({ page }) => {
  await avaaLaulu(page);
  await page.locator('.line').first().locator('.chord', { hasText: 'F' }).click();

  const info = page.locator('.nudge-info');
  await expect(info).toContainText('merkki 4/16');

  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(info).toContainText('merkki 6/16');
  // textContent suoraan, koska toHaveText normalisoi välit – ja juuri välien
  // määrä kertoo tässä soinnun sijainnin.
  const merkkirivi = await page.locator('.sheet .context .mark').evaluate((el) => el.textContent);
  expect(merkkirivi).toBe('      F');

  await page.keyboard.press('ArrowLeft');
  await expect(info).toContainText('merkki 5/16');
});

test('siirto pysähtyy rivin alkuun ja loppuun', async ({ page }) => {
  await avaaLaulu(page);
  await page.locator('.line').first().locator('.chord', { hasText: 'F' }).click();

  for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.nudge-info')).toContainText('merkki 0/16');

  for (let i = 0; i < 25; i++) await page.keyboard.press('ArrowRight');
  await expect(page.locator('.nudge-info')).toContainText('merkki 16/16');
});

test('siirretty sointu tallentuu uuteen kohtaan ilman kaksoiskappaletta', async ({ page }) => {
  await avaaLaulu(page);
  const rivi = page.locator('.line').first();
  await rivi.locator('.chord', { hasText: 'F' }).click();
  await page.keyboard.press('ArrowRight');
  await page.getByRole('button', { name: 'Tallenna' }).click();

  await expect(page.locator('.sheet')).toHaveCount(0);
  await expect(rivi.locator('.chord')).toHaveText(['Am', 'F']);
  await expect(rivi.locator('.chord').nth(1)).toHaveAttribute('style', /5ch/);
});

test('esikatselun sointumerkki pysyy näkyvissä pitkällä rivillä', async ({ page }) => {
  await avaaLaulu(
    page,
    laulu({
      lines: [
        {
          id: 'l1',
          text: PITKA_RIVI,
          section: { kind: 'verse' },
          chords: [{ id: 'c1', pos: 70, symbol: 'F#m7' }],
        },
      ],
    }),
  );
  await page.locator('.chord').first().click();

  const nakyy = () =>
    page.evaluate(() => {
      const box = document.querySelector('.context')!;
      const mark = box.querySelector('.mark span') as HTMLElement;
      return mark.offsetLeft >= box.scrollLeft && mark.offsetLeft + mark.offsetWidth <= box.scrollLeft + box.clientWidth;
    });

  expect(await nakyy()).toBe(true);
  for (let i = 0; i < 75; i++) await page.keyboard.press('ArrowLeft');
  expect(await nakyy()).toBe(true);
});
