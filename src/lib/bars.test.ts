import { describe, expect, it } from 'vitest';
import type { BarRow } from './bars';
import {
  barRowOf,
  insertBarAfter,
  removeBarAt,
  setBarAt,
  setMeterAt,
  splitBarAt,
  splitCount,
  storedMeters,
} from './bars';

const row = (bars: string[], meters: string[] = []): BarRow => ({
  bars,
  meters: bars.map((_, i) => meters[i] ?? ''),
});

describe('barRowOf', () => {
  it('täydentää tahtilajit tahtien mittaisiksi', () => {
    expect(barRowOf({ bars: ['Am', 'F', 'C'], meters: ['3/4'] })).toEqual({
      bars: ['Am', 'F', 'C'],
      meters: ['3/4', '', ''],
    });
  });

  it('lukee vanhan rivikohtaisen kentän ensimmäisen tahdin lajiksi', () => {
    // Jo tallennetut laulut käyttävät vanhaa kenttää; ne eivät saa menettää sitä.
    expect(barRowOf({ bars: ['Am', 'F'], meter: '4/4' })).toEqual({
      bars: ['Am', 'F'],
      meters: ['4/4', ''],
    });
  });

  it('sietää rivin ilman tahteja', () => {
    expect(barRowOf({})).toEqual({ bars: [], meters: [] });
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
