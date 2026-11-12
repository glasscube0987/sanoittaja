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
export function chordLineText(line: Pick<LyricLine, 'chords'>): string {
  let out = '';
  for (const chord of [...line.chords].sort((a, b) => a.pos - b.pos)) {
    const start = out.length === 0 ? chord.pos : Math.max(chord.pos, out.length + 1);
    out = out.padEnd(start, ' ') + chord.symbol;
  }
  return out;
}

/** Tahdin vähimmäisleveys, jotta tyhjäkin tahti näkyy tahtina. */
const MIN_BAR_WIDTH = 2;

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

/** Sointurivin ladonnan osat, yhteiset koko riville ja sen taitoksille. */
interface BarRowParts {
  marks: BarRepeat[];
  cells: string[];
  /** Tahdin leveys: rivin levein, jotta tahtiviivat asettuvat allekkain. */
  width: number;
  prefix: string;
  /** Avaavan tahtiviivan sarakkeen leveys kertausmerkkeineen. */
  headWidth: number;
}

function barRowParts(
  bars: string[],
  meters: string[],
  gutter: number,
  repeats: RepeatLayout,
): BarRowParts {
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

  const lead = (meters[0] ?? '').trim();
  return {
    marks: repeats.marks ?? [],
    cells,
    width: Math.max(MIN_BAR_WIDTH, ...cells.map((cell) => cell.length)),
    // Johtava merkintä omassa sarakkeessaan: ilman varattua tilaa merkitty rivi
    // liukuisi sivuun muiden sointurivien tahtiviivoista.
    prefix: (lead ? `${lead} ` : '').padStart(gutter),
    /*
     * Avaava `|:` on merkin leveämpi kuin `|`, joten kertaava rivi liukuisi
     * sivuun muista sointuriveistä. Sama ratkaisu kuin johtavalla tahtilajilla:
     * merkille varataan kiinteä tila, jos laulussa on yksikin avaava kertaus.
     */
    headWidth: 1 + (repeats.gutter ?? 0),
  };
}

/**
 * Tahdit `alku`…`loppu − 1` omana rivinään.
 *
 * Koko rivi on sama funktio koko välillä. Taitoksessa rivi alkaa avaavalla ja
 * päättyy sulkevalla tahtiviivalla, joten taittokohdan `:||:` jakautuu
 * itsestään: `:|` jää edellisen rivin loppuun ja `|:` aloittaa seuraavan –
 * niin kuin nuotissa rivin vaihtuessa.
 */
function barChunk(parts: BarRowParts, alku: number, loppu: number): string {
  const { marks, cells, width, prefix, headWidth } = parts;
  // Jatkorivillä johtavan merkinnän paikka on tyhjä, mutta varattu: tahtiviivat
  // pysyvät allekkain ensimmäisen rivin kanssa.
  const lead = alku === 0 ? prefix : ' '.repeat(prefix.length);
  const head = barLine(undefined, marks[alku]).padEnd(headWidth);
  let inner = '';
  for (let i = alku; i < loppu; i++) {
    inner += (i === alku ? '' : barLine(marks[i - 1], marks[i])) + ` ${cells[i].padEnd(width)} `;
  }
  return `${lead}${head}${inner}${barLine(marks[loppu - 1], undefined)}`;
}

/**
 * Sointurivi tekstinä: `| Am  | F   | C   | G   |`.
 *
 * Tahdit tasataan rivin leveimmän mukaan, jotta tahtiviivat asettuvat
 * allekkain ja tahtien kesto on luettavissa silmäyksellä.
 */
export function barLineText(
  bars: string[],
  meters: string[] = [],
  gutter = 0,
  repeats: RepeatLayout = {},
): string {
  if (bars.length === 0) return '';
  return barChunk(barRowParts(bars, meters, gutter, repeats), 0, bars.length);
}

/** Sointurivin taitos: omalla näyttörivillään ladottu pala tahteja. */
export interface BarSegment {
  /** Sarake, josta pala alkaa taittamattomalla rivillä. */
  from: number;
  /** Montako saraketta palan sisältö on siirtynyt vasemmalle. */
  shift: number;
  text: string;
}

/**
 * Jakaa sointurivin paloiksi, joista jokainen mahtuu `cols` sarakkeeseen.
 *
 * Katkaistaan vain tahtiviivasta. Jokainen pala alkaa samasta sarakkeesta kuin
 * ensimmäinen, joten tahtiviivat asettuvat allekkain myös taitettuna.
 *
 * `from` ja `shift` kertovat merkinnöille mihin kohtaan taittamatonta riviä
 * pala kuuluu; ks. `lib/wrap.ts`. Tahdin sisältö on palassa täsmälleen samassa
 * kohdassa suhteessa tahtiviivaansa kuin taittamattomalla rivillä, joten
 * soinnun ympärille piirretty ympyrä osuu sointuunsa.
 */
export function wrapBarLine(
  bars: string[],
  meters: string[] = [],
  gutter = 0,
  repeats: RepeatLayout = {},
  cols = Infinity,
): BarSegment[] {
  if (bars.length === 0) return [{ from: 0, shift: 0, text: '' }];
  const parts = barRowParts(bars, meters, gutter, repeats);
  const koko = barChunk(parts, 0, bars.length);
  if (!Number.isFinite(cols) || koko.length <= cols) return [{ from: 0, shift: 0, text: koko }];

  // Tahtien alkusarakkeet taittamattomalla rivillä: erotin ja itse tahti.
  const sisalto = parts.prefix.length + parts.headWidth;
  const erotin: number[] = [parts.prefix.length];
  const tahti: number[] = [sisalto];
  for (let i = 1; i < bars.length; i++) {
    erotin[i] = tahti[i - 1] + parts.width + 2;
    tahti[i] = erotin[i] + barLine(parts.marks[i - 1], parts.marks[i]).length;
  }

  const palat: BarSegment[] = [];
  let alku = 0;
  while (alku < bars.length) {
    // Niin monta tahtia kuin mahtuu, mutta aina vähintään yksi: liian leveä
    // tahti valuu yli mieluummin kuin jää kokonaan pois.
    let loppu = alku + 1;
    while (loppu < bars.length && barChunk(parts, alku, loppu + 1).length <= cols) loppu++;
    palat.push({
      from: alku === 0 ? 0 : erotin[alku],
      shift: alku === 0 ? 0 : tahti[alku] - sisalto,
      text: barChunk(parts, alku, loppu),
    });
    alku = loppu;
  }
  return palat;
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
