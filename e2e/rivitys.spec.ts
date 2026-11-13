import { expect, test, type Page } from '@playwright/test';
import {
  avaaLaulu,
  avaaSaadot,
  DB_VERSION,
  laulu,
  PITKA_RIVI,
} from './apu';

/**
 * Pitkän rivin rivitys live-tilassa.
 *
 * Rivitys on laitekohtainen: puhelin taittaa rivin, leveä näyttö näyttää sen
 * kokonaisena. Siitä seuraa tämän tiedoston tärkein kysymys – **löytyykö
 * yhdellä näytöllä piirretty merkintä toiselta oikean sanan kohdalta**.
 * Merkinnät ovat tallessa suhteessa taittamattomaan riviin, ja taitto on
 * näyttömuunnos; testit vaihtavat näytön kokoa kesken ja mittaavat missä
 * merkintä on suhteessa sanaansa.
 *
 * Näytön koko vaihdetaan live-tilan ollessa auki. Se on samalla näytön
 * kääntämisen testi: lehti mittaa itsensä uudelleen.
 */

const PUHELIN = { width: 393, height: 852 };
const LEVEA = { width: 1180, height: 820 };

function pitkaLaulu() {
  return laulu({
    lines: [
      {
        id: 'l1',
        text: PITKA_RIVI,
        section: { kind: 'verse' },
        chords: [
          { id: 'c1', pos: 0, symbol: 'Am' },
          { id: 'c2', pos: 32, symbol: 'F' },
        ],
      },
      { id: 'l2', text: 'lyhyt rivi', chords: [] },
      {
        id: 'l3',
        text: '',
        chords: [],
        section: { kind: 'solo' },
        bars: ['Am', 'F', 'C', 'G', 'Em', 'Dm7', 'G', 'C'],
      },
    ],
  });
}

async function avaaLive(page: Page, koko = PUHELIN) {
  /* Osoittimen kaappaus vaatii oikean osoittimen: synteettisellä id:llä kutsu
     kaataisi käsittelijän ennen kuin se ehtii tehdä mitään. */
  await page.addInitScript(() => {
    Element.prototype.setPointerCapture = () => {};
  });
  await page.setViewportSize(koko);
  await avaaLaulu(page, pitkaLaulu());
  await page.getByRole('button', { name: 'Live', exact: true }).click();
  await expect(page.locator('.live-view')).toBeVisible();
}

/** Pitkän rivin taitokset tekstinä. */
const taitokset = (page: Page) =>
  page.locator('.live-view [data-line="l1"] .sheet-seg .sheet-lyric').allTextContents();

const ylivuoto = (page: Page) =>
  page.locator('.live-scroll').evaluate((el) => el.scrollWidth - el.clientWidth);

interface Laatikko {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Sanan tai soinnun paikka näytöllä. Sen on oltava rivillä kerran. */
function sana(page: Page, teksti: string, rivi = 'l1'): Promise<Laatikko> {
  return page.evaluate(([haettu, id]) => {
    const valitsin = `.live-view [data-line="${id}"] .sheet-lyric, .live-view [data-line="${id}"] .sheet-bars`;
    for (const pre of document.querySelectorAll(valitsin)) {
      const solmu = pre.firstChild;
      const kohta = solmu?.textContent?.indexOf(haettu) ?? -1;
      if (!solmu || kohta === -1) continue;
      const range = document.createRange();
      range.setStart(solmu, kohta);
      range.setEnd(solmu, kohta + haettu.length);
      const r = range.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    }
    throw new Error(`sanaa «${haettu}» ei löytynyt`);
  }, [teksti, rivi] as const);
}

/** Piirrettyjen vetojen paikat näytöllä, vasemmalta oikealle ja ylhäältä alas. */
function vedot(page: Page): Promise<Laatikko[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('.live-view .annot path')]
      .map((path) => {
        const r = path.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      })
      .sort((a, b) => a.top - b.top || a.left - b.left),
  );
}

