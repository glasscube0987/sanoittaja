import { describe, expect, it } from 'vitest';
import { barLineText, chordLineText, isBlankLine, meterGutter } from './render';
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
