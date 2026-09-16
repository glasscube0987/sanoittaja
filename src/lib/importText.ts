/**
 * Laulun tuonti tekstistä.
 *
 * Vanhat laulut ovat tyypillisesti Wordissa tai muistiinpanoissa niin, että
 * soinnut on kohdistettu välilyönnein sanoitusrivin yläpuolelle. Tämä moduuli
 * lukee sellaisen tekstin laulun riveiksi: sointurivit pariutuvat allaan
 * olevaan sanoitusriviin ja soinnut ankkuroituvat siihen sarakkeeseen, josta ne
 * lähdetekstissä alkoivat.
 *
 * Tunnistus on kaksivaiheinen tarkoituksella. Rivin tyyppi päätetään ensin
 * erikseen (`classifyLines`), ja vasta sen jälkeen rivit kootaan lauluksi
 * (`buildLines`). Näin käyttäjä voi korjata väärin tunnistetun rivin tyypin ja
 * kokoaminen ajetaan uudelleen samalla logiikalla – pariutumissääntö on
 * yhdessä paikassa.
 */
import { chordSpan } from './anchors';
import { splitBars } from './bars';
import { isChordToken } from './chords';
import type { ChordAnchor, LyricLine, SectionKind, SectionMark } from './types';
import { uid } from './types';

export type ImportKind = 'blank' | 'section' | 'chords' | 'bars' | 'lyrics';

/** Valikon järjestys: yleisimmät ensin. */
export const IMPORT_KINDS: ImportKind[] = ['lyrics', 'chords', 'bars', 'section', 'blank'];

/**
 * Sarkaimen leveys tuonnissa.
 *
 * Sarkain ei ole sarake, joten se on levitettävä välilyönneiksi ennen kuin
 * sointujen kohdistus voidaan lukea. Sama sääntö koskee sekä sointu- että
 * sanoitusriviä, joten johdonmukaisesti sarkaimin tehty asettelu säilyy.
 */
const TAB_WIDTH = 4;

function expandTabs(line: string): string {
  let out = '';
  for (const ch of line) {
    if (ch === '\t') out += ' '.repeat(TAB_WIDTH - (out.length % TAB_WIDTH));
    else out += ch;
  }
  return out;
}

/** Teksti riveiksi rivinvaihtotyylistä riippumatta, sarkaimet levitettyinä. */
export function splitLines(text: string): string[] {
  return text.replace(/\r\n?/g, '\n').split('\n').map(expandTabs);
}

/*
 * Osio-otsikoiden sanat molemmilla kielillä. Vanha laulu voi olla kirjoitettu
 * kummalla kielellä tahansa riippumatta siitä, mikä kieli käyttöliittymässä on
 * valittuna, joten tämä luettelo on tarkoituksella erillään i18n-taulusta.
 */
const SECTION_WORDS: Record<string, SectionKind> = {
  intro: 'intro',
  alkusoitto: 'intro',
  verse: 'verse',
  säkeistö: 'verse',
  sakeisto: 'verse',
  prechorus: 'prechorus',
  nousu: 'prechorus',
  chorus: 'chorus',
  refrain: 'chorus',
  kertosäe: 'chorus',
  kertosae: 'chorus',
  kertsi: 'chorus',
  bridge: 'bridge',
  cosa: 'bridge',
  välike: 'bridge',
  solo: 'solo',
  soolo: 'solo',
  instrumental: 'solo',
  välisoitto: 'solo',
  valisoitto: 'solo',
  outro: 'outro',
  ending: 'outro',
  lopetus: 'outro',
  coda: 'outro',
};

/** Otsikkoteksti hakuavaimeksi: `Pre-Chorus 2:` → `prechorus`. */
function headingKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[:.]+$/, '')
    .replace(/\s*\d+\s*$/, '')
    .replace(/[-\s_]/g, '')
    .trim();
}

/**
 * Osiomerkintä otsikkorivistä, tai null jos rivi ei ole otsikko.
 *
 * Hakasulkeissa oleva rivi on aina otsikko, myös tuntematon: sen teksti jää
 * osion omaksi nimeksi, jolloin mitään ei katoa. Ilman hakasulkeita koko rivin
 * on oltava tunnettu osiosana, jottei sanoitusrivi ”Chorus of angels” muutu
 * otsikoksi.
 */
