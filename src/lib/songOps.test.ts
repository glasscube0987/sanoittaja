import { describe, expect, it } from 'vitest';
import {
  editLineText,
  mergeLineWithPrevious,
  placeChord,
  setChord,
  splitLine,
  transposeSong,
} from './songOps';
import type { Song } from './types';

function makeSong(): Song {
  return {
    id: 's1',
    title: 'Testi',
    songKey: 'Am',
    lines: [
      {
        id: 'l1',
        text: 'kuu valaisee yön',
        chords: [
          { id: 'c1', pos: 0, symbol: 'Am' },
          { id: 'c2', pos: 4, symbol: 'F' },
          { id: 'c3', pos: 13, symbol: 'E7' },
        ],
      },
      { id: 'l2', text: 'toinen rivi', chords: [{ id: 'c4', pos: 7, symbol: 'C' }] },
    ],
    createdAt: 1,
    updatedAt: 1,
  };
}

describe('editLineText', () => {
  it('siirtää soinnut tekstimuutoksen mukana', () => {
    const song = editLineText(makeSong(), 'l1', 'kuu taas valaisee yön');
    expect(song.lines[0].chords.map((c) => c.pos)).toEqual([0, 9, 18]);
  });
});

describe('splitLine ja mergeLineWithPrevious', () => {
  it('jakaa soinnut oikeille riveille', () => {
    const song = splitLine(makeSong(), 'l1', 4);
    expect(song.lines).toHaveLength(3);
    expect(song.lines[0].text).toBe('kuu ');
    expect(song.lines[0].chords.map((c) => c.symbol)).toEqual(['Am']);
    expect(song.lines[1].text).toBe('valaisee yön');
    expect(song.lines[1].chords.map((c) => c.pos)).toEqual([0, 9]);
  });

  it('yhdistäminen palauttaa alkuperäisen', () => {
    const split = splitLine(makeSong(), 'l1', 4);
    const merged = mergeLineWithPrevious(split, split.lines[1].id);
    expect(merged.lines).toHaveLength(2);
    expect(merged.lines[0].text).toBe('kuu valaisee yön');
    expect(merged.lines[0].chords.map((c) => c.pos)).toEqual([0, 4, 13]);
  });
});

describe('setChord', () => {
  it('lisää, korvaa ja poistaa soinnun', () => {
    let song = setChord(makeSong(), 'l1', 8, 'Dm');
    expect(song.lines[0].chords.map((c) => c.symbol)).toEqual(['Am', 'F', 'Dm', 'E7']);
    song = setChord(song, 'l1', 8, 'Dm7');
    expect(song.lines[0].chords.map((c) => c.symbol)).toEqual(['Am', 'F', 'Dm7', 'E7']);
    song = setChord(song, 'l1', 8, '');
    expect(song.lines[0].chords.map((c) => c.symbol)).toEqual(['Am', 'F', 'E7']);
  });
});

describe('placeChord', () => {
  it('siirtää soinnun uuteen kohtaan jättämättä kopiota', () => {
    const song = placeChord(makeSong(), 'l1', 4, 6, 'F');
    expect(song.lines[0].chords.map((c) => [c.pos, c.symbol])).toEqual([
      [0, 'Am'],
      [6, 'F'],
      [13, 'E7'],
    ]);
  });

  it('säilyttää soinnun id:n siirrossa', () => {
    const song = placeChord(makeSong(), 'l1', 4, 6, 'F');
    expect(song.lines[0].chords.find((c) => c.pos === 6)?.id).toBe('c2');
  });

  it('korvaa kohdekohdassa olevan soinnun', () => {
    const song = placeChord(makeSong(), 'l1', 0, 4, 'Am');
    expect(song.lines[0].chords.map((c) => [c.pos, c.symbol])).toEqual([
      [4, 'Am'],
      [13, 'E7'],
    ]);
  });

  it('rajaa kohdan rivin pituuteen', () => {
    const song = placeChord(makeSong(), 'l1', 0, 999, 'Am');
    expect(song.lines[0].chords.find((c) => c.symbol === 'Am')?.pos).toBe(16);
    expect(placeChord(makeSong(), 'l1', 4, -5, 'F').lines[0].chords[0]).toMatchObject({
      pos: 0,
      symbol: 'F',
    });
  });

  it('poistaa soinnun tyhjällä symbolilla myös siirrettäessä', () => {
    const song = placeChord(makeSong(), 'l1', 4, 6, '  ');
    expect(song.lines[0].chords.map((c) => c.symbol)).toEqual(['Am', 'E7']);
  });
});

describe('transposeSong', () => {
  it('transponoi kaikki soinnut ja sävellajin', () => {
    const song = transposeSong(makeSong(), 2);
    expect(song.songKey).toBe('Bm');
    expect(song.lines[0].chords.map((c) => c.symbol)).toEqual(['Bm', 'G', 'F#7']);
    expect(song.lines[1].chords[0].symbol).toBe('D');
  });
});
