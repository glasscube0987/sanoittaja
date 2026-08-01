import { describe, expect, it } from 'vitest';
import { parseChord, respellChord, transposeChord } from './chords';

describe('parseChord', () => {
  it('jäsentää perussoinnut', () => {
    expect(parseChord('C')).toEqual({ root: 'C', quality: '', bass: undefined });
    expect(parseChord('Am7')).toEqual({ root: 'A', quality: 'm7', bass: undefined });
    expect(parseChord('F#sus4')).toEqual({ root: 'F#', quality: 'sus4', bass: undefined });
  });

  it('jäsentää bassosävelen', () => {
    expect(parseChord('C/G')).toEqual({ root: 'C', quality: '', bass: 'G' });
    expect(parseChord('Dm7/Bb')).toEqual({ root: 'D', quality: 'm7', bass: 'Bb' });
  });

  it('hylkää tunnistamattomat', () => {
    expect(parseChord('H7')).toBeNull();
    expect(parseChord('')).toBeNull();
    expect(parseChord('7')).toBeNull();
  });
});

describe('transposeChord', () => {
  it('transponoi ylös ja alas', () => {
    expect(transposeChord('C', 2)).toBe('D');
    expect(transposeChord('Am', -2)).toBe('Gm');
    expect(transposeChord('G7', 5)).toBe('C7');
  });

  it('kiertää oktaavin yli', () => {
    expect(transposeChord('B', 1)).toBe('C');
    expect(transposeChord('C', -1)).toBe('B');
    expect(transposeChord('D', 12)).toBe('D');
  });

  it('säilyttää laadun ja transponoi basson', () => {
    expect(transposeChord('Am7/G', 2)).toBe('Bm7/A');
    expect(transposeChord('Csus2/E', 1)).toBe('C#sus2/F');
  });

  it('kunnioittaa etumerkkiasetusta', () => {
    expect(transposeChord('C', 1, 'flat')).toBe('Db');
    expect(transposeChord('C', 1, 'sharp')).toBe('C#');
  });

  it('päättelee etumerkin alkuperäisestä symbolista', () => {
    expect(transposeChord('Bb', 2)).toBe('C');
    expect(transposeChord('Bb', 1)).toBe('B');
    expect(transposeChord('A#', 1)).toBe('B');
    expect(transposeChord('F#m', 2)).toBe('G#m');
  });

  it('palauttaa tunnistamattoman symbolin muuttumattomana', () => {
    expect(transposeChord('N.C.', 3)).toBe('N.C.');
    expect(transposeChord('riffi', 3)).toBe('riffi');
  });
});

describe('respellChord', () => {
  it('vaihtaa enharmonisen kirjoitusasun', () => {
    expect(respellChord('C#m', 'flat')).toBe('Dbm');
    expect(respellChord('Dbm', 'sharp')).toBe('C#m');
    expect(respellChord('C', 'flat')).toBe('C');
  });
});