/**
 * Lähettää osoitintapahtuman niin kuin oikea kosketus.
 *
 * Ele alkaa elementistä joka kohdassa on päällimmäisenä, ja **pysyy siinä**
 * kunnes sormi nousee – sovellus kaappaa osoittimen, joten rivin reunan yli
 * jatkuva veto kuuluu yhä riville jolta se alkoi. Ilman tätä ympyrän alakaari
 * meni naapuririville ja ympyrästä jäi puolikas.
 *
 * Yksi tapahtuma per kierros: kesken oleva veto elää Reactin tilassa.
 */
async function laheta(page: Page, tapahtuma: string, x: number, y: number, pointerType = 'pen') {
  await page.evaluate(
    ([nimi, cx, cy, type]) => {
      const w = window as unknown as { __ote?: Element | null };
      if (nimi === 'pointerdown') w.__ote = document.elementFromPoint(cx as number, cy as number);
      const el = w.__ote;
      if (!el) throw new Error(`ei elementtiä kohdassa ${cx},${cy}`);
      if (nimi === 'pointerup') w.__ote = null;
      el.dispatchEvent(
        new PointerEvent(nimi as string, {
          pointerId: 1,
          pointerType: type as string,
          clientX: cx as number,
          clientY: cy as number,
          buttons: 1,
          bubbles: true,
          cancelable: true,
        }),
      );
    },
    [tapahtuma, x, y, pointerType] as const,
  );
}

/** Vetää murtoviivan pisteiden kautta. */
async function piirra(page: Page, pisteet: [number, number][]) {
  const [alku, ...loput] = pisteet;
  await laheta(page, 'pointerdown', alku[0], alku[1]);
  for (const [x, y] of loput) await laheta(page, 'pointermove', x, y);
  const [lx, ly] = pisteet[pisteet.length - 1];
  await laheta(page, 'pointerup', lx, ly);
}

/** Alleviivaus laatikon alareunaan. */
function alleviivaa(page: Page, a: Laatikko, b: Laatikko = a) {
  const y = a.bottom - 2;
  return piirra(page, [
    [a.left, y],
    [(a.left + b.right) / 2, y],
    [b.right, y],
  ]);
}

async function piirtoTila(page: Page) {
  await page.getByLabel('Draw on the sheet').click();
  await expect(page.locator('.draw-tools')).toBeVisible();
}

/** Vaihtaa näytön kokoa ja odottaa että lehti on mitannut itsensä uudelleen. */
async function vaihdaNaytto(page: Page, koko: { width: number; height: number }, palojaOdotetaan: 'yksi' | 'monta') {
  await page.setViewportSize(koko);
  await expect
    .poll(async () => ((await taitokset(page)).length > 1 ? 'monta' : 'yksi'))
    .toBe(palojaOdotetaan);
}

/** Onko veto sanan alla: vaakasuunnassa sanan kohdalla, pystysuunnassa sen alareunassa. */
function odotaSananAlla(veto: Laatikko, kohde: Laatikko) {
  expect(Math.abs(veto.left - kohde.left), 'vasen reuna').toBeLessThan(3);
  expect(Math.abs(veto.right - kohde.right), 'oikea reuna').toBeLessThan(3);
  expect(veto.top, 'ei sanan yläpuolella').toBeGreaterThan(kohde.top);
  expect(veto.bottom, 'ei seuraavalla rivillä').toBeLessThanOrEqual(kohde.bottom + 1);
}

/* --- Rivitys --- */

test('pitkä rivi taittuu puhelimella eikä valu reunan yli', async ({ page }) => {
  await avaaLive(page);

  const palat = await taitokset(page);
  expect(palat.length).toBeGreaterThan(1);
  expect(await ylivuoto(page)).toBeLessThanOrEqual(0);

  // Mitään ei katoa eikä kahdennu: taitokset peräkkäin ovat alkuperäinen rivi.
  // Jatkorivit on sisennetty, jotta taittunut rivi erottuu uudesta säkeestä.
  for (const jatko of palat.slice(1)) expect(jatko).toMatch(/^ {2}\S/);
  expect(palat.map((p, i) => (i === 0 ? p : p.slice(2))).join('')).toBe(PITKA_RIVI);
});

