/**
 * Lakanat dialogeina ja selaimen kyselyikkunoiden korvaajat.
 *
 * Setin nimi kysyttiin selaimen `prompt`illa ja poistot vahvistettiin
 * `confirm`illa: asennetussa sovelluksessa ne näyttivät vierailta, niiden
 * painikkeet olivat «OK» ja «Peruuta», eikä niitä voinut kääntää. Lakanat taas
 * olivat pelkkiä laatikoita ruudun päällä – Esc ei sulkenut, Tab vei
 * kohdistuksen alla olevaan editoriin, eikä ruudunlukija tiennyt dialogista.
 */
import { expect, test } from '@playwright/test';
import { avaaLaulu, avaaMonta, laulujenNimet, luoSetti, vahvista } from './apu';

test.describe('setin nimi', () => {
  test('uusi setti nimetään omassa lakanassa', async ({ page }) => {
    // Selaimen kyselyikkuna ei saa enää aueta.
    page.on('dialog', () => {
      throw new Error('selaimen kyselyikkuna aukesi');
    });
    await avaaMonta(page, ['Alfa', 'Beeta']);
    await luoSetti(page, 'Keikka 21.11.');
    await expect(page.locator('.setlist-bar button.primary')).toHaveText('Keikka 21.11.');
  });

  /* Selaimen ikkunassa tyhjä nimi peruutti hiljaa; nyt tallennus ei ole
     edes mahdollinen. */
  test('tyhjää nimeä ei voi tallentaa', async ({ page }) => {
    await avaaMonta(page, ['Alfa', 'Beeta']);
    await page.getByRole('button', { name: '+ New set' }).click();
    const lakana = page.getByRole('dialog', { name: 'New set' });
    await expect(lakana.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
    await lakana.getByLabel('Name of the set').fill('   ');
    await expect(lakana.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  });

  test('peruutus ei luo settiä', async ({ page }) => {
    await avaaMonta(page, ['Alfa', 'Beeta']);
    await page.getByRole('button', { name: '+ New set' }).click();
    await page.getByRole('dialog', { name: 'New set' }).getByLabel('Name of the set').fill('Turha');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Turha', exact: true })).toHaveCount(0);
  });

  test('setin nimeäminen näyttää vanhan nimen ja vaihtaa sen', async ({ page }) => {
    await avaaMonta(page, ['Alfa', 'Beeta']);
    await luoSetti(page, 'Keikka');
    await page.getByRole('button', { name: 'Rename', exact: true }).click();
    const kentta = page.getByRole('dialog', { name: 'Rename set' }).getByLabel('Name of the set');
    await expect(kentta).toHaveValue('Keikka');
    await kentta.fill('Kesäkeikka');
    await page.keyboard.press('Enter');
    await expect(page.locator('.setlist-bar button.primary')).toHaveText('Kesäkeikka');
  });
});

test.describe('poiston vahvistus', () => {
  test('laulun poiston voi perua', async ({ page }) => {
    await avaaLaulu(page);
    await page.getByRole('button', { name: 'Delete song' }).click();
    const lakana = page.getByRole('alertdialog');
    await expect(lakana).toContainText('Kuu valaisee');
    await lakana.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    // Editori on yhä auki eikä laulu kadonnut.
    await expect(page.locator('.lyrics')).toBeVisible();
  });

  test('vahvistettu poisto poistaa laulun', async ({ page }) => {
    await avaaLaulu(page);
    await page.getByRole('button', { name: 'Delete song' }).click();
    await vahvista(page, 'Delete song');
    await expect(page.locator('.song-card')).toHaveCount(0);
    await expect.poll(() => laulujenNimet(page)).toEqual([]);
  });
});

test.describe('lakanat dialogeina', () => {
  test('lakana on nimetty dialogi ja Esc sulkee sen', async ({ page }) => {
    await avaaLaulu(page);
    await page.locator('.chord-row .chord').first().click();
    await expect(page.getByRole('dialog', { name: 'Edit chord' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  /* Tab vei kohdistuksen lakanan alla olevaan editoriin, jolloin näppäimistön
     käyttäjä kirjoitti näkymättömään kenttään. */
  test('Tab kiertää lakanan sisällä', async ({ page }) => {
    await avaaLaulu(page);
    await page.locator('.chord-row .chord').first().click();
    const lakana = page.getByRole('dialog', { name: 'Edit chord' });
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab');
      expect(await lakana.evaluate((el) => el.contains(document.activeElement)), `Tab ${i + 1}`).toBe(true);
    }
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Shift+Tab');
      expect(await lakana.evaluate((el) => el.contains(document.activeElement)), `Shift+Tab ${i + 1}`).toBe(true);
    }
  });

  test('suljettaessa kohdistus palaa avanneeseen painikkeeseen', async ({ page }) => {
    await avaaMonta(page, ['Alfa', 'Beeta']);
    const asetukset = page.getByLabel('Settings');
    await asetukset.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(asetukset).toBeFocused();
  });
});
