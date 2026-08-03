/** Sarakkeita vähintään, myös täysin tyhjällä rivillä. */
export const MIN_CHORD_SPAN = 32;

/** Sarakkeita tekstin loppumisen jälkeen, kierrossointua varten. */
const SLACK = 8;

/**
 * Monelleko sarakkeelle rivillä voi asettaa sointuja.
 *
 * Sointuja ei rajata tekstin pituuteen: sanaton rivi (välisoitto, intro) on
 * tyhjä, jolloin rajaus sallisi vain yhden soinnun paikkaan 0. Tekstin loppuun
 * jätetty vara sallii myös kierrosoinnun viimeisen sanan jälkeen.
 */
export function chordSpan(text: string): number {
  return Math.max(text.length + SLACK, MIN_CHORD_SPAN);
}

/**
 * Himmeä sarakeruudukko sanattomalle riville: piste joka neljännen merkin
 * kohdalla, jotta napautuskohdan näkee kun tekstiä ei ole ohjaamassa silmää.
 */
export function columnGuide(span: number): string {
  return Array.from({ length: span }, (_, i) => (i % 4 === 0 ? '·' : ' ')).join('');
}

/**
 * Sointuankkurien siirto, kun rivin tekstiä muokataan.
 *
 * Muutos paikannetaan yhteisen alku- ja loppuosan avulla: ankkurit ennen
 * muutoskohtaa pysyvät paikoillaan, muutoskohdan jälkeiset siirtyvät tekstin
 * pituusmuutoksen verran ja muutetun alueen sisällä olleet napsahtavat
 * muutosalueen alkuun (eivät koskaan katoa).
 */
export function adjustPositions(oldText: string, newText: string, positions: number[]): number[] {
  if (oldText === newText) return positions.slice();

  let prefix = 0;
  const maxPrefix = Math.min(oldText.length, newText.length);
  while (prefix < maxPrefix && oldText[prefix] === newText[prefix]) prefix++;

  let suffix = 0;
  const maxSuffix = Math.min(oldText.length, newText.length) - prefix;
  while (
    suffix < maxSuffix &&
    oldText[oldText.length - 1 - suffix] === newText[newText.length - 1 - suffix]
  ) {
    suffix++;
  }

  const delta = newText.length - oldText.length;
  const oldChangeEnd = oldText.length - suffix;

  return positions.map((pos) => {
    // Siirto tarkistetaan ensin: kun lisäys osuu täsmälleen ankkurin kohdalle
    // (esim. sanan eteen kirjoitetaan uusi sana), sointu seuraa alkuperäistä sanaa.
    if (pos >= oldChangeEnd) return pos + delta;
    if (pos <= prefix) return pos;
    return Math.min(prefix, newText.length);
  });
}
