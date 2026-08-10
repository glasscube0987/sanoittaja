/**
 * Vapaat tekstikentät nuottilehdellä.
 *
 * Kosketukset kohdistetaan `elementFromPoint`illa eikä lähettämällä tapahtumaa
 * valitulle elementille. Ero on olennainen: elementille lähetetty tapahtuma
 * kuplii ylöspäin sen kerroksen *ohi*, joka oikeassa kosketuksessa olisi
 * päällimmäisenä, ja testi menee vihreäksi vaikka käyttäjälle ei tapahdu
 * mitään. Juuri se päästi aiemmin läpi julkaistun vian.
 */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { avaaLaulu, laulu, vaakaYlivuoto } from './apu';

function piirrettavaLaulu() {
  return laulu({
    lines: [
      { id: 'l1', text: 'kuu valaisee yön', section: { kind: 'verse' }, chords: [] },
      { id: 'l2', text: 'ja tie vie pohjoiseen', chords: [] },
    ],
  });
}

async function avaaLive(page: Page) {
  /* Osoittimen kaappaus vaatii oikean osoittimen: synteettisellä id:llä kutsu
     kaataisi käsittelijän ennen kuin se ehtii tehdä mitään. */
  await page.addInitScript(() => {
    Element.prototype.setPointerCapture = () => {};
  });
  await avaaLaulu(page, piirrettavaLaulu());
  await page.getByRole('button', { name: 'Live', exact: true }).click();
  await expect(page.locator('.live-view')).toBeVisible();
}

async function tekstiTila(page: Page) {
  await page.getByLabel('Draw on the sheet').click();
  await page.getByRole('button', { name: 'Text', exact: true }).click();
  await expect(page.locator('.draw-attrs')).toBeVisible();
}

/** Mikä elementti on oikeasti päällimmäisenä annetussa kohdassa. */
function kerrosKohdassa(page: Page, x: number, y: number): Promise<string> {
  return page.evaluate(
    ([cx, cy]) => {
      const el = document.elementFromPoint(cx, cy);
      return el ? `${el.tagName.toLowerCase()}.${el.getAttribute('class') ?? ''}` : '';
    },
    [x, y] as const,
  );
}

/**
 * Yksi osoitintapahtuma päällimmäiselle elementille.
 *
 * Erillinen kierros per tapahtuma: kesken oleva veto ja kirjoitettavana oleva
 * kenttä elävät Reactin tilassa, joten saman kierroksen sisällä lähetetty
 * seuraava tapahtuma näkisi vielä vanhan arvon.
 */
