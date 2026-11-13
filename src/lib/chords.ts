/**
 * Sointusymbolien jäsennys ja transponointi.
 *
 * Symboli koostuu perussävelestä (A–H + # tai b), laadusta (m7, sus4, dim, ...)
 * ja valinnaisesta bassosävelestä ("/G#"). Laatuosaa ei tulkita – se säilyy
 * transponoinnissa sellaisenaan.
 *
 * **H on sama sävel kuin englannin B.** Suomalais-saksalaisessa perinteessä
 * h-sävel kirjoitetaan H:lla, ja se hyväksytään syötteenä aina – H ei tarkoita
 * missään merkintätavassa mitään muuta. `B` sen sijaan tarkoittaa syötteenä
 * aina h-säveltä, vaikka perinteisessä merkinnässä se on b-sävel: sen
 * merkityksen muuttaminen vaihtaisi jokaisen jo kirjoitetun B-soinnun
 * korkeutta puolisävelaskeleen ilman että käyttäjä huomaisi mitään.
 * Merkintätapa ohjaa siksi vain **ulostuloa**, ei tulkintaa.
 */

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/** Kumpaa kirjainta h-sävelestä kirjoitetaan. */
export type Notation = 'B' | 'H';

/*
 * H-merkinnän taulut eroavat vain sävelluokassa 11. Sävelluokka 10 on jo
 * valmiiksi yksiselitteinen kummassakin taulussa (`A#` tai `Bb`), joten
 * pelkkää `B`:tä ei tässä merkinnässä synny lainkaan – ja juuri se tekee
 * tuloksesta luettavan molemmissa perinteissä.
 */
const SHARP_NAMES_H = [...SHARP_NAMES.slice(0, 11), 'H'];
const FLAT_NAMES_H = [...FLAT_NAMES.slice(0, 11), 'H'];

function noteNames(prefer: Accidental, notation: Notation): string[] {
  if (notation === 'H') return prefer === 'flat' ? FLAT_NAMES_H : SHARP_NAMES_H;
  return prefer === 'flat' ? FLAT_NAMES : SHARP_NAMES;
}

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
  'A#': 10, Bb: 10, Hb: 10,
  B: 11, Cb: 11, H: 11,
  'H#': 0,
};

export interface ParsedChord {
  root: string;
  quality: string;
  bass?: string;
}

