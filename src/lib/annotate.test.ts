import { describe, expect, it } from 'vitest';
import {
  eraseAt,
  ERASER_RADIUS,
  hitsStroke,
  pathData,
  simplify,
  STROKE_WIDTH,
  toAnchored,
  toFlat,
  toPixels,
  toPoints,
} from './annotate';

/** Rivi ruudun kohdassa (100, 200), fonttikoko 20 px. */
const rivi = { left: 100, top: 200, em: 20 };

describe('koordinaattimuunnos', () => {
  it('muuntaa näyttöpisteen rivin em-koordinaatistoon', () => {
    expect(toAnchored(rivi, 300, 240)).toEqual({ x: 10, y: 2 });
  });

  it('on käännettävissä takaisin', () => {
    const piste = toAnchored(rivi, 342, 263);
    const takaisin = toPixels(rivi, piste);
    expect(takaisin.x).toBeCloseTo(342);
    expect(takaisin.y).toBeCloseTo(263);
  });

  it('seuraa tekstikokoa kun lehteä zoomataan', () => {
    /*
     * Tämä on koko yksikönvaihdon syy. Aiemmin piste suhteutettiin rivin
     * leveyteen, joka ei muutu tekstikoon mukana – merkinnät jäivät paikalleen
     * kun teksti kasvoi. Fonttikokoon suhteutettuna sama piste on kaksinkertaisella
     * tekstikoolla kaksi kertaa kauempana, aivan kuten kirjaimet.
     */
    const pieni = { left: 0, top: 0, em: 20 };
    const iso = { left: 0, top: 0, em: 40 };
    const piste = toAnchored(pieni, 100, 60);

    const isolla = toPixels(iso, piste);
    expect(isolla.x).toBe(200);
    expect(isolla.y).toBe(120);
  });

  it('säilyttää muodon: ympyrä ei veny soikioksi', () => {
    // x ja y jaetaan samalla luvulla; eri jakajat venyttäisivät muodon.
    const piste = toAnchored({ left: 0, top: 0, em: 20 }, 40, 40);
    expect(piste.x).toBe(piste.y);
  });

  it('ei jaa nollalla puuttuvalla fonttikoolla', () => {
    expect(() => toAnchored({ left: 0, top: 0, em: 0 }, 10, 10)).not.toThrow();
  });

  it('antaa rivin ulkopuolisen pisteen olla rivin ulkopuolella', () => {
    // Iso ympyrä kertosäkeen ympärillä on yksi veto; sitä ei saa rajata.
    const yla = toAnchored(rivi, 300, 100);
    expect(yla.y).toBeLessThan(0);
  });
});

describe('pisteiden esitys', () => {
  it('muuntuu litteän listan ja pisteiden välillä', () => {
    expect(toPoints([1, 2, 3, 4])).toEqual([
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ]);
    expect(toFlat([{ x: 1, y: 2 }])).toEqual([1, 2]);
  });

  it('sietää parittoman listan', () => {
    expect(toPoints([1, 2, 3])).toEqual([{ x: 1, y: 2 }]);
  });
});

describe('pathData', () => {
  it('piirtää vedon polkuna pikseleinä', () => {
    expect(pathData([0, 0, 10, 5], 20)).toBe('M0.000 0.000L200.000 100.000');
  });

  it('erottaa lähekkäiset pisteet toisistaan', () => {
    /*
     * Kynän peräkkäiset pisteet ovat murto-osan päässä toisistaan. Liian karkea
     * pyöristys sulatti ne samaan kohtaan, jolloin veto porrastui näkyvästi ja
     * siistiytyi vasta kun karsinta poisti pisteet. Kahden vierekkäisen pisteen
     * on erotuttava polussa.
     */
    const polku = pathData([1, 1, 1.02, 1], 20);
    const [eka, toka] = polku.split('L');
    expect(toka).not.toBe(eka.slice(1));
  });

  it('tekee yksittäisestä napautuksesta näkyvän', () => {
    // Pelkkä M ei piirrä mitään, jolloin napautus katoaisi jäljettömiin.
    expect(pathData([5, 5], 20)).toContain('L');
  });

  it('on tyhjä ilman pisteitä', () => {
    expect(pathData([], 20)).toBe('');
  });
});

describe('simplify', () => {
  it('karsii suoralla olevat välipisteet', () => {
    const suora = [0, 0, 2, 0, 4, 0, 6, 0, 8, 0];
    expect(simplify(suora)).toEqual([0, 0, 8, 0]);
  });

  it('säilyttää mutkan', () => {
    const mutka = [0, 0, 4, 4, 8, 0];
    expect(simplify(mutka)).toEqual(mutka);
  });

  it('säilyttää päätepisteet', () => {
    const veto = [0, 0, 1, 0.01, 2, 0, 18, 10];
    const tulos = simplify(veto);
    expect(tulos.slice(0, 2)).toEqual([0, 0]);
    expect(tulos.slice(-2)).toEqual([18, 10]);
  });

  it('jättää lyhyen vedon rauhaan', () => {
    expect(simplify([0, 0, 20, 20])).toEqual([0, 0, 20, 20]);
    expect(simplify([0, 0])).toEqual([0, 0]);
  });

  it('toleranssi on alle kirjaimen mittainen', () => {
    /*
     * Toleranssi on em-yksiköissä. Jos se olisi luokkaa yksi em, karsinta
     * oikaisisi kirjaimen korkuisia mutkia ja ympyrästä tulisi kolmio.
     */
    const mutka = [0, 0, 5, 0.5, 10, 0];
    expect(simplify(mutka)).toEqual(mutka);
  });

  it('lyhentää kynän tuottamaa pisteryöppyä tuntuvasti', () => {
    // Kynä tuottaa satoja pisteitä sekunnissa; karsimatta yksi veto olisi
    // kilotavuja ja varmuuskopio kasvaisi turhaan.
    const tihea: number[] = [];
    for (let i = 0; i <= 200; i++) tihea.push(i / 10, 0);
    expect(simplify(tihea).length).toBeLessThan(10);
  });
});

