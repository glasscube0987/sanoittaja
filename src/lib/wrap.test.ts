import { describe, expect, it } from 'vitest';
import { eraseAlong } from './annotate';
import type { LyricLine } from './types';
import {
  eraseWrapped,
  placeStroke,
  pointToStrip,
  pointToWrapped,
  segmentIndex,
  splitStroke,
  strokeSegment,
  strokeToStrip,
  WRAP_INDENT,
  wrapLine,
  type WrapLayout,
} from './wrap';

const rivi = (text: string, chords: [number, string][] = []): LyricLine => ({
  id: 'r',
  text,
  chords: chords.map(([pos, symbol], i) => ({ id: `c${i}`, pos, symbol })),
});

const tekstit = (line: LyricLine, cols: number) => wrapLine(line, cols).map((s) => s.text);

describe('wrapLine', () => {
  const pitka = rivi('ja tie vie pohjoiseen halki yön ja sateen kunnes aamu tulee');

  it('mahtuva rivi on yksi pala sellaisenaan', () => {
    const palat = wrapLine(rivi('lyhyt rivi', [[0, 'Am']]), 30);
    expect(palat).toHaveLength(1);
    expect(palat[0]).toMatchObject({ from: 0, shift: 0, text: 'lyhyt rivi' });
    expect(palat[0].chords[0].pos).toBe(0);
  });

  it('ääretön leveys ei rivitä: tuloste ja leveä näyttö pysyvät ennallaan', () => {
    expect(wrapLine(pitka, Infinity)).toHaveLength(1);
  });

  it('katkaisee sanarajasta ja sisentää jatkorivit', () => {
    expect(tekstit(pitka, 30)).toEqual([
      'ja tie vie pohjoiseen halki ',
      '  yön ja sateen kunnes aamu ',
      '  tulee',
    ]);
  });

  it('jokainen pala mahtuu annettuun leveyteen', () => {
    for (const cols of [14, 20, 27, 33, 40]) {
      for (const teksti of tekstit(pitka, cols)) {
        expect(teksti.trimEnd().length, `${cols}: «${teksti}»`).toBeLessThanOrEqual(cols);
      }
    }
  });

  /* Mitään ei saa kadota eikä kahdentua: palat peräkkäin ovat alkuperäinen rivi. */
  it('palat yhdessä ovat alkuperäinen teksti', () => {
    const palat = wrapLine(pitka, 22);
    const koottu = palat.map((s, i) => (i === 0 ? s.text : s.text.slice(WRAP_INDENT))).join('');
    expect(koottu).toBe(pitka.text);
  });

  it('sointu kulkee sanansa mukana ja sen sarake lasketaan palan alusta', () => {
    // «yön» alkaa sarakkeesta 28; sointu sen yllä.
    const line = rivi(pitka.text, [
      [0, 'Am'],
      [28, 'F'],
    ]);
    const palat = wrapLine(line, 30);
    expect(palat[0].chords.map((c) => [c.pos, c.symbol])).toEqual([[0, 'Am']]);
    // Jatkorivillä sisennyksen verran oikealla, täsmälleen sanansa yllä.
    expect(palat[1].chords.map((c) => [c.pos, c.symbol])).toEqual([[WRAP_INDENT, 'F']]);
    expect(palat[1].text.slice(WRAP_INDENT, WRAP_INDENT + 3)).toBe('yön');
  });

  it('pala kertoo mistä sarakkeesta se alkaa ja paljonko sisältö siirtyi', () => {
    const palat = wrapLine(pitka, 30);
    expect(palat.map((s) => s.from)).toEqual([0, 28, 54]);
    expect(palat.map((s) => s.shift)).toEqual([0, 28 - WRAP_INDENT, 54 - WRAP_INDENT]);
  });

  /* Pitkä sointu rivin viimeisen sanan yllä ei saa valua reunan yli. */
  it('sointurivin leveys lasketaan mukaan', () => {
    const line = rivi('aa bb cc dd ee ff gg', [[18, 'F#m7b5/C#']]);
    for (const seg of wrapLine(line, 20)) {
      const sointurivinLoppu = Math.max(0, ...seg.chords.map((c) => c.pos + c.symbol.length));
      expect(sointurivinLoppu).toBeLessThanOrEqual(20);
    }
  });

  it('riviä pidempi sana katkaistaan eikä valu yli', () => {
    const palat = tekstit(rivi('epäjärjestelmällistyttämättömyydellänsäkään on pitkä'), 16);
    for (const teksti of palat) expect(teksti.length).toBeLessThanOrEqual(16 + 1);
    expect(palat.length).toBeGreaterThan(2);
  });

  it('tekstin jälkeen tulevat soinnut saavat katkaista rivin', () => {
    const line = rivi('lyhyt', [
      [0, 'Am'],
      [10, 'F'],
      [20, 'C'],
      [30, 'G'],
    ]);
    const palat = wrapLine(line, 16);
    expect(palat.length).toBeGreaterThan(1);
    expect(palat.flatMap((s) => s.chords.map((c) => c.symbol))).toEqual(['Am', 'F', 'C', 'G']);
  });

  it('liian kapea näyttö ei rivitä sana per rivi', () => {
    expect(wrapLine(pitka, 6)).toHaveLength(1);
  });
});

