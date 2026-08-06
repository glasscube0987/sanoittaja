/**
 * Laululistan järjestys.
 *
 * Koskee vain «Kaikki laulut» -näkymää. Setissä järjestys on käyttäjän itse
 * asettama esitysjärjestys, eikä sitä saa lajitella pois alta.
 */
import type { Lang } from './i18n';
import type { Song } from './types';

export type SortOrder = 'edited' | 'az' | 'za';

export const SORT_ORDERS: SortOrder[] = ['edited', 'az', 'za'];

const STORAGE_KEY = 'sanoittaja.sort';

/**
 * Aakkostus käyttöliittymän kielellä.
 *
 * `Intl.Collator` eikä merkkijonovertailu, koska `<` vertaa koodipisteitä:
 * silloin ä ja ö päätyisivät z:n jälkeen mutta myös ennen kaikkia isoja
 * kirjaimia, ja suomessa å ä ö kuuluvat aakkosten loppuun omina kirjaiminaan.
 * `numeric` järjestää myös «Laulu 2» ennen «Laulu 10».
 */
function collator(lang: Lang): Intl.Collator {
  return new Intl.Collator(lang === 'fi' ? 'fi' : 'en', {
    sensitivity: 'base',
    numeric: true,
  });
}

/**
 * Lajittelee laulut. Palauttaa uuden taulukon, koska React vertaa viitteitä
 * eikä paikallaan lajittelu näkyisi näkymässä.
 *
 * `untitled` on nimettömän laulun näkyvä otsikko: ilman sitä tyhjä otsikko
 * lajiteltaisiin tyhjänä merkkijonona ja kaikki uudet laulut hyppäisivät listan
 * alkuun riippumatta siitä, miltä ne näyttävät käyttäjälle.
 */
export function sortSongs(songs: Song[], order: SortOrder, lang: Lang, untitled: string): Song[] {
  const rows = songs.slice();
  if (order === 'edited') return rows.sort((a, b) => b.updatedAt - a.updatedAt);

  const cmp = collator(lang);
  const nimi = (s: Song) => s.title.trim() || untitled;
  rows.sort((a, b) => {
    const ero = cmp.compare(nimi(a), nimi(b));
    // Samannimiset tuoreimman mukaan, jottei järjestys heilu satunnaisesti.
    return ero !== 0 ? ero : b.updatedAt - a.updatedAt;
  });
  return order === 'za' ? rows.reverse() : rows;
}

export function loadSortOrder(): SortOrder {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return SORT_ORDERS.includes(raw as SortOrder) ? (raw as SortOrder) : 'edited';
  } catch {
    // Rikkinäinen asetus ei saa estää listan näyttämistä.
    return 'edited';
  }
}

export function storeSortOrder(order: SortOrder): void {
  localStorage.setItem(STORAGE_KEY, order);
}
