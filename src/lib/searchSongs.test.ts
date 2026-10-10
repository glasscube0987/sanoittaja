import { describe, expect, it } from 'vitest';
import { searchSongs } from './searchSongs';
import type { Song } from './types';

const laulu = (id: string, title: string, rivit: string[]): Song => ({
  id,
  title,
  songKey: '',
  createdAt: 1,
  updatedAt: 1,
  lines: rivit.map((text, i) => ({ id: `${id}-${i}`, text, chords: [] })),
});

const kirjasto = (): Song[] => [
  laulu('a', 'Kuu valaisee', ['kuu valaisee yön', 'ja tie vie pohjoiseen halki yön']),
  laulu('b', 'Sateen jälkeen', ['aamu tulee kohta', 'älä katso taakse']),
  laulu('c', '', ['nimetön luonnos']),
];

const nimet = (songs: Song[], haku: string) =>
  searchSongs(songs, haku, 'Nimetön').map((m) => m.song.id);

describe('searchSongs', () => {
  it('tyhjä haku palauttaa kaikki ilman katkelmia', () => {
    const tulos = searchSongs(kirjasto(), '   ', 'Nimetön');
    expect(tulos.map((m) => m.song.id)).toEqual(['a', 'b', 'c']);
    expect(tulos.every((m) => m.snippet === undefined)).toBe(true);
  });

  it('löytää nimellä eikä tuota katkelmaa', () => {
    const tulos = searchSongs(kirjasto(), 'sateen', 'Nimetön');
    expect(tulos).toHaveLength(1);
    expect(tulos[0].song.id).toBe('b');
    // Nimiosuma näkyy jo otsikossa, joten katkelma olisi toistoa.
    expect(tulos[0].snippet).toBeUndefined();
  });

  it('löytää sanoituksesta ja kertoo osuvan rivin', () => {
    const tulos = searchSongs(kirjasto(), 'halki yön', 'Nimetön');
    expect(tulos).toHaveLength(1);
    expect(tulos[0].snippet).toBe('ja tie vie pohjoiseen halki yön');
  });

  it('kirjainkoko ei merkitse', () => {
    expect(nimet(kirjasto(), 'KUU')).toEqual(['a']);
  });

  /*
   * Suomessa ä ja ö ovat omia kirjaimiaan eivätkä a:n ja o:n muunnelmia.
   * Tarkkeiden pudottaminen tekisi sanoista «äla» ja «ala» saman.
   */
  it('ä ei ole sama kuin a', () => {
    // Oma kirjasto, jottei osuma tule sattumalta jostain toisesta sanasta.
    const parit = [laulu('x', 'Älä mene', []), laulu('y', 'Ala mäki', [])];
    expect(nimet(parit, 'älä')).toEqual(['x']);
    expect(nimet(parit, 'ala')).toEqual(['y']);
    expect(nimet(parit, 'mäki')).toEqual(['y']);
    expect(nimet(parit, 'maki')).toEqual([]);
  });

  it('nimetön laulu löytyy näkyvällä otsikollaan', () => {
    expect(nimet(kirjasto(), 'nimetön')).toEqual(['c']);
  });

  it('osumaton haku palauttaa tyhjän', () => {
    expect(nimet(kirjasto(), 'eiolemassa')).toEqual([]);
  });

  it('säilyttää lähtöjärjestyksen', () => {
    expect(nimet(kirjasto(), 'n')).toEqual(['a', 'b', 'c']);
  });
});
