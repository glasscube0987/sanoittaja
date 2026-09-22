import { describe, expect, it } from 'vitest';
import type { BarRow } from './bars';
import type { BarRepeat } from './types';
import {
  barRowOf,
  insertBarAfter,
  removeBarAt,
  setBarAt,
  setMeterAt,
  splitBarAt,
  setRepeatAt,
  splitCount,
  storedMeters,
  storedRepeats,
} from './bars';

const row = (bars: string[], meters: string[] = [], repeats: BarRepeat[] = []): BarRow => ({
  bars,
  meters: bars.map((_, i) => meters[i] ?? ''),
  repeats: bars.map((_, i) => repeats[i] ?? {}),
});

describe('barRowOf', () => {
  it('täydentää tahtilajit tahtien mittaisiksi', () => {
    expect(barRowOf({ bars: ['Am', 'F', 'C'], meters: ['3/4'] })).toEqual({
      bars: ['Am', 'F', 'C'],
      meters: ['3/4', '', ''],
      repeats: [{}, {}, {}],
    });
  });

  it('lukee vanhan rivikohtaisen kentän ensimmäisen tahdin lajiksi', () => {
    // Jo tallennetut laulut käyttävät vanhaa kenttää; ne eivät saa menettää sitä.
    expect(barRowOf({ bars: ['Am', 'F'], meter: '4/4' })).toEqual({
      bars: ['Am', 'F'],
      meters: ['4/4', ''],
      repeats: [{}, {}],
    });
  });

  it('sietää rivin ilman tahteja', () => {
    expect(barRowOf({})).toEqual({ bars: [], meters: [], repeats: [] });
  });
});

describe('storedMeters', () => {
  it('jättää pelkät tyhjät tallentamatta', () => {
    expect(storedMeters(['', '  '])).toBeNull();
  });

  it('siistii välit ja säilyttää paikat', () => {
    expect(storedMeters(['', ' 3/4 ', ''])).toEqual(['', '3/4', '']);
  });
});

describe('tahtien muokkaus pitää tahtilajit paikoillaan', () => {
  it('lisäys siirtää myöhempiä merkintöjä', () => {
    const tulos = insertBarAfter(row(['Am', 'F', 'Dm'], ['', '', '3/4']), 0);
    expect(tulos.bars).toEqual(['Am', '', 'F', 'Dm']);
    expect(tulos.meters).toEqual(['', '', '', '3/4']);
  });

  it('poisto vie merkinnän mukanaan', () => {
    const tulos = removeBarAt(row(['Am', 'F', 'Dm'], ['', '2/4', '3/4']), 1);
    expect(tulos.bars).toEqual(['Am', 'Dm']);
    expect(tulos.meters).toEqual(['', '3/4']);
  });

  it('ei poista viimeistä tahtia', () => {
    const lahto = row(['Am'], ['3/4']);
    expect(removeBarAt(lahto, 0)).toBe(lahto);
  });

  it('jakaminen jättää merkinnän ensimmäiseen osaan', () => {
    // Laji vaihtui siinä tahdissa; jaon jälkeenkin se vaihtuu sen alussa.
    const tulos = splitBarAt(row(['Am F', 'C'], ['3/4', '']), 0);
    expect(tulos.bars).toEqual(['Am', 'F', 'C']);
    expect(tulos.meters).toEqual(['3/4', '', '']);
  });

  it('jakaminen ei koske yhden merkinnän tahtiin', () => {
    const lahto = row(['Am', 'C']);
    expect(splitBarAt(lahto, 0)).toBe(lahto);
    expect(splitCount(lahto, 0)).toBe(1);
    expect(splitCount(row(['Am F G']), 0)).toBe(3);
  });

  it('sisällön ja lajin asetus eivät sotke toisiaan', () => {
    let tulos = setBarAt(row(['Am', 'F']), 1, 'Dm7');
    tulos = setMeterAt(tulos, 1, ' 6/8 ');
    expect(tulos.bars).toEqual(['Am', 'Dm7']);
    expect(tulos.meters).toEqual(['', '6/8']);
  });
});

describe('kertausmerkkien indeksikirjanpito', () => {
  const kertaava = () =>
    row(['Am', 'F', 'C'], [], [{ start: true }, {}, { end: true, times: 4 }]);

  it('setRepeatAt kirjoittaa vain valittuun tahtiin', () => {
    const next = setRepeatAt(row(['Am', 'F']), 1, { end: true });
    expect(next.repeats).toEqual([{}, { end: true }]);
    expect(next.bars).toEqual(['Am', 'F']);
  });

  it('uusi tahti syntyy merkittömänä eikä siirrä naapurin merkkiä', () => {
    const next = insertBarAfter(kertaava(), 0);
    expect(next.bars).toEqual(['Am', '', 'F', 'C']);
    expect(next.repeats).toEqual([{ start: true }, {}, {}, { end: true, times: 4 }]);
  });

  it('poistetun tahdin merkki katoaa sen mukana', () => {
    const next = removeBarAt(kertaava(), 0);
    expect(next.bars).toEqual(['F', 'C']);
    expect(next.repeats).toEqual([{}, { end: true, times: 4 }]);
  });

  /* Kertaus kehystää edelleen saman musiikin, joten avaus jää alkuun ja
     sulku siirtyy loppuun. */
  it('jaettaessa avaus jää ensimmäiseen ja sulku siirtyy viimeiseen osaan', () => {
    const next = splitBarAt(row(['Am F G'], [], [{ start: true, end: true, times: 3 }]), 0);
    expect(next.bars).toEqual(['Am', 'F', 'G']);
    expect(next.repeats).toEqual([{ start: true }, {}, { end: true, times: 3 }]);
  });

  it('storedRepeats jättää merkitsemättömän rivin tallentamatta', () => {
    expect(storedRepeats([{}, {}])).toBeNull();
    expect(storedRepeats([{}, { end: true }])).toEqual([{}, { end: true }]);
  });
});
