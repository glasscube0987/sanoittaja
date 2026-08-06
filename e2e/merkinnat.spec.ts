/**
 * Omat merkinnät nuottilehdellä.
 *
 * Osoitintapahtumat syntetisoidaan `pointerType`-arvoineen, jolloin sekä kynä-
 * että sormipolku tulevat katetuiksi. Oikean Apple Pencilin paine, viive ja
 * kämmentunnistus jäävät silti laitteella kokeiltaviksi – ne eivät toistu
 * selaintestissä.
 */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { avaaLaulu, avaaMonta, laulu, lisaaLauluja, luoSetti } from './apu';

function piirrettavaLaulu() {
  return laulu({
    lines: [
      { id: 'l1', text: 'kuu valaisee yön', section: { kind: 'verse' }, chords: [] },
      { id: 'l2', text: 'ja tie vie pohjoiseen', chords: [] },
    ],
  });
}

async function avaaLive(page: Page) {
  await avaaLaulu(page, piirrettavaLaulu());
  await page.getByRole('button', { name: 'Live', exact: true }).click();
  await expect(page.locator('.live-view')).toBeVisible();
}

async function piirtoTila(page: Page) {
  await page.getByLabel('Draw on the sheet').click();
  await expect(page.locator('.draw-tools')).toBeVisible();
}

/**
 * Vetää viivan annetun kerroksen yli. Playwrightin hiiri ei aseta
 * `pointerType`-arvoa, joten tapahtumat lähetetään suoraan.
 *
 * Jokainen tapahtuma lähetetään omalla kierroksellaan: kesken oleva veto elää
 * Reactin tilassa, joten `pointermove` näkisi saman kierroksen sisällä vielä
 * vanhan arvon. Laitteella tapahtumat tulevat joka tapauksessa erikseen.
 */
async function veda(kerros: Locator, pointerType: 'pen' | 'touch' | 'mouse') {
  const laheta = (nimi: string, osuus: number) =>
    kerros.evaluate(
      (el, [tapahtuma, type, x]) => {
        const box = el.getBoundingClientRect();
        // Kaappaus vaatii oikean osoittimen; testissä se ohitetaan.
        el.setPointerCapture = () => {};
        el.dispatchEvent(
          new PointerEvent(tapahtuma as string, {
            pointerId: 1,
            pointerType: type as string,
            clientX: box.left + box.width * (x as number),
            clientY: box.top + box.height / 2,
            buttons: 1,
            bubbles: true,
            cancelable: true,
          }),
        );
      },
      [nimi, pointerType, osuus] as const,
    );

  await laheta('pointerdown', 0.2);
  await laheta('pointermove', 0.5);
  await laheta('pointermove', 0.8);
  await laheta('pointerup', 0.8);
}

/** Napautus yhteen kohtaan; pyyhkiminen kohdistuu tarkalleen siihen pisteeseen. */
async function napauta(kerros: Locator, osuus: number, pointerType: 'pen' | 'touch') {
  const laheta = (nimi: string) =>
    kerros.evaluate(
      (el, [tapahtuma, type, x]) => {
        const box = el.getBoundingClientRect();
        el.setPointerCapture = () => {};
        el.dispatchEvent(
          new PointerEvent(tapahtuma as string, {
            pointerId: 1,
            pointerType: type as string,
            clientX: box.left + box.width * (x as number),
            clientY: box.top + box.height / 2,
            buttons: 1,
            bubbles: true,
            cancelable: true,
          }),
        );
      },
      [nimi, pointerType, osuus] as const,
    );
  await laheta('pointerdown');
  await laheta('pointerup');
}

/* Editorin tulostuslehdellä on oma kerroksensa, joten laskenta rajataan
   esitysnäkymään. Tulostuslehti tarkistetaan erikseen omassa testissään. */
const vedot = (page: Page) => page.locator('.live-view .annot path').count();

