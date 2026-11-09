import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import {
  avaaLaulu,
  avaaLista,
  DB_VERSION,
  laulu,
  nauhoitteet,
  PITKA_RIVI,
  tallennettuLaulu,
  vaarennaMikrofoni,
} from './apu';

/**
 * Laatuerän viat. Kaikki kolme löytyivät kuvakaappauksista eivätkä testeistä:
 * mikään ei ollut rikki toiminnaltaan, vaan näkymä ei näyttänyt sitä mitä sen
 * piti. Siksi testit mittaavat ladontaa eivätkä käytöstä.
 */

/** Mahtuuko elementin sisältö sen omaan laatikkoon. */
const mahtuu = (page: Page, selector: string) =>
  page.locator(selector).evaluate((el) => el.scrollWidth <= el.clientWidth);

/*
 * Nopeus näkyi puhelimessa muodossa «S.»: teksti «Speed 20» sai palkista sen
 * tilan joka painikkeilta jäi, ja kynäpainikkeen lisääminen vei senkin. Luku on
 * se mitä säädetään, joten sen on näyttävä kokonaan – myös kapeimmalla
 * puhelimella, jolla sovellusta voi käyttää.
 */
for (const leveys of [393, 375, 320]) {
  test(`live-tilan nopeus näkyy kokonaan ${leveys} px leveydellä`, async ({ page }) => {
    await page.setViewportSize({ width: leveys, height: 700 });
    await avaaLaulu(page);
    await page.getByRole('button', { name: 'Live', exact: true }).click();

    const nopeus = page.locator('.live-speed');
    await expect(nopeus).toHaveText(/^\d+$/);
    expect(await mahtuu(page, '.live-speed')).toBe(true);

    // Mikään ohjain ei valu reunan yli. Poistuminen on rivin viimeinen, joten
    // se on ensimmäinen joka putoaisi ruudulta.
    const painikkeet = await page.locator('.live-controls button').all();
    for (const painike of painikkeet) {
      const box = (await painike.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(leveys);
    }

    // 375 pikselistä ylöspäin kaikki on yhdellä rivillä; kapeammalla rivi saa
    // kiertyä, koska kahdeksan säädintä ei mahdu sormenkokoisina 320 pikseliin.
    if (leveys >= 375) {
      const ylareunat = await Promise.all(painikkeet.map(async (p) => (await p.boundingBox())!.y));
      expect(new Set(ylareunat.map(Math.round)).size).toBe(1);
    }
  });
}

/*
 * Pitkän rivin muokkaus vierittää sanoituslaatikon sivulle. Otsikot ja rivin
 * asetuspainikkeet vierittyivät mukana: osion nimestä jäi näkyviin «RSE 1», ja
 * painike jolla rivin laji vaihdetaan katosi kokonaan.
 */
test('osion otsikko ja rivin asetuspainike pysyvät näkyvissä sivuvierityksessä', async ({ page }) => {
  await avaaLaulu(
    page,
    laulu({
      lines: [
        { id: 'l1', text: PITKA_RIVI, section: { kind: 'verse' }, chords: [] },
        { id: 'l2', text: 'lyhyt', chords: [] },
      ],
    }),
  );

  /* Lepotilassa mikään ei saa liikkua: tarttuva painike istuu rivin alussa
     tekstin vieressä, ei sen päällä. Väärä tarttumiskohta siirsi sen kuusi
     pikseliä oikealle jo ennen kuin mitään oli vieritetty. */
  const painikeLevossa = (await page.getByLabel('Line settings').first().boundingBox())!;
  const tekstiLevossa = (await page.locator('input.text').first().boundingBox())!;
  expect(tekstiLevossa.x).toBeGreaterThanOrEqual(painikeLevossa.x + painikeLevossa.width);

  const laatikko = page.locator('.lyrics');
  await laatikko.evaluate((el) => (el.scrollLeft = el.scrollWidth));
  expect(await laatikko.evaluate((el) => el.scrollLeft)).toBeGreaterThan(50);

  const reuna = (await laatikko.boundingBox())!;
  for (const kohde of [page.locator('.section-name').first(), page.getByLabel('Line settings').first()]) {
    const box = (await kohde.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(reuna.x);
    expect(box.x + box.width).toBeLessThanOrEqual(reuna.x + reuna.width);
  }
  // Painike on vieritettynä täsmälleen siinä missä se oli levossa.
  const painikeVieritettyna = (await page.getByLabel('Line settings').first().boundingBox())!;
  expect(Math.abs(painikeVieritettyna.x - painikeLevossa.x)).toBeLessThan(1);

  /* Näkyvissä ei riitä: painikkeen on oltava päällimmäisenä, muuten sen alta
     vierivä teksti ottaisi napautuksen. */
  const painike = (await page.getByLabel('Line settings').first().boundingBox())!;
  const paalla = await page.evaluate(
    ([x, y]) => document.elementFromPoint(x, y)?.closest('button')?.getAttribute('aria-label'),
    [painike.x + painike.width / 2, painike.y + painike.height / 2],
  );
  expect(paalla).toBe('Line settings');
});

/*
 * Rivilakanan valinnat ladottiin sointujen tasalevyisellä fontilla, koska ne
 * lainasivat sointuchipien riviä. Sama vika oli tagilakanassa.
 */
test('rivilakanan valinnat ovat käyttöliittymän fontilla, sointuchipit tasalevyisellä', async ({ page }) => {
  await avaaLaulu(page);
  const fontti = (nimi: string) =>
    page
      .locator('.sheet')
      .getByRole('button', { name: nimi, exact: true })
      .evaluate((el) => getComputedStyle(el).fontFamily);

  await page.getByLabel('Line settings').first().click();
  const tallenna = await fontti('Save');
  expect(await fontti('Chord bars')).toBe(tallenna);
  expect(await fontti('Chorus')).toBe(tallenna);
  expect(await fontti('Duplicate line')).toBe(tallenna);
  await page.locator('.sheet').getByRole('button', { name: 'Cancel' }).click();

  // Soinnut ovat edelleen tasalevyisiä: ne ladotaan samalla fontilla kuin lehti.
  await page.locator('.chord').first().click();
  expect(await fontti('F')).not.toBe(tallenna);
});

/* --- Kantavirheet näkyviin --- */

/**
 * Saa kannan kirjoitukset epäonnistumaan kuin tallennustila olisi täynnä.
 *
 * Kutsutaan vasta kun sovellus on latautunut: kylvö tarvitsee toimivan kannan.
 */
async function rikoKirjoitukset(page: Page, vainTaulu?: string): Promise<void> {
  await page.evaluate((taulu) => {
    const alkuperainen = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore['put']>) {
      if (!taulu || this.name === taulu) {
        throw new DOMException('Tila on täynnä', 'QuotaExceededError');
      }
      return alkuperainen.apply(this, args);
    };
  }, vainTaulu);
}

/*
 * Näkymä päivittyy heti ja kanta kirjoitetaan taustalla, joten epäonnistunut
 * tallennus ei näkynyt missään: laulu oli ruudulla mutta ei kannassa, ja puute
 * paljastui vasta kun sovellus avattiin uudelleen.
 */
test('epäonnistunut tallennus kerrotaan käyttäjälle', async ({ page }) => {
  await avaaLaulu(page);
  await expect(page.getByRole('alert')).toHaveCount(0);

  await rikoKirjoitukset(page);
  await page.getByPlaceholder('Song title').fill('Muutettu nimi');

  const ilmoitus = page.getByRole('alert');
  await expect(ilmoitus).toContainText('Saving failed');
  // Selaimen oma viesti mukana: se kertoo syyn, esimerkiksi täyden tilan.
  await expect(ilmoitus).toContainText('Tila on täynnä');

  // Ilmoitus ei katoa itsestään, mutta sen saa pois.
  await ilmoitus.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('onnistunut tallennus ei näytä ilmoitusta', async ({ page }) => {
  await avaaLaulu(page);
  await page.getByPlaceholder('Song title').fill('Muutettu nimi');
  await expect
    .poll(async () => JSON.parse(await tallennettuLaulu(page)).title)
    .toBe('Muutettu nimi');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

/*
 * Nauhoite on se tiedosto jota ei voi tehdä uudelleen. Aiemmin epäonnistunut
 * tallennus katkaisi käsittelijän hiljaa: otto ei ilmestynyt listaan eikä
 * mikään kertonut miksi.
 */
test('hukkunut nauhoite kerrotaan eikä näy listassa tallennettuna', async ({ page }) => {
  await vaarennaMikrofoni(page);
  await avaaLaulu(page);
  await rikoKirjoitukset(page, 'recordings');

  await page.getByRole('button', { name: '● Record' }).click();
  await page.getByRole('button', { name: '■ Stop' }).click();

  await expect(page.getByRole('alert')).toContainText('Saving failed');
  // Lista ei väitä että otto on tallessa.
  await expect(page.locator('.rec-card')).toHaveCount(0);
  expect(await nauhoitteet(page)).toEqual([]);
});

/* --- Kaatumisnäkymä --- */

/*
 * Rikkinäinen tietue kannassa kaataa listan joka kerta kun sovellus avataan.
 * Ilman virherajaa ruutu jäi valkoiseksi, eikä valkoisesta ruudusta pääse
 * varmuuskopioon – vaikka muut laulut ovat kannassa tallessa.
 */
test('rikkinäinen tietue johtaa kaatumisnäkymään, josta saa varmuuskopion', async ({ page }) => {
  await avaaLista(page);
  await page.evaluate(
    (versio) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('sanoittaja', versio);
        req.onsuccess = () => {
          const tx = req.result.transaction('songs', 'readwrite');
          // `lines` puuttuu: lista lukee siitä rivimäärän ja kaatuu.
          tx.objectStore('songs').put({ id: 'rikki', title: 'Rikki', songKey: '', createdAt: 1, updatedAt: 9 });
          tx.oncomplete = () => {
            req.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      }),
    DB_VERSION,
  );
  await page.reload();

  const nakyma = page.getByRole('alert');
  await expect(nakyma).toContainText('Something went wrong');

  // Varmuuskopio lukee kannan suoraan, joten se toimii vaikka näkymä ei.
  const lataus = page.waitForEvent('download');
  await nakyma.getByRole('button', { name: 'Download backup' }).click();
  const tiedosto = await (await lataus).path();
  const paketti = JSON.parse(await readFile(tiedosto, 'utf8'));
  expect(paketti.songs.map((s: { title: string }) => s.title).sort()).toEqual(['Kuu valaisee', 'Rikki']);
  await expect(nakyma).toContainText('Backup saved');
});

/* --- Kotiruutukuvake --- */

/*
 * Kuvake oli pelkkä SVG. iOS ei käytä sitä kotiruudulla, ja Android haluaa
 * manifestiin rasterikoot. Testi hakee tiedostot oikeasti: väärä polku
 * manifestissa ei kaada mitään, se vain jättää kuvakkeen pois.
 */
test('kotiruutukuvakkeet ovat PNG-tiedostoja jotka latautuvat', async ({ page, request, baseURL }) => {
  await page.goto('/');

  const apple = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  expect(apple).toMatch(/\.png$/);

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifest = await (await request.get(new URL(manifestHref!, `${baseURL}/`).href)).json();
  const pngt = (manifest.icons as { src: string; type: string; purpose: string }[]).filter(
    (icon) => icon.type === 'image/png',
  );
  // Maskattava erikseen: «any maskable» samalla kuvalla leikkaisi pyöristetyn
  // kuvakkeen kulmat toiseen kertaan.
  expect(pngt.map((icon) => icon.purpose).sort()).toEqual(['any', 'any', 'maskable']);

  for (const src of [apple!, ...pngt.map((icon) => icon.src)]) {
    const vastaus = await request.get(new URL(src, `${baseURL}/`).href);
    expect(vastaus.status(), src).toBe(200);
    expect(vastaus.headers()['content-type'], src).toContain('image/png');
  }
});
