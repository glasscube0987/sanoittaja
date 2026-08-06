/**
 * Liu'utuseleen kynnykset.
 *
 * Poistaminen setistä tapahtuu liu'uttamalla riviä vasemmalle, koska pieni
 * ✕-painike rivin reunassa on puhelimella liian helppo osua vahingossa. Ele on
 * tarkoituksellinen tavalla jota napautus ei ole.
 *
 * Kynnykset ovat täällä eivätkä komponentissa, jotta niiden käytöksen voi
 * todeta ilman selainta: raja-arvot ovat juuri se kohta, jossa ele tuntuu joko
 * herkältä tai kankealta.
 */

/** Mistä asti vaakaveto katsotaan liu'utukseksi eikä vierityksen aluksi. */
export const ENGAGE_PX = 8;

/** Kuinka pitkälle rivi avautuu, kun poistopainike paljastetaan. */
export const OPEN_PX = 88;

/** Osuus rivin leveydestä, jonka yli vedettäessä poisto tapahtuu suoraan. */
export const REMOVE_RATIO = 0.45;

export type SwipeOutcome = 'remove' | 'open' | 'closed';

/**
 * Tarttuuko ele vaakasuoraan liu'utukseen.
 *
 * Pystysuora veto kuuluu listan vieritykselle, joten vaakasuunnan on oltava
 * selvästi hallitseva. Pelkkä `dx > kynnys` veisi myös vinot vedot, jolloin
 * listaa ei voisi vierittää rivien päältä lainkaan.
 */
export function engagesHorizontally(dx: number, dy: number): boolean {
  return Math.abs(dx) > ENGAGE_PX && Math.abs(dx) > Math.abs(dy);
}

/**
 * Mihin liu'utus päätyy, kun ote irtoaa.
 *
 * Oikealle vetäminen (`dx > 0`) sulkee rivin: se on luonteva tapa perua ele
 * kesken kaiken.
 */
export function swipeOutcome(dx: number, width: number): SwipeOutcome {
  if (dx > -ENGAGE_PX) return 'closed';
  if (dx <= -width * REMOVE_RATIO) return 'remove';
  if (dx <= -OPEN_PX / 2) return 'open';
  return 'closed';
}

/**
 * Rivin siirtymä pikseleinä vedon aikana.
 *
 * Oikealle ei liu'uta lainkaan, koska avattavaa ei ole siltä puolelta, ja
 * poistorajan yli venyminen sallitaan, jotta pitkä veto tuntuu jatkuvan.
 */
export function swipeOffset(dx: number, open: boolean): number {
  const base = open ? -OPEN_PX : 0;
  return Math.min(0, base + dx);
}