test('piirtotila avaa työkalut ja kynä jättää jäljen', async ({ page }) => {
  await avaaLive(page);
  expect(await vedot(page)).toBe(0);

  await piirtoTila(page);
  await veda(page.locator('.live-view .annot').first(), 'pen');

  await expect.poll(() => vedot(page)).toBe(1);
});

test('veto osion otsikon päältä jättää jäljen', async ({ page }) => {
  /*
   * Osion otsikko oli `.sheet-section`in suora lapsi, ja piirtokerros on vain
   * `.sheet-line`-laatikoiden sisällä. Otsikon päällä ei siis ollut kerrosta
   * lainkaan, eikä sieltä alkava veto osunut mihinkään — juuri sen kohdan yli
   * vedetään kun kertosäe ympyröidään.
   */
  await avaaLive(page);
  await piirtoTila(page);

  const otsikko = page.locator('.live-view .sheet-section h2').first();
  await expect(otsikko).toBeVisible();
  const laatikko = (await otsikko.boundingBox())!;

  /* Ratkaiseva kohta: mikä elementti on otsikon päällä. Selain valitsee
     kosketukselle päällimmäisen elementin, joten piirtokerroksen on oltava
     siellä. Tapahtuman lähettäminen otsikolle itselleen ei kertoisi tästä
     mitään, koska se kuplisi ylöspäin kerroksen ohi. */
  const paallimmainen = await page.evaluate(
    ([x, y]) => document.elementFromPoint(x, y)?.closest('.annot') !== null,
    [laatikko.x + laatikko.width / 2, laatikko.y + laatikko.height / 2],
  );
  expect(paallimmainen).toBe(true);

  // Ja veto sen kohdalta jättää jäljen.
  await veda(page.locator('.live-view .annot').first(), 'pen');
  await expect.poll(() => vedot(page)).toBe(1);
});

test('merkintä säilyy ja palaa uudelleen avattaessa', async ({ page }) => {
  await avaaLive(page);
  await piirtoTila(page);
  await veda(page.locator('.live-view .annot').first(), 'pen');
  await expect.poll(() => vedot(page)).toBe(1);

  await page.getByLabel('Exit live mode').click();
  await page.getByRole('button', { name: 'Live', exact: true }).click();
  await expect.poll(() => vedot(page)).toBe(1);
});

test('merkintä pysyy rivillään kun sen ylle lisätään rivi', async ({ page }) => {
  await avaaLive(page);
  await piirtoTila(page);
  // Veto toiselle riville, jotta yläpuolelle mahtuu uusi rivi.
  await veda(page.locator('.live-view .annot').nth(1), 'pen');
  await expect.poll(() => vedot(page)).toBe(1);
  await page.getByLabel('Exit live mode').click();

  // Uusi rivi ensimmäisen perään siirtää kaikkia alempia rivejä.
  await page.locator('.line input.text').first().click();
  await page.locator('.line-tools').getByRole('button', { name: '+ Line' }).click();

  await page.getByRole('button', { name: 'Live', exact: true }).click();
  // Merkintä on edelleen omalla rivillään eikä jäänyt kolmanneksi riviksi.
  const rivi = page.locator('.live-view .sheet-line', { has: page.locator('.annot path') });
  await expect(rivi.locator('.sheet-lyric')).toHaveText('ja tie vie pohjoiseen');
});

test('merkinnät seuraavat laulua setissä selattaessa', async ({ page }) => {
  await avaaMonta(page, ['Ensimmäinen', 'Toinen']);
  await luoSetti(page, 'Keikka');
  await lisaaLauluja(page, ['Ensimmäinen', 'Toinen']);
  await page.locator('.button-row').getByRole('button', { name: 'Live' }).click();
  await piirtoTila(page);

  await veda(page.locator('.live-view .annot').first(), 'pen');
  await expect.poll(() => vedot(page)).toBe(1);

  // Merkintä kuuluu lauluun, ei esitysnäkymään: seuraavassa laulussa on puhdas
  // lehti, ja takaisin palattaessa veto on paikallaan.
  await page.getByLabel('Next song').click();
  await expect(page.locator('.live-view h1')).toHaveText('Toinen');
  await expect.poll(() => vedot(page)).toBe(0);

  await page.getByLabel('Previous song').click();
  await expect(page.locator('.live-view h1')).toHaveText('Ensimmäinen');
  await expect.poll(() => vedot(page)).toBe(1);
});

