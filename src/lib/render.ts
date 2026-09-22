/**
 * Laulun esitys kahtena tasalevyisenä rivinä: soinnut sanoitusrivin yllä.
 *
 * Sama esitys palvelee sekä tulostusta että live-tilaa, joten sointujen
 * kohdistus on yhdessä paikassa. Editorin absoluuttinen asemointi ei sovi
 * kumpaankaan: tulostuksessa rivit katkeavat sivun mukaan ja live-tilassa
 * tekstikoko muuttuu, ja molemmissa pelkkä teksti käyttäytyy ennustettavammin.
 */
import type { BarRepeat, LyricLine } from './types';

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
/** Kertausmerkkien ladonta-asetukset. */
export interface RepeatLayout {
  marks?: BarRepeat[];
  /** Varattu tila avaavalle merkille, jotta rivit pysyvät allekkain. */
  gutter?: number;
}

/**
 * Tahtiviiva kertausmerkkeineen.
 *
 * Sulkeva merkki tulee edellisestä tahdista ja avaava seuraavasta. Kun ne
 * osuvat samalle viivalle, ne kirjoitetaan yhteen (`:||:`) niin kuin nuotissa.
 * Kertaluku kirjoitetaan sulkevan merkin perään vain kun se on yli kaksi:
 * kertausmerkki tarkoittaa perinteen mukaan jo kahdesti soittamista.
 */
function barLine(before: BarRepeat | undefined, after: BarRepeat | undefined): string {
  const close = before?.end ? ':|' : '';
  const times = before?.end && before.times && before.times > 2 ? `x${before.times}` : '';
  const open = after?.start ? '|:' : '';
  if (close && open) return `:||:${times}`;
  if (close) return `:|${times}`;
  return open || '|';
}

export function barLineText(
  bars: string[],
  meters: string[] = [],
  gutter = 0,
  repeats: RepeatLayout = {},
): string {
  if (bars.length === 0) return '';
  const marks = repeats.marks ?? [];

  /*
   * Tahtilaji kuuluu siihen tahtiin josta laji vaihtuu, joten se kirjoitetaan
   * tahtiviivan jälkeen tahdin alkuun – paitsi rivin ensimmäisessä tahdissa,
   * jossa se on tapansa mukaan ennen ensimmäistä tahtiviivaa.
   */
  const cells = bars.map((bar, i) => {
    const meter = (meters[i] ?? '').trim();
    const content = bar.trim();
    return i > 0 && meter ? `${meter} ${content}` : content;
  });

  const width = Math.max(MIN_BAR_WIDTH, ...cells.map((cell) => cell.length));
  const lead = (meters[0] ?? '').trim();
  // Johtava merkintä omassa sarakkeessaan: ilman varattua tilaa merkitty rivi
  // liukuisi sivuun muiden sointurivien tahtiviivoista.
  const prefix = (lead ? `${lead} ` : '').padStart(gutter);

  /*
   * Avaava `|:` on merkin leveämpi kuin `|`, joten kertaava rivi liukuisi
   * sivuun muista sointuriveistä. Sama ratkaisu kuin johtavalla tahtilajilla:
   * merkille varataan kiinteä tila, jos laulussa on yksikin avaava kertaus.
   */
  const head = barLine(undefined, marks[0]).padEnd(1 + (repeats.gutter ?? 0));

  const inner = cells
    .map((cell, i) => (i === 0 ? '' : barLine(marks[i - 1], marks[i])) + ` ${cell.padEnd(width)} `)
    .join('');

  return `${prefix}${head}${inner}${barLine(marks[bars.length - 1], undefined)}`;
}

/**
 * Kuinka leveä sarake avaavalle kertausmerkille on varattava. Nolla kun
 * laulussa ei ole yhtään avausta.
 */
export function repeatGutter(lines: LyricLine[]): number {
  return lines.some((line) => line.repeats?.some((mark) => mark.start)) ? 1 : 0;
}

/**
 * Kuinka leveä sarake laulun johtaville tahtilajeille on varattava, jotta
 * sointurivien tahtiviivat pysyvät allekkain. Nolla kun merkintöjä ei ole.
 */
export function meterGutter(lines: LyricLine[]): number {
  let widest = 0;
  for (const line of lines) {
    if (!line.bars) continue;
    const lead = (line.meters?.[0] ?? line.meter ?? '').trim();
    if (lead) widest = Math.max(widest, lead.length + 1);
  }
  return widest;
}

/** Onko rivillä mitään näytettävää – tyhjä rivi erottaa osioita. */
export function isBlankLine(line: LyricLine): boolean {
  return line.text.trim() === '' && line.chords.length === 0;
}