test('lyhyt rivi ei taitu', async ({ page }) => {
  await avaaLive(page);
  await expect(page.locator('.live-view [data-line="l2"] .sheet-seg')).toHaveCount(1);
});

/* Käyttäjän vaatimus: iPadin ruudulla ei katkaista rivejä, jotka ovat pitkiä
   vain puhelimelle. */
test('leveällä näytöllä rivi on kokonainen', async ({ page }) => {
  await avaaLive(page, LEVEA);
  expect(await taitokset(page)).toEqual([PITKA_RIVI]);
});

test('sointu pysyy sanansa yllä taitoksessa', async ({ page }) => {
  await avaaLive(page);

  // F on sanan «ja» yllä (sarake 32), joka puhelimella on toisella näyttörivillä.
  const toinen = page.locator('.live-view [data-line="l1"] .sheet-seg').nth(1);
  const soinnut = (await toinen.locator('.sheet-chords').textContent()) ?? '';
  const teksti = (await toinen.locator('.sheet-lyric').textContent()) ?? '';
  expect(soinnut.trim()).toBe('F');
  expect(soinnut.indexOf('F')).toBe(teksti.indexOf('ja sateen'));
});

/* Tyhjä sointurivi jokaisella jatkorivillä näytti siltä kuin säe olisi hajonnut
   erillisiksi pätkiksi. */
test('taitoksella jonka yllä ei ole sointuja ei ole tyhjää sointuriviä', async ({ page }) => {
  await avaaLive(page);
  const kolmas = page.locator('.live-view [data-line="l1"] .sheet-seg').nth(2);
  await expect(kolmas.locator('.sheet-lyric')).toBeVisible();
  await expect(kolmas.locator('.sheet-chords')).toHaveCount(0);
});

test('tekstikoon muutos taittaa rivin uudelleen', async ({ page }) => {
  await avaaLive(page);
  const alussa = (await taitokset(page)).length;

  await avaaSaadot(page);
  for (let i = 0; i < 4; i++) await page.getByLabel('Larger text').click();
  await expect.poll(async () => (await taitokset(page)).length).toBeGreaterThan(alussa);
  expect(await ylivuoto(page)).toBeLessThanOrEqual(0);

  await avaaSaadot(page);
  // 28 → 14, joka on pienin koko; sen alle painike ei enää vie.
  for (let i = 0; i < 7; i++) await page.getByLabel('Smaller text').click();
  await expect.poll(async () => (await taitokset(page)).length).toBeLessThan(alussa);
  expect(await ylivuoto(page)).toBeLessThanOrEqual(0);
});

test('näytön kääntäminen taittaa ja avaa rivin', async ({ page }) => {
  await avaaLive(page);
  expect((await taitokset(page)).length).toBeGreaterThan(1);

  await vaihdaNaytto(page, LEVEA, 'yksi');
  await vaihdaNaytto(page, PUHELIN, 'monta');
  expect(await ylivuoto(page)).toBeLessThanOrEqual(0);
});

/* Tulostuslehti on editorissa `display: none`, eikä siltä voi mitata mitään.
   Rivitys ei siksi saa koskea siihen. */
test('tulostuslehti ei rivity', async ({ page }) => {
  await page.setViewportSize(PUHELIN);
  await avaaLaulu(page, pitkaLaulu());
  const tuloste = page.locator('main .song-sheet [data-line="l1"] .sheet-seg .sheet-lyric');
  expect(await tuloste.allTextContents()).toEqual([PITKA_RIVI]);
});

/* --- Sointurivit --- */

const tahtirivit = (page: Page) =>
  page.locator('.live-view [data-line="l3"] .sheet-seg .sheet-bars').allTextContents();