test('setin toiselle laululle piirretty jää sille laululle', async ({ page }) => {
  await avaaMonta(page, ['Ensimmäinen', 'Toinen']);
  await luoSetti(page, 'Keikka');
  await lisaaLauluja(page, ['Ensimmäinen', 'Toinen']);
  await page.locator('.button-row').getByRole('button', { name: 'Live' }).click();
  await piirtoTila(page);

  await page.getByLabel('Next song').click();
  await veda(page.locator('.live-view .annot').first(), 'pen');
  await expect.poll(() => vedot(page)).toBe(1);

  await page.getByLabel('Previous song').click();
  await expect.poll(() => vedot(page)).toBe(0);
});

test('pyyhkiminen lyhentää vetoa mitattavasti', async ({ page }) => {
  /*
   * Pyyhekumi ei enää poista koko vetoa yhdestä kosketuksesta – se oli koko
   * muutoksen tarkoitus. Vedon on siis lyhennyttävä, ei kadottava.
   */
  await avaaLive(page);
  await piirtoTila(page);
  await veda(page.locator('.live-view .annot').first(), 'pen');
  await expect.poll(() => vedot(page)).toBe(1);

  const leveys = () =>
    page
      .locator('.live-view .annot path')
      .first()
      .evaluate((el) => (el as SVGPathElement).getBBox().width);
  const ennen = await leveys();

  await page.getByRole('button', { name: 'Erase' }).click();
  await napauta(page.locator('.live-view .annot').first(), 0.2, 'pen');

  await expect.poll(() => vedot(page)).toBe(1);
  expect(await leveys()).toBeLessThan(ennen);
});

test('pyyhekumi pyyhkii vedosta osan eikä koko vetoa', async ({ page }) => {
  /*
   * Koko vedon poistaminen yhdestä kosketuksesta oli tylsä työkalu: ympyrästä
   * ei voinut siistiä yhtä kohtaa siistimättä koko ympyrää uudelleen.
   */
  await avaaLive(page);
  await piirtoTila(page);
  await veda(page.locator('.live-view .annot').first(), 'pen');
  await expect.poll(() => vedot(page)).toBe(1);

  await page.getByRole('button', { name: 'Erase' }).click();
  // Napautus vedon keskelle katkaisee sen kahdeksi.
  await napauta(page.locator('.live-view .annot').first(), 0.5, 'pen');

  await expect.poll(() => vedot(page)).toBe(2);
});

test('pyyhkiminen vedon päästä lyhentää sitä', async ({ page }) => {
  await avaaLive(page);
  await piirtoTila(page);
  await veda(page.locator('.live-view .annot').first(), 'pen');
  await expect.poll(() => vedot(page)).toBe(1);

  await page.getByRole('button', { name: 'Erase' }).click();
  await napauta(page.locator('.live-view .annot').first(), 0.2, 'pen');

  // Veto on yhä olemassa, ei katkennut kahdeksi eikä kadonnut.
  await expect.poll(() => vedot(page)).toBe(1);
});

test('sormikytkintä ei ole ennen kuin kynää on käytetty', async ({ page }) => {
  // Puhelimessa kynää ei ole, eikä sormi tarvitse mitään valintaa.
  await avaaLive(page);
  await piirtoTila(page);
  await expect(page.getByRole('button', { name: 'Finger draws' })).toHaveCount(0);
});

