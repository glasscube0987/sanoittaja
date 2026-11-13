import { expect, test, type Page } from '@playwright/test';
import {
  avaaKirjasto,
  avaaLaulu,
  avaaSaadot,
  laulu,
  lisaaLauluja,
  luoSetti,
  tallennettuLaulu,
} from './apu';

/**
 * Live-tilan ohjainpalkki: transponointi, setin selaus ja palkin tila.
 *
 * Palkissa on kolme tilaa, ja kussakin näkyy vain se mitä siinä tarvitaan:
 * toistorivi kesken soiton, sen päälle avattava säätörivi (tekstikoko ja
 * sävellaji) ja piirtotilan työkalut. Testit vartioivat sekä sitä mitä kukin
 * tila tekee että sitä, kuinka paljon ruutua se vie – palkin koko oli se syy
 * miksi rakenne muutettiin.
 */

const PUHELIN = { width: 375, height: 812 };

async function avaaLive(page: Page) {
  await page.addInitScript(() => {
    Element.prototype.setPointerCapture = () => {};
  });
  await avaaLaulu(page);
  await page.getByRole('button', { name: 'Live', exact: true }).click();
  await expect(page.locator('.live-view')).toBeVisible();
}

/** Kolmen laulun setti live-tilassa; lauluilla on sävellajit. */
async function avaaSetti(page: Page, nimet = ['Ensimmäinen', 'Toinen', 'Kolmas']) {
  const savellajit = ['Am', 'G', ''];
  await avaaKirjasto(
    page,
    nimet.map((title, i) =>
      laulu({ id: `s${i}`, title, songKey: savellajit[i] ?? '', updatedAt: nimet.length - i }),
    ),
  );
  await luoSetti(page, 'Keikka');
  await lisaaLauluja(page, nimet);
  await page.locator('.button-row').getByRole('button', { name: 'Live' }).click();
  await expect(page.locator('.live-view')).toBeVisible();
}

const soinnut = (page: Page) => page.locator('.live-view .sheet-chords').first().textContent();

/** Ovatko kaikki rivin painikkeet samalla korkeudella ja ruudun sisällä. */
async function yhdellaRivilla(page: Page, valitsin: string, leveys: number) {
  const laatikot = await page
    .locator(`${valitsin} button`)
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect()).map((r) => ({ x: r.x, y: r.y, w: r.width })));
  expect(laatikot.length).toBeGreaterThan(0);
  for (const box of laatikot) {
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.w).toBeLessThanOrEqual(leveys);
  }
  expect(new Set(laatikot.map((box) => Math.round(box.y))).size).toBe(1);
}

/* --- Transponointi --- */

/* Laulaja vaihtuu tai kapo unohtui: sävellajin on vaihduttava lavalla ilman
   editoriin palaamista. */
test('sävellajin voi vaihtaa live-tilassa', async ({ page }) => {
  await avaaLive(page);
  expect(await soinnut(page)).toBe('Am  F');

  await avaaSaadot(page);
  await page.getByLabel('Transpose up').click();
  await page.getByLabel('Transpose up').click();

  // Koko sävelaskel ylös: Am → Bm, F → G.
  expect(await soinnut(page)).toBe('Bm  G');
  await expect(page.locator('.live-key')).toHaveText('Bm');
  await expect(page.locator('.live-view .sheet-key')).toContainText('Bm');

  // Sama muutos kuin editorissa: soinnut tallennetaan transponoituina.
  await expect
    .poll(async () => {
      const tallennettu = JSON.parse(await tallennettuLaulu(page));
      return [tallennettu.transpose, tallennettu.songKey, tallennettu.lines[0].chords[0].symbol];
    })
    .toEqual([2, 'Bm', 'Bm']);
});

/*
 * Editorissa etumerkit voi vaihtaa ♭/♯-painikkeilla. Täällä niitä ei ole, joten
 * ne valitaan sävellajin mukaan johon päädytään: a-mollista nostettu c-molli
 * kirjoitettiin ensin soinnuilla G#, D# ja A#.
 */