export function sectionFromHeading(raw: string): SectionMark | null {
  const trimmed = raw.trim();
  const bracketed = /^[[(](.+)[\])]$/.exec(trimmed);
  const inner = bracketed ? bracketed[1].trim() : trimmed;
  const kind = SECTION_WORDS[headingKey(inner)];

  if (kind) return { kind };
  // Tuntematon otsikko säilyy omana nimenään; laji on vain kantaja, sillä
  // nimi korvaa sekä oletusnimen että numeroinnin.
  if (bracketed) return { kind: 'verse', label: inner };
  return null;
}

/** Merkinnät, jotka kuuluvat sointuriville olematta itse sointuja. */
const CHORD_EXTRAS = /^(?:[|/%\-–—.]+|[xX]\d+|\d+[xX]|N\.?C\.?|:\|+|\|+:)$/;

function isChordRowToken(token: string): boolean {
  return isChordToken(token) || CHORD_EXTRAS.test(token);
}

/** Rivi, jolla on soinnut ja vain sointuja. */
function looksLikeChordRow(raw: string): boolean {
  const tokens = raw.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every(isChordRowToken) && tokens.some(isChordToken);
}

/** Tahtimerkinnällä kirjoitettu sointurivi: `| Am | F | C | G |`. */
function looksLikeBarRow(raw: string): boolean {
  if (!raw.includes('|')) return false;
  const segments = raw.split('|');
  const filled = segments.map((s) => s.trim()).filter(Boolean);
  if (filled.length === 0) return false;
  return filled.every((segment) => segment.split(/\s+/).every(isChordRowToken)) &&
    filled.some((segment) => segment.split(/\s+/).some(isChordToken));
}

/**
 * Tahtiviivan näköiset merkit.
 *
 * `|` on puhelimen näppäimistöllä hankalassa paikassa, ja nopeassa
 * merkinnässä sen tilalle tulee helposti `I` tai `l` – ne näyttävät
 * paperilla samalta. Kirjoittajan tarkoitus on selvä, joten se luetaan.
 */
const BAR_LOOKALIKES = /[Il]/g;

/**
 * Sama rivi tahtiviivan näköiset merkit tahtiviivoiksi vaihdettuna, jos se
 * vasta silloin on sointurivi.
 *
 * Tämä on **vara eikä sääntö**, ja järjestys on koko turvallisuus: vaihtoa
 * kokeillaan vasta kun rivi ei ole sointurivi sellaisenaan. Siksi `Calt`
 * säilyy sointuna eikä pilkkoudu, ja tahtiviivoilla jo kirjoitettu rivi
 * luetaan sellaisenaan.
 *
 * Vaihto ei silti yksin riitä: `looksLikeBarRow` vaatii, että **jokaisen**
 * tahdin sisältö on pelkkiä sointuja. Juuri se estää sanoitusta katoamasta –
 * «Am I the only one» pilkkoutuisi muotoon `Am | the on|y one`, jossa sanat
 * eivät ole sointuja, joten rivi jää sanoitukseksi.
 */
function barLookalikeRow(raw: string): string | null {
  const swapped = raw.replace(BAR_LOOKALIKES, '|');
  if (swapped === raw || !looksLikeBarRow(swapped)) return null;
  /*
   * Vähintään kaksi tahtia. Yhden tahdin rivi on varatulkinnalle liian ohut
   * todiste: «Am I» täyttäisi kaikki muut ehdot mutta voi hyvin olla
   * sanoitusta. Tahtiviivoilla kirjoitettuun riviin tämä ei päde, koska
   * silloin merkintä on jo yksiselitteinen.
   */
  return splitBars(swapped).filter(Boolean).length >= 2 ? swapped : null;
}

/**
 * Teksti, josta rivin tahdit luetaan, tai `null` jos rivi ei ole tahtirivi.
 *
 * Tuonti ja editorin sointurivimuunnos käyttävät molemmat tätä, jottei sama
 * rivi tulkittaisi kahdessa paikassa eri tavalla.
 */
export function barRowText(raw: string): string | null {
  if (looksLikeBarRow(raw)) return raw;
  /*
   * Tahtiviivaton sointurivi on oma lajinsa, eikä sitä pilkota varatulkinnalla.
   * Yhtään syötettä joka tarvitsisi tämän vahdin ei ole löytynyt – `Calt`
   * torjuu itsensä jo sillä, ettei `Ca` ole sointu – joten tämä on
   * järjestyksen takuu eikä korjaus tunnettuun vikaan. Ilman sitä lajien
   * keskinäinen järjestys jäisi riippumaan sointujen laatuosien sisällöstä.
   */
  if (looksLikeChordRow(raw)) return null;
  return barLookalikeRow(raw);
}