test('sormikytkin palauttaa sormipiirron kynän jälkeen', async ({ page }) => {
  await avaaLive(page);
  await piirtoTila(page);
  await veda(page.locator('.live-view .annot').first(), 'pen');
  await expect.poll(() => vedot(page)).toBe(1);

  // Kytkin ilmestyy vasta kynän havaitsemisen jälkeen.
  const sormi = page.getByRole('button', { name: 'Finger draws' });
  await expect(sormi).toBeVisible();
  await expect(sormi).not.toHaveClass(/primary/);

  // Ilman kytkintä kosketus on kämmen eikä piirrä.
  await veda(page.locator('.live-view .annot').nth(1), 'touch');
  await expect.poll(() => vedot(page)).toBe(1);

  await sormi.click();
  await veda(page.locator('.live-view .annot').nth(1), 'touch');
  await expect.poll(() => vedot(page)).toBe(2);
});

test('kumoaminen poistaa viimeisimmän vedon', async ({ page }) => {
  await avaaLive(page);
  await piirtoTila(page);
  await veda(page.locator('.live-view .annot').first(), 'pen');
  await veda(page.locator('.live-view .annot').nth(1), 'pen');
  await expect.poll(() => vedot(page)).toBe(2);

  await page.getByRole('button', { name: 'Undo stroke' }).click();
  await expect.poll(() => vedot(page)).toBe(1);
});

test('kynä piirtää ilman mitään sormiasetusta', async ({ page }) => {
  /*
   * Aiemmin `touch-action: none` asetettiin vain sormipiirron ollessa päällä.
   * Apple Pencil on `touch-action`in alainen aivan kuten sormi, joten kynäveto
   * meni vieritykseksi ja käyttäjän oli pakko pitää sormipiirto päällä – mikä
   * puolestaan antoi kämmenen piirtää.
   */
  await avaaLive(page);
  await piirtoTila(page);
  await veda(page.locator('.live-view .annot').first(), 'pen');
  await expect.poll(() => vedot(page)).toBe(1);
});

test('kämmen ei piirrä sen jälkeen kun kynää on käytetty', async ({ page }) => {
  await avaaLive(page);
  await piirtoTila(page);
  await veda(page.locator('.live-view .annot').first(), 'pen');
  await expect.poll(() => vedot(page)).toBe(1);

  // Kosketus kynän jälkeen on kämmen, ei piirtoaikomus.
  await veda(page.locator('.live-view .annot').nth(1), 'touch');
  await expect.poll(() => vedot(page)).toBe(1);
});

test('kynän muistaminen säilyy live-tilan avaamisten yli', async ({ page }) => {
  // Kämmen osuu lappuun usein ennen kärkeä; ilman muistia joka istunnon
  // ensimmäinen veto olisi kämmenen jättämä.
  await avaaLive(page);
  await piirtoTila(page);
  await veda(page.locator('.live-view .annot').first(), 'pen');
  await expect.poll(() => vedot(page)).toBe(1);

  await page.getByLabel('Exit live mode').click();
  await page.getByRole('button', { name: 'Live', exact: true }).click();
  await piirtoTila(page);

  await veda(page.locator('.live-view .annot').nth(1), 'touch');
  await expect.poll(() => vedot(page)).toBe(1);
});

test('merkintä kasvaa tekstikoon mukana', async ({ page }) => {
  /*
   * Merkinnät suhteutettiin aiemmin rivin leveyteen, joka ei muutu tekstikoon
   * mukana – veto jäi paikalleen kun teksti kasvoi. Yksikkö on nyt rivin
   * fonttikoko, joten vedon on kasvettava samassa suhteessa kuin kirjainten.
   */
  await avaaLive(page);
  await piirtoTila(page);
  await veda(page.locator('.live-view .annot').first(), 'pen');
  await expect.poll(() => vedot(page)).toBe(1);

  const leveys = () =>
    page.locator('.live-view .annot path').first().evaluate((el) => {
      const box = (el as SVGPathElement).getBBox();
      return box.width;
    });

  const ennen = await leveys();
  expect(ennen).toBeGreaterThan(0);

  // Kaksi askelta suuremmaksi: 20 → 24 pikseliä, eli kerroin 1.2.
  await page.getByLabel('Larger text').click();
  await page.getByLabel('Larger text').click();
  await expect.poll(async () => Math.round((await leveys()) / ennen * 100)).toBe(120);
});