/* Kolme taitosta: sarakkeet 0–19, 20–39 ja 40–. Merkki 0,5 em, taitos 3 em;
   rivin laatikon yläreunassa on yhden em:n korkuinen osion otsikko. */
const layout: WrapLayout = {
  segments: [
    { from: 0, shift: 0 },
    { from: 20, shift: 18 },
    { from: 40, shift: 38 },
  ],
  ch: 0.5,
  dy: [0, 3, 6],
  tops: [1, 4, 7],
};

const yksi: WrapLayout = { segments: [{ from: 0, shift: 0 }], ch: 0.5, dy: [0], tops: [1] };

/** Pyöristää liukulukuvirheet pois vertailua varten. */
const siisti = (flat: number[]) => flat.map((v) => Math.round(v * 1000) / 1000);

describe('segmentIndex', () => {
  it('raja kuuluu alkavalle taitokselle', () => {
    expect(segmentIndex(layout.segments, 19.9)).toBe(0);
    expect(segmentIndex(layout.segments, 20)).toBe(1);
    expect(segmentIndex(layout.segments, 99)).toBe(2);
    expect(segmentIndex(layout.segments, -5)).toBe(0);
  });
});

describe('placeStroke', () => {
  it('taittamaton rivi ei muuta vetoa', () => {
    const veto = [1, 1, 30, 2];
    expect(placeStroke(yksi, veto)).toEqual([veto]);
  });

  it('ensimmäisen taitoksen veto pysyy paikallaan', () => {
    const veto = [1, 2, 4, 2];
    expect(placeStroke(layout, veto)).toEqual([veto]);
  });

  /* Sarakkeessa 24 oleva sana on toisella näyttörivillä kuuden sarakkeen
     kohdalla (24 − 18): vasemmalle 9 em, alas yhden taitoksen verran. */
  it('toisen taitoksen veto siirtyy sanansa mukana', () => {
    const veto = [12, 2, 14, 2];
    expect(placeStroke(layout, veto).map(siisti)).toEqual([[3, 5, 5, 5]]);
  });

  /* Ympyrä toisen taitoksen ensimmäisen sanan ympärillä ylittää vähän
     taitoskohdan (sarake 20 = 10 em). Pisteittäin siirrettynä sen vasen kaari
     ilmestyisi edellisen rivin loppuun. */
  it('taitoskohdan vähän ylittävä ympyrä pysyy yhtenä kappaleena', () => {
    const ympyra = [9.7, 2, 11, 1, 12.5, 2, 11, 3, 9.7, 2];
    const palat = placeStroke(layout, ympyra);
    expect(palat).toHaveLength(1);
    // Muoto säilyy: sama siirros jokaiselle pisteelle.
    expect(siisti(palat[0])).toEqual([0.7, 5, 2, 4, 3.5, 5, 2, 6, 0.7, 5]);
  });

  it('taitoskohdan yli menevä alleviivaus jakautuu kahdeksi', () => {
    // Sarakkeet 14–26: kuusi kummallakin puolella taitoskohtaa.
    const viiva = [7, 2.5, 13, 2.5];
    const palat = placeStroke(layout, viiva).map(siisti);
    expect(palat).toEqual([
      [7, 2.5, 10, 2.5], // ensimmäisen rivin loppuun asti
      [1, 5.5, 4, 5.5], // toisen rivin alusta: (20 − 18) × 0,5 = 1
    ]);
  });

  it('jako katkeaa täsmälleen taitoskohdasta myös vinolla viivalla', () => {
    const palat = splitStroke(layout, [8, 2, 12, 4]);
    expect(palat.map((p) => p.k)).toEqual([0, 1]);
    // Raja on x = 10, jossa viiva on puolivälissä: y = 3.
    expect(siisti(palat[0].points)).toEqual([8, 2, 10, 3]);
    expect(siisti(palat[1].points)).toEqual([10, 3, 12, 4]);
  });

  it('usean taitoksen yli menevä viiva jakautuu jokaisessa', () => {
    const palat = splitStroke(layout, [2, 2, 28, 2]);
    expect(palat.map((p) => p.k)).toEqual([0, 1, 2]);
  });

  /* Kertosäkeen ympärille piirretty laatikko ei ole rivin merkintä. Jaettuna se
     hajoaisi pätkiksi pitkin riviä; yhtenä kappaleena se on ainakin kuvio. */
  it('korkea kuvio pysyy yhtenä kappaleena vaikka on leveä', () => {
    const laatikko = [1, 0, 29, 0, 29, 12, 1, 12, 1, 0];
    expect(strokeSegment(layout, laatikko)).not.toBeNull();
    expect(placeStroke(layout, laatikko)).toHaveLength(1);
  });
});

