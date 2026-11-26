/**
 * Ulkoasun järjestelmä: teemat, omat kirjasimet ja musteet.
 *
 * Ulkoasu ei ole vain ulkonäköä tässä sovelluksessa. Lehden kirjasimen
 * merkkileveys ja rivikorkeus ovat merkintöjen koordinaatisto, ja kynän muste
 * on tallessa heksana – väärin valittu kirjasin tai teema siirtää tai
 * piilottaa käyttäjän piirtämää. Siksi nämä mitataan.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { avaaLaulu, avaaLista, laulu, PITKA_RIVI } from './apu';

function pitkaLaulu() {
  return laulu({
    lines: [
      {
        id: 'l1',
        text: PITKA_RIVI,
        section: { kind: 'verse' },
        chords: [
          { id: 'c1', pos: 0, symbol: 'Am' },
          { id: 'c2', pos: 70, symbol: 'F#m7' },
        ],
      },
      { id: 'l2', text: 'valo piirtää veteen tien', chords: [{ id: 'c3', pos: 0, symbol: 'G' }] },
    ],
  });
}

async function kylvaVeto(page: Page, color: string): Promise<void> {
  await page.evaluate(
    (vari) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('sanoittaja');
        req.onsuccess = () => {
          const tx = req.result.transaction('annotations', 'readwrite');
          tx.objectStore('annotations').put({
            id: 'veto',
            songId: 'testi',
            lineId: 'l1',
            kind: 'stroke',
            unit: 'em',
            color: vari,
            width: 0.1,
            points: [0.5, 1.6, 6, 1.6],
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
    color,
  );
}

async function avaaLive(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Live', exact: true }).click();
  await page.waitForSelector('.live-view .sheet-line');
}

function vedonVari(page: Page): Promise<string> {
  return page.evaluate(() => getComputedStyle(document.querySelector('.live-view .annot path')!).stroke);
}

function luminanssi(rgb: string): number {
  const [r, g, b] = (rgb.match(/\d+(\.\d+)?/g) ?? []).map(Number);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/*
 * Pitkän laulun rivin napautus vieritti sanoituslaatikkoa sivuttain niin, että
 * kentän alku osui laatikon reunaan – tarttuvan asetuspainikkeen alle. Rivin
 * alun soinnut katosivat näkyvistä juuri kun riviä kirjoitettiin.
 */
test('kohdistettu rivi ei vieri rivin alun sointua asetuspainikkeen alle', async ({ page }) => {
  await avaaLaulu(page, pitkaLaulu());
  await page.locator('.line input.text').nth(1).focus();

  const tulos = await page.evaluate(() => {
    const laatikko = document.querySelector('.lyrics')!;
    return [...document.querySelectorAll('.line')].map((rivi) => {
      const sointu = rivi.querySelector('.chord-row .chord')!.getBoundingClientRect();
      const paalla = document.elementFromPoint(sointu.left + sointu.width / 2, sointu.top + sointu.height / 2);
      return { vieritys: laatikko.scrollLeft, sointu: !!paalla?.closest('.chord') };
    });
  });
  expect(tulos.map((r) => r.vieritys)).toEqual([0, 0]);
  expect(tulos.map((r) => r.sointu)).toEqual([true, true]);
});

/* Reunaviiva ei saa viedä tilaa: kohdistuksen myötä siirtyvä rivi irrottaisi
   soinnut hetkeksi kirjaimistaan ja nykäisi tekstiä sormen alla. */
test('kohdistetun rivin reunaviiva ei siirrä riviä', async ({ page }) => {
  await avaaLaulu(page, pitkaLaulu());
  const kentta = page.locator('.line input.text').nth(1);
  /* Verrataan naapuririviin eikä ruutuun: kohdistus voi vierittää laatikkoa,
     ja vieritys siirtäisi siirtynyttä riviä takaisin samaan ruudun kohtaan. */
  const ero = () =>
    page.evaluate(() => {
      const [a, b] = [...document.querySelectorAll('.line input.text')];
      return b.getBoundingClientRect().left - a.getBoundingClientRect().left;
    });
  const ennen = await ero();
  await kentta.focus();
  expect(await ero()).toBe(ennen);

  // Viiva on näkyvissä rivin vasemmassa reunassa.
  const viiva = await page.evaluate(() => {
    const rivi = document.querySelectorAll('.line')[1];
    const tyyli = getComputedStyle(rivi, '::before');
    return { sisalto: tyyli.content, leveys: tyyli.width, tausta: tyyli.backgroundColor };
  });
  expect(viiva.sisalto).not.toBe('none');
  expect(viiva.leveys).toBe('3px');
});