describe('hitsStroke', () => {
  const veto = [0, 0, 10, 0, 10, 10];

  it('osuu vedon janaan', () => {
    expect(hitsStroke(veto, { x: 5, y: 0.1 }, ERASER_RADIUS)).toBe(true);
    expect(hitsStroke(veto, { x: 10, y: 5 }, ERASER_RADIUS)).toBe(true);
  });

  it('ei osu kauas vedosta', () => {
    expect(hitsStroke(veto, { x: 5, y: 6 }, ERASER_RADIUS)).toBe(false);
  });

  it('osuu yksittäiseen pisteeseen', () => {
    expect(hitsStroke([5, 5], { x: 5.1, y: 5 }, ERASER_RADIUS)).toBe(true);
    expect(hitsStroke([5, 5], { x: 9, y: 5 }, ERASER_RADIUS)).toBe(false);
  });

  it('ei osu tyhjään vetoon', () => {
    expect(hitsStroke([], { x: 0, y: 0 }, ERASER_RADIUS)).toBe(false);
  });
});

describe('eraseAt', () => {
  /** Alleviivaus: suora veto kahdella pisteellä, kuten simplify sen jättää. */
  const alleviivaus = [0, 0, 10, 0];

  it('katkaisee alleviivauksen keskeltä kahdeksi', () => {
    /*
     * Ratkaiseva tapaus. `simplify` typistää suoran vedon kahdeksi pisteeksi,
     * joten pistekohtainen pyyhkiminen ei osuisi keskelle lainkaan – ja juuri
     * alleviivaus on se merkintä jota tulee eniten siistittyä.
     */
    const palat = eraseAt(alleviivaus, { x: 5, y: 0 }, 1);
    expect(palat).toHaveLength(2);
    expect(palat[0]).toEqual([0, 0, 4, 0]);
    expect(palat[1]).toEqual([6, 0, 10, 0]);
  });

  it('lyhentää vetoa kun pyyhitään päästä', () => {
    const palat = eraseAt(alleviivaus, { x: 0, y: 0 }, 2.5);
    expect(palat).toHaveLength(1);
    expect(palat[0]).toEqual([2.5, 0, 10, 0]);
  });

  it('poistaa koko vedon kun pyyhin peittää sen', () => {
    expect(eraseAt(alleviivaus, { x: 5, y: 0 }, 20)).toEqual([]);
  });

  it('ei muuta vetoa kun pyyhin menee ohi', () => {
    expect(eraseAt(alleviivaus, { x: 5, y: 9 }, 1)).toEqual([alleviivaus]);
  });

  it('pyyhkii monipisteisestä vedosta vain osuvan kohdan', () => {
    const mutka = [0, 0, 5, 0, 5, 5, 10, 5];
    const palat = eraseAt(mutka, { x: 5, y: 0 }, 1);
    expect(palat).toHaveLength(2);
    expect(palat[0].slice(0, 2)).toEqual([0, 0]);
    expect(palat[1].slice(-2)).toEqual([10, 5]);
  });

  it('karsii yksittäisiksi jäävät tähteet', () => {
    // Pyyhkimen reunaan jäänyt piste piirtyisi pisteenä keskelle pyyhittyä kohtaa.
    const palat = eraseAt([0, 0, 0.5, 0], { x: 0.25, y: 0 }, 5);
    expect(palat).toEqual([]);
  });

  it('ei muuta alkuperäistä', () => {
    const kopio = alleviivaus.slice();
    eraseAt(alleviivaus, { x: 5, y: 0 }, 1);
    expect(alleviivaus).toEqual(kopio);
  });

  it('sietää tyhjän ja yksipisteisen vedon', () => {
    expect(eraseAt([], { x: 0, y: 0 }, 1)).toEqual([]);
    expect(eraseAt([5, 5], { x: 5, y: 5 }, 1)).toEqual([]);
    expect(eraseAt([5, 5], { x: 9, y: 9 }, 1)).toEqual([[5, 5]]);
  });
});

describe('mittasuhteet', () => {
  it('viiva on ohut mutta näkyvä tavallisella tekstikoolla', () => {
    // 20 px teksti on live-tilan oletus; viivan on erotuttava kirjaimista
    // ilman että se peittää niitä.
    expect(STROKE_WIDTH * 20).toBeGreaterThan(1);
    expect(STROKE_WIDTH * 20).toBeLessThan(4);
  });

  it('pyyhekumi on viivaa selvästi leveämpi', () => {
    // Muuten pyyhkiminen vaatisi osumista pikselilleen samaan kohtaan.
    expect(ERASER_RADIUS).toBeGreaterThan(STROKE_WIDTH * 3);
  });
});
