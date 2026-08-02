import { expect, test } from '@playwright/test';
import { avaaLaulu } from './apu';

/*
 * iOS suurentaa näkymän kun tekstikenttään kohdistetaan, jos kenttä on sen
 * mielestä liian pieni – eikä palauta zoomia kentästä poistuttaessa. Nämä
 * testit vartioivat ehtoja, joilla zoom laukeaa. Itse zoomausta ne eivät voi
 * havaita: se on iOS-Safarin käyttöliittymäkäytös, ei asia jonka moottori
 * paljastaisi työpöytäselaimessa.
 */

test('yksikään kenttä ei alita 16px', async ({ page }) => {
  await avaaLaulu(page);
  await page.locator('.chord').first().click();
  await expect(page.locator('.sheet')).toBeVisible();

  const pienet = await page.evaluate(() =>
    [...document.querySelectorAll('input, textarea, select')]
      .map((el) => ({
        tunnus: el.className || (el as HTMLInputElement).placeholder || el.tagName,
        px: parseFloat(getComputedStyle(el).fontSize),
      }))
      .filter((f) => f.px < 16),
  );
  expect(pienet).toEqual([]);
});

test('sointuponnahdus ei kohdista tekstikenttään', async ({ page }) => {
  await avaaLaulu(page);
  await page.locator('.chord').first().click();
  await expect(page.locator('.sheet')).toBeVisible();

  // Kenttään kohdistaminen avaisi näppäimistön ja laukaisisi iOS:n zoomin.
  const aktiivinen = await page.evaluate(() => document.activeElement?.tagName ?? '');
  expect(aktiivinen).not.toBe('INPUT');
  expect(aktiivinen).toBe('FORM');
});

test('kenttään voi silti kirjoittaa napauttamalla ja Enter tallentaa', async ({ page }) => {
  await avaaLaulu(page);
  const rivi = page.locator('.line').first();
  await rivi.locator('.chord', { hasText: 'F' }).click();

  await page.locator('.sheet input').click();
  await page.locator('.sheet input').fill('Dm7');
  await page.keyboard.press('Enter');

  await expect(page.locator('.sheet')).toHaveCount(0);
  await expect(rivi.locator('.chord')).toHaveText(['Am', 'Dm7']);
});

/*
 * Se, kummalle haaralle viewport asettuu, riippuu selaimen tunnistuksesta ja
 * on katettu yksikkötesteissä (src/lib/iosZoom.test.ts). Täällä varmistetaan
 * vain, että meta on olemassa ja perusasetukset säilyvät haarasta riippumatta.
 */
test('viewport-meta säilyttää perusasetukset', async ({ page }) => {
  await avaaLaulu(page);
  const content = await page.getAttribute('meta[name="viewport"]', 'content');

  expect(content).toContain('width=device-width');
  expect(content).toContain('initial-scale=1.0');
  expect(content).toContain('viewport-fit=cover');
});
