import { beforeEach, describe, expect, it } from 'vitest';
import { loadSortOrder, sortSongs, storeSortOrder } from './sortSongs';
import type { Song } from './types';

const UNTITLED = 'Nimetön laulu';

function laulu(title: string, updatedAt = 0): Song {
  return { id: title || 'tyhja', title, songKey: '', createdAt: 0, updatedAt, lines: [] };
}

const nimet = (songs: Song[]) => songs.map((s) => s.title);

describe('sortSongs', () => {
  it('järjestää muokkausajan mukaan uusin ensin', () => {
    const songs = [laulu('vanha', 1), laulu('uusin', 3), laulu('keski', 2)];
    expect(nimet(sortSongs(songs, 'edited', 'fi', UNTITLED))).toEqual(['uusin', 'keski', 'vanha']);
  });

  it('aakkostaa A–Ö', () => {
    const songs = [laulu('Sade'), laulu('Aamu'), laulu('Kuu')];
    expect(nimet(sortSongs(songs, 'az', 'fi', UNTITLED))).toEqual(['Aamu', 'Kuu', 'Sade']);
  });

  it('aakkostaa Ö–A', () => {
    const songs = [laulu('Sade'), laulu('Aamu'), laulu('Kuu')];
    expect(nimet(sortSongs(songs, 'za', 'fi', UNTITLED))).toEqual(['Sade', 'Kuu', 'Aamu']);
  });

  it('sijoittaa ä:n ja ö:n aakkosten loppuun suomeksi', () => {
    /*
     * Merkkijonovertailu (`<`) vertaa koodipisteitä, jolloin ä päätyisi z:n
     * jälkeen mutta myös kaikkien isojen kirjainten jälkeen. Suomessa å ä ö
     * ovat omia kirjaimiaan aakkosten lopussa.
     */
    const songs = [laulu('Ääni'), laulu('Aamu'), laulu('Öinen'), laulu('Zulu')];
    expect(nimet(sortSongs(songs, 'az', 'fi', UNTITLED))).toEqual([
      'Aamu',
      'Zulu',
      'Ääni',
      'Öinen',
    ]);
  });

  it('ei välitä kirjainkoosta', () => {
    const songs = [laulu('banaani'), laulu('Aamu'), laulu('Cembalo')];
    expect(nimet(sortSongs(songs, 'az', 'fi', UNTITLED))).toEqual([
      'Aamu',
      'banaani',
      'Cembalo',
    ]);
  });

  it('järjestää numerot lukuarvon mukaan', () => {
    // Merkkijonona «Laulu 10» tulisi ennen «Laulu 2».
    const songs = [laulu('Laulu 10'), laulu('Laulu 2'), laulu('Laulu 1')];
    expect(nimet(sortSongs(songs, 'az', 'fi', UNTITLED))).toEqual([
      'Laulu 1',
      'Laulu 2',
      'Laulu 10',
    ]);
  });

  it('lajittelee nimettömän laulun näkyvällä otsikollaan', () => {
    // Muuten tyhjä otsikko veisi jokaisen uuden laulun listan alkuun, vaikka
    // käyttäjä näkee siinä lukevan «Nimetön laulu».
    const songs = [laulu('Aamu'), laulu(''), laulu('Sade')];
    expect(nimet(sortSongs(songs, 'az', 'fi', UNTITLED))).toEqual(['Aamu', '', 'Sade']);
  });

  it('pitää samannimiset vakaassa järjestyksessä', () => {
    const songs = [laulu('Sama', 1), laulu('Sama', 3), laulu('Sama', 2)];
    expect(sortSongs(songs, 'az', 'fi', UNTITLED).map((s) => s.updatedAt)).toEqual([3, 2, 1]);
  });

  it('ei muuta alkuperäistä taulukkoa', () => {
    const songs = [laulu('Sade'), laulu('Aamu')];
    sortSongs(songs, 'az', 'fi', UNTITLED);
    expect(nimet(songs)).toEqual(['Sade', 'Aamu']);
  });

  it('sietää tyhjän listan', () => {
    expect(sortSongs([], 'az', 'fi', UNTITLED)).toEqual([]);
  });
});

describe('valinnan muistaminen', () => {
  /** Vitest ajaa Nodessa ilman selainta, joten localStorage tarvitaan tynkänä. */
  beforeEach(() => {
    const store = new Map<string, string>();
    globalThis.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    } as unknown as Storage;
  });

  it('palauttaa oletuksen kun mitään ei ole tallennettu', () => {
    expect(loadSortOrder()).toBe('edited');
  });

  it('muistaa tallennetun valinnan', () => {
    storeSortOrder('za');
    expect(loadSortOrder()).toBe('za');
  });

  it('hylkää tuntemattoman arvon', () => {
    // Vanha tai käsin muokattu arvo ei saa rikkoa listaa.
    localStorage.setItem('sanoittaja.sort', 'roskaa');
    expect(loadSortOrder()).toBe('edited');
  });
});
