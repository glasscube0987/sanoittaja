import { describe, expect, it } from 'vitest';
import { barLineText, chordLineText, isBlankLine } from './render';
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
