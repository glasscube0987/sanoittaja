/**
 * Yhden rivin leikepöytä laulusta toiseen.
 *
 * Sovelluksen oma eikä järjestelmän: iOS kysyy luvan joka kerta kun
 * `navigator.clipboard`ia luetaan, eikä sointurivistä ole mielekästä
 * tekstimuotoa jota liittää takaisin. Tässä kopioituu koko rivi tahteineen,
 * tahtilajeineen ja ankkuroituine sointuineen.
 *
 * localStorage eikä muisti, koska kopiointi ja liittäminen tapahtuvat usein
 * eri lauluissa: välissä editori puretaan, ja käyttäjä voi sulkea sovelluksen
 * kokonaan etsiessään sitä toista laulua.
 */
import type { LyricLine } from './types';

const STORAGE_KEY = 'sanoittaja.lineClipboard';

/**
 * Kelpaako luettu arvo riviksi.
 *
 * Arvo voi olla käsin muokattu, vanhemman version kirjoittama tai puolittain
 * tallentunut. Editori piirtää rivin suoraan, joten puuttuva `chords` kaataisi
 * koko näkymän – tyhjä leikepöytä on aina turvallisempi vastaus kuin vajaa
 * rivi.
 */
function onRivi(value: unknown): value is LyricLine {
  if (typeof value !== 'object' || value === null) return false;
  const rivi = value as Partial<LyricLine>;
  if (typeof rivi.text !== 'string' || !Array.isArray(rivi.chords)) return false;
  if (rivi.bars !== undefined && !Array.isArray(rivi.bars)) return false;
  if (rivi.meters !== undefined && !Array.isArray(rivi.meters)) return false;
  if (rivi.repeats !== undefined && !Array.isArray(rivi.repeats)) return false;
  return true;
}

export function storeLine(line: LyricLine): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(line));
  } catch {
    /* Yksityisessä ikkunassa tallennus voi epäonnistua; kopio jää tekemättä. */
  }
}

export function loadLine(): LyricLine | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return onRivi(parsed) ? parsed : null;
  } catch {
    // Rikkinäinen tai estetty tallennus ei saa estää sovelluksen käyttöä.
    return null;
  }
}
