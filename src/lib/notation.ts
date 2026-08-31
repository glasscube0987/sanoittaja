/**
 * Sointujen merkintätapa: kirjoitetaanko h-sävel muodossa `B` vai `H`.
 *
 * Asetus ohjaa vain sitä mitä transponointi **kirjoittaa**, ei sitä miten
 * syötettä tulkitaan. `H` hyväksytään aina, ja `B` tarkoittaa aina h-säveltä –
 * ks. `chords.ts`. Näin asetuksen vaihtaminen ei voi muuttaa yhdenkään jo
 * kirjoitetun soinnun korkeutta.
 *
 * Laitekohtainen näyttöasetus, ei laulun tietoa, joten se asuu localStoragessa
 * eikä kannassa – samoin kuin kieli ja laululistan järjestys.
 */
import type { Notation } from './chords';

const STORAGE_KEY = 'sanoittaja.notation';

/** Oletus on `B`, jolloin sovelluksen käytös säilyy ennallaan kaikille. */
export const DEFAULT_NOTATION: Notation = 'B';

export const NOTATIONS: Notation[] = ['B', 'H'];

export function loadNotation(): Notation {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === 'H' || raw === 'B' ? raw : DEFAULT_NOTATION;
  } catch {
    // Rikkinäinen tai estetty tallennus ei saa estää sovelluksen käyttöä.
    return DEFAULT_NOTATION;
  }
}

export function storeNotation(notation: Notation): void {
  try {
    localStorage.setItem(STORAGE_KEY, notation);
  } catch {
    /* Yksityisessä ikkunassa tallennus voi epäonnistua; valinta jää istuntoon. */
  }
}
