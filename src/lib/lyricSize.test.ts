import { beforeEach, describe, expect, it } from 'vitest';
import {
  clampLyricSize,
  DEFAULT_LYRIC_SIZE,
  loadLyricSize,
  LYRIC_SIZE_MAX,
  LYRIC_SIZE_MIN,
  storeLyricSize,
} from './lyricSize';

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

describe('lyricSize', () => {
  beforeEach(() => muisti());

  it('oletus on entinen kiinteä koko', () => {
    expect(loadLyricSize()).toBe(DEFAULT_LYRIC_SIZE);
  });

  it('tallennettu koko palautuu', () => {
    storeLyricSize(12);
    expect(loadLyricSize()).toBe(12);
  });

  it('rajaa liian pienen ja liian suuron välille', () => {
    expect(clampLyricSize(2)).toBe(LYRIC_SIZE_MIN);
    expect(clampLyricSize(99)).toBe(LYRIC_SIZE_MAX);
  });

  /* Käsin muokattu tai vanhentunut arvo ei saa päätyä CSS:ään sellaisenaan. */
  it('siivoaa roskan oletukseksi', () => {
    muisti({ 'sanoittaja.lyricSize': 'iso' });
    expect(loadLyricSize()).toBe(DEFAULT_LYRIC_SIZE);
  });

  it('rajaa myös tallennetun liian suuren arvon luettaessa', () => {
    muisti({ 'sanoittaja.lyricSize': '400' });
    expect(loadLyricSize()).toBe(LYRIC_SIZE_MAX);
  });

  it('estetty tallennus ei kaada lukemista eikä kirjoittamista', () => {
    muisti({}, true);
    expect(loadLyricSize()).toBe(DEFAULT_LYRIC_SIZE);
    expect(() => storeLyricSize(20)).not.toThrow();
  });
});