/*
 * Taitokset eivät ole yhtä korkeita: sointurivi ladotaan vain niihin joiden yllä
 * on sointuja. Tässä ensimmäisellä on sointurivi (1,5 em) ja tekstirivi
 * (1,5 em), toisella pelkkä tekstirivi.
 */
describe('eri korkuiset taitokset', () => {
  const epatasainen: WrapLayout = {
    segments: [
      { from: 0, shift: 0 },
      { from: 20, shift: 18 },
      { from: 40, shift: 38 },
    ],
    ch: 0.5,
    // Tekstirivit: 1,5 / 3 / 4,5 em laatikon yläreunasta.
    dy: [0, 1.5, 3],
    tops: [0, 3, 4.5],
  };

  /* Alleviivaus on nauhalla tekstirivin alareunassa (y = 3). Toisella
     taitoksella tekstirivi on 1,5 em alempana, joten viivakin on. Yhdellä
     yhteisellä rivikorkeudella se olisi osunut 3 em alemmas, seuraavan rivin
     päälle. */
  it('alleviivaus osuu sanansa alle taitoksessa jolla ei ole sointuriviä', () => {
    expect(placeStroke(epatasainen, [12, 3, 14, 3]).map(siisti)).toEqual([[3, 4.5, 5, 4.5]]);
  });

  it('näytölle piirretty palaa samaan kohtaan', () => {
    const naytolla = [3, 4.4, 5, 4.4];
    const nauhalla = strokeToStrip(epatasainen, naytolla);
    expect(placeStroke(epatasainen, nauhalla).map(siisti)).toEqual([naytolla]);
  });

  it('piste kulkee edestakaisin', () => {
    const naytolla = { x: 3, y: 5 };
    expect(pointToWrapped(epatasainen, pointToStrip(epatasainen, naytolla))).toEqual(naytolla);
  });
});

describe('strokeToStrip', () => {
  it('on placeStroken käänteismuunnos', () => {
    // Piirretty toiselle näyttöriville: y-keskikohta 5 on taitoksen 1 kohdalla.
    const naytolla = [3, 5, 5, 5];
    const nauhalla = strokeToStrip(layout, naytolla);
    expect(siisti(nauhalla)).toEqual([12, 2, 14, 2]);
    expect(placeStroke(layout, nauhalla).map(siisti)).toEqual([naytolla]);
  });

  /* Rivin yläreunan yli kaartuva ympyrä: yläosa on jo edellisen taitoksen
     korkeudella. Pisteittäin muunnettuna se repeäisi kahtia. */
  it('koko veto siirtyy keskikohtansa taitoksen mukaan', () => {
    const naytolla = [3, 5, 4, 3.6, 5, 5, 4, 6, 3, 5];
    const nauhalla = strokeToStrip(layout, naytolla);
    expect(placeStroke(layout, nauhalla).map(siisti)).toEqual([naytolla]);
  });

  /* Taitetun rivin lopun tyhjä tila ei vastaa mitään kohtaa nauhalla. Sinne
     piirretty veto ei saa hypätä seuraavan näyttörivin alkuun. */
  it('rivin lopun tyhjään tilaan piirretty veto jää omalle rivilleen', () => {
    // Ensimmäinen näyttörivi päättyy sarakkeeseen 20 (10 em); veto on sen takana.
    const naytolla = [10.5, 2, 12, 2];
    const nauhalla = strokeToStrip(layout, naytolla);
    const palat = placeStroke(layout, nauhalla);
    expect(palat).toHaveLength(1);
    // Samalla korkeudella kuin piirrettiin, eli ensimmäisellä näyttörivillä.
    expect(palat[0][1]).toBe(2);
    expect(Math.max(palat[0][0], palat[0][2])).toBeLessThanOrEqual(10);
  });

  it('taittamaton rivi ei muuta vetoa', () => {
    const veto = [1, 5, 30, 5];
    expect(strokeToStrip(yksi, veto)).toBe(veto);
  });
});

