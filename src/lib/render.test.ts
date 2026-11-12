import { describe, expect, it } from 'vitest';
import {
  barLineText,
  chordLineText,
  isBlankLine,
  meterGutter,
  repeatGutter,
  wrapBarLine,
} from './render';
import type { BarRepeat } from './types';
import type { ChordAnchor, LyricLine } from './types';

function line(text: string, chords: [number, string][]): LyricLine {
  return {
    id: 'l',
    text,
    chords: chords.map(([pos, symbol], i): ChordAnchor => ({ id: `c${i}`, pos, symbol })),
  };
}

describe('chordLineText', () => {
  it('asettaa soinnut sarakkeisiinsa', () => {
    expect(chordLineText(line('kuu valaisee yön', [[0, 'Am'], [4, 'F']]))).toBe('Am  F');
    expect(chordLineText(line('kuu valaisee yön', [[4, 'F']]))).toBe('    F');
  });

  it('palauttaa tyhjän rivin ilman sointuja', () => {
    expect(chordLineText(line('pelkkää tekstiä', []))).toBe('');
  });

  it('järjestää soinnut sijainnin mukaan', () => {
    expect(chordLineText(line('', [[8, 'F'], [0, 'Am']]))).toBe('Am      F');
  });

  it('erottaa päällekkäin osuvat soinnut vähintään välilyönnillä', () => {
    // Am7 vie sarakkeet 0–2, joten sarakkeeseen 2 pyytävä F siirtyy oikealle.
    expect(chordLineText(line('sanat', [[0, 'Am7'], [2, 'F']]))).toBe('Am7 F');
    expect(chordLineText(line('sanat', [[0, 'Am7'], [1, 'F'], [2, 'G']]))).toBe('Am7 F G');
  });

  it('toimii sanattomalla välisoittorivillä', () => {
    expect(chordLineText(line('', [[0, 'Am'], [8, 'F'], [16, 'C']]))).toBe('Am      F       C');
  });
});

describe('barLineText', () => {
  it('ladotaan tahtiviivoin', () => {
    expect(barLineText(['Am', 'F', 'C', 'G'])).toBe('| Am | F  | C  | G  |');
  });

  it('tasaa tahdit leveimmän mukaan, jotta tahtiviivat ovat allekkain', () => {
    const rivi = barLineText(['Am', 'F#m7', 'C']);
    expect(rivi).toBe('| Am   | F#m7 | C    |');
    // Tahtiviivat samoissa sarakkeissa kuin lyhyemmillä tahdeilla.
    const viivat = [...rivi].flatMap((c, i) => (c === '|' ? [i] : []));
    expect(viivat).toEqual([0, 7, 14, 21]);
  });

  it('säilyttää useamman soinnun tahdissa', () => {
    expect(barLineText(['Am F', 'C'])).toBe('| Am F | C    |');
  });

  it('näyttää tyhjän tahdin tahtina', () => {
    expect(barLineText(['', ''])).toBe('|    |    |');
    expect(barLineText([])).toBe('');
  });
});

describe('isBlankLine', () => {
  it('tunnistaa tyhjän rivin', () => {
    expect(isBlankLine(line('', []))).toBe(true);
    expect(isBlankLine(line('   ', []))).toBe(true);
    expect(isBlankLine(line('', [[0, 'Am']]))).toBe(false);
    expect(isBlankLine(line('sanat', []))).toBe(false);
  });
});

describe('barLineText tahtilajilla', () => {
  it('etuliittää rivin ensimmäisen tahtilajin tahtiviivan eteen', () => {
    expect(barLineText(['Am', 'F'], ['3/4'])).toBe('3/4 | Am | F  |');
  });

  it('kirjoittaa kesken rivin vaihtuvan lajin tahdin alkuun', () => {
    // Tahtilaji kuuluu siihen tahtiin josta laji vaihtuu, joten se on
    // tahtiviivan jälkeen eikä sitä ennen.
    expect(barLineText(['Am', 'F', 'Dm'], ['', '', '3/4'])).toBe('| Am     | F      | 3/4 Dm |');
  });

  it('jättää etuliitteen pois ilman tahtilajia', () => {
    expect(barLineText(['Am', 'F'])).toBe('| Am | F  |');
    expect(barLineText(['Am', 'F'], [''])).toBe('| Am | F  |');
    expect(barLineText(['Am', 'F'], ['   '])).toBe('| Am | F  |');
  });

  it('varaa sarakkeen johtavalle merkinnälle myös ilman merkintää', () => {
    // Ilman varattua saraketta merkitty rivi liukuisi sivuun muista.
    const merkitty = barLineText(['Am', 'F'], ['3/4'], 4);
    const merkitsematon = barLineText(['C', 'G'], [], 4);
    expect(merkitty).toBe('3/4 | Am | F  |');
    expect(merkitsematon).toBe('    | C  | G  |');
    expect(merkitty.indexOf('|')).toBe(merkitsematon.indexOf('|'));
  });
});

