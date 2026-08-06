import { describe, expect, it } from 'vitest';
import {
  hitsStroke,
  pathData,
  simplify,
  toAnchored,
  toFlat,
  toPixels,
  toPoints,
} from './annotate';

/** Rivi ruudun kohdassa (100, 200), leveys 400. */
const rivi = { left: 100, top: 200, width: 400 };

describe('koordinaattimuunnos', () => {
  it('muuntaa näyttöpisteen rivin koordinaatistoon', () => {
    expect(toAnchored(rivi, 300, 240)).toEqual({ x: 0.5, y: 0.1 });
  });

  it('on käännettävissä takaisin', () => {
    const piste = toAnchored(rivi, 342, 263);
    const takaisin = toPixels(rivi, piste);
    expect(takaisin.x).toBeCloseTo(342);
    expect(takaisin.y).toBeCloseTo(263);
  });

  it('säilyttää muodon kun lehti levenee', () => {
    // Sama merkintä leveämmällä näytöllä: ympyrä pysyy ympyränä, koska x ja y
    // jaetaan samalla luvulla. Eri jakajat venyttäisivät sen soikioksi.
    const kapea = { left: 0, top: 0, width: 400 };
    const levea = { left: 0, top: 0, width: 800 };
    const piste = toAnchored(kapea, 100, 100);

    const iso = toPixels(levea, piste);
    expect(iso.x).toBe(200);
    expect(iso.y).toBe(200);
  });

  it('ei jaa nollalla ennen ensimmäistä mittausta', () => {
    expect(() => toAnchored({ left: 0, top: 0, width: 0 }, 10, 10)).not.toThrow();
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
  it('piirtää vedon polkuna', () => {
    expect(pathData([0, 0, 0.5, 0.25], 400)).toBe('M0.00 0.00L200.00 100.00');
  });

  it('tekee yksittäisestä napautuksesta näkyvän', () => {
    // Pelkkä M ei piirrä mitään, jolloin napautus katoaisi jäljettömiin.
    expect(pathData([0.5, 0.5], 400)).toContain('L');
  });

  it('on tyhjä ilman pisteitä', () => {
    expect(pathData([], 400)).toBe('');
  });
});

describe('simplify', () => {
  it('karsii suoralla olevat välipisteet', () => {
    const suora = [0, 0, 0.1, 0, 0.2, 0, 0.3, 0, 0.4, 0];
    expect(simplify(suora)).toEqual([0, 0, 0.4, 0]);
  });

  it('säilyttää mutkan', () => {
    const mutka = [0, 0, 0.2, 0.2, 0.4, 0];
    expect(simplify(mutka)).toEqual(mutka);
  });

  it('säilyttää päätepisteet', () => {
    const veto = [0, 0, 0.05, 0.001, 0.1, 0, 0.9, 0.5];
    const tulos = simplify(veto);
    expect(tulos.slice(0, 2)).toEqual([0, 0]);
    expect(tulos.slice(-2)).toEqual([0.9, 0.5]);
  });

  it('jättää lyhyen vedon rauhaan', () => {
    expect(simplify([0, 0, 1, 1])).toEqual([0, 0, 1, 1]);
    expect(simplify([0, 0])).toEqual([0, 0]);
  });

  it('lyhentää kynän tuottamaa pisteryöppyä tuntuvasti', () => {
    // Kynä tuottaa satoja pisteitä sekunnissa; karsimatta yksi veto olisi
    // kilotavuja ja varmuuskopio kasvaisi turhaan.
    const tiheä: number[] = [];
    for (let i = 0; i <= 200; i++) tiheä.push(i / 200, 0);
    expect(simplify(tiheä).length).toBeLessThan(10);
  });
});

describe('hitsStroke', () => {
  const veto = [0, 0, 0.5, 0, 0.5, 0.5];

  it('osuu vedon janaan', () => {
    expect(hitsStroke(veto, { x: 0.25, y: 0.005 }, 0.02)).toBe(true);
    expect(hitsStroke(veto, { x: 0.5, y: 0.25 }, 0.02)).toBe(true);
  });

  it('ei osu kauas vedosta', () => {
    expect(hitsStroke(veto, { x: 0.25, y: 0.3 }, 0.02)).toBe(false);
  });

  it('osuu yksittäiseen pisteeseen', () => {
    expect(hitsStroke([0.5, 0.5], { x: 0.505, y: 0.5 }, 0.02)).toBe(true);
    expect(hitsStroke([0.5, 0.5], { x: 0.9, y: 0.5 }, 0.02)).toBe(false);
  });

  it('ei osu tyhjään vetoon', () => {
    expect(hitsStroke([], { x: 0, y: 0 }, 0.02)).toBe(false);
  });
});
