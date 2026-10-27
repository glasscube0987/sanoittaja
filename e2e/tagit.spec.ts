import { expect, test, type Page } from '@playwright/test';
import {
  avaaKirjasto,
  avaaLaulu,
  kirjastoToiminto,
  kirjauduDropboxiin,
  laulu,
  lisaaLauluja,
  luoSetti,
  paketti,
  tallennettuLaulu,
  vaarennaPilvikopiot,
} from './apu';
import type { Song } from '../src/lib/types';

/**
 * Laulujen tagit: laulun omat tagit editorissa ja niillä suodattaminen
 * laululistassa.
 *
 * Painopiste on **kaventavassa** säännössä: kahdella tagilla lista lyhenee. Se
 * on käyttäjän valitsema sääntö, ja laajentava tulkinta näyttää ohimennen
 * katsottuna yhtä oikealta – siksi sillä on oma testi joka kaatuu jos sääntö
 * kääntyy.
 */

const nimet = (page: Page) => page.locator('.song-card .title').allTextContents();

/** Suodatinchipit laululistassa. */
const suodatin = (page: Page) => page.getByRole('group', { name: 'Filter by tag' });

function kirjasto(rows: { title: string; tags?: string[] }[]): Song[] {
  // Aikaleimat laskevina, jotta listan järjestys on annettu järjestys.
  return rows.map((row, i) =>
    laulu({
      id: `s${i}`,
      title: row.title,
      updatedAt: rows.length - i,
      lines: [{ id: `l${i}`, text: row.title, chords: [] }],
      ...(row.tags ? { tags: row.tags } : {}),
    }),
  );
}

test('editorissa lisätty tagi näkyy laulun kortilla', async ({ page }) => {
  await avaaLaulu(page);

  await page.getByRole('button', { name: '+ Tag' }).click();
  await page.getByLabel('New tag').fill('keikkakunto');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.locator('.sheet').getByRole('button', { name: 'Save' }).click();

  await expect(page.getByLabel('Remove tag keikkakunto')).toBeVisible();

  await page.getByLabel('Songs').click();
  await expect(page.locator('.card-tag')).toHaveText(['keikkakunto']);
});

/* Kesken oleva kenttä otetaan tallennuksessa mukaan: kirjoitettu tagi jota ei
   ehditty lisätä katoaisi muuten huomaamatta. */
test('tallennus ottaa mukaan kenttään jääneen tagin', async ({ page }) => {
  await avaaLaulu(page);

  await page.getByRole('button', { name: '+ Tag' }).click();
  await page.getByLabel('New tag').fill('kesken');
  await page.locator('.sheet').getByRole('button', { name: 'Save' }).click();

  await expect(page.getByLabel('Remove tag kesken')).toBeVisible();
});

test('kirjaston tagi on tarjolla toisessa laulussa', async ({ page }) => {
  await avaaKirjasto(page, kirjasto([{ title: 'Alfa', tags: ['cover'] }, { title: 'Beeta' }]));

  await page.locator('.song-card', { hasText: 'Beeta' }).click();
  await page.getByRole('button', { name: '+ Tag' }).click();

  // Valmiin tarjoaminen on se mikä pitää tagit yhtenäisinä.
  await page.locator('.sheet').getByRole('button', { name: 'cover', exact: true }).click();
  await page.locator('.sheet').getByRole('button', { name: 'Save' }).click();

  await expect(page.getByLabel('Remove tag cover')).toBeVisible();
});

test('tagin poisto editorissa poistaa sen myös kannasta', async ({ page }) => {
  await avaaLaulu(page, laulu({ tags: ['cover', 'kesken'] }));

  await page.getByLabel('Remove tag kesken').click();

  await expect(page.getByLabel('Remove tag kesken')).toHaveCount(0);
  await expect(page.getByLabel('Remove tag cover')).toBeVisible();
  await expect
    .poll(async () => JSON.parse(await tallennettuLaulu(page)).tags)
    .toEqual(['cover']);
});

test('yksi tagi suodattaa listan', async ({ page }) => {
  await avaaKirjasto(
    page,
    kirjasto([
      { title: 'Alfa', tags: ['cover'] },
      { title: 'Beeta', tags: ['kesken'] },
      { title: 'Gamma' },
    ]),
  );
  expect(await nimet(page)).toEqual(['Alfa', 'Beeta', 'Gamma']);

  await suodatin(page).getByRole('button', { name: 'cover', exact: true }).click();

  expect(await nimet(page)).toEqual(['Alfa']);
});

/*
 * Käyttäjän valitsema sääntö. Laajentava tulkinta antaisi tässä kolme laulua,
 * eli lista kasvaisi toisen tagin myötä – juuri päinvastoin kuin suodattamisella
 * haetaan.
 */
test('kaksi tagia kaventaa eikä laajenna', async ({ page }) => {
  await avaaKirjasto(
    page,
    kirjasto([
      { title: 'Alfa', tags: ['cover', 'keikkakunto'] },
      { title: 'Beeta', tags: ['cover'] },
      { title: 'Gamma', tags: ['keikkakunto'] },
    ]),
  );

  await suodatin(page).getByRole('button', { name: 'cover', exact: true }).click();
  expect(await nimet(page)).toEqual(['Alfa', 'Beeta']);

  await suodatin(page).getByRole('button', { name: 'keikkakunto', exact: true }).click();
  expect(await nimet(page)).toEqual(['Alfa']);
});

