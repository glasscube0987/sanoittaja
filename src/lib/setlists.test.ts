import { describe, expect, it } from 'vitest';
import {
  addSongs,
  moveSong,
  newSetlist,
  removeSong,
  renameSetlist,
  setlistSongs,
} from './setlists';
import type { Setlist, Song } from './types';

function setti(songIds: string[]): Setlist {
  return { id: 's1', name: 'Keikka', songIds, createdAt: 1, updatedAt: 1 };
}

function laulu(id: string, title = id): Song {
  return { id, title, songKey: '', lines: [], createdAt: 1, updatedAt: 1 };
}

describe('newSetlist', () => {
  it('siistii nimen ja alkaa tyhjänä', () => {
    const list = newSetlist('  Kesäkeikat  ');
    expect(list.name).toBe('Kesäkeikat');
    expect(list.songIds).toEqual([]);
  });
});

describe('addSongs', () => {
  it('lisää laulut setin loppuun', () => {
    expect(addSongs(setti(['a']), ['b', 'c']).songIds).toEqual(['a', 'b', 'c']);
  });

  it('ei kahdenna jo setissä olevaa laulua', () => {
    // Sama laulu kahdesti setissä olisi keikalla pelkkä virhelähde.
    expect(addSongs(setti(['a', 'b']), ['b', 'c']).songIds).toEqual(['a', 'b', 'c']);
  });

  it('palauttaa saman setin kun mitään ei lisätä', () => {
    const lahto = setti(['a']);
    expect(addSongs(lahto, ['a'])).toBe(lahto);
    expect(addSongs(lahto, [])).toBe(lahto);
  });
});

describe('removeSong', () => {
  it('poistaa laulun setistä', () => {
    expect(removeSong(setti(['a', 'b', 'c']), 'b').songIds).toEqual(['a', 'c']);
  });

  it('ei muuta settiä tuntemattomalla laululla', () => {
    const lahto = setti(['a']);
    expect(removeSong(lahto, 'x')).toBe(lahto);
  });
});

describe('moveSong', () => {
  it('siirtää laulua ylös ja alas', () => {
    expect(moveSong(setti(['a', 'b', 'c']), 'b', -1).songIds).toEqual(['b', 'a', 'c']);
    expect(moveSong(setti(['a', 'b', 'c']), 'b', 1).songIds).toEqual(['a', 'c', 'b']);
  });

  it('ei siirrä setin reunojen yli', () => {
    const lahto = setti(['a', 'b']);
    expect(moveSong(lahto, 'a', -1)).toBe(lahto);
    expect(moveSong(lahto, 'b', 1)).toBe(lahto);
  });

  it('siirto alas on siirron ylös käänteisoperaatio', () => {
    const alas = moveSong(setti(['a', 'b', 'c']), 'a', 1);
    expect(moveSong(alas, 'a', -1).songIds).toEqual(['a', 'b', 'c']);
  });
});

describe('setlistSongs', () => {
  it('palauttaa laulut setin järjestyksessä eikä kirjaston', () => {
    const songs = [laulu('a'), laulu('b'), laulu('c')];
    expect(setlistSongs(setti(['c', 'a']), songs).map((s) => s.id)).toEqual(['c', 'a']);
  });

  it('ohittaa laulun, jota ei ole', () => {
    // Palautettu varmuuskopio voi sisältää setin, jonka laulua ei tuotu.
    const songs = [laulu('a')];
    expect(setlistSongs(setti(['a', 'poistettu']), songs).map((s) => s.id)).toEqual(['a']);
  });
});

describe('renameSetlist', () => {
  it('vaihtaa nimen koskematta lauluihin', () => {
    const list = renameSetlist(setti(['a', 'b']), ' Uusi nimi ');
    expect(list.name).toBe('Uusi nimi');
    expect(list.songIds).toEqual(['a', 'b']);
  });
});