test('transponointi kirjoittaa soinnut kohdesävellajin etumerkein', async ({ page }) => {
  await avaaLive(page);
  await avaaSaadot(page);
  for (let i = 0; i < 3; i++) await page.getByLabel('Transpose up').click();

  // Am → Cm: F → Ab, C → Eb, G → Bb.
  await expect(page.locator('.live-key')).toHaveText('Cm');
  expect(await page.locator('.live-view .sheet-chords').allTextContents()).toEqual([
    'Cm  Ab',
    '   Eb',
    'Bb',
  ]);

  // Vielä puolisävelaskel: C#m on ristisävellaji, ja soinnut vaihtuvat mukana.
  await page.getByLabel('Transpose up').click();
  await expect(page.locator('.live-key')).toHaveText('C#m');
  expect(await soinnut(page)).toBe('C#m A');
});

test('alkuperäiseen sävellajiin pääsee takaisin yhdellä painalluksella', async ({ page }) => {
  await avaaLive(page);
  await avaaSaadot(page);
  // Paluu näkyy vain kun laulu ei ole alkuperäisessä sävellajissaan.
  await expect(page.locator('.live-settings .reset-key')).toHaveCount(0);

  await page.getByLabel('Transpose down').click();
  await page.getByLabel('Transpose down').click();
  await page.getByLabel('Transpose down').click();
  const paluu = page.locator('.live-settings .reset-key');
  await expect(paluu).toHaveText('-3 ↺');

  await paluu.click();
  expect(await soinnut(page)).toBe('Am  F');
  await expect(paluu).toHaveCount(0);
});

/* Live-tilassa tehty transponointi on laulun muutos eikä esitysasetus: se näkyy
   editorissa ja sen saa kumottua sieltä, kuten editorissa tehdyn. */
test('live-tilassa transponoitu laulu on transponoitu editorissa ja kumottavissa', async ({ page }) => {
  await avaaLive(page);
  await avaaSaadot(page);
  await page.getByLabel('Transpose up').click();
  await page.getByLabel('Transpose up').click();
  await page.getByLabel('Exit live mode').click();

  await expect(page.locator('.lyrics .chord').first()).toHaveText('Bm');
  await expect(page.getByLabel('Key', { exact: true })).toHaveValue('Bm');

  await page.getByRole('button', { name: 'Undo' }).first().click();
  await page.getByRole('button', { name: 'Undo' }).first().click();
  await expect(page.locator('.lyrics .chord').first()).toHaveText('Am');
});

test('setistä avatun laulun transponointi tallentuu', async ({ page }) => {
  await avaaSetti(page);
  await page.getByLabel('Next song').click();
  await avaaSaadot(page);
  await page.getByLabel('Transpose up').click();
  await page.getByLabel('Transpose up').click();

  // Toinen laulu on G-duurissa: koko sävelaskel ylös on A.
  await expect(page.locator('.live-key')).toHaveText('A');
  await expect.poll(async () => JSON.parse(await tallennettuLaulu(page, 's1')).songKey).toBe('A');
  // Ensimmäinen laulu ei muuttunut.
  expect(JSON.parse(await tallennettuLaulu(page, 's0')).songKey).toBe('Am');
});

/* --- Säätörivi --- */

/* Tekstikokoon ja sävellajiin kosketaan kerran laulua kohti. Toistorivillä ne
   veivät tilan nopeudelta, jota säädetään kesken soiton. */
test('tekstikoko ja sävellaji ovat säätöpainikkeen takana', async ({ page }) => {
  await avaaLive(page);
  await expect(page.locator('.live-settings')).toHaveCount(0);
  await expect(page.getByLabel('Larger text')).toHaveCount(0);

  const painike = page.getByLabel('Text size and key');
  await painike.click();
  await expect(painike).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByLabel('Larger text')).toBeVisible();
  await expect(page.getByLabel('Transpose up')).toBeVisible();

  await painike.click();
  await expect(page.locator('.live-settings')).toHaveCount(0);
});

