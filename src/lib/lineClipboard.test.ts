import { beforeEach, describe, expect, it } from 'vitest';
import { loadLine, storeLine } from './lineClipboard';
import type { LyricLine } from './types';

/** Node-ympäristössä ei ole localStoragea, joten se korvataan tässä. */
function muisti(alku: Record<string, string> = {}, rikki = false) {
  const data = { ...alku };
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => {
        if (rikki) throw new Error('estetty');
        return k in data ? data[k] : null;
      },
      setItem: (k: string, v: string) => {
        if (rikki) throw new Error('estetty');
        data[k] = v;
      },
    },
  });
  return data;
}

const rivi: LyricLine = {
  id: 'l1',
  text: 'kuu valaisee yön',
  chords: [{ id: 'c1', pos: 0, symbol: 'Am' }],
};

describe('lineClipboard', () => {
  beforeEach(() => muisti());

  it('tyhjä leikepöytä on null', () => {
    expect(loadLine()).toBeNull();
  });

  it('kopioitu rivi palautuu sellaisenaan', () => {
    storeLine(rivi);
    expect(loadLine()).toEqual(rivi);
  });

  it('sointurivin tahdit ja tahtilajit kulkevat mukana', () => {
    const tahdit: LyricLine = { id: 'l2', text: '', chords: [], bars: ['Am', 'F'], meters: ['4/4', ''] };
    storeLine(tahdit);
    expect(loadLine()).toEqual(tahdit);
  });

  it('lukeminen ei tyhjennä leikepöytää', () => {
    storeLine(rivi);
    loadLine();
    expect(loadLine()).toEqual(rivi);
  });

  /*
   * Editori piirtää rivin suoraan, joten vajaa tietue kaataisi koko näkymän.
   * Tyhjä leikepöytä on turvallisempi vastaus kuin puolikas rivi.
   */
  it('torjuu vajaan tietueen', () => {
    muisti({ 'sanoittaja.lineClipboard': '{"id":"l","text":"sanoja"}' });
    expect(loadLine()).toBeNull();

    muisti({ 'sanoittaja.lineClipboard': '{"id":"l","chords":[]}' });
    expect(loadLine()).toBeNull();

    muisti({ 'sanoittaja.lineClipboard': '{"id":"l","text":"x","chords":[],"bars":"Am"}' });
    expect(loadLine()).toBeNull();
  });

  it('torjuu kelvottoman JSONin', () => {
    muisti({ 'sanoittaja.lineClipboard': 'ei-jsonia' });
    expect(loadLine()).toBeNull();
  });

  it('estetty tallennus ei kaada kumpaakaan suuntaa', () => {
    muisti({}, true);
    expect(loadLine()).toBeNull();
    expect(() => storeLine(rivi)).not.toThrow();
  });
});