describe('pisteet', () => {
  it('tekstikentän ankkuri siirtyy sanansa mukana ja takaisin', () => {
    const nauhalla = { x: 12, y: 2 };
    const naytolla = pointToWrapped(layout, nauhalla);
    expect(naytolla).toEqual({ x: 3, y: 5 });
    expect(pointToStrip(layout, naytolla)).toEqual(nauhalla);
  });

  it('rivin lopun taakse pudotettu kenttä ei hyppää seuraavalle riville', () => {
    const nauhalla = pointToStrip(layout, { x: 11, y: 2 });
    expect(pointToWrapped(layout, nauhalla).y).toBe(2);
  });

  it('jatkorivin sisennykseen pudotettu kenttä ei hyppää edelliselle riville', () => {
    const nauhalla = pointToStrip(layout, { x: 0.2, y: 5 });
    expect(pointToWrapped(layout, nauhalla).y).toBe(5);
  });

  it('taittamaton rivi on identiteetti', () => {
    const p = { x: 25, y: 2 };
    expect(pointToWrapped(yksi, p)).toBe(p);
    expect(pointToStrip(yksi, p)).toBe(p);
  });
});

describe('eraseWrapped', () => {
  it('taittamattomalla rivillä sama kuin eraseAlong', () => {
    const veto = [1, 2, 9, 2];
    const from = { x: 5, y: 1 };
    const to = { x: 5, y: 3 };
    expect(eraseWrapped(yksi, veto, from, to, 0.5)).toEqual(eraseAlong(veto, from, to, 0.5));
  });

  /* Veto näkyy toisella näyttörivillä, joten pyyhkimen on osuttava siihen
     siellä missä se näkyy – ei siellä missä se on nauhalla. */
  it('pyyhkii vedon siitä kohdasta jossa se näkyy', () => {
    const veto = [12, 2, 16, 2]; // näytöllä x 3–7, y 5
    const osuma = eraseWrapped(layout, veto, { x: 5, y: 4 }, { x: 5, y: 6 }, 0.5);
    expect(osuma).not.toBeNull();
    expect(osuma).toHaveLength(2);
    // Sama kohta nauhalla ei osu: siellä ei näy mitään.
    expect(eraseWrapped(layout, veto, { x: 14, y: 1 }, { x: 14, y: 3 }, 0.5)).toBeNull();
  });

  it('ohi mennyt pyyhkäisy ei muuta mitään', () => {
    expect(eraseWrapped(layout, [12, 2, 16, 2], { x: 0, y: 0 }, { x: 1, y: 0 }, 0.3)).toBeNull();
  });

  /*
   * Ympyrän taitoskohdan ylittävä kaari jää jäljelle kun loput pyyhitään. Kaari
   * on nauhalla kokonaan edellisen taitoksen puolella, joten ilman asettamista
   * se hyppäisi edellisen näyttörivin loppuun – pyyhkiminen siirtäisi sen mihin
   * ei koskettu.
   */
  it('jäljelle jäänyt pala pysyy samalla näyttörivillä', () => {
    const ympyra = [9.7, 2, 11, 1, 12.5, 2, 11, 3, 9.7, 2];
    // Näytöllä ympyrä on toisella rivillä, x 0,7–3,5. Pyyhitään kaikki paitsi
    // vasen reuna, joka on nauhalla sarakkeen 20 vasemmalla puolella.
    const jaljelle = eraseWrapped(layout, ympyra, { x: 2.5, y: 3.5 }, { x: 2.5, y: 6.5 }, 1.3);
    expect(jaljelle).not.toBeNull();
    expect(jaljelle!.length).toBeGreaterThan(0);

    const korkeudet = jaljelle!.flatMap((pala) =>
      placeStroke(layout, pala).flatMap((naytolla) => naytolla.filter((_, i) => i % 2 === 1)),
    );
    // Toisen näyttörivin korkeudella (y 4–6), ei ensimmäisen (y 1–3).
    expect(Math.min(...korkeudet)).toBeGreaterThanOrEqual(3.9);
  });
});
