import { describe, expect, it } from 'vitest';
import { allTags, dedupeTags, filterByTags, hasTag, normalizeTag, uniqueTags } from './tags';
import type { Song } from './types';

const laulu = (id: string, tags?: string[]): Song => ({
  id,
  title: id,
  songKey: '',
  createdAt: 1,
  updatedAt: 1,
  lines: [],
  ...(tags ? { tags } : {}),
});

const kirjasto = (): Song[] => [
  laulu('a', ['cover', 'keikkakunto']),
  laulu('b', ['Cover']),
  laulu('c', ['kesken']),
  laulu('d'),
];

const nimet = (songs: Song[]) => songs.map((s) => s.id);

describe('normalizeTag', () => {
  it('siivoaa reunavälit ja tiivistää sisäiset', () => {
    expect(normalizeTag('  keikka  kunto ')).toBe('keikka kunto');
  });

  it('tyhjä jää tyhjäksi', () => {
    expect(normalizeTag('   ')).toBe('');
  });
});

describe('dedupeTags', () => {
  it('säilyttää tulon järjestyksen ja ensin kirjoitetun asun', () => {
    expect(dedupeTags([' Cover ', 'kesken', 'cover'])).toEqual(['Cover', 'kesken']);
  });

  it('pudottaa tyhjät', () => {
    expect(dedupeTags(['', '   ', 'cover'])).toEqual(['cover']);
  });
});

describe('uniqueTags', () => {
  it('aakkostaa ja yhdistää kirjainkoosta riippumatta', () => {
    expect(uniqueTags(['öinen', 'Cover', 'aamu', 'cover'], 'fi')).toEqual([
      'aamu',
      'Cover',
      'öinen',
    ]);
  });
});

describe('allTags', () => {
  it('antaa kunkin tagin kerran kirjainkoosta riippumatta', () => {
    // «cover» ja «Cover» ovat sama tagi; ensin kirjoitettu asu voittaa.
    expect(allTags(kirjasto(), 'fi')).toEqual(['cover', 'keikkakunto', 'kesken']);
  });

  it('aakkostaa suomen mukaan', () => {
    const songs = [laulu('a', ['öinen']), laulu('b', ['aamu']), laulu('c', ['ääni'])];
    expect(allTags(songs, 'fi')).toEqual(['aamu', 'ääni', 'öinen']);
  });

  it('tagiton kirjasto on tyhjä', () => {
    expect(allTags([laulu('a'), laulu('b')], 'fi')).toEqual([]);
  });
});

describe('hasTag', () => {
  it('ei erota kirjainkokoa', () => {
    expect(hasTag(laulu('a', ['Cover']), 'cover')).toBe(true);
    expect(hasTag(laulu('a', ['cover']), 'kesken')).toBe(false);
  });
});

describe('filterByTags', () => {
  it('tyhjä valinta palauttaa kaikki', () => {
    expect(nimet(filterByTags(kirjasto(), []))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('yksi tagi suodattaa kirjainkoosta riippumatta', () => {
    expect(nimet(filterByTags(kirjasto(), ['cover']))).toEqual(['a', 'b']);
    expect(nimet(filterByTags(kirjasto(), ['COVER']))).toEqual(['a', 'b']);
  });

  /*
   * Käyttäjän valitsema sääntö. Laajentava tulkinta antaisi tässä ['a','b'],
   * eli lista kasvaisi toisen tagin myötä – juuri päinvastoin kuin
   * suodattamisella haetaan.
   */
  it('kaksi tagia kaventaa eikä laajenna', () => {
    expect(nimet(filterByTags(kirjasto(), ['cover', 'keikkakunto']))).toEqual(['a']);
  });

  it('tagiton laulu ei osu mihinkään valintaan', () => {
    expect(nimet(filterByTags(kirjasto(), ['kesken']))).toEqual(['c']);
  });

  it('osumaton valinta palauttaa tyhjän', () => {
    expect(nimet(filterByTags(kirjasto(), ['eiolemassa']))).toEqual([]);
  });
});