test.describe('kirjasimet', () => {
  /*
   * Merkinnät on tallennettu em-yksiköin, mutta soinnut ja sanat sijoittuvat
   * merkin leveyden mukaan. Kirjasin jonka merkki ei ole 0,6 em siirtäisi
   * jokaista jo piirrettyä merkintää sivuun sanastaan.
   */
  test('lehden kirjasin on sovelluksen oma ja sen merkki on 0,6 em', async ({ page }) => {
    await avaaLaulu(page);
    await avaaLive(page);
    const mitta = await page.evaluate(async () => {
      await document.fonts.ready;
      const rivi = document.querySelector<HTMLElement>('.live-view .sheet-lyric')!;
      const em = parseFloat(getComputedStyle(rivi).fontSize);
      const koe = document.createElement('span');
      koe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font:inherit';
      koe.textContent = '0'.repeat(100);
      rivi.appendChild(koe);
      const leveys = koe.getBoundingClientRect().width;
      koe.remove();
      return {
        merkki: leveys / 100 / em,
        ladattu: document.fonts.check(`${em}px "Red Hat Mono"`),
        perhe: getComputedStyle(rivi).fontFamily,
      };
    });
    expect(mitta.perhe).toMatch(/^"?Red Hat Mono/);
    expect(mitta.ladattu).toBe(true);
    expect(mitta.merkki).toBeCloseTo(0.6, 3);
  });

  /* Selaimen oletusrivikorkeus tulee kirjasimen mitoista ja vaihteli
     laitteittain, mikä siirsi merkintöjä pystysuunnassa. */
  test('lehden rivikorkeus on kiinteä', async ({ page }) => {
    await avaaLaulu(page);
    await avaaLive(page);
    const suhde = await page.evaluate(() => {
      const rivi = document.querySelector<HTMLElement>('.live-view .sheet-lyric')!;
      const tyyli = getComputedStyle(rivi);
      return parseFloat(tyyli.lineHeight) / parseFloat(tyyli.fontSize);
    });
    expect(suhde).toBeCloseTo(1.2, 3);
  });

  /*
   * Rivitys mitataan merkin leveydestä. Oma kirjasin latautuu vasta
   * käytettäessä, joten ensimmäinen mittaus voi osua varakirjasimeen. Lehden
   * leveys ei muutu kirjasimen latautuessa, joten pelkkä koon seuranta jättäisi
   * rivityksen laskemaan väärällä merkillä ja pitkä rivi valuisi ruudun yli.
   *
   * Koe: lehti vaihdetaan kirjasimeen, joka on puolitoista kertaa leveämpi ja
   * latautuu vasta kun lehti on jo mitattu.
   */
  test('rivitys mitataan uudelleen kun kirjasin latautuu', async ({ page }) => {
    await avaaLaulu(page, pitkaLaulu());
    await avaaLive(page);
    /* Kaikille lehden riveille kiinteä korkeus, jottei lehden koko muutu
       kirjasimen vaihtuessa: kokoa seuraava mittaus huomaisi muuten muutoksen
       itse, ja testi menisi läpi ilman kirjasimen kuuntelua. Oikeassa
       vaihdossa (varakirjasin → oma) koko ei muutu, koska lehden rivikorkeus
       on kiinteä. */
    await page.addStyleTag({ content: '.live-view .song-sheet * { line-height: 1.2 !important; }' });
    const ylivuoto = () =>
      page.evaluate(() => {
        const el = document.querySelector('.live-scroll')!;
        return el.scrollWidth - el.clientWidth;
      });
    expect(await ylivuoto()).toBeLessThanOrEqual(0);
    const ennen = await page.locator('.live-view [data-seg]').count();

    /*
     * Koekirjasin CSS:n `@font-face`-säännöllä eikä `FontFace`-rajapinnalla:
     * WebKit ei leventänyt rajapinnan kautta annettua kirjasinta, jolloin
     * testi kaatui vaikka sovellus toimi. Leveys mitataan ennen väitettä, jotta
     * testin oma rajoite ja sovelluksen vika erottuvat toisistaan.
     */
    const merkki = () =>
      page.evaluate(() => document.querySelector('.live-view .sheet-measure')!.getBoundingClientRect().width / 10);
    const kapea = await merkki();
    await page.evaluate(async () => {
      const url = performance
        .getEntriesByType('resource')
        .map((r) => r.name)
        .find((n) => /red-hat-mono-latin-400/.test(n))!;
      const tyyli = document.createElement('style');
      tyyli.textContent = `
        @font-face { font-family: 'Leveä koe'; src: url(${url}) format('woff2'); size-adjust: 150%; }
        .live-view .song-sheet { --mono: 'Leveä koe', monospace; }`;
      document.head.appendChild(tyyli);
      await document.fonts.load('16px "Leveä koe"');
      await document.fonts.ready;
    });
    expect(await merkki(), 'koekirjasin ei levennyt – testi ei koe mitään').toBeGreaterThan(kapea * 1.4);

    await expect.poll(() => page.locator('.live-view [data-seg]').count()).toBeGreaterThan(ennen);
    expect(await ylivuoto()).toBeLessThanOrEqual(0);
  });
});

test.describe('teema', () => {
  test('laitteen mukaan seuraa laitteen tilaa', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await avaaLaulu(page);
    const vaalea = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await page.emulateMedia({ colorScheme: 'dark' });
    const tumma = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(luminanssi(vaalea)).toBeGreaterThan(0.8);
    expect(luminanssi(tumma)).toBeLessThan(0.2);
  });

  /* Valinta voittaa laitteen asetuksen kumpaankin suuntaan ja säilyy. */
  test('valittu teema voittaa laitteen tilan ja säilyy', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await avaaLista(page);
    await page.getByLabel('Settings').click();
    await page.getByRole('button', { name: 'Light', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('light');
    expect(luminanssi(await page.evaluate(() => getComputedStyle(document.body).backgroundColor))).toBeGreaterThan(0.8);

    await page.reload();
    await page.waitForSelector('.song-card');
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('light');
    // Selaimen palkki seuraa valintaa eikä laitetta.
    const palkit = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map((m) => m.content),
    );
    expect(palkit).toEqual(['#f2f5f6', '#f2f5f6']);

    await page.emulateMedia({ colorScheme: 'light' });
    await page.getByLabel('Settings').click();
    await page.getByRole('button', { name: 'Dark', exact: true }).click();
    expect(luminanssi(await page.evaluate(() => getComputedStyle(document.body).backgroundColor))).toBeLessThan(0.2);

    await page.getByRole('button', { name: 'Match device', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBeUndefined();
    expect(luminanssi(await page.evaluate(() => getComputedStyle(document.body).backgroundColor))).toBeGreaterThan(0.8);
  });
});

test.describe('musteet', () => {
  /* Muste on tallessa heksana. Valkoinen veto piirtyi sellaisenaan ja katosi
     vaalealla pohjalla. */
  test('valkoinen muste näkyy vaalealla pohjalla', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await avaaLaulu(page);
    await kylvaVeto(page, '#eceef4');
    await avaaLive(page);
    const vari = await vedonVari(page);
    const tausta = await page.evaluate(() => getComputedStyle(document.querySelector('.live-view')!).backgroundColor);
    expect(luminanssi(tausta) - luminanssi(vari)).toBeGreaterThan(0.6);
  });

  test('tummalla pohjalla sama muste on vaalea', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await avaaLaulu(page);
    await kylvaVeto(page, '#eceef4');
    await avaaLive(page);
    expect(luminanssi(await vedonVari(page))).toBeGreaterThan(0.85);
  });

  /* Teema on näyttömuunnos: tallennettuun ei kosketa. */
  test('tallennettu muste ei muutu', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await avaaLaulu(page);
    await kylvaVeto(page, '#eceef4');
    await avaaLive(page);
    // Vaakasuoran vedon laatikko on nollan korkuinen, joten se ei ole «näkyvä».
    await page.waitForSelector('.live-view .annot path', { state: 'attached' });
    const tallessa = await page.evaluate(
      () =>
        new Promise<string>((resolve) => {
          const req = indexedDB.open('sanoittaja');
          req.onsuccess = () => {
            const get = req.result.transaction('annotations').objectStore('annotations').get('veto');
            get.onsuccess = () => resolve(get.result.color);
          };
        }),
    );
    expect(tallessa).toBe('#eceef4');
  });

  test('tuntematon väri piirtyy sellaisenaan', async ({ page }) => {
    await avaaLaulu(page);
    await kylvaVeto(page, '#123456');
    await avaaLive(page);
    expect(await vedonVari(page)).toBe('rgb(18, 52, 86)');
  });
});

/* Edistymisviiva kertoo yhdellä silmäyksellä onko menossa alku vai loppu. */
test('live-tilan edistymisviiva seuraa vieritystä', async ({ page }) => {
  const rivit = Array.from({ length: 40 }, (_, i) => ({ id: `r${i}`, text: `rivi numero ${i}`, chords: [] }));
  await avaaLaulu(page, laulu({ lines: rivit }));
  await avaaLive(page);
  const kohta = () =>
    page.evaluate(() => {
      const el = document.querySelector('.live-progress i')!;
      const m = new DOMMatrix(getComputedStyle(el).transform);
      return m.a;
    });
  expect(await kohta()).toBe(0);
  await page.evaluate(() => {
    const el = document.querySelector('.live-scroll')!;
    el.scrollTop = el.scrollHeight;
  });
  await expect.poll(kohta).toBeCloseTo(1, 2);
  await page.evaluate(() => {
    const el = document.querySelector('.live-scroll')!;
    el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
  });
  await expect.poll(kohta).toBeCloseTo(0.5, 1);
});
