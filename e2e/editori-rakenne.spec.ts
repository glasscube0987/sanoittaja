/**
 * Editorin rakenne: laulun nimi kerran, rivilakanan järjestys ja rivin
 * toimintojen kuvake.
 */
import { expect, test } from '@playwright/test';
import { avaaLaulu, laulu } from './apu';

/*
 * Nimi oli editorissa kahdesti: yläpalkissa ja nimikentässä heti sen alla.
 * Palkin nimi näkyy nyt vasta kun nimikenttä on vierinyt palkin alle – pitkän
 * laulun keskellä nimi on silti aina ruudulla.
 */
test('laulun nimi on ruudulla kerran ja palkkiin kun kenttä vierii pois', async ({ page }) => {
  const rivit = Array.from({ length: 40 }, (_, i) => ({ id: `r${i}`, text: `rivi ${i}`, chords: [] }));
  await avaaLaulu(page, laulu({ lines: rivit }));
  const palkki = page.locator('.topbar .topbar-title');
  await expect(palkki).toHaveAttribute('aria-hidden', 'true');
  await expect.poll(() => palkki.evaluate((el) => getComputedStyle(el).opacity)).toBe('0');

  await page.evaluate(() => window.scrollTo(0, 600));
  await expect(palkki).toHaveAttribute('aria-hidden', 'false');
  await expect(palkki).toHaveText('Kuu valaisee');
  await expect.poll(() => palkki.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(palkki).toHaveAttribute('aria-hidden', 'true');
});

/*
 * Rivilakanassa asetukset tallennetaan ja toiminnot tapahtuvat heti. Tallennus
 * oli toimintojen alla, joten ei näkynyt kumpi tarvitsee tallennuksen.
 */
test('rivilakanan tallennus on asetusten alla ja toiminnot erillään', async ({ page }) => {
  await avaaLaulu(page);
  await page.locator('.line .section-mark').first().click();
  const lakana = page.getByRole('dialog');
  const jarjestys = await lakana.evaluate((el) => {
    const tallenna = [...el.querySelectorAll('button')].find((b) => b.textContent === 'Save')!;
    const toiminnot = el.querySelector('.sheet-actions')!;
    return {
      tallennusEnnenToimintoja: !!(tallenna.compareDocumentPosition(toiminnot) & Node.DOCUMENT_POSITION_FOLLOWING),
      poistoToiminnoissa: !!toiminnot.querySelector('button.danger'),
    };
  });
  expect(jarjestys).toEqual({ tallennusEnnenToimintoja: true, poistoToiminnoissa: true });
});
