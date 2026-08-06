/**
 * Vanhan laulun tuonti tekstistä: tunnistus, esikatselun korjaus ja se, että
 * soinnut päätyvät oikean merkin kohdalle eivätkä vain suunnilleen oikein.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { avaaLaulu, avaaLista, osiot, kirjastoToiminto } from './apu';

const LAULU = [
  'Kuu valaisee',
  '',
  '[Intro]',
  '| Am | F |',
  '',
  'Verse 1',
  'Am           F',
  'kuu valaisee yön',
  '',
  'Kertosäe',
  'G',
  'älä katso taakse',
].join('\n');

/** Rivien sanoitustekstit näytön järjestyksessä. */
function rivit(page: Page): Promise<string[]> {
  return page.$$eval('.line input.text', (els) => els.map((e) => (e as HTMLInputElement).value));
}

async function liita(page: Page, teksti: string): Promise<void> {
  await page.locator('.import-input').fill(teksti);
}

test('liitetystä laulupaperista syntyy laulu osioineen', async ({ page }) => {
  await avaaLista(page);
  await kirjastoToiminto(page, 'Import text');
  await liita(page, LAULU);

  // Nimi tunnistetaan ensimmäisestä rivistä eikä jää sanoitukseksi.
  await expect(page.getByLabel('Song title')).toHaveValue('Kuu valaisee');

  await page.getByRole('button', { name: 'Create song' }).click();

  await expect.poll(() => osiot(page)).toEqual(['Intro', 'Verse', 'Chorus']);
  expect(await rivit(page)).toEqual(['kuu valaisee yön', 'älä katso taakse']);
  await expect(page.locator('.bar-row')).toHaveText('| Am | F |');
  await expect(page.locator('.topbar h1')).toHaveText('Kuu valaisee');
});

test('tuotu sointu osuu oikean merkin kohdalle', async ({ page }) => {
  await avaaLista(page);
  await kirjastoToiminto(page, 'Import text');
  // F on sarakkeessa 13, eli sanan "yön" alussa.
  await liita(page, ['Am           F', 'kuu valaisee yön'].join('\n'));
  await page.getByRole('button', { name: 'Create song' }).click();
  await page.waitForSelector('.chord-row .chord');

  const virheet = await page.evaluate(() => {
    const line = document.querySelector('.line')!;
    const input = line.querySelector('input.text') as HTMLInputElement;
    const probe = document.createElement('span');
    probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${getComputedStyle(input).font}`;
    document.body.appendChild(probe);
    const odotetut: Record<string, number> = { Am: 0, F: 13 };
    const tulos = [...line.querySelectorAll<HTMLElement>('.chord')].map((chord) => {
      probe.textContent = input.value.slice(0, odotetut[chord.textContent ?? ''] ?? 0);
      const odotettu = input.getBoundingClientRect().left + probe.getBoundingClientRect().width;
      return chord.getBoundingClientRect().left - odotettu;
    });
    probe.remove();
    return tulos;
  });

  const vaihtelu = Math.max(...virheet) - Math.min(...virheet);
  expect(vaihtelu, `kohdistusvirheet: ${virheet.map((v) => v.toFixed(1)).join(', ')}`).toBeLessThan(3);
});

test('esikatselu näyttää rivien tulkinnan', async ({ page }) => {
  await avaaLista(page);
  await kirjastoToiminto(page, 'Import text');
  await liita(page, ['[Chorus]', 'Am  F', 'kuu valaisee yön'].join('\n'));

  const tulkinnat = await page.$$eval('.import-row select', (els) =>
    els.map((e) => (e as HTMLSelectElement).value),
  );
  expect(tulkinnat).toEqual(['section', 'chords', 'lyrics']);
});

test('väärin tunnistetun rivin tyypin voi korjata ennen luontia', async ({ page }) => {
  await avaaLista(page);
  await kirjastoToiminto(page, 'Import text');
  // "Am F" on tässä sanoitusta, ei sointuja; ilman korjausta se söisi
  // seuraavan rivin sointuriviksi.
  await liita(page, ['Am  F', 'kuu valaisee yön'].join('\n'));
  await page.getByLabel('Type of line 1').selectOption('lyrics');

  await page.getByRole('button', { name: 'Create song' }).click();

  expect(await rivit(page)).toEqual(['Am  F', 'kuu valaisee yön']);
  await expect(page.locator('.chord-row .chord')).toHaveCount(0);
});

test('tekstin voi liittää avoimen laulun perään ja peruuttaa', async ({ page }) => {
  await avaaLaulu(page);
  const ennen = await rivit(page);

  await page.getByRole('button', { name: 'Paste text' }).click();
  await liita(page, ['G', 'uusi rivi tähän'].join('\n'));
  await page.getByRole('button', { name: 'Add to song' }).click();

  await expect.poll(() => rivit(page)).toEqual([...ennen, 'uusi rivi tähän']);

  await page.getByLabel('Undo').click();
  await expect.poll(() => rivit(page)).toEqual(ennen);
});

test('esikatselurivi ei peri editorin sanoituslaatikon tyylejä', async ({ page }) => {
  await avaaLista(page);
  await kirjastoToiminto(page, 'Import text');
  await liita(page, 'kuu valaisee yön');

  // Rivin laji oli aluksi luokkana, ja `lyrics` on myös editorin
  // sanoituslaatikon luokka: sanoitusrivit saivat sen reunan ja taustan.
  const tyyli = await page.locator('.import-text').first().evaluate((el) => {
    const s = getComputedStyle(el);
    return { reuna: s.borderTopWidth, tausta: s.backgroundColor };
  });
  expect(tyyli.reuna).toBe('0px');
  expect(tyyli.tausta).toBe('rgba(0, 0, 0, 0)');
});

test('tuonti ei levitä sivua leveällä tekstillä', async ({ page }) => {
  await avaaLista(page);
  await kirjastoToiminto(page, 'Import text');
  await liita(page, ['Am' + ' '.repeat(90) + 'F', 'x'.repeat(120)].join('\n'));

  const ylivuoto = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(ylivuoto).toBeLessThanOrEqual(0);
});
