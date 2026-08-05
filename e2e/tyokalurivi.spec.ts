/**
 * Rivin työkalurivi: näkyy kirjoitettaessa siinä missä työskennellään, ja
 * toimii ensimmäisellä napautuksella. Jälkimmäinen on koko ominaisuuden
 * ratkaiseva kohta – painallus veisi kohdistuksen kentältä, jolloin rivi
 * katoaisi napautuksen alta eikä painike laukeaisi koskaan.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { avaaLaulu, laulu } from './apu';

function rivit(page: Page): Promise<string[]> {
  return page.$$eval('.line input.text', (els) => els.map((e) => (e as HTMLInputElement).value));
}

test('työkalurivi ilmestyy kirjoitettavan rivin alle', async ({ page }) => {
  await avaaLaulu(page);
  await expect(page.locator('.line-tools')).toHaveCount(0);

  await page.locator('.line input.text').nth(1).click();
  await expect(page.locator('.line-tools')).toHaveCount(1);

  // Työkalut ovat sen rivin alla, jota muokataan.
  const omistaja = await page
    .locator('.line-tools')
    .evaluate((el) => el.closest('.line')!.querySelector('input.text')!.getAttribute('value'));
  expect(omistaja).not.toBeNull();
});

test('työkalurivi katoaa kun kohdistus poistuu', async ({ page }) => {
  await avaaLaulu(page);
  await page.locator('.line input.text').first().click();
  await expect(page.locator('.line-tools')).toHaveCount(1);

  // Näppäimistön sulkeminen näkyy sovellukselle kohdistuksen katoamisena.
  await page.locator('.line input.text').first().blur();
  await expect(page.locator('.line-tools')).toHaveCount(0);
});

test('työkalurivin painike toimii ensimmäisellä napautuksella', async ({ page }) => {
  await avaaLaulu(page);
  const ennen = await rivit(page);

  await page.locator('.line input.text').nth(1).click();
  await page.locator('.line-tools').getByRole('button', { name: '+ Line' }).click();

  // Rivi syntyy heti; ilman kohdistuksen säilytystä tässä ei tapahtuisi mitään.
  await expect.poll(() => rivit(page)).toHaveLength(ennen.length + 1);
});

test('rivi lisätään kohdistetun rivin perään eikä laulun loppuun', async ({ page }) => {
  await avaaLaulu(page);
  await page.locator('.line input.text').nth(1).click();
  await page.locator('.line-tools').getByRole('button', { name: '+ Line' }).click();

  await expect.poll(() => rivit(page)).toEqual([
    'kuu valaisee yön',
    'ja tie vie pohjoiseen',
    '',
    'älä katso taakse',
    'aamu tulee kohta',
    'toinen säkeistö tässä',
  ]);
});

test('uusi rivi saa kohdistuksen ja työkalut seuraavat mukana', async ({ page }) => {
  await avaaLaulu(page);
  await page.locator('.line input.text').first().click();
  await page.locator('.line-tools').getByRole('button', { name: '+ Line' }).click();

  await page.keyboard.type('kirjoitettu suoraan');
  await expect.poll(() => rivit(page)).toEqual([
    'kuu valaisee yön',
    'kirjoitettu suoraan',
    'ja tie vie pohjoiseen',
    'älä katso taakse',
    'aamu tulee kohta',
    'toinen säkeistö tässä',
  ]);
});

test('kumoaminen onnistuu työkaluriviltä', async ({ page }) => {
  await avaaLaulu(page);
  await page.locator('.line input.text').nth(1).click();
  await page.locator('.line-tools').getByRole('button', { name: '+ Line' }).click();
  await expect.poll(() => rivit(page)).toHaveLength(6);

  await page.locator('.line-tools').getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => rivit(page)).toHaveLength(5);
});

test('kumoaminen on pois käytöstä kun peruutettavaa ei ole', async ({ page }) => {
  await avaaLaulu(page);
  await page.locator('.line input.text').first().click();
  await expect(page.locator('.line-tools').getByRole('button', { name: 'Undo' })).toBeDisabled();
});

test('liitetty teksti menee kohdistetun rivin perään', async ({ page }) => {
  await avaaLaulu(page);
  await page.locator('.line input.text').first().click();
  await page.locator('.line-tools').getByRole('button', { name: 'Paste text' }).click();

  await page.locator('.import-input').fill(['G', 'liitetty rivi'].join('\n'));
  await page.getByRole('button', { name: 'Add to song' }).click();

  await expect.poll(() => rivit(page)).toEqual([
    'kuu valaisee yön',
    'liitetty rivi',
    'ja tie vie pohjoiseen',
    'älä katso taakse',
    'aamu tulee kohta',
    'toinen säkeistö tässä',
  ]);
});

test('alalaidan liittäminen lisää edelleen laulun loppuun', async ({ page }) => {
  await avaaLaulu(page);
  await page.locator('.editor-actions').getByRole('button', { name: 'Paste text' }).click();
  await page.locator('.import-input').fill('viimeinen rivi');
  await page.getByRole('button', { name: 'Add to song' }).click();

  await expect
    .poll(async () => {
      const kaikki = await rivit(page);
      return kaikki[kaikki.length - 1];
    })
    .toBe('viimeinen rivi');
});

test('sointurivillä ei ole työkaluriviä', async ({ page }) => {
  // Sointurivillä ei ole tekstikenttää eikä siten kohdistusta.
  await avaaLaulu(page, laulu({ lines: [{ id: 'b1', text: '', chords: [], bars: ['Am', 'F'] }] }));
  await page.locator('.bar-row').click();
  await expect(page.locator('.line-tools')).toHaveCount(0);
});

test('työkalu toimii vaikka kohdistus katoaisi ennen napautusta', async ({ page }) => {
  await avaaLaulu(page);
  await page.locator('.line input.text').nth(1).click();
  await page.getByLabel('Up a semitone').click();
  await page.locator('.line input.text').nth(1).click();

  // iOS ei noudata pointerdownin preventDefaultia, joten kohdistus katoaa
  // ennen kuin napautus ehtii perille. Sama järjestys pakotetaan tässä.
  await page.locator('.line input.text').nth(1).evaluate((el: HTMLInputElement) => el.blur());
  await page.locator('.line-tools').getByRole('button', { name: 'Undo' }).click();

  await expect(page.locator('.line .chord').first()).toHaveText('Am');
});

test('kumoaminen jättää työkalut näkyviin toistoa varten', async ({ page }) => {
  await avaaLaulu(page);
  await page.locator('.line input.text').nth(1).click();
  await page.getByLabel('Up a semitone').click();
  await page.getByLabel('Up a semitone').click();

  await page.locator('.line-tools').getByRole('button', { name: 'Undo' }).click();
  // Ilman kohdistuksen palautusta rivi olisi kadonnut ja riviä pitäisi
  // napauttaa uudelleen ennen seuraavaa kumoamista.
  await expect(page.locator('.line-tools')).toHaveCount(1);

  await page.locator('.line-tools').getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('.line .chord').first()).toHaveText('Am');
});
