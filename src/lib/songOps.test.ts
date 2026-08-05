import { describe, expect, it } from 'vitest';
import {
  barsFromLine,
  DEFAULT_BARS,
  editLineText,
  insertLinesAfter,
  mergeLineWithPrevious,
  placeChord,
  resetTranspose,
  respellSong,
  setChord,
  setLineMeter,
  splitLine,
  transposeOffset,
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

  it('rajaa kohdan rivin sointualueeseen', () => {
    // 'kuu valaisee yön' on 16 merkkiä, joten 16 + 8 jää alle 32:n vähimmäisleveyden.
    const song = placeChord(makeSong(), 'l1', 0, 999, 'Am');
    expect(song.lines[0].chords.find((c) => c.symbol === 'Am')?.pos).toBe(32);
    expect(placeChord(makeSong(), 'l1', 4, -5, 'F').lines[0].chords[0]).toMatchObject({
      pos: 0,
      symbol: 'F',
    });
  });

  it('sallii soinnun tekstin loppumisen jälkeen', () => {
    // Kierrosointu viimeisen sanan jälkeen: ennen tämä napsahti rivin loppuun.
    const song = placeChord(makeSong(), 'l1', 4, 20, 'G');
    expect(song.lines[0].chords.find((c) => c.symbol === 'G')?.pos).toBe(20);
  });

  it('sallii useita sointuja sanattomalla rivillä', () => {
    let song = makeSong();
    song = { ...song, lines: [{ id: 'v1', text: '', chords: [] }, ...song.lines] };
    for (const [pos, symbol] of [
      [0, 'Am'],
      [8, 'F'],
      [16, 'C'],
      [24, 'G'],
    ] as const) {
      song = placeChord(song, 'v1', pos, pos, symbol);
    }
    expect(song.lines[0].chords.map((c) => [c.pos, c.symbol])).toEqual([
      [0, 'Am'],
      [8, 'F'],
      [16, 'C'],
      [24, 'G'],
    ]);
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

  it('kerryttää siirtymän ja palautus vie takaisin alkuperäiseen', () => {
    const alku = makeSong();
    let song = transposeSong(alku, 2);
    song = transposeSong(song, 3);
    expect(transposeOffset(song)).toBe(5);
    expect(song.songKey).toBe('Dm');

    const palautettu = resetTranspose(song);
    expect(transposeOffset(palautettu)).toBe(0);
    expect(palautettu.songKey).toBe('Am');
    expect(palautettu.lines[0].chords.map((c) => c.symbol)).toEqual(['Am', 'F', 'E7']);
  });

  it('palautus tuo oikeat sävelet vaikka kirjoitusasu vaihtuisi', () => {
    // Transponointi ei muista enharmonista valintaa: Bb voi palata muodossa A#.
    const bb: Song = { ...makeSong(), songKey: 'Bb', lines: [{ id: 'l1', text: 'x', chords: [{ id: 'c', pos: 0, symbol: 'Bb' }] }] };
    const palautettu = resetTranspose(transposeSong(bb, 1));
    expect(transposeOffset(palautettu)).toBe(0);
    expect(['Bb', 'A#']).toContain(palautettu.lines[0].chords[0].symbol);
  });

  it('kirjoitusasun vaihto ei muuta siirtymää', () => {
    const song = respellSong(transposeSong(makeSong(), 2), 'flat');
    expect(transposeOffset(song)).toBe(2);
  });

  it('transponoi myös sointurivit', () => {
    const lahto = makeSong();
    const withBars: Song = {
      ...lahto,
      lines: [{ id: 'v1', text: '', chords: [], bars: ['Am F', '%', 'C'] }, ...lahto.lines],
    };
    expect(transposeSong(withBars, 2).lines[0].bars).toEqual(['Bm G', '%', 'D']);
  });
});

describe('insertLinesAfter', () => {
  const lisatyt = [
    { id: 'n1', text: 'uusi eka', chords: [] },
    { id: 'n2', text: 'uusi toka', chords: [] },
  ];

  it('lisää rivit annetun rivin perään', () => {
    const song = insertLinesAfter(makeSong(), 'l1', lisatyt);
    expect(song.lines.map((l) => l.id)).toEqual(['l1', 'n1', 'n2', 'l2']);
  });

  it('lisää laulun loppuun kun kohtaa ei anneta', () => {
    const song = insertLinesAfter(makeSong(), null, lisatyt);
    expect(song.lines.map((l) => l.id)).toEqual(['l1', 'l2', 'n1', 'n2']);
  });

  it('ei muuta laulua tyhjällä lisäyksellä eikä tuntemattomalla rivillä', () => {
    const lahto = makeSong();
    expect(insertLinesAfter(lahto, 'l1', [])).toBe(lahto);
    expect(insertLinesAfter(lahto, 'ei-ole', lisatyt).lines).toEqual(lahto.lines);
  });

  it('säilyttää olemassa olevat rivit sellaisinaan', () => {
    const lahto = makeSong();
    const song = insertLinesAfter(lahto, 'l1', lisatyt);
    expect(song.lines[0]).toEqual(lahto.lines[0]);
    expect(song.lines[3]).toEqual(lahto.lines[1]);
  });
});

describe('barsFromLine', () => {
  it('siirtää rivin soinnut tahdeiksi sijaintijärjestyksessä', () => {
    const line = {
      id: 'l',
      text: 'kuu valaisee yön',
      chords: [
        { id: 'c2', pos: 13, symbol: 'E7' },
        { id: 'c1', pos: 0, symbol: 'Am' },
        { id: 'c3', pos: 4, symbol: 'F' },
      ],
    };
    expect(barsFromLine(line)).toEqual(['Am', 'F', 'E7']);
  });

  it('palaa oletustahteihin kun sointuja ei ole', () => {
    expect(barsFromLine({ id: 'l', text: 'sanoja', chords: [] })).toEqual(DEFAULT_BARS);
  });

  it('ei muuta lähtörivin sointujen järjestystä', () => {
    const chords = [
      { id: 'c2', pos: 9, symbol: 'F' },
      { id: 'c1', pos: 0, symbol: 'Am' },
    ];
    barsFromLine({ id: 'l', text: 'sanoja', chords });
    expect(chords.map((c) => c.symbol)).toEqual(['F', 'Am']);
  });
});

describe('setLineMeter', () => {
  it('asettaa ja poistaa rivin tahtilajin', () => {
    let song = setLineMeter(makeSong(), 'l1', ' 3/4 ');
    expect(song.lines[0].meter).toBe('3/4');

    song = setLineMeter(song, 'l1', '');
    expect(song.lines[0]).not.toHaveProperty('meter');
  });
});

describe('tahtilaji ja transponointi', () => {
  it('ei transponoi rivin tahtilajia', () => {
    // transposeBar käsittelee tahdin sisällön sana kerrallaan; tahtilaji on
    // oma kenttänsä juuri siksi, ettei se joudu sen läpi.
    const lahto: Song = {
      ...makeSong(),
      meter: '4/4',
      lines: [{ id: 'b1', text: '', chords: [], bars: ['Am', 'F'], meter: '3/4' }],
    };
    const song = transposeSong(lahto, 2);
    expect(song.lines[0].meter).toBe('3/4');
    expect(song.meter).toBe('4/4');
    expect(song.lines[0].bars).toEqual(['Bm', 'G']);
  });

  it('ei muuta tahtilajia kirjoitusasua vaihdettaessa', () => {
    const lahto: Song = { ...makeSong(), meter: '6/8' };
    expect(respellSong(lahto, 'flat').meter).toBe('6/8');
  });
});