test('sormi piirtää kun kynää ei ole käytetty', async ({ page }) => {
  // Puhelimella kynää ei ole, joten sormen on voitava piirtää.
  await avaaLive(page);
  await piirtoTila(page);
  await veda(page.locator('.live-view .annot').first(), 'touch');
  await expect.poll(() => vedot(page)).toBe(1);
});

test('vanhat leveyteen suhteutetut merkinnät poistuvat', async ({ page }) => {
  await avaaLive(page);
  await page.getByLabel('Exit live mode').click();

  // Ensimmäisen version veto: ei unit-kenttää, koordinaatit 0–1.
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('sanoittaja');
        req.onsuccess = () => {
          const tx = req.result.transaction('annotations', 'readwrite');
          tx.objectStore('annotations').put({
            id: 'vanha',
            songId: 'testi',
            lineId: 'l1',
            color: '#e0524f',
            width: 0.004,
            points: [0.1, 0.02, 0.8, 0.02],
            createdAt: 1,
          });
          tx.oncomplete = () => {
            req.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      }),
  );

  await page.getByRole('button', { name: 'Live', exact: true }).click();
  // Ei piirry väärään kohtaan väärän kokoisena, vaan poistuu kannasta.
  await expect.poll(() => vedot(page)).toBe(0);

  const jaljella = await page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const req = indexedDB.open('sanoittaja');
        req.onsuccess = () => {
          const get = req.result.transaction('annotations').objectStore('annotations').getAll();
          get.onsuccess = () => {
            req.result.close();
            resolve(get.result.length);
          };
          get.onerror = () => reject(get.error);
        };
        req.onerror = () => reject(req.error);
      }),
  );
  expect(jaljella).toBe(0);
});

test('piirtokerros ei ota kosketuksia tavallisessa tilassa', async ({ page }) => {
  await avaaLive(page);
  // Ilman piirtotilaa napautus kuuluu vierityksen käynnistykselle.
  await expect(page.locator('.live-view .annot').first()).not.toHaveClass(/active/);

  await veda(page.locator('.live-view .annot').first(), 'touch');
  expect(await vedot(page)).toBe(0);
});

test('merkinnät tulevat mukaan tulostuslehdelle', async ({ page }) => {
  // Tuloste on sama SongSheet. Live-tila avataan editorin päälle, joten
  // editorin lehti jää taustalle: ilman ilmoitusta merkinnät puuttuisivat
  // PDF:stä, vaikka ne näkyvät esitysnäkymässä.
  await avaaLive(page);
  await piirtoTila(page);
  await veda(page.locator('.live-view .annot').first(), 'pen');
  await expect.poll(() => vedot(page)).toBe(1);

  await page.getByLabel('Exit live mode').click();
  await expect(page.locator('.live-view')).toHaveCount(0);

  await expect.poll(() => page.locator('.song-sheet .annot path').count()).toBe(1);
});

test('merkinnät katoavat laulun mukana', async ({ page }) => {
  await avaaLive(page);
  await piirtoTila(page);
  await veda(page.locator('.live-view .annot').first(), 'pen');
  await expect.poll(() => vedot(page)).toBe(1);
  await page.getByLabel('Exit live mode').click();

  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Delete song' }).click();

  const jaljella = await page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const req = indexedDB.open('sanoittaja');
        req.onsuccess = () => {
          const get = req.result.transaction('annotations').objectStore('annotations').getAll();
          get.onsuccess = () => {
            req.result.close();
            resolve(get.result.length);
          };
          get.onerror = () => reject(get.error);
        };
        req.onerror = () => reject(req.error);
      }),
  );
  expect(jaljella).toBe(0);
});
