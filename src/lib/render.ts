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

/** Tahdin vähimmäisleveys, jotta tyhjäkin tahti näkyy tahtina. */
const MIN_BAR_WIDTH = 2;

/**
 * Sointurivi tekstinä: `| Am  | F   | C   | G   |`.
 *
 * Tahdit tasataan rivin leveimmän mukaan, jotta tahtiviivat asettuvat
 * allekkain ja tahtien kesto on luettavissa silmäyksellä.
 */
export function barLineText(bars: string[], meter?: string): string {
  if (bars.length === 0) return '';
  const width = Math.max(MIN_BAR_WIDTH, ...bars.map((bar) => bar.trim().length));
  const line = `| ${bars.map((bar) => bar.trim().padEnd(width)).join(' | ')} |`;
  // Tahtilaji ensimmäisen tahtiviivan eteen, kuten nuotissa.
  return meter?.trim() ? `${meter.trim()} ${line}` : line;
}

/** Onko rivillä mitään näytettävää – tyhjä rivi erottaa osioita. */
export function isBlankLine(line: LyricLine): boolean {
  return line.text.trim() === '' && line.chords.length === 0;
}
