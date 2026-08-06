import { expect, test } from '@playwright/test';
import { avaaLaulu, avaaLista, osiot, tallennettuLaulu } from './apu';

test('käyttöliittymä on oletuksena englanniksi', async ({ page }) => {
  await avaaLista(page);
  await expect(page.getByRole('button', { name: '+ New song' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'All songs' })).toBeVisible();
});

test('kielen vaihto vaihtaa tekstit ja säilyy uudelleenlatauksen yli', async ({ page }) => {
  await avaaLista(page);
  await page.getByLabel('Settings').click();
  await page.getByRole('button', { name: 'Suomi' }).click();

  // Kieli vaihtuu heti, ennen tallennusta.
  await expect(page.getByRole('button', { name: 'Tallenna' })).toBeVisible();
  await page.getByRole('button', { name: 'Tallenna' }).click();
  await expect(page.getByRole('button', { name: '+ Uusi laulu' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: '+ Uusi laulu' })).toBeVisible();
});

test('osioiden nimet seuraavat kieltä eivätkä tallennu lauluun', async ({ page }) => {
  await avaaLaulu(page);
  await expect.poll(() => osiot(page)).toEqual(['Verse 1', 'Chorus', 'Verse 2']);

  // Sama laulu suomeksi: data on kielineutraalia, vain esitys vaihtuu.
  await page.evaluate(() => localStorage.setItem('sanoittaja.lang', 'fi'));
  await page.reload();
  await page.locator('.song-card').first().click();
  await expect.poll(() => osiot(page)).toEqual(['Säkeistö 1', 'Kertosäe', 'Säkeistö 2']);

  const tallennettu = await tallennettuLaulu(page);
  expect(tallennettu).toContain('"kind":"verse"');
  expect(tallennettu).not.toContain('Säkeistö');
  expect(tallennettu).not.toContain('Verse');
});