const CHORD_RE = /^([A-H](?:#|b)?)([^/]*)(?:\/([A-H](?:#|b)?))?$/;

export function parseChord(symbol: string): ParsedChord | null {
  const m = CHORD_RE.exec(symbol.trim());
  if (!m) return null;
  if (!(m[1] in PITCH_CLASS)) return null;
  if (m[3] && !(m[3] in PITCH_CLASS)) return null;
  return { root: m[1], quality: m[2] ?? '', bass: m[3] || undefined };
}

/**
 * Tunnistaa sointumerkin *tiukasti*, tuontia varten.
 *
 * `parseChord` on tarkoituksella salliva: sen laatuosa on `[^/]*`, jotta
 * transponointi ei hukkaa käyttäjän omia merkintöjä. Sivuvaikutuksena se
 * hyväksyy soinnuksi minkä tahansa A–G-alkuisen sanan – `Dance`, `Every`,
 * `Baby`, `Alone` – mikä on transponoinnissa harmitonta mutta tunnistuksessa
 * kohtalokasta: isolla alkukirjaimella kirjoitettu sanoitusrivi luokittuisi
 * sointuriviksi ja sanat katoaisivat sointumerkkien sekaan.
 *
 * Tässä laatuosa on siksi lueteltu. Tunnistamaton merkki tulkitaan sanaksi,
 * mikä on turvallisempi suunta: väärin sanoitukseksi jäänyt sointurivi näkyy
 * käyttäjälle sellaisenaan, toisin päin sanat menetettäisiin.
 */
const STRICT_CHORD_RE =
  /^[A-H][#b]?(?:maj|min|aug|dim|sus|add|alt|m|M|Δ|°|ø|\+|-)*\d*(?:[#b]\d+)*(?:(?:sus|add|maj|no)\d+)*(?:\/[A-H][#b]?)?$/;

export function isChordToken(token: string): boolean {
  // Sulkeet ovat pelkkää ryhmittelyä: C(add9) on sointu siinä missä Cadd9.
  const cleaned = token.replace(/[()]/g, '').trim();
  return cleaned.length > 0 && STRICT_CHORD_RE.test(cleaned);
}

export type Accidental = 'sharp' | 'flat';

export function transposeNote(
  note: string,
  semitones: number,
  prefer: Accidental,
  notation: Notation = 'B',
): string {
  const pc = PITCH_CLASS[note];
  if (pc === undefined) return note;
  const next = ((pc + semitones) % 12 + 12) % 12;
  return noteNames(prefer, notation)[next];
}

/**
 * Transponoi sointusymbolin. Jos symbolia ei tunnisteta, se palautetaan
 * muuttumattomana, jotta käyttäjän omat merkinnät eivät katoa.
 * Etumerkki (# / b) valitaan `prefer`-asetuksella; jos sitä ei anneta,
 * käytetään alkuperäisen symbolin etumerkkiä.
 */
export function transposeChord(
  symbol: string,
  semitones: number,
  prefer?: Accidental,
  notation: Notation = 'B',
): string {
  const parsed = parseChord(symbol);
  if (!parsed) return symbol;
  const accidental: Accidental =
    prefer ?? (parsed.root.includes('b') || (parsed.bass?.includes('b') ?? false) ? 'flat' : 'sharp');
  const root = transposeNote(parsed.root, semitones, accidental, notation);
  const bass = parsed.bass ? '/' + transposeNote(parsed.bass, semitones, accidental, notation) : '';
  return root + parsed.quality + bass;
}

/**
 * Kumpaa etumerkkiä sävellajissa kirjoitetaan. `undefined` kun sävellajia ei
 * tunnisteta tai siinä ei ole etumerkkejä (C ja Am).
 *
 * Live-tilassa transponoidaan ilman editorin ♭/♯-painikkeita, ja oletus –
 * kukin sointu säilyttää oman etumerkkinsä – kirjoitti a-mollista nostetun
 * c-mollin soinnuilla G#, D# ja A#. Lavalla ne luetaan Ab, Eb ja Bb.
 *
 * Molli luetaan rinnakkaisduurinsa kautta, jolloin sääntö on yksi kvinttiympyrä
 * eikä kaksi taulukkoa. Fis/Ges-duurissa (ja dis/es-mollissa) kumpaakin on
 * kuusi, joten siinä noudatetaan sitä miten sävellaji on kirjoitettu.
 */
export function keyAccidental(key: string): Accidental | undefined {
  const parsed = parseChord(key);
  if (!parsed) return undefined;
  // «m», «m7» ja «min» ovat mollia; «maj7» ja iso «M» eivät.
  const molli = /^m(?!aj)/.test(parsed.quality);
  const duuri = (PITCH_CLASS[parsed.root] + (molli ? 3 : 0)) % 12;
  if (duuri === 0) return undefined;
  if (duuri === 6) return parsed.root.includes('b') ? 'flat' : 'sharp';
  // F, B♭, E♭, A♭ ja D♭; loput ovat ristisävellajeja.
  return [5, 10, 3, 8, 1].includes(duuri) ? 'flat' : 'sharp';
}

/** Vaihtaa symbolin enharmonisen kirjoitusasun (C# <-> Db) transponoimatta. */
export function respellChord(symbol: string, prefer: Accidental, notation: Notation = 'B'): string {
  return transposeChord(symbol, 0, prefer, notation);
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
export function transposeBar(
  bar: string,
  semitones: number,
  prefer?: Accidental,
  notation: Notation = 'B',
): string {
  return bar.replace(/\S+/g, (token) => transposeChord(token, semitones, prefer, notation));
}