/* Kahdeksan tahdin rivi ei mahdu puhelimelle. Ilman tätä yksi pitkä sointurivi
   toisi vaakavierityksen takaisin, vaikka sanoitukset rivittyisivät. */
test('pitkä sointurivi taittuu tahtiviivasta', async ({ page }) => {
  await avaaLive(page);

  const palat = await tahtirivit(page);
  expect(palat.length).toBeGreaterThan(1);
  // Jokainen pala on kokonainen rivi tahtiviivasta tahtiviivaan.
  for (const pala of palat) expect(pala).toMatch(/^\| .* \|$/);
  // Tahdit ovat tallella ja järjestyksessä.
  expect(palat.join(' ').match(/[A-G][a-z0-9]*/g)).toEqual(['Am', 'F', 'C', 'G', 'Em', 'Dm7', 'G', 'C']);
  expect(await ylivuoto(page)).toBeLessThanOrEqual(0);
});

test('sointurivi on leveällä näytöllä kokonainen', async ({ page }) => {
  await avaaLive(page, LEVEA);
  expect(await tahtirivit(page)).toHaveLength(1);
});

test('soinnun alle piirretty viiva pysyy soinnun alla taitetulla sointurivillä', async ({ page }) => {
  await avaaLive(page, LEVEA);
  await piirtoTila(page);
  await alleviivaa(page, await sana(page, 'Dm7', 'l3'));

  await vaihdaNaytto(page, PUHELIN, 'monta');
  expect((await tahtirivit(page)).length).toBeGreaterThan(1);

  const veto = await vedot(page);
  expect(veto).toHaveLength(1);
  odotaSananAlla(veto[0], await sana(page, 'Dm7', 'l3'));
});

/* --- Merkinnät seuraavat sanaansa --- */

test('leveällä näytöllä alleviivattu sana on alleviivattu myös puhelimella', async ({ page }) => {
  await avaaLive(page, LEVEA);
  await piirtoTila(page);
  await alleviivaa(page, await sana(page, 'kunnes'));
  odotaSananAlla((await vedot(page))[0], await sana(page, 'kunnes'));

  await vaihdaNaytto(page, PUHELIN, 'monta');

  // «kunnes» on puhelimella toisella näyttörivillä; viiva on siirtynyt mukana.
  const veto = await vedot(page);
  expect(veto).toHaveLength(1);
  odotaSananAlla(veto[0], await sana(page, 'kunnes'));
});

test('puhelimella alleviivattu sana on alleviivattu myös leveällä näytöllä', async ({ page }) => {
  await avaaLive(page);
  await piirtoTila(page);
  // Viimeinen sana: puhelimella kolmannella näyttörivillä.
  await alleviivaa(page, await sana(page, 'ikkunaan'));
  // Veto pysyy paikallaan kun sormi nousee, eikä hyppää muunnoksessa.
  odotaSananAlla((await vedot(page))[0], await sana(page, 'ikkunaan'));

  await vaihdaNaytto(page, LEVEA, 'yksi');

  const veto = await vedot(page);
  expect(veto).toHaveLength(1);
  odotaSananAlla(veto[0], await sana(page, 'ikkunaan'));
});

/* Merkintä tallennetaan suhteessa taittamattomaan riviin, jotta sama tietue
   kelpaa kaikille näytöille eikä tallennusmuotoon tarvinnut koskea. */
test('puhelimella piirretty tallentuu taittamattoman rivin koordinaatteihin', async ({ page }) => {
  await avaaLive(page);
  await piirtoTila(page);
  const kohde = await sana(page, 'ikkunaan');
  await alleviivaa(page, kohde);

  const talletettu = await expect
    .poll(async () => (await merkinnat(page)).length)
    .toBe(1)
    .then(() => merkinnat(page));
  const xt = (talletettu[0].points as number[]).filter((_, i) => i % 2 === 0);
  // «ikkunaan» alkaa sarakkeesta 73. Merkki on noin 0,6 em, joten viiva alkaa
  // nauhalla noin 44 em:n kohdalta – näytöllä sana on aivan rivin alussa.
  expect(Math.min(...xt)).toBeGreaterThan(40);
});

