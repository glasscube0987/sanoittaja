/**
 * Peruutuspino auki olevalle laululle.
 *
 * Pino sisältää *edellisiä* tiloja: jokainen muutos työntää muutosta edeltäneen
 * laulun, ja peruutus palauttaa päällimmäisen.
 *
 * Kirjoittaminen tuottaa muutoksen joka näppäimenpainalluksella. Jos jokainen
 * niistä työntäisi oman tilansa, peruutus etenisi kirjain kerrallaan ja pino
 * täyttyisi yhdestä säkeistöstä. Siksi peräkkäiset kirjoitusmuutokset lyhyen
 * ajan sisällä yhdistetään yhdeksi askeleeksi, ja kaikki muu — rivin tyyppi,
 * osiomerkintä, sointujen lisäys tai transponointi — työntää aina omansa.
 */
import type { Song } from './types';

export const MAX_HISTORY = 50;

/** Kuinka pitkään peräkkäiset kirjoitusmuutokset sulautuvat samaan askeleeseen. */
export const COALESCE_MS = 1200;

export interface HistoryEntry {
  song: Song;
  at: number;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Onko muutos pelkkää kirjoittamista.
 *
 * Sointujen sijainnit saavat muuttua, koska tekstin muokkaus siirtää ankkureita
 * mukanaan; sen sijaan sointujen määrä tai symbolit, rivityyppi ja osiomerkintä
 * eivät kirjoittaessa muutu.
 */
export function isTypingChange(before: Song, after: Song): boolean {
  if (before.lines.length !== after.lines.length) return false;
  return before.lines.every((line, i) => {
    const next = after.lines[i];
    if (line.id !== next.id) return false;
    if (!same(line.bars, next.bars)) return false;
    if (!same(line.section, next.section)) return false;
    if (line.chords.length !== next.chords.length) return false;
    return line.chords.every(
      (chord, j) => chord.id === next.chords[j].id && chord.symbol === next.chords[j].symbol,
    );
  });
}

/** Työntää muutosta edeltäneen tilan, tai yhdistää sen edelliseen askeleeseen. */
export function pushHistory(
  stack: HistoryEntry[],
  before: Song,
  after: Song,
  now: number = Date.now(),
): HistoryEntry[] {
  const last = stack[stack.length - 1];
  if (last && isTypingChange(before, after) && now - last.at < COALESCE_MS) return stack;
  return [...stack, { song: before, at: now }].slice(-MAX_HISTORY);
}
