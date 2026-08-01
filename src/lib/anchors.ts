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