export function classifyLine(raw: string): ImportKind {
  if (raw.trim() === '') return 'blank';
  if (sectionFromHeading(raw)) return 'section';
  if (barRowText(raw)) return 'bars';
  if (looksLikeChordRow(raw)) return 'chords';
  return 'lyrics';
}

export function classifyLines(rawLines: string[]): ImportKind[] {
  return rawLines.map(classifyLine);
}

/** Sointurivin merkinnät sarakkeineen; lisämerkinnät (`|`, `x2`) jätetään pois. */
function chordsAt(raw: string, span: number): ChordAnchor[] {
  const anchors: ChordAnchor[] = [];
  for (const match of raw.matchAll(/\S+/g)) {
    if (!isChordToken(match[0])) continue;
    anchors.push({ id: uid(), pos: Math.min(match.index ?? 0, span), symbol: match[0] });
  }
  return anchors;
}

export interface ImportResult {
  /** Otsikoksi tulkittu rivi, jos sellainen löytyi. */
  title?: string;
  /** Otsikoksi otetun lähderivin indeksi, jotta esikatselu voi näyttää sen. */
  titleIndex?: number;
  lines: LyricLine[];
}

export interface BuildOptions {
  /** Otetaanko ensimmäinen rivi laulun nimeksi. Ei uuteen lauluun lisättäessä. */
  withTitle?: boolean;
}

/**
 * Onko ensimmäinen sisältörivi laulun nimi: yksinäinen sanoitusrivi, jonka yllä
 * ei ole sointuja ja jota seuraa tyhjä rivi. Nimirivi on tavallisin tapa
 * aloittaa käsin kirjoitettu laulupaperi.
 */
function titleIndexOf(kinds: ImportKind[]): number | null {
  const first = kinds.findIndex((kind) => kind !== 'blank');
  if (first === -1) return null;
  if (kinds[first] !== 'lyrics') return null;
  if (kinds[first + 1] !== 'blank') return null;
  // Pelkkä nimi ilman laulua ei ole nimi.
  if (!kinds.slice(first + 1).some((kind) => kind === 'lyrics' || kind === 'chords')) return null;
  return first;
}

export function buildLines(
  rawLines: string[],
  kinds: ImportKind[],
  options: BuildOptions = {},
): ImportResult {
  const titleAt = options.withTitle ? titleIndexOf(kinds) : null;
  const lines: LyricLine[] = [];
  let pendingMark: SectionMark | null = null;
  let pendingBlank = false;

  const push = (line: Omit<LyricLine, 'id'>) => {
    // Tyhjä rivi erottimena vain sisällön välissä, ei alussa eikä osio-otsikon
    // edessä – otsikko erottaa osiot jo itse.
    if (pendingBlank && lines.length > 0 && !pendingMark) {
      lines.push({ id: uid(), text: '', chords: [] });
    }
    pendingBlank = false;
    lines.push({ id: uid(), ...line, ...(pendingMark ? { section: pendingMark } : {}) });
    pendingMark = null;
  };

  for (let i = 0; i < rawLines.length; i++) {
    if (i === titleAt) continue;
    const raw = rawLines[i];

    switch (kinds[i]) {
      case 'blank':
        pendingBlank = true;
        break;

      case 'section':
        pendingMark = sectionFromHeading(raw) ?? { kind: 'verse', label: raw.trim() };
        break;

      case 'bars':
        push({ text: '', chords: [], bars: splitBars(barRowText(raw) ?? raw) });
        break;

      case 'chords': {
        // Sointurivi kuuluu allaan olevalle sanoitusriville; yksinään se on
        // sanaton rivi, kuten intro tai välisoitto.
        const paired = kinds[i + 1] === 'lyrics' && i + 1 !== titleAt;
        const text = paired ? rawLines[i + 1].trimEnd() : '';
        push({ text, chords: chordsAt(raw, chordSpan(text)) });
        if (paired) i++;
        break;
      }

      default:
        push({ text: raw.trimEnd(), chords: [] });
    }
  }

  const result: ImportResult = { lines };
  if (titleAt !== null) {
    result.title = rawLines[titleAt].trim();
    result.titleIndex = titleAt;
  }
  return result;
}

/** Koko tuonti yhtenä kutsuna: teksti sisään, laulun rivit ulos. */
export function parseSongText(text: string, options: BuildOptions = {}): ImportResult {
  const rawLines = splitLines(text);
  return buildLines(rawLines, classifyLines(rawLines), options);
}