test('taittokohdan yli menevä alleviivaus jakautuu kahdelle näyttöriville', async ({ page }) => {
  await avaaLive(page, LEVEA);
  await piirtoTila(page);
  // «halki» ja «yön» ovat puhelimella taittokohdan eri puolilla.
  await alleviivaa(page, await sana(page, 'halki'), await sana(page, 'yön'));
  expect(await vedot(page)).toHaveLength(1);

  await vaihdaNaytto(page, PUHELIN, 'monta');
  const halki = await sana(page, 'halki');
  const yon = await sana(page, 'yön');
  expect(yon.top).toBeGreaterThan(halki.bottom - 1);

  const palat = await vedot(page);
  expect(palat).toHaveLength(2);
  // Ensimmäinen pala päättyy ensimmäisen rivin viimeisen sanan alle…
  expect(Math.abs(palat[0].left - halki.left)).toBeLessThan(3);
  expect(palat[0].bottom).toBeLessThanOrEqual(halki.bottom + 1);
  // …ja toinen jatkuu toisen rivin ensimmäisen sanan alta.
  expect(Math.abs(palat[1].right - yon.right)).toBeLessThan(3);
  expect(palat[1].top).toBeGreaterThan(yon.top);
  expect(palat[1].bottom).toBeLessThanOrEqual(yon.bottom + 1);
});

/* Sanan ympärille piirretty ympyrä ylittää aina vähän sanansa reunat. Jos veto
   leikattaisiin taittokohdasta, ympyrän kaari ilmestyisi viereiselle riville. */
test('taittokohdan viereisen sanan ympyrä pysyy yhtenä kappaleena', async ({ page }) => {
  await avaaLive(page, LEVEA);
  await piirtoTila(page);
  const yon = await sana(page, 'yön');
  // Reilusti sanan reunojen yli: vasemmalla edellisen taitoksen puolelle.
  const v = 9;
  const keskiY = (yon.top + yon.bottom) / 2;
  await piirra(page, [
    [yon.left - v, keskiY],
    [(yon.left + yon.right) / 2, yon.top - 2],
    [yon.right + v, keskiY],
    [(yon.left + yon.right) / 2, yon.bottom + 2],
    [yon.left - v, keskiY],
  ]);

  await vaihdaNaytto(page, PUHELIN, 'monta');

  const palat = await vedot(page);
  expect(palat).toHaveLength(1);
  const puhelimella = await sana(page, 'yön');
  expect(Math.abs(palat[0].left - (puhelimella.left - v))).toBeLessThan(3);
  expect(Math.abs(palat[0].right - (puhelimella.right + v))).toBeLessThan(3);
  expect(Math.abs((palat[0].top + palat[0].bottom) / 2 - (puhelimella.top + puhelimella.bottom) / 2)).toBeLessThan(3);
});

/* Veto ei näy puhelimella siinä kohdassa jossa se on tallessa, joten pyyhkimen
   on osuttava siihen siellä missä se näkyy. */
test('pyyhin osuu taitetun rivin vetoon siinä missä se näkyy', async ({ page }) => {
  await avaaLive(page);
  await piirtoTila(page);
  const kohde = await sana(page, 'ikkunaan');
  await alleviivaa(page, kohde);
  expect(await vedot(page)).toHaveLength(1);

  await page.getByRole('button', { name: 'Erase', exact: true }).click();
  const x = (kohde.left + kohde.right) / 2;
  await piirra(page, [
    [x, kohde.top],
    [x, kohde.bottom],
    [x, kohde.bottom + 6],
  ]);

  // Keskeltä pyyhitty viiva on kahtena palana, ja molemmat yhä sanan alla.
  const palat = await vedot(page);
  expect(palat).toHaveLength(2);
  for (const pala of palat) {
    expect(pala.left).toBeGreaterThanOrEqual(kohde.left - 3);
    expect(pala.right).toBeLessThanOrEqual(kohde.right + 3);
    expect(pala.bottom).toBeLessThanOrEqual(kohde.bottom + 1);
  }
});