async function laheta(page: Page, tapahtuma: string, x: number, y: number) {
  await page.evaluate(
    ([nimi, cx, cy]) => {
      const el = document.elementFromPoint(cx as number, cy as number);
      if (!el) throw new Error(`ei elementtiä kohdassa ${cx},${cy}`);
      // Kaappaus vaatii oikean osoittimen; testissä se ohitetaan.
      (el as HTMLElement).setPointerCapture = () => {};
      el.dispatchEvent(
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

async function napauta(page: Page, x: number, y: number) {
  await laheta(page, 'pointerdown', x, y);
  await laheta(page, 'pointerup', x, y);
}

/**
 * Tapahtuma nimetylle elementille. Vedon aikana oikea kosketus pysyy
 * kaappauksen ansiosta samassa elementissä vaikka sormi liikkuu sen
 * ulkopuolelle, eikä `elementFromPoint` kertoisi sitä – siksi kesken vedon
 * kohde on elementti eikä ruudun kohta. Osumatesti tehdään erikseen.
 */
async function lahetaElementille(kohde: Locator, tapahtuma: string, x: number, y: number) {
  await kohde.evaluate(
    (el, [nimi, cx, cy]) => {
      el.dispatchEvent(
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

/** Veto elementin yli: alku, kaksi väliaskelta ja loppu, yksi per kierros. */
async function veda(kohde: Locator, alkuX: number, loppuX: number, y: number) {
  await lahetaElementille(kohde, 'pointerdown', alkuX, y);
  await lahetaElementille(kohde, 'pointermove', (alkuX + loppuX) / 2, y);
  await lahetaElementille(kohde, 'pointermove', loppuX, y);
  await lahetaElementille(kohde, 'pointerup', loppuX, y);
}

/** Kohta ensimmäisen rivin sisällä, hieman vasemmasta reunasta oikealle. */
async function rivinKohta(page: Page, osuus = 0.3): Promise<{ x: number; y: number }> {
  const box = (await page.locator('.live-view .sheet-line').first().boundingBox())!;
  return { x: box.x + box.width * osuus, y: box.y + box.height / 2 };
}

const kentat = (page: Page) => page.locator('.live-view .annot-text');
const kirjoitettava = (page: Page) => page.locator('.live-view .annot-text textarea');

/** Luo kentän annettuun kohtaan ja kirjoittaa siihen tekstin. */
async function kirjoita(page: Page, teksti: string, osuus = 0.3) {
  const { x, y } = await rivinKohta(page, osuus);
  await napauta(page, x, y);
  await expect(kirjoitettava(page)).toBeFocused();
  await page.keyboard.type(teksti);
  await page.keyboard.press('Escape');
  await expect(kirjoitettava(page)).toHaveCount(0);
}

test('tekstikerros on päällimmäisenä vain tekstitilassa', async ({ page }) => {
  /*
   * Kerrosjärjestys on koko ominaisuuden ehto. Tekstitilassa kosketuksen on
   * osuttava tekstikerrokseen, muuten kynä ei voisi piirtää kenttien päälle –
   * ja tavallisessa tilassa kummankaan kerroksen ei pidä ottaa mitään vastaan.
   */
  await avaaLive(page);
  const { x, y } = await rivinKohta(page);

  expect(await kerrosKohdassa(page, x, y)).not.toContain('annot');

  await page.getByLabel('Draw on the sheet').click();
  expect(await kerrosKohdassa(page, x, y)).toContain('annot active');

  await page.getByRole('button', { name: 'Text', exact: true }).click();
  expect(await kerrosKohdassa(page, x, y)).toContain('annot-texts active');
});

test('napautus luo kentän ja kirjoitettu teksti jää lehdelle', async ({ page }) => {
  await avaaLive(page);
  await tekstiTila(page);
  expect(await kentat(page).count()).toBe(0);

  await kirjoita(page, 'capo 3');

  await expect(kentat(page)).toHaveCount(1);
  await expect(page.locator('.live-view .annot-text-body')).toHaveText('capo 3');
});

test('kenttä säilyy ja palaa uudelleen avattaessa', async ({ page }) => {
  await avaaLive(page);
  await tekstiTila(page);
  await kirjoita(page, 'capo 3');

  await page.getByLabel('Exit live mode').click();
  await expect(page.locator('.live-view')).toHaveCount(0);
  await page.getByRole('button', { name: 'Live', exact: true }).click();

  await expect(page.locator('.live-view .annot-text-body')).toHaveText('capo 3');
});

test('tyhjä kenttä katoaa itsestään', async ({ page }) => {
  // Näkymätön laatikko keskellä lehteä olisi pelkkä ansa: siihen törmäisi
  // vasta kun sitä yrittäisi napauttaa jonkin muun asian takia.
  await avaaLive(page);
  await tekstiTila(page);

  const { x, y } = await rivinKohta(page);
  await napauta(page, x, y);
  await expect(kirjoitettava(page)).toBeFocused();
  await page.keyboard.press('Escape');

  await expect(kentat(page)).toHaveCount(0);
});

test('kentän tyhjentäminen poistaa sen', async ({ page }) => {
  await avaaLive(page);
  await tekstiTila(page);
  await kirjoita(page, 'capo 3');

  const laatikko = (await kentat(page).first().boundingBox())!;
  await napauta(page, laatikko.x + laatikko.width / 2, laatikko.y + laatikko.height / 2);
  await expect(kirjoitettava(page)).toBeFocused();

  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Escape');

  await expect(kentat(page)).toHaveCount(0);
});

test('roskakori poistaa kirjoitettavan kentän', async ({ page }) => {
  await avaaLive(page);
  await tekstiTila(page);

  const { x, y } = await rivinKohta(page);
  await napauta(page, x, y);
  await expect(kirjoitettava(page)).toBeFocused();
  await page.keyboard.type('poistetaan');

  await page.getByLabel('Delete text').click();
  await expect(kentat(page)).toHaveCount(0);
});

test('napautus kentän päällä avaa sen muokattavaksi', async ({ page }) => {
  await avaaLive(page);
  await tekstiTila(page);
  await kirjoita(page, 'capo 3');

  const laatikko = (await kentat(page).first().boundingBox())!;
  await napauta(page, laatikko.x + laatikko.width / 2, laatikko.y + laatikko.height / 2);

  await expect(kirjoitettava(page)).toHaveValue('capo 3');
});

test('kosketus kirjoitettavaan kenttään ei päätä kirjoitusta', async ({ page }) => {
  /*
   * Kentän kosketus kuplii kerrokselle, joka tulkitsee napautuksen lopetukseksi.
   * Ilman pysäytystä kohdistinta ei voisi siirtää sanan keskelle: jokainen
   * kosketus omaan tekstiin sulkisi kentän.
   */
  await avaaLive(page);
  await tekstiTila(page);

  const { x, y } = await rivinKohta(page);
  await napauta(page, x, y);
  await expect(kirjoitettava(page)).toBeFocused();
  await page.keyboard.type('capo 3');

  const alue = (await kirjoitettava(page).boundingBox())!;
  await napauta(page, alue.x + alue.width / 2, alue.y + alue.height / 2);

  await expect(kirjoitettava(page)).toHaveValue('capo 3');
});

test('kenttä siirtyy vetämällä ja siirto säilyy', async ({ page }) => {
  await avaaLive(page);
  await tekstiTila(page);
  await kirjoita(page, 'capo 3', 0.2);

  const sijainti = async () => (await kentat(page).first().boundingBox())!.x;
  const ennen = await sijainti();

  const laatikko = (await kentat(page).first().boundingBox())!;
  const y = laatikko.y + laatikko.height / 2;
  const alku = laatikko.x + laatikko.width / 2;
  await veda(kentat(page).first(), alku, alku + 80, y);

  await expect.poll(sijainti).toBeGreaterThan(ennen + 60);
  const siirretty = await sijainti();

  // Siirto tallentuu: uudelleen avattaessa kenttä on siellä minne se jätettiin.
  await page.getByLabel('Exit live mode').click();
  await page.getByRole('button', { name: 'Live', exact: true }).click();
  await expect(kentat(page)).toHaveCount(1);
  expect(Math.abs((await sijainti()) - siirretty)).toBeLessThan(2);
});

test('lyhyt napautus ei siirrä kenttää vaan avaa sen', async ({ page }) => {
  // Sormi liikkuu aina hieman. Ilman kynnystä kenttä karkaisi napautuksesta.
  await avaaLive(page);
  await tekstiTila(page);
  await kirjoita(page, 'capo 3');

  const laatikko = (await kentat(page).first().boundingBox())!;
  const x = laatikko.x + laatikko.width / 2;
  const y = laatikko.y + laatikko.height / 2;
  const kentta = kentat(page).first();
  await lahetaElementille(kentta, 'pointerdown', x, y);
  await lahetaElementille(kentta, 'pointermove', x + 2, y + 1);
  await lahetaElementille(kentta, 'pointerup', x + 2, y + 1);

  await expect(kirjoitettava(page)).toBeFocused();
  expect(Math.abs((await kentat(page).first().boundingBox())!.x - laatikko.x)).toBeLessThan(2);
});

test('kenttä kasvaa tekstikoon mukana', async ({ page }) => {
  /*
   * Sama invariantti kuin vedoilla: koordinaatisto on rivin fonttikoko, joten
   * kentän on kasvettava samassa suhteessa kuin kirjainten. Pikseliin tai rivin
   * leveyteen sidottu kenttä jäisi paikalleen tekstin kasvaessa.
   */
  await avaaLive(page);
  await tekstiTila(page);
  await kirjoita(page, 'capo 3', 0.4);

  const mitat = () =>
    page.locator('.live-view .annot-text-body').first().evaluate((el) => ({
      koko: parseFloat(getComputedStyle(el).fontSize),
      x: el.getBoundingClientRect().x,
    }));

  const ennen = await mitat();
  const lehti = (await page.locator('.live-view .sheet-line').first().boundingBox())!;

  // Kaksi askelta suuremmaksi: 20 → 24 pikseliä, eli kerroin 1.2.
  await page.getByLabel('Larger text').click();
  await page.getByLabel('Larger text').click();

  await expect.poll(async () => Math.round(((await mitat()).koko / ennen.koko) * 100)).toBe(120);
  // Myös sijainti rivin alusta skaalautuu, ei vain kirjasinkoko.
  const jalkeen = await mitat();
  expect(Math.round(((jalkeen.x - lehti.x) / (ennen.x - lehti.x)) * 100)).toBeGreaterThan(115);
});

test('kirjasin ja lihavointi tarttuvat kirjoitettavaan kenttään', async ({ page }) => {
  await avaaLive(page);
  await tekstiTila(page);

  const { x, y } = await rivinKohta(page);
  await napauta(page, x, y);
  await expect(kirjoitettava(page)).toBeFocused();
  await page.keyboard.type('hiljaa');

  // Kirjasin kiertää sans → mono → serif, joten serif on kahden napautuksen päässä.
  await page.getByLabel('Font: Sans').click();
  await page.getByLabel('Font: Mono').click();
  await expect(page.getByLabel('Font: Serif')).toBeVisible();
  await page.getByLabel('Bold').click();
  await page.keyboard.press('Escape');

  const asu = await page
    .locator('.live-view .annot-text-body')
    .first()
    .evaluate((el) => {
      const tyyli = getComputedStyle(el);
      return { perhe: tyyli.fontFamily, paksuus: tyyli.fontWeight };
    });
  expect(asu.perhe).toContain('Georgia');
  expect(Number(asu.paksuus)).toBeGreaterThanOrEqual(700);
});

test('peittävä tausta erottaa kentän sanoituksesta', async ({ page }) => {
  await avaaLive(page);
  await tekstiTila(page);

  const { x, y } = await rivinKohta(page);
  await napauta(page, x, y);
  await expect(kirjoitettava(page)).toBeFocused();
  await page.keyboard.type('2x');
  await page.getByLabel('Solid background').click();
  await page.keyboard.press('Escape');

  const tausta = await page
    .locator('.live-view .annot-text-body')
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(tausta).not.toBe('rgba(0, 0, 0, 0)');
  expect(tausta).not.toBe('transparent');
});

test('kynä piirtää kentän päälle', async ({ page }) => {
  /*
   * Tekstikerros on kentän kohdalla, mutta kynätilassa sen ei pidä ottaa
   * kosketuksia vastaan lainkaan. Muuten kenttää ei voisi ympyröidä eikä
   * yliviivata, ja veto katkeaisi juuri siitä mistä se on kiinnostavin.
   */
  await avaaLive(page);
  await tekstiTila(page);
  await kirjoita(page, 'capo 3', 0.3);

  const laatikko = (await kentat(page).first().boundingBox())!;
  const y = laatikko.y + laatikko.height / 2;
  await page.getByRole('button', { name: 'Pen', exact: true }).click();

  // Kynätilassa päällimmäisenä on piirtokerros, ei kenttä.
  expect(await kerrosKohdassa(page, laatikko.x + laatikko.width / 2, y)).toContain('annot active');

  const kerros = page.locator('.live-view .annot').first();
  await veda(kerros, laatikko.x - 10, laatikko.x + laatikko.width + 10, y);

  await expect.poll(() => page.locator('.live-view .annot path').count()).toBe(1);
  await expect(kentat(page)).toHaveCount(1);
});

test('pyyhekumi ei poista tekstikenttää', async ({ page }) => {
  /*
   * Pyyhekumi koskee vetoihin. Kirjoitettua tekstiä ei voi piirtää takaisin,
   * joten yksi harhainen pyyhkäisy ei saa viedä sitä – kenttä poistetaan
   * tyhjentämällä tai roskakorista.
   */
  await avaaLive(page);
  await tekstiTila(page);
  await kirjoita(page, 'capo 3', 0.3);

  const laatikko = (await kentat(page).first().boundingBox())!;
  const y = laatikko.y + laatikko.height / 2;

  const kerros = page.locator('.live-view .annot').first();
  await page.getByRole('button', { name: 'Pen', exact: true }).click();
  await veda(kerros, laatikko.x - 10, laatikko.x + laatikko.width + 10, y);
  await expect.poll(() => page.locator('.live-view .annot path').count()).toBe(1);

  await page.getByRole('button', { name: 'Erase', exact: true }).click();
  await veda(kerros, laatikko.x - 10, laatikko.x + laatikko.width + 10, y);

  await expect.poll(() => page.locator('.live-view .annot path').count()).toBe(0);
  await expect(kentat(page)).toHaveCount(1);
});

test('kumoaminen poistaa viimeisimmän tekstikentän', async ({ page }) => {
  await avaaLive(page);
  await tekstiTila(page);
  await kirjoita(page, 'capo 3');

  await page.getByLabel('Undo annotation').click();
  await expect(kentat(page)).toHaveCount(0);
});

test('kenttä tulee mukaan tulostuslehdelle', async ({ page }) => {
  // Tuloste on sama SongSheet, ja se on editorissa `display: none`. Kentän
  // sijainti tulee CSS:n em-yksiköistä, joten se ei vaadi ladontaa.
  await avaaLive(page);
  await tekstiTila(page);
  await kirjoita(page, 'capo 3');

  await page.getByLabel('Exit live mode').click();
  await expect(page.locator('.live-view')).toHaveCount(0);

  await expect.poll(() => page.locator('.song-sheet .annot-text-body').count()).toBe(1);
  const kentta = await page
    .locator('.song-sheet .annot-text-body')
    .first()
    .evaluate((el) => ({ teksti: el.textContent, vasen: (el.parentElement as HTMLElement).style.left }));
  expect(kentta.teksti).toBe('capo 3');
  // Sijainti on em-yksiköissä eikä pikseleissä: se kelpaa myös ladottomana.
  expect(kentta.vasen).toContain('em');
});

test('työkalurivit eivät vuoda ruudun yli', async ({ page }) => {
  // Kuvakaappaukset ovat toistuvasti löytäneet juuri tämän: painike valuu
  // näytön ulkopuolelle kapealla puhelimella.
  await avaaLive(page);
  await tekstiTila(page);
  expect(await vaakaYlivuoto(page)).toBe(0);

  const { x, y } = await rivinKohta(page);
  await napauta(page, x, y);
  await expect(kirjoitettava(page)).toBeFocused();
  // Roskakori ilmestyy vasta kirjoitettaessa; rivi ei saa silloinkaan levitä.
  expect(await vaakaYlivuoto(page)).toBe(0);
});