test('toistorivi ja säätörivi mahtuvat kumpikin yhdelle riville', async ({ page }) => {
  await page.setViewportSize(PUHELIN);
  await avaaLive(page);
  await yhdellaRivilla(page, '.live-controls', PUHELIN.width);

  await avaaSaadot(page);
  // Leveimmillään: paluupainike näkyvissä ja sävellajissa etumerkki.
  await page.getByLabel('Transpose down').click();
  await expect(page.locator('.live-settings .reset-key')).toBeVisible();
  await yhdellaRivilla(page, '.live-settings', PUHELIN.width);
});

/* --- Piirtotila --- */

/*
 * Piirtotilassa oli kolme palkkia päällekkäin – setissä neljä – ja ne veivät
 * puhelimen ruudusta viidenneksen juuri silloin kun lehteä pitää nähdä.
 * Toistolla ja laulun vaihdolla ei piirtäessä tee mitään, joten ne ovat
 * piilossa ja tilalla on yksi «Valmis».
 */
test('piirtotilassa näkyvät vain työkalut', async ({ page }) => {
  await page.setViewportSize(PUHELIN);
  await avaaSetti(page);
  const korkeus = () => page.locator('.live-bar').evaluate((el) => el.getBoundingClientRect().height);
  const toistossa = await korkeus();

  await page.getByLabel('Draw on the sheet').click();
  await expect(page.locator('.draw-tools')).toBeVisible();
  await expect(page.locator('.live-controls')).toHaveCount(0);
  await expect(page.locator('.live-nav')).toHaveCount(0);

  // Kaksi työkaluriviä ei vie enempää kuin toisto- ja settirivi yhdessä.
  expect(await korkeus()).toBeLessThanOrEqual(toistossa + 1);
  await yhdellaRivilla(page, '.draw-tools', PUHELIN.width);

  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.locator('.live-controls')).toBeVisible();
  await expect(page.locator('.live-nav')).toBeVisible();
});

/* Kenttää kirjoitettaessa riville tulee roskakori. Se on rivin levein tila, ja
   juuri silloin rivin kiertyminen veisi näppäimistön yllä olevan tilan. */
test('työkalurivi mahtuu yhdelle riville myös kenttää kirjoitettaessa', async ({ page }) => {
  await page.setViewportSize(PUHELIN);
  await avaaLive(page);
  await page.getByLabel('Draw on the sheet').click();
  await page.getByRole('button', { name: 'Text', exact: true }).click();
  await kirjoitaKentta(page, 'capo 3', false);
  await expect(page.getByLabel('Delete text')).toBeVisible();

  await yhdellaRivilla(page, '.draw-tools', PUHELIN.width);
});

test('Valmis kesken kirjoituksen tallentaa kentän', async ({ page }) => {
  await avaaLive(page);
  await page.getByLabel('Draw on the sheet').click();
  await page.getByRole('button', { name: 'Text', exact: true }).click();
  await kirjoitaKentta(page, 'capo 3', false);

  /*
   * Painallus ilman kohdistuksen siirtymistä. Työpöytäselaimessa napautus vie
   * kohdistuksen painikkeelle ja kenttä päättyy sitä kautta, mutta iOS:ssä
   * painike ei ota kohdistusta: kenttä jäisi auki piirtotilan ulkopuolelle,
   * eikä sitä saisi enää suljettua mistään.
   */
  await page
    .getByRole('button', { name: 'Done', exact: true })
    .evaluate((el) => (el as HTMLButtonElement).click());

  await expect(page.locator('.draw-tools')).toHaveCount(0);
  await expect(page.locator('.live-view .annot-text')).toHaveText('capo 3');
  await expect(page.locator('.live-view textarea')).toHaveCount(0);
});

