import { describe, expect, it } from 'vitest';
import { COALESCE_MS, isTypingChange, MAX_HISTORY, pushHistory } from './history';
import { editLineText, placeChord, setLineBars, transposeSong } from './songOps';
import type { Song } from './types';

function makeSong(): Song {
  return {
    id: 's1',
    title: 'Testi',
    songKey: 'Am',
    createdAt: 1,
    updatedAt: 1,
    lines: [
      { id: 'l1', text: 'kuu valaisee yön', chords: [{ id: 'c1', pos: 4, symbol: 'Am' }] },
      { id: 'l2', text: 'toinen rivi', chords: [] },
    ],
  };
}

describe('isTypingChange', () => {
  it('tunnistaa tekstin muokkauksen kirjoittamiseksi', () => {
    const before = makeSong();
    expect(isTypingChange(before, editLineText(before, 'l1', 'kuu valaisee yöni'))).toBe(true);
  });

  it('sallii sointujen siirtymisen tekstin mukana', () => {
    // editLineText siirtää ankkureita; se ei tee muutoksesta rakenteellista.
    const before = makeSong();
    const after = editLineText(before, 'l1', 'kirkas kuu valaisee yön');
    expect(after.lines[0].chords[0].pos).not.toBe(before.lines[0].chords[0].pos);
    expect(isTypingChange(before, after)).toBe(true);
  });

  it('ei pidä rakenteellisia muutoksia kirjoittamisena', () => {
    const before = makeSong();
    expect(isTypingChange(before, setLineBars(before, 'l1', ['Am']))).toBe(false);
    expect(isTypingChange(before, placeChord(before, 'l2', 0, 0, 'F'))).toBe(false);
    expect(isTypingChange(before, transposeSong(before, 2))).toBe(false);
  });
});

describe('pushHistory', () => {
  it('yhdistää peräkkäiset kirjoitusmuutokset yhdeksi askeleeksi', () => {
    // Ilman yhdistämistä peruutus peruisi yhden kirjaimen kerrallaan.
    const a = makeSong();
    const b = editLineText(a, 'l1', 'kuu valaisee yön!');
    const c = editLineText(b, 'l1', 'kuu valaisee yön!!');

    let stack = pushHistory([], a, b, 1000);
    stack = pushHistory(stack, b, c, 1200);
    expect(stack).toHaveLength(1);
    expect(stack[0].song).toBe(a);
  });

  it('aloittaa uuden askeleen kun kirjoittamisessa on tauko', () => {
    const a = makeSong();
    const b = editLineText(a, 'l1', 'kuu valaisee yön!');
    const c = editLineText(b, 'l1', 'kuu valaisee yön!!');

    let stack = pushHistory([], a, b, 1000);
    stack = pushHistory(stack, b, c, 1000 + COALESCE_MS + 1);
    expect(stack).toHaveLength(2);
  });

  it('työntää rakenteellisen muutoksen aina omakseen', () => {
    const a = makeSong();
    const b = editLineText(a, 'l1', 'kuu valaisee yön!');
    const c = setLineBars(b, 'l1', ['Am', 'F']);

    let stack = pushHistory([], a, b, 1000);
    // Sama hetki kuin edellinen: yhdistäminen ei saa niellä muunnosta.
    stack = pushHistory(stack, b, c, 1000);
    expect(stack).toHaveLength(2);
    expect(stack[1].song).toBe(b);
  });

  it('rajaa pinon pituuden ja pudottaa vanhimmat', () => {
    let stack: ReturnType<typeof pushHistory> = [];
    let song = makeSong();
    for (let i = 0; i < MAX_HISTORY + 10; i++) {
      const next = setLineBars(song, 'l1', [`bar${i}`]);
      stack = pushHistory(stack, song, next, i * 10_000);
      song = next;
    }
    expect(stack).toHaveLength(MAX_HISTORY);
    // Työntöjä oli MAX_HISTORY + 10 ja jokainen tallensi muutosta edeltäneen
    // tilan, joten vanhin jäljellä oleva on kymmenennen muunnoksen jälkeinen.
    expect(stack[0].song.lines[0].bars).toEqual(['bar9']);
  });
});

describe('setLineBars säilyttää sanat', () => {
  it('ei hävitä sanoituksia sointuriviksi muunnettaessa', () => {
    // Muunnos on yhden napautuksen päässä; tyhjentäminen hävitti sanat lopullisesti.
    const song = setLineBars(makeSong(), 'l1', ['Am', 'F']);
    expect(song.lines[0].text).toBe('kuu valaisee yön');
    expect(song.lines[0].chords).toHaveLength(1);
  });

  it('palauttaa sanat kun rivi muutetaan takaisin', () => {
    const alku = makeSong();
    const edestakaisin = setLineBars(setLineBars(alku, 'l1', ['Am']), 'l1', null);
    expect(edestakaisin.lines[0].text).toBe(alku.lines[0].text);
    expect(edestakaisin.lines[0].chords).toEqual(alku.lines[0].chords);
    expect(edestakaisin.lines[0]).not.toHaveProperty('bars');
  });
});
