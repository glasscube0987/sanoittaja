import { describe, expect, it } from 'vitest';
import { DEFAULT_NOTATION, loadNotation, storeNotation } from './notation';

/** Sijainen localStoragelle; node-ympäristössä sitä ei ole. */
function muisti(arvo: string | null) {
  let tallessa = arvo;
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: () => tallessa,
    setItem: (_avain: string, uusi: string) => {
      tallessa = uusi;
    },
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  } as unknown as Storage;
}

describe('merkintätavan asetus', () => {
  it('on oletuksena B, jolloin nykyinen käytös säilyy', () => {
    muisti(null);
    expect(loadNotation()).toBe('B');
    expect(DEFAULT_NOTATION).toBe('B');
  });

  it('muistaa valinnan', () => {
    muisti(null);
    storeNotation('H');
    expect(loadNotation()).toBe('H');
  });

  it('hylkää tuntemattoman arvon', () => {
    // Käsin muokattu tai vanhentunut arvo ei saa jättää sovellusta outoon tilaan.
    muisti('saksa');
    expect(loadNotation()).toBe('B');
  });
});