test('valinnan purku palauttaa listan', async ({ page }) => {
  await avaaKirjasto(
    page,
    kirjasto([{ title: 'Alfa', tags: ['cover'] }, { title: 'Beeta' }]),
  );

  const chip = suodatin(page).getByRole('button', { name: 'cover', exact: true });
  await chip.click();
  expect(await nimet(page)).toEqual(['Alfa']);

  await chip.click();
  expect(await nimet(page)).toEqual(['Alfa', 'Beeta']);
});

test('haku ja tagi vaikuttavat yhdessä', async ({ page }) => {
  await avaaKirjasto(
    page,
    kirjasto([
      { title: 'Alfa laulu', tags: ['cover'] },
      { title: 'Beeta laulu', tags: ['cover'] },
      { title: 'Alfa muu', tags: ['kesken'] },
    ]),
  );

  await suodatin(page).getByRole('button', { name: 'cover', exact: true }).click();
  expect(await nimet(page)).toEqual(['Alfa laulu', 'Beeta laulu']);

  await page.getByLabel('Search songs').fill('beeta');
  expect(await nimet(page)).toEqual(['Beeta laulu']);
});

/* Kirjainkoko ei erota tageja: muuten iPadilla kirjoitettu «Cover» ja
   puhelimella kirjoitettu «cover» olisivat kaksi suodatinta samalle asialle. */
test('Cover ja cover ovat sama suodatin', async ({ page }) => {
  await avaaKirjasto(
    page,
    kirjasto([
      { title: 'Alfa', tags: ['Cover'] },
      { title: 'Beeta', tags: ['cover'] },
      { title: 'Gamma', tags: ['kesken'] },
    ]),
  );

  // Yksi chip kahdesta kirjoitusasusta, ensin kirjoitettu asu näkyvissä.
  await expect(suodatin(page).getByRole('button')).toHaveText(['Cover', 'kesken']);

  await suodatin(page).getByRole('button', { name: 'Cover', exact: true }).click();
  expect(await nimet(page)).toEqual(['Alfa', 'Beeta']);
});

test('osumaton tagivalinta kertoo syyn', async ({ page }) => {
  await avaaKirjasto(
    page,
    kirjasto([
      { title: 'Alfa', tags: ['cover'] },
      { title: 'Beeta', tags: ['kesken'] },
    ]),
  );

  await suodatin(page).getByRole('button', { name: 'cover', exact: true }).click();
  await suodatin(page).getByRole('button', { name: 'kesken', exact: true }).click();

  expect(await nimet(page)).toEqual([]);
  // Hakusanaa ei ole, joten hakua koskeva huomautus ei selittäisi tyhjää listaa.
  await expect(page.locator('.empty-note')).toHaveText(
    'No song has all the selected tags.',
  );
});

/* Setissä lista on lyhyt ja järjestys on esitysjärjestys – kuten haku ja
   lajittelu, suodatin kuuluu vain koko kirjastolle. */
test('tagisuodatin ei näy setissä', async ({ page }) => {
  await avaaKirjasto(
    page,
    kirjasto([{ title: 'Alfa', tags: ['cover'] }, { title: 'Beeta' }]),
  );
  await expect(suodatin(page)).toBeVisible();

  await luoSetti(page, 'Keikka');
  await lisaaLauluja(page, ['Alfa']);

  await expect(suodatin(page)).toHaveCount(0);
});

/*
 * Kirjasto voi vaihtua listan ollessa auki: pilvestä haettu uudempi versio voi
 * viedä tagin, jolla lista on juuri suodatettu. Ilman valinnan rajaamista
 * kirjastossa yhä oleviin tageihin suodatin jäisi päälle ilman yhtään chippiä
 * jolla sen voisi purkaa – lista olisi tyhjä eikä näkymästä pääsisi ulos.
 */
test('kadonnut tagi ei jätä suodatinta päälle', async ({ page }) => {
  // Pilvestä tulee uudempi Alfa ilman tageja, joten se voittaa yhdistämisessä.
  await vaarennaPilvikopiot(page, [
    {
      name: 'sanoittaja-varmuuskopio-2026-10-20-iPad-a3f1.json',
      sisalto: paketti(
        laulu({ id: 's0', title: 'Alfa', updatedAt: 99, lines: [{ id: 'l0', text: 'Alfa', chords: [] }] }),
      ),
    },
  ]);
  await avaaKirjasto(
    page,
    kirjasto([{ title: 'Alfa', tags: ['cover'] }, { title: 'Beeta' }]),
  );

  await suodatin(page).getByRole('button', { name: 'cover', exact: true }).click();
  expect(await nimet(page)).toEqual(['Alfa']);

  await kirjauduDropboxiin(page);
  await kirjastoToiminto(page, 'To cloud');
  await page.getByRole('button', { name: 'Fetch from cloud' }).click();
  await page.locator('.cloud-files button').click();
  await page.locator('.sheet').getByRole('button', { name: 'Close' }).click();

  await expect(suodatin(page)).toHaveCount(0);
  expect(await nimet(page)).toEqual(['Alfa', 'Beeta']);
});

/* Tyhjä valitsinrivi olisi pelkkä selittämätön otsikko niille jotka eivät
   tageja käytä. */
test('tagisuodatin ei näy tagittomassa kirjastossa', async ({ page }) => {
  await avaaKirjasto(page, kirjasto([{ title: 'Alfa' }, { title: 'Beeta' }]));
  await expect(suodatin(page)).toHaveCount(0);
});
