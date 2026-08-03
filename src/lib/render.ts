/**
 * Laulun esitys kahtena tasalevyisenä rivinä: soinnut sanoitusrivin yllä.
 *
 * Sama esitys palvelee sekä tulostusta että live-tilaa, joten sointujen
 * kohdistus on yhdessä paikassa. Editorin absoluuttinen asemointi ei sovi
 * kumpaankaan: tulostuksessa rivit katkeavat sivun mukaan ja live-tilassa
 * tekstikoko muuttuu, ja molemmissa pelkkä teksti käyttäytyy ennustettavammin.
 */
import type { LyricLine } from './types';

/**
 * Sointurivi välilyönteineen. Päällekkäin osuvat soinnut työnnetään oikealle
 * niin, että niiden väliin jää vähintään yksi väli – muuten ne sulautuisivat
 * yhdeksi lukukelvottomaksi merkkijonoksi.
 */
export function chordLineText(line: LyricLine): string {
  let out = '';
  for (const chord of [...line.chords].sort((a, b) => a.pos - b.pos)) {
    const start = out.length === 0 ? chord.pos : Math.max(chord.pos, out.length + 1);
    out = out.padEnd(start, ' ') + chord.symbol;
  }
  return out;
}

/** Onko rivillä mitään näytettävää – tyhjä rivi erottaa osioita. */
export function isBlankLine(line: LyricLine): boolean {
  return line.text.trim() === '' && line.chords.length === 0;
}
