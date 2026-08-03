import { expect, test } from '@playwright/test';
import { avaaLaulu, laulu } from './apu';

test('tulostusnäkymä näyttää soinnut sanojen yllä', async ({ page }) => {
  await avaaLaulu(page);
  await page.emulateMedia({ media: 'print' });

  await expect(page.locator('.song-sheet')).toBeVisible();
  const rivi = page.locator('.sheet-line').first();
  // Am sarakkeessa 0, F sarakkeessa 4 – sama kohdistus kuin editorissa.
  expect(await rivi.locator('.sheet-chords').textContent()).toBe('Am  F');
  expect(await rivi.locator('.sheet-lyric').textContent()).toBe('kuu valaisee yön');
});

test('tulostuksessa näkyy vain nuottilehti', async ({ page }) => {
  await avaaLaulu(page);

  // Näytöllä lehti on piilossa ja editori näkyvissä.
  await expect(page.locator('.song-sheet')).toBeHidden();
  await expect(page.locator('.lyrics')).toBeVisible();

  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.song-sheet')).toBeVisible();
  for (const piilossa of ['.topbar', '.lyrics', '.editor-actions', '.transpose-bar']) {
    await expect(page.locator(piilossa)).toBeHidden();
  }
});

test('osiot ja sävellaji tulevat mukaan tulosteeseen', async ({ page }) => {
  await avaaLaulu(page);
  await page.emulateMedia({ media: 'print' });

  await expect(page.locator('.song-sheet h1')).toHaveText('Kuu valaisee');
  await expect(page.locator('.song-sheet .sheet-key')).toHaveText('Am');
  await expect(page.locator('.song-sheet .sheet-section h2')).toHaveText([
    'Verse 1',
    'Chorus',
    'Verse 2',
  ]);
});

test('välisoiton soinnut tulostuvat ilman sanoja', async ({ page }) => {
  await avaaLaulu(
    page,
    laulu({
      lines: [
        {
          id: 'v1',
          text: '',
          section: { kind: 'solo' },
          chords: [
            { id: 'c1', pos: 0, symbol: 'Am' },
            { id: 'c2', pos: 8, symbol: 'F' },
          ],
        },
      ],
    }),
  );
  await page.emulateMedia({ media: 'print' });

  expect(await page.locator('.sheet-chords').first().textContent()).toBe('Am      F');
});
