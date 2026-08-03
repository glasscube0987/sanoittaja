import { describe, expect, it } from 'vitest';
import type { Key, Params } from './i18n';
import { translate } from './i18n';
import { getSections, sectionTitle as title } from './sections';
import { moveSection, removeLine, setLineSection } from './songOps';
import type { LyricLine, SectionMark, Song } from './types';

/** Testit ajetaan englanniksi, jotta odotetut nimet ovat yksiselitteisiä. */
const t = (key: Key, params?: Params) => translate('en', key, params);
const sectionTitle = (block: Parameters<typeof title>[0]) => title(block, t);

function line(id: string, text: string, section?: SectionMark): LyricLine {
  return section ? { id, text, chords: [], section } : { id, text, chords: [] };
}

function makeSong(lines: LyricLine[]): Song {
  return { id: 's1', title: 'Testi', songKey: '', lines, createdAt: 1, updatedAt: 1 };
}

/** Säkeistö – kertosäe – säkeistö, ilman merkitsemätöntä alkulohkoa. */
function structured(): Song {
  return makeSong([
    line('a1', 'eka säkeistö', { kind: 'verse' }),
    line('a2', 'jatkuu'),
    line('b1', 'kertosäe', { kind: 'chorus' }),
    line('c1', 'toka säkeistö', { kind: 'verse' }),
  ]);
}

describe('getSections', () => {
  it('ryhmittelee merkitsemättömät rivit edeltävään osioon', () => {
    const blocks = getSections(structured());
    expect(blocks.map((b) => b.lines.map((l) => l.id))).toEqual([['a1', 'a2'], ['b1'], ['c1']]);
    expect(blocks.map((b) => [b.start, b.end])).toEqual([
      [0, 2],
      [2, 3],
      [3, 4],
    ]);
  });

  it('jättää alun merkitsemättömät rivit omaksi nimeämättömäksi lohkoksi', () => {
    const blocks = getSections(makeSong([line('x', 'intro-rivi'), line('y', 'säkeistö', { kind: 'verse' })]));
    expect(blocks[0].mark).toBeNull();
    expect(blocks[0].lines.map((l) => l.id)).toEqual(['x']);
    expect(blocks[1].mark).toEqual({ kind: 'verse' });
  });

  it('numeroi vain toistuvat lajit', () => {
    const blocks = getSections(structured());
    expect(blocks.map(sectionTitle)).toEqual(['Verse 1', 'Chorus', 'Verse 2']);
  });

  it('käyttää omaa nimeä numeroinnin sijaan', () => {
    const song = makeSong([
      line('a', 'x', { kind: 'verse' }),
      line('b', 'y', { kind: 'verse', label: 'Loppuhuipennus' }),
      line('c', 'z', { kind: 'verse' }),
    ]);
    expect(getSections(song).map(sectionTitle)).toEqual(['Verse 1', 'Loppuhuipennus', 'Verse 2']);
  });
});

describe('moveSection', () => {
  it('siirtää osion rivit yhtenä lohkona', () => {
    const song = moveSection(structured(), 'b1', -1);
    expect(song.lines.map((l) => l.id)).toEqual(['b1', 'a1', 'a2', 'c1']);
    expect(getSections(song).map(sectionTitle)).toEqual(['Chorus', 'Verse 1', 'Verse 2']);
  });

  it('siirto alas on siirron ylös käänteisoperaatio', () => {
    const moved = moveSection(structured(), 'b1', -1);
    expect(moveSection(moved, 'b1', 1).lines.map((l) => l.id)).toEqual(['a1', 'a2', 'b1', 'c1']);
  });

  it('ei siirrä laulun reunojen yli', () => {
    const song = structured();
    expect(moveSection(song, 'a1', -1).lines).toEqual(song.lines);
    expect(moveSection(song, 'c1', 1).lines).toEqual(song.lines);
  });

  it('ei siirrä osiota merkitsemättömän alkulohkon ohi', () => {
    // Merkitsemättömät rivit kuuluisivat siirron jälkeen väärään osioon.
    const song = makeSong([line('x', 'irrallinen'), line('y', 'säkeistö', { kind: 'verse' })]);
    expect(moveSection(song, 'y', -1).lines).toEqual(song.lines);
  });
});

describe('setLineSection', () => {
  it('lisää ja poistaa merkinnän', () => {
    let song = setLineSection(structured(), 'a2', { kind: 'bridge' });
    expect(getSections(song).map(sectionTitle)).toEqual(['Verse 1', 'Bridge', 'Chorus', 'Verse 2']);
    song = setLineSection(song, 'a2', null);
    expect(song.lines.find((l) => l.id === 'a2')).not.toHaveProperty('section');
    expect(getSections(song)).toHaveLength(3);
  });
});

describe('removeLine', () => {
  it('siirtää osiomerkinnän seuraavalle riville', () => {
    const song = removeLine(structured(), 'a1');
    expect(song.lines[0]).toMatchObject({ id: 'a2', section: { kind: 'verse' } });
    expect(getSections(song).map(sectionTitle)).toEqual(['Verse 1', 'Chorus', 'Verse 2']);
  });

  it('ei ylikirjoita seuraavan rivin omaa merkintää', () => {
    const song = removeLine(structured(), 'b1');
    expect(song.lines.map((l) => l.section?.kind)).toEqual(['verse', undefined, 'verse']);
  });
});