describe('meterGutter', () => {
  const bars = (id: string, meters?: string[], meter?: string) => ({
    id,
    text: '',
    chords: [],
    bars: ['Am'],
    ...(meters ? { meters } : {}),
    ...(meter ? { meter } : {}),
  });

  it('on nolla ilman tahtilajeja', () => {
    expect(meterGutter([bars('a'), { id: 'b', text: 'sanat', chords: [] }])).toBe(0);
  });

  it('mitoittuu levimmän johtavan merkinnän mukaan', () => {
    expect(meterGutter([bars('a', ['3/4']), bars('b', ['12/8'])])).toBe(5);
  });

  it('ei huomioi kesken rivin vaihtuvia lajeja', () => {
    // Ne eivät siirrä rivin alkua, joten niille ei tarvitse varata saraketta.
    expect(meterGutter([bars('a', ['', '3/4'])])).toBe(0);
  });

  it('lukee myös vanhan rivikohtaisen kentän', () => {
    expect(meterGutter([bars('a', undefined, '4/4')])).toBe(4);
  });
});

describe('barLineText kertausmerkeillä', () => {
  const rivi = (marks: BarRepeat[], gutter = 0) =>
    barLineText(['Am', 'F'], [], 0, { marks, gutter });

  it('avaa kertauksen tahdin edestä', () => {
    expect(rivi([{ start: true }, {}])).toBe('|: Am | F  |');
  });

  it('sulkee kertauksen tahdin jälkeen', () => {
    expect(rivi([{}, { end: true }])).toBe('| Am | F  :|');
  });

  it('sama tahti voi avata ja sulkea', () => {
    expect(barLineText(['Am'], [], 0, { marks: [{ start: true, end: true }] })).toBe('|: Am :|');
  });

  /* Vierekkäin osuvat sulku ja avaus ovat yksi tahtiviiva, kuten nuotissa. */
  it('yhdistää vierekkäisen sulun ja avauksen', () => {
    expect(barLineText(['Am', 'F', 'C'], [], 0, { marks: [{}, { end: true }, { start: true }] })).toBe(
      '| Am | F  :||: C  |',
    );
  });

  /* Kertausmerkki tarkoittaa perinteen mukaan jo kahdesti soittamista. */
  it('kirjoittaa kertaluvun vain yli kahdella', () => {
    expect(rivi([{}, { end: true, times: 2 }])).toBe('| Am | F  :|');
    expect(rivi([{}, { end: true, times: 4 }])).toBe('| Am | F  :|x4');
  });

  it('merkitön rivi latoutuu ennallaan', () => {
    expect(rivi([{}, {}])).toBe(barLineText(['Am', 'F']));
  });

  /*
   * Avaava merkki on merkin leveämpi kuin tavallinen tahtiviiva, joten ilman
   * varattua tilaa kertaava rivi liukuisi sivuun muista sointuriveistä.
   */
  it('varattu tila pitää kertaavan ja kertaamattoman rivin allekkain', () => {
    const kertaava = rivi([{ start: true }, {}], 1);
    const tavallinen = rivi([{}, {}], 1);
    expect(kertaava.indexOf('Am')).toBe(tavallinen.indexOf('Am'));
    expect(tavallinen).toBe('|  Am | F  |');
  });
});

describe('repeatGutter', () => {
  it('on nolla kun avauksia ei ole', () => {
    expect(repeatGutter([{ id: 'l', text: '', chords: [], bars: ['Am'] }])).toBe(0);
    expect(
      repeatGutter([{ id: 'l', text: '', chords: [], bars: ['Am'], repeats: [{ end: true }] }]),
    ).toBe(0);
  });

  it('varaa tilan kun yksikin rivi avaa kertauksen', () => {
    expect(
      repeatGutter([
        { id: 'a', text: '', chords: [], bars: ['Am'] },
        { id: 'b', text: '', chords: [], bars: ['F'], repeats: [{ start: true }] },
      ]),
    ).toBe(1);
  });
});

