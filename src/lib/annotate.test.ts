import { describe, expect, it } from 'vitest';
import {
  DRAG_SLOP,
  eraseAlong,
  eraseAt,
  ERASER_RADII,
  ERASER_RADIUS,
  hitsStroke,
  isBlank,
  pathData,
  simplify,
  STROKE_WIDTH,
  STROKE_WIDTHS,
  TEXT_FONTS,
  TEXT_SIZE,
  TEXT_SIZES,
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

describe('eraseAlong', () => {
  /** Pitkä alleviivaus, kuten simplify sen jättää: kaksi pistettä. */
  const alleviivaus = [0, 0, 40, 0];

  it('pyyhkii koko matkaltaan eikä jätä aukkoja', () => {
    /*
     * Ratkaiseva tapaus. Yhteen pisteeseen kohdistuva pyyhkiminen jätti
     * näytepisteiden väliin aukkoja, joten veto hajosi paloiksi sen sijaan
     * että olisi kadonnut sormen alta.
     */
    expect(eraseAlong(alleviivaus, { x: -1, y: 0 }, { x: 41, y: 0 }, 1)).toEqual([]);
  });

  it('katkaisee vedon poikittaisella pyyhkäisyllä', () => {
    const palat = eraseAlong(alleviivaus, { x: 20, y: -3 }, { x: 20, y: 3 }, 1);
    expect(palat).toHaveLength(2);
  });

  it('huomaa lyhentymisen vaikka pisteiden määrä säilyy', () => {
    /*
     * Vedon lyhentäminen päästä jättää yhtä monta pistettä. Pelkkään
     * lukumäärään nojaava vertailu piti sitä muuttumattomana, jolloin
     * pyyhkiminen ei tehnyt mitään päätä lähestyttäessä.
     */
    const palat = eraseAlong(alleviivaus, { x: 40, y: 0 }, { x: 40, y: 0 }, 5);
    expect(palat).not.toBeNull();
    expect(palat![0][2]).toBeLessThan(40);
  });

  it('palauttaa null kun mikään ei muutu', () => {
    expect(eraseAlong(alleviivaus, { x: 0, y: 20 }, { x: 40, y: 20 }, 1)).toBeNull();
  });

  it('pistemäinen jana vastaa yhtä pyyhkäisykohtaa', () => {
    const piste = { x: 20, y: 0 };
    expect(eraseAlong(alleviivaus, piste, piste, 1)).toEqual(eraseAt(alleviivaus, piste, 1));
  });

  it('askeltiheys ei riipu janan pituudesta', () => {
    // Pitkä pyyhkäisy pyyhkii yhtä siististi kuin lyhyt: aukko ei voi kasvaa
    // sädettä suuremmaksi, koska näytteet ovat säteen puolikkaan välein.
    const pitka = [0, 0, 400, 0];
    expect(eraseAlong(pitka, { x: -1, y: 0 }, { x: 401, y: 0 }, 2)).toEqual([]);
  });
});

describe('mittasuhteet', () => {
  it('viiva on ohut mutta näkyvä tavallisella tekstikoolla', () => {
    // 20 px teksti on live-tilan oletus; viivan on erotuttava kirjaimista
    // ilman että se peittää niitä.
    expect(STROKE_WIDTH * 20).toBeGreaterThan(1);
    expect(STROKE_WIDTH * 20).toBeLessThan(4);
  });

  it('koot ovat nousevia ja oletus on keskellä', () => {
    // Oletus on keskimmäinen, jottei aiemmin piirrettyjen vetojen paksuus
    // muutu kun kokovalinta lisätään.
    for (const koot of [STROKE_WIDTHS, ERASER_RADII]) {
      expect(koot).toHaveLength(3);
      expect(koot[0]).toBeLessThan(koot[1]);
      expect(koot[1]).toBeLessThan(koot[2]);
    }
    expect(STROKE_WIDTH).toBe(STROKE_WIDTHS[1]);
    expect(ERASER_RADIUS).toBe(ERASER_RADII[1]);
  });

  it('pyyhekumi on viivaa selvästi leveämpi', () => {
    // Muuten pyyhkiminen vaatisi osumista pikselilleen samaan kohtaan.
    expect(ERASER_RADIUS).toBeGreaterThan(STROKE_WIDTH * 3);
  });
});

describe('tekstikentän mitat', () => {
  it('koot ovat nousevia ja oletus on sanoitusten kokoinen', () => {
    // Keskimmäinen on 1 em eli täsmälleen rivin koko: oletuskenttä näyttää
    // samalta kuin laulun teksti, ja poikkeama on aina valinta.
    expect(TEXT_SIZES).toHaveLength(3);
    expect(TEXT_SIZES[0]).toBeLessThan(TEXT_SIZES[1]);
    expect(TEXT_SIZES[1]).toBeLessThan(TEXT_SIZES[2]);
    expect(TEXT_SIZE).toBe(TEXT_SIZES[1]);
    expect(TEXT_SIZE).toBe(1);
  });

  it('kirjasimia on kolme eikä yhtäkään ladata verkosta', () => {
    expect([...TEXT_FONTS]).toEqual(['sans', 'mono', 'serif']);
  });

  it('vedon kynnys on murto-osa rivistä muttei häviävän pieni', () => {
    // Liian pieni kynnys tekisi jokaisesta napautuksesta siirron, liian suuri
    // vaatisi kentän raahaamista puoli riviä ennen kuin se lähtee mukaan.
    expect(DRAG_SLOP).toBeGreaterThan(0.1);
    expect(DRAG_SLOP).toBeLessThan(1);
  });
});

describe('isBlank', () => {
  it('tunnistaa tyhjän ja pelkän tyhjämerkin', () => {
    expect(isBlank('')).toBe(true);
    expect(isBlank('   ')).toBe(true);
    expect(isBlank('\n\t ')).toBe(true);
  });

  it('ei pidä tyhjänä kenttää jossa on merkkejä', () => {
    expect(isBlank('capo 3')).toBe(false);
    expect(isBlank(' 2x ')).toBe(false);
  });
});
