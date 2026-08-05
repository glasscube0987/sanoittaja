import { expect, test } from '@playwright/test';
import { avaaLaulu, laulu, osiot } from './apu';

test('osiot nimetään ja toistuvat lajit numeroidaan', async ({ page }) => {
  await avaaLaulu(page);
  await expect.poll(() => osiot(page)).toEqual(['Verse 1', 'Chorus', 'Verse 2']);
});

test('osion siirto vie koko rivilohkon mukanaan', async ({ page }) => {
  await avaaLaulu(page);
  await page.getByLabel('Move section Chorus down').click();

  await expect.poll(() => osiot(page)).toEqual(['Verse 1', 'Verse 2', 'Chorus']);
  const rivit = await page.$$eval('.line input.text', (els) =>
    els.map((e) => (e as HTMLInputElement).value),
  );
  expect(rivit.slice(2)).toEqual(['toinen säkeistö tässä', 'älä katso taakse', 'aamu tulee kohta']);
});

test('siirto laulun reunan yli on estetty', async ({ page }) => {
  await avaaLaulu(page);
  await expect(page.getByLabel('Move section Verse 1 up')).toBeDisabled();
  await expect(page.getByLabel('Move section Verse 2 down')).toBeDisabled();
});

test('osion kopio syntyy alkuperäisen perään ja numeroituu', async ({ page }) => {
  await avaaLaulu(page);
  await page.getByLabel('Duplicate section Chorus').click();

  await expect.poll(() => osiot(page)).toEqual(['Verse 1', 'Chorus 1', 'Chorus 2', 'Verse 2']);

  // Kertosäkeen molemmat rivit kopioituvat, eivät vain ensimmäinen.
  const rivit = await page.$$eval('.line input.text', (els) =>
    els.map((e) => (e as HTMLInputElement).value),
  );
  expect(rivit).toEqual([
    'kuu valaisee yön',
    'ja tie vie pohjoiseen',
    'älä katso taakse',
    'aamu tulee kohta',
    'älä katso taakse',
    'aamu tulee kohta',
    'toinen säkeistö tässä',
  ]);
});

test('kopiointi kumoutuu yhdellä peruutuksella', async ({ page }) => {
  await avaaLaulu(page);
  await page.getByLabel('Duplicate section Chorus').click();
  await expect.poll(() => osiot(page)).toHaveLength(4);

  await page.getByLabel('Undo').click();
  await expect.poll(() => osiot(page)).toEqual(['Verse 1', 'Chorus', 'Verse 2']);
});

test('kopioidun osion muokkaus ei muuta alkuperäistä', async ({ page }) => {
  await avaaLaulu(page);
  await page.getByLabel('Duplicate section Chorus').click();
  await expect.poll(() => osiot(page)).toHaveLength(4);

  // Kopion ensimmäinen rivi on neljäs rivi; alkuperäinen on kolmas.
  await page.locator('.line input.text').nth(4).fill('älä katso eteen');

  const rivit = await page.$$eval('.line input.text', (els) =>
    els.map((e) => (e as HTMLInputElement).value),
  );
  expect(rivit[2]).toBe('älä katso taakse');
  expect(rivit[4]).toBe('älä katso eteen');
});

test('rivin voi merkitä osioksi ja osio syntyy oikeaan kohtaan', async ({ page }) => {
  await avaaLaulu(page);
  await page.locator('.line').nth(1).getByLabel('Line settings').click();
  await page.getByRole('button', { name: 'Bridge', exact: true }).click();
  await page.getByRole('button', { name: 'Save' }).click();

  await expect.poll(() => osiot(page)).toEqual(['Verse 1', 'Bridge', 'Chorus', 'Verse 2']);
});

test('rivin voi poistaa rivin asetuksista', async ({ page }) => {
  await avaaLaulu(page);
  await page.locator('.line').nth(1).getByLabel('Line settings').click();
  await page.getByRole('button', { name: 'Delete line' }).click();

  const rivit = await page.$$eval('.line input.text', (els) =>
    els.map((e) => (e as HTMLInputElement).value),
  );
  expect(rivit).toEqual([
    'kuu valaisee yön',
    'älä katso taakse',
    'aamu tulee kohta',
    'toinen säkeistö tässä',
  ]);
});

test('sointurivin voi poistaa vaikka siinä ei ole tekstikenttää', async ({ page }) => {
  await avaaLaulu(
    page,
    laulu({
      lines: [
        { id: 'b1', text: '', chords: [], bars: ['Am', 'F'], section: { kind: 'intro' } },
        { id: 'l1', text: 'sanoja', chords: [], section: { kind: 'verse' } },
      ],
    }),
  );
  await expect(page.locator('.bar-row')).toHaveCount(1);

  await page.locator('.line').first().getByLabel('Line settings').click();
  await page.getByRole('button', { name: 'Delete line' }).click();

  await expect(page.locator('.bar-row')).toHaveCount(0);
  // Seuraavalla rivillä on jo oma merkintänsä, joten poistetun rivin osio ei
  // peri sitä – jäljelle jää pelkkä Verse.
  await expect.poll(() => osiot(page)).toEqual(['Verse']);
});

test('laulun ainoaa riviä ei voi poistaa', async ({ page }) => {
  await avaaLaulu(page, laulu({ lines: [{ id: 'l1', text: 'ainoa', chords: [] }] }));
  await page.locator('.line').first().getByLabel('Line settings').click();
  await expect(page.getByRole('button', { name: 'Delete line' })).toBeDisabled();
});

test('tyhjän ensimmäisen rivin saa pois askelpalauttimella', async ({ page }) => {
  await avaaLaulu(
    page,
    laulu({
      lines: [
        { id: 'l0', text: '', chords: [] },
        { id: 'l1', text: 'ensimmäinen sana', chords: [] },
      ],
    }),
  );

  const kentta = page.locator('.line input.text').first();
  await kentta.click();
  await page.keyboard.press('Backspace');

  const rivit = await page.$$eval('.line input.text', (els) =>
    els.map((e) => (e as HTMLInputElement).value),
  );
  expect(rivit).toEqual(['ensimmäinen sana']);
});

test('ensimmäinen rivi säilyy jos siinä on tekstiä', async ({ page }) => {
  await avaaLaulu(page);
  const kentta = page.locator('.line input.text').first();
  await kentta.click();
  await kentta.press('Home');
  await page.keyboard.press('Backspace');

  const rivit = await page.$$eval('.line input.text', (els) =>
    els.map((e) => (e as HTMLInputElement).value),
  );
  expect(rivit[0]).toBe('kuu valaisee yön');
  expect(rivit).toHaveLength(5);
});