test('tekstikenttä seuraa sanaansa näytöltä toiselle', async ({ page }) => {
  await avaaLive(page);
  await page.getByLabel('Draw on the sheet').click();
  await page.getByRole('button', { name: 'Text', exact: true }).click();

  // Kenttä viimeisen sanan perään, puhelimella kolmannelle näyttöriville.
  const kohde = await sana(page, 'ikkunaan');
  const x = kohde.right + 6;
  const y = kohde.top + 2;
  await laheta(page, 'pointerdown', x, y, 'touch');
  await laheta(page, 'pointerup', x, y, 'touch');
  await page.keyboard.type('2x');
  await page.keyboard.press('Escape');

  const kentta = page.locator('.live-view .annot-text');
  await expect(kentta).toHaveText('2x');
  const ero = async () => {
    const box = (await kentta.boundingBox())!;
    const nyt = await sana(page, 'ikkunaan');
    return { dx: box.x - nyt.right, dy: box.y - nyt.top };
  };
  const puhelimella = await ero();
  // Kenttä on siinä mihin napautettiin, eikä hypännyt muunnoksessa.
  expect(Math.abs(puhelimella.dx - 6)).toBeLessThan(3);

  await vaihdaNaytto(page, LEVEA, 'yksi');
  const leveella = await ero();
  expect(Math.abs(leveella.dx - puhelimella.dx)).toBeLessThan(3);
  expect(Math.abs(leveella.dy - puhelimella.dy)).toBeLessThan(3);
});

/* Tarttumakohta lasketaan siitä missä kenttä näkyy. Tallennetusta paikasta
   laskettuna kenttä hyppäsi otteen alkaessa taitoksen verran sivuun. */
test('tekstikentän siirto taitetulla rivillä ei hyppää', async ({ page }) => {
  await avaaLive(page);
  await page.getByLabel('Draw on the sheet').click();
  await page.getByRole('button', { name: 'Text', exact: true }).click();

  const kohde = await sana(page, 'ikkunaan');
  await laheta(page, 'pointerdown', kohde.right + 6, kohde.top + 2, 'touch');
  await laheta(page, 'pointerup', kohde.right + 6, kohde.top + 2, 'touch');
  await page.keyboard.type('2x');
  await page.keyboard.press('Escape');

  const kentta = page.locator('.live-view .annot-text');
  const ennen = (await kentta.boundingBox())!;
  const x = ennen.x + ennen.width / 2;
  const y = ennen.y + ennen.height / 2;

  // 40 pikseliä vasemmalle, saman näyttörivin sisällä.
  await laheta(page, 'pointerdown', x, y, 'touch');
  await laheta(page, 'pointermove', x - 20, y, 'touch');
  await laheta(page, 'pointermove', x - 40, y, 'touch');
  await laheta(page, 'pointerup', x - 40, y, 'touch');

  const jalkeen = (await kentta.boundingBox())!;
  expect(Math.abs(jalkeen.x - (ennen.x - 40))).toBeLessThan(3);
  expect(Math.abs(jalkeen.y - ennen.y)).toBeLessThan(3);
});

/** Kantaan tallennetut merkinnät. */
function merkinnat(page: Page): Promise<Record<string, unknown>[]> {
  return page.evaluate(
    (versio) =>
      new Promise<Record<string, unknown>[]>((resolve, reject) => {
        const req = indexedDB.open('sanoittaja', versio);
        req.onsuccess = () => {
          const all = req.result.transaction('annotations').objectStore('annotations').getAll();
          all.onsuccess = () => resolve(all.result as Record<string, unknown>[]);
          all.onerror = () => reject(all.error);
        };
        req.onerror = () => reject(req.error);
      }),
    DB_VERSION,
  );
}