describe('wrapBarLine', () => {
  const tahdit = ['Am', 'F', 'C', 'G', 'Dm', 'E7', 'Am', 'Am'];

  it('mahtuva rivi on yksi pala, sama kuin barLineText', () => {
    expect(wrapBarLine(tahdit, [], 0, {}, 80)).toEqual([
      { from: 0, shift: 0, text: barLineText(tahdit) },
    ]);
  });

  it('ääretön leveys ei rivitä: tuloste pysyy ennallaan', () => {
    expect(wrapBarLine(tahdit)).toHaveLength(1);
  });

  it('katkaisee tahtiviivasta ja jokainen pala mahtuu', () => {
    const palat = wrapBarLine(tahdit, [], 0, {}, 24);
    expect(palat.map((p) => p.text)).toEqual([
      '| Am | F  | C  | G  |',
      '| Dm | E7 | Am | Am |',
    ]);
    for (const pala of palat) expect(pala.text.length).toBeLessThanOrEqual(24);
  });

  it('kapealla näytöllä paloja tulee useampi', () => {
    const palat = wrapBarLine(tahdit, [], 0, {}, 12);
    expect(palat.map((p) => p.text)).toEqual([
      '| Am | F  |',
      '| C  | G  |',
      '| Dm | E7 |',
      '| Am | Am |',
    ]);
  });

  /* Liian leveä tahti valuu yli mieluummin kuin jää kokonaan pois. */
  it('jokaisessa palassa on vähintään yksi tahti', () => {
    const palat = wrapBarLine(['Cmaj7 Am7 Dm7 G7', 'C'], [], 0, {}, 8);
    expect(palat).toHaveLength(2);
    expect(palat[0].text).toContain('Cmaj7 Am7 Dm7 G7');
  });

  /*
   * Merkinnät ovat tallessa taittamattoman rivin sarakkeissa. `shift` kertoo
   * paljonko palan sisältö on siirtynyt, joten sama merkki on kummassakin
   * samassa kohdassa: palan sarake + shift = rivin sarake.
   */
  it('tahdin sisältö on palassa samassa kohdassa kuin koko rivillä', () => {
    const koko = barLineText(tahdit);
    const palat = wrapBarLine(tahdit, [], 0, {}, 24);
    const toinen = palat[1];
    const dm = toinen.text.indexOf('Dm');
    expect(koko.slice(dm + toinen.shift, dm + toinen.shift + 2)).toBe('Dm');
    const e7 = toinen.text.indexOf('E7');
    expect(koko.slice(e7 + toinen.shift, e7 + toinen.shift + 2)).toBe('E7');
    // Pala alkaa rivillä tahtiviivasta, joka edeltää sen ensimmäistä tahtia.
    expect(koko[toinen.from]).toBe('|');
    expect(koko.slice(toinen.from).trimStart().startsWith('| Dm')).toBe(true);
  });

  /* Taittokohdan `:||:` jakautuu niin kuin nuotissa rivin vaihtuessa: sulkeva
     jää edellisen rivin loppuun ja avaava aloittaa seuraavan. */
  it('kertausmerkit jakautuvat taittokohdassa', () => {
    const marks: BarRepeat[] = [{ start: true }, {}, {}, { end: true }, { start: true }, {}, {}, { end: true, times: 3 }];
    const palat = wrapBarLine(tahdit, [], 0, { marks, gutter: 1 }, 26);
    expect(palat.map((p) => p.text)).toEqual([
      '|: Am | F  | C  | G  :|',
      '|: Dm | E7 | Am | Am :|x3',
    ]);
    // Taittamattomana ne ovat yksi merkki.
    expect(barLineText(tahdit, [], 0, { marks, gutter: 1 })).toContain(':||:');
  });

  it('kertausmerkkien kanssa sisältö on yhä samassa kohdassa', () => {
    const marks: BarRepeat[] = [{ start: true }, {}, {}, { end: true }, { start: true }, {}, {}, { end: true }];
    const koko = barLineText(tahdit, [], 0, { marks, gutter: 1 });
    const toinen = wrapBarLine(tahdit, [], 0, { marks, gutter: 1 }, 26)[1];
    const dm = toinen.text.indexOf('Dm');
    expect(koko.slice(dm + toinen.shift, dm + toinen.shift + 2)).toBe('Dm');
  });

  /* Johtavan tahtilajin sarake on jatkorivillä tyhjä mutta varattu, jotta
     tahtiviivat pysyvät allekkain. */
  it('jatkorivin tahtiviivat ovat allekkain ensimmäisen rivin kanssa', () => {
    const palat = wrapBarLine(tahdit, ['3/4'], 4, {}, 28);
    expect(palat[0].text.startsWith('3/4 | Am')).toBe(true);
    expect(palat[1].text.startsWith('    | Dm')).toBe(true);
    expect(palat[1].text.indexOf('|')).toBe(palat[0].text.indexOf('|'));
  });

  it('tyhjä rivi on yksi tyhjä pala', () => {
    expect(wrapBarLine([], [], 0, {}, 20)).toEqual([{ from: 0, shift: 0, text: '' }]);
  });
});