/* --- Setin selaus --- */

/* Lavalla halutaan tietää mihin ollaan menossa ennen kuin sinne mennään: kapo
   ehditään siirtää välispiikin aikana. */
test('seuraavan laulun nimi ja sävellaji näkyvät selauspainikkeessa', async ({ page }) => {
  await avaaSetti(page);

  const seuraava = page.getByLabel('Next song');
  await expect(seuraava).toContainText('Toinen');
  await expect(seuraava.locator('small')).toHaveText('Next · G');
  await expect(seuraava).toHaveAccessibleName('Next song: Toinen');

  await seuraava.click();
  // Kolmannella laululla ei ole sävellajia; nimi näkyy ilman sitä.
  await expect(seuraava).toContainText('Kolmas');
  await expect(seuraava.locator('small')).toHaveText('Next');

  await seuraava.click();
  await expect(seuraava).toBeDisabled();
  await expect(seuraava).not.toContainText('Next');
});

test('laulun lopun painike vie seuraavaan lauluun eikä käynnistä vieritystä', async ({ page }) => {
  await avaaSetti(page);
  const kortti = page.locator('.live-next-card');
  await expect(kortti).toContainText('Toinen');
  await expect(kortti).toContainText('G');

  await kortti.click();

  await expect(page.locator('.live-position')).toContainText('2/3');
  await expect(page.locator('.live-view h1')).toHaveText('Toinen');
  // Lehden napautus käynnistää vierityksen; kortin napautus ei saa.
  await expect(page.getByLabel('Play')).toBeVisible();
  await expect(page.getByLabel('Pause')).toHaveCount(0);
});

test('viimeisessä laulussa ja yksittäisessä laulussa ei ole seuraavaa', async ({ page }) => {
  await avaaSetti(page);
  await page.getByLabel('Next song').click();
  await page.getByLabel('Next song').click();
  await expect(page.locator('.live-next-card')).toHaveCount(0);
});

test('yksittäisen laulun live-tilassa ei ole seuraava-painiketta', async ({ page }) => {
  await avaaLive(page);
  await expect(page.locator('.live-next-card')).toHaveCount(0);
  await expect(page.locator('.live-nav')).toHaveCount(0);
});

/* Pitkä nimi katkeaa kolmeen pisteeseen eikä työnnä painikkeita ruudulta. */
test('pitkä seuraavan laulun nimi ei riko settiriviä', async ({ page }) => {
  await page.setViewportSize(PUHELIN);
  await avaaSetti(page, [
    'Ensimmäinen laulu jolla on kohtuuttoman pitkä nimi',
    'Toinen laulu jonka nimi ei mahdu millekään riville kokonaan',
    'Kolmas',
  ]);
  await yhdellaRivilla(page, '.live-nav', PUHELIN.width);
  const kortti = (await page.locator('.live-next-card').boundingBox())!;
  expect(kortti.x + kortti.width).toBeLessThanOrEqual(PUHELIN.width);
});

/** Luo tekstikentän ensimmäisen rivin kohdalle ja kirjoittaa siihen. */
async function kirjoitaKentta(page: Page, teksti: string, paata: boolean) {
  const rivi = (await page.locator('.live-view .sheet-line').first().boundingBox())!;
  const x = rivi.x + 40;
  const y = rivi.y + rivi.height - 8;
  for (const tapahtuma of ['pointerdown', 'pointerup']) {
    await page.evaluate(
      ([nimi, cx, cy]) => {
        document.elementFromPoint(cx as number, cy as number)!.dispatchEvent(
          new PointerEvent(nimi as string, {
            pointerId: 1,
            pointerType: 'touch',
            clientX: cx as number,
            clientY: cy as number,
            buttons: 1,
            bubbles: true,
            cancelable: true,
          }),
        );
      },
      [tapahtuma, x, y] as const,
    );
  }
  await page.keyboard.type(teksti);
  if (paata) await page.keyboard.press('Escape');
}
