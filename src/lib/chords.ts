/**
 * Sointusymbolien jäsennys ja transponointi.
 *
 * Symboli koostuu perussävelestä (A–G + # tai b), laadusta (m7, sus4, dim, ...)
 * ja valinnaisesta bassosävelestä ("/G#"). Laatuosaa ei tulkita – se säilyy
 * transponoinnissa sellaisenaan.
 */

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const PITCH_CLASS: Record<string, number> = {
  C: 0, 'B#': 0,
  'C#': 1, Db: 1,
  D: 2,
  'D#': 3, Eb: 3,
  E: 4, Fb: 4,
  F: 5, 'E#': 5,
  'F#': 6, Gb: 6,
  G: 7,
  'G#': 8, Ab: 8,
  A: 9,
  'A#': 10, Bb: 10,
  B: 11, Cb: 11,
};

export interface ParsedChord {
  root: string;
  quality: string;
  bass?: string;
}

const CHORD_RE = /^([A-G](?:#|b)?)([^/]*)(?:\/([A-G](?:#|b)?))?$/;

export function parseChord(symbol: string): ParsedChord | null {
  const m = CHORD_RE.exec(symbol.trim());
  if (!m) return null;
  if (!(m[1] in PITCH_CLASS)) return null;
  if (m[3] && !(m[3] in PITCH_CLASS)) return null;
  return { root: m[1], quality: m[2] ?? '', bass: m[3] || undefined };
}

export type Accidental = 'sharp' | 'flat';

export function transposeNote(note: string, semitones: number, prefer: Accidental): string {
  const pc = PITCH_CLASS[note];
  if (pc === undefined) return note;
  const next = ((pc + semitones) % 12 + 12) % 12;
  return prefer === 'flat' ? FLAT_NAMES[next] : SHARP_NAMES[next];
}

/**
 * Transponoi sointusymbolin. Jos symbolia ei tunnisteta, se palautetaan
 * muuttumattomana, jotta käyttäjän omat merkinnät eivät katoa.
 * Etumerkki (# / b) valitaan `prefer`-asetuksella; jos sitä ei anneta,
 * käytetään alkuperäisen symbolin etumerkkiä.
 */
export function transposeChord(symbol: string, semitones: number, prefer?: Accidental): string {
  const parsed = parseChord(symbol);
  if (!parsed) return symbol;
  const accidental: Accidental =
    prefer ?? (parsed.root.includes('b') || (parsed.bass?.includes('b') ?? false) ? 'flat' : 'sharp');
  const root = transposeNote(parsed.root, semitones, accidental);
  const bass = parsed.bass ? '/' + transposeNote(parsed.bass, semitones, accidental) : '';
  return root + parsed.quality + bass;
}

/** Vaihtaa symbolin enharmonisen kirjoitusasun (C# <-> Db) transponoimatta. */
export function respellChord(symbol: string, prefer: Accidental): string {
  return transposeChord(symbol, 0, prefer);
}

/**
 * Transponoi tahdin sisällön sana kerrallaan.
 *
 * Tahtiin mahtuu useampi sointu ("Am F") ja muitakin merkintöjä ("%", "N.C.").
 * Koko sisältöä ei voi antaa `transposeChord`ille, koska laatuosa hyväksyy
 * välilyönnit: "Am F" jäsentyisi juureksi A ja laaduksi "m F", jolloin
 * jälkimmäinen sointu jäisi transponoimatta. Välit säilyvät sellaisinaan, ja
 * tunnistamaton merkintä palautuu koskemattomana.
 */
export function transposeBar(bar: string, semitones: number, prefer?: Accidental): string {
  return bar.replace(/\S+/g, (token) => transposeChord(token, semitones, prefer));
}
