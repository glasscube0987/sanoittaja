/** Laulun muokkausoperaatiot – puhtaita funktioita, jotka palauttavat uuden laulun. */
import { adjustPositions, chordSpan } from './anchors';
import type { BarRow } from './bars';
import { splitBars, storedMeters } from './bars';
import type { Accidental } from './chords';
import { respellChord, transposeBar, transposeChord } from './chords';
import type { Notation } from './chords';
import { barRowText, classifyLine } from './importText';
import { getSections } from './sections';
import type { ChordAnchor, LyricLine, SectionMark, Song } from './types';
import { uid } from './types';

function touch(song: Song): Song {
  return { ...song, updatedAt: Date.now() };
}

function sortChords(chords: ChordAnchor[]): ChordAnchor[] {
  return [...chords].sort((a, b) => a.pos - b.pos);
}

/** Päivittää rivin tekstin ja siirtää sointuankkurit muutoksen mukana. */
export function editLineText(song: Song, lineId: string, newText: string): Song {
  return touch({
    ...song,
    lines: song.lines.map((line) => {
      if (line.id !== lineId) return line;
      const newPositions = adjustPositions(
        line.text,
        newText,
        line.chords.map((c) => c.pos),
      );
      return {
        ...line,
        text: newText,
        chords: line.chords.map((c, i) => ({ ...c, pos: newPositions[i] })),
      };
    }),
  });
}

/** Jakaa rivin kahtia kohdasta `at`; kohdan jälkeiset soinnut siirtyvät uudelle riville. */
export function splitLine(song: Song, lineId: string, at: number): Song {
  const idx = song.lines.findIndex((l) => l.id === lineId);
  if (idx === -1) return song;
  const line = song.lines[idx];
  const first: LyricLine = {
    ...line,
    text: line.text.slice(0, at),
    chords: line.chords.filter((c) => c.pos < at || (at === 0 && c.pos === 0)),
  };
  const second: LyricLine = {
    id: uid(),
    text: line.text.slice(at),
    chords: line.chords
      .filter((c) => !first.chords.includes(c))
      .map((c) => ({ ...c, pos: Math.max(0, c.pos - at) })),
  };
  const lines = [...song.lines];
  lines.splice(idx, 1, first, second);
  return touch({ ...song, lines });
}

/** Yhdistää rivin edelliseen; sointuankkurit siirtyvät edellisen rivin pituuden verran. */
export function mergeLineWithPrevious(song: Song, lineId: string): Song {
  const idx = song.lines.findIndex((l) => l.id === lineId);
  if (idx <= 0) return song;
  const prev = song.lines[idx - 1];
  const line = song.lines[idx];
  // Sointurivillä ei ole sanoja: yhdistäminen tuottaisi rivin, jolla on sekä
  // tahdit että teksti, eikä sellaista voi piirtää kummallakaan tavalla.
  if (prev.bars || line.bars) return song;
  const merged: LyricLine = {
    ...prev,
    text: prev.text + line.text,
    chords: sortChords([
      ...prev.chords,
      ...line.chords.map((c) => ({ ...c, pos: c.pos + prev.text.length })),
    ]),
  };
  const lines = [...song.lines];
  lines.splice(idx - 1, 2, merged);
  return touch({ ...song, lines });
}

export function removeLine(song: Song, lineId: string): Song {
  if (song.lines.length <= 1) return song;
  const idx = song.lines.findIndex((l) => l.id === lineId);
  if (idx === -1) return song;
  const lines = song.lines.filter((l) => l.id !== lineId);
  // Osiomerkintä periytyy seuraavalle riville, jottei koko osio katoa kun sen
  // ensimmäinen rivi poistetaan.
  const mark = song.lines[idx].section;
  if (mark && idx < lines.length && !lines[idx].section) {
    lines[idx] = { ...lines[idx], section: mark };
  }
  return touch({ ...song, lines });
}

/**
 * Lisää valmiit rivit annetun rivin perään, tai laulun loppuun kun `lineId` on
 * null. Tuonti kohdistuu tämän kautta keskelle laulua eikä vain loppuun.
 */
export function insertLinesAfter(song: Song, lineId: string | null, added: LyricLine[]): Song {
  if (added.length === 0) return song;
  const idx = lineId === null ? song.lines.length - 1 : song.lines.findIndex((l) => l.id === lineId);
  if (idx === -1) return song;
  const lines = [...song.lines];
  lines.splice(idx + 1, 0, ...added);
  return touch({ ...song, lines });
}

export function addLineAfter(song: Song, lineId: string): Song {
  const idx = song.lines.findIndex((l) => l.id === lineId);
  if (idx === -1) return song;
  const lines = [...song.lines];
  lines.splice(idx + 1, 0, { id: uid(), text: '', chords: [] });
  return touch({ ...song, lines });
}

/**
 * Kirjoittaa soinnun kohtaan `toPos` ja poistaa sen lähtökohdasta `fromPos`.
 * Näin sointua voi samalla operaatiolla siirtää, muokata ja (tyhjällä
 * symbolilla) poistaa. Kohdekohdassa jo oleva sointu korvautuu.
 */
export function placeChord(
  song: Song,
  lineId: string,
  fromPos: number,
  toPos: number,
  symbol: string,
): Song {
  return touch({
    ...song,
    lines: song.lines.map((line) => {
      if (line.id !== lineId) return line;
      const pos = Math.max(0, Math.min(chordSpan(line.text), toPos));
      const others = line.chords.filter((c) => c.pos !== fromPos && c.pos !== pos);
      const trimmed = symbol.trim();
      if (!trimmed) return { ...line, chords: sortChords(others) };
      // Siirretty sointu säilyttää id:nsä, jotta React-avain ja mahdollinen
      // valinta pysyvät samana soinnun liikkuessa.
      const moved = line.chords.find((c) => c.pos === fromPos);
      return { ...line, chords: sortChords([...others, { id: moved?.id ?? uid(), pos, symbol: trimmed }]) };
    }),
  });
}

/** Asettaa, korvaa tai (tyhjällä symbolilla) poistaa soinnun kohdassa pos. */
export function setChord(song: Song, lineId: string, pos: number, symbol: string): Song {
  return placeChord(song, lineId, pos, pos, symbol);
}

export const DEFAULT_BARS = ['', '', '', ''];

/**
 * Rivin soinnut tahdeiksi, yksi sointu tahtia kohti.
 *
 * Sointurivin voi tehdä valmiiksi merkityn rivin päälle, ja silloin soinnut
 * ovat jo tiedossa: neljä tyhjää tahtia pakottaisi kirjoittamaan ne uudelleen.
 *
 * Soinnut voivat olla rivillä kahdella tavalla. Ankkuroituna ne ovat
 * `line.chords`issa, ja se on ensisijainen lähde. Mutta kun tuonti on
 * tulkinnut sointurivin sanoitusriviksi, soinnut ovat rivin **tekstinä** –
 * juuri se rivi jonka käyttäjä haluaa muuntaa, ja juuri se tapaus jossa
 * tyhjät tahdit tuntuvat siltä että sovellus hukkasi työn.
 *
 * Tekstiä luetaan vain jos **jokainen** sana on sointu. `isChordToken` on
 * tarkoituksella tiukka, koska väärä suunta on tässä kohtalokas: sanoitusrivi
 * joka luettaisiin soinnuiksi katoaisi tahtien sekaan. Yksikin tunnistamaton
 * sana palauttaa oletustahteihin, jolloin käyttäjä näkee rivinsä ennallaan.
 */
export function barsFromLine(line: LyricLine): string[] {
  const symbols = [...line.chords].sort((a, b) => a.pos - b.pos).map((c) => c.symbol);
  if (symbols.length > 0) return symbols;
  return barsFromText(line.text) ?? DEFAULT_BARS;
}

/**
 * Sointuriviksi kirjoitettu teksti tahdeiksi, tai `null` jos se ei ole
 * sointurivi.
 *
 * Kysymys «onko tämä rivi sointurivi» on jo ratkaistu `classifyLine`ssa, jolla
 * tuonti päättää saman asian. Sitä käytetään tässä sellaisenaan eikä
 * kirjoiteta uudelleen: kaksi rinnakkaista sääntöä erkanisivat toisistaan, ja
 * silloin sama rivi tulkittaisiin tuonnissa ja editorissa eri tavalla.
 *
 * Aiempi oma tunnistus luki merkinnät välilyönneistä ja tiputti vain erillään
 * olevat tahtiviivat, joten kiinni kirjoitettu `|Am` jäi tunnistamatta ja koko
 * rivi putosi oletustahteihin.
 *
 * Tahtiviivat kertovat tahdituksen itse, jolloin niitä noudatetaan
 * sellaisenaan – myös tyhjää tahtia, joka tarkoittaa edellisen soinnun
 * jatkumista. Ilman tahtiviivoja tulee yksi merkintä tahtia kohti, sama sääntö
 * kuin ankkuroiduilla soinnuilla.
 */
function barsFromText(text: string): string[] | null {
  const laji = classifyLine(text);
  if (laji === 'bars') return splitBars(barRowText(text) ?? text);
  if (laji === 'chords') return text.trim().split(/\s+/).filter(Boolean);
  return null;
}

/**
 * Muuttaa rivin sointuriviksi tai (null) takaisin sanoitusriviksi.
 *
 * Sanat ja ankkuroidut soinnut säilytetään muunnoksessa vaikka niitä ei
 * sointurivillä piirretä: muunnos on yhden napautuksen päässä, ja tyhjentäminen
 * hävittäisi sanoitukset peruuttamattomasti. Takaisin muunnettaessa ne palaavat
 * sellaisinaan. Osiomerkintä säilyy niin ikään, jotta välisoiton voi merkitä
 * osioksi ja siirtää muiden osioiden mukana.
 */
export function setLineBars(song: Song, lineId: string, bars: string[] | null): Song {
  return touch({
    ...song,
    lines: song.lines.map((line) => {
      if (line.id !== lineId) return line;
      if (bars) return { ...line, bars };
      const next = { ...line };
      delete next.bars;
      return next;
    }),
  });
}

/** Kirjoittaa rivin tahdit ja niiden tahtilajit. */
export function setLineBarRow(song: Song, lineId: string, row: BarRow): Song {
  const meters = storedMeters(row.meters);
  return touch({
    ...song,
    lines: song.lines.map((line) => {
      if (line.id !== lineId) return line;
      const next: LyricLine = { ...line, bars: [...row.bars] };
      if (meters) next.meters = meters;
      else delete next.meters;
      // Vanha rivikohtainen kenttä on luettu jo tahtilajeihin.
      delete next.meter;
      return next;
    }),
  });
}

/** Merkitsee rivin osion aluksi tai (null) poistaa merkinnän. */
export function setLineSection(song: Song, lineId: string, mark: SectionMark | null): Song {
  return touch({
    ...song,
    lines: song.lines.map((line) => {
      if (line.id !== lineId) return line;
      if (mark) return { ...line, section: mark };
      if (!line.section) return line;
      const next = { ...line };
      delete next.section;
      return next;
    }),
  });
}

/**
 * Siirtää osion rivilohkoineen edellisen tai seuraavan osion ohi.
 *
 * Merkitsemätön aloituslohko pysyy aina ensimmäisenä: sen rivit valuisivat
 * siirron jälkeen edeltävän osion perään, mikä muuttaisi laulun rakennetta.
 */
export function moveSection(song: Song, blockId: string, direction: -1 | 1): Song {
  const blocks = getSections(song);
  const from = blocks.findIndex((b) => b.id === blockId);
  const to = from + direction;
  if (from === -1 || to < 0 || to >= blocks.length) return song;
  if (!blocks[from].mark || !blocks[to].mark) return song;

  const first = blocks[Math.min(from, to)];
  const second = blocks[Math.max(from, to)];
  return touch({
    ...song,
    lines: [
      ...song.lines.slice(0, first.start),
      ...second.lines,
      ...first.lines,
      ...song.lines.slice(second.end),
    ],
  });
}

/**
 * Kopioi osion riveineen heti alkuperäisen perään.
 *
 * Toistuva osio – kertosäe, sama säkeistörakenne – kirjoitettaisiin muuten
 * rivi riviltä uudelleen. Osiomerkintä kopioituu sellaisenaan, jolloin
 * `getSections`in numerointi tekee lopun: yksi ”Kertosäe” muuttuu automaattisesti
 * pariksi ”Kertosäe 1” ja ”Kertosäe 2”.
 *
 * Rivit ja sointuankkurit saavat uudet tunnukset: yhteiset tunnukset sotkisivat
 * sekä Reactin avaimet että rivikohtaiset operaatiot.
 */
/**
 * Rivin kopio omilla tunnisteillaan.
 *
 * Taulukot irrotetaan omiksi kappaleikseen, jottei kopio ja alkuperäinen jaa
 * samaa `bars`- tai `meters`-taulukkoa. Operaatiot ovat puhtaita eivätkä
 * muokkaa niitä paikallaan, joten jaettu viite ei riko mitään tänään – mutta
 * se on ansa joka laukeaisi vasta ensimmäisestä paikallaan muokkaavasta
 * rivistä, eikä sellaista vikaa löydä lukemalla kopiointia.
 *
 * Tämä on ainoa paikka joka tietää mitä rivin kopioon kuuluu. Jos uusi kenttä
 * unohtuisi täältä, se katoaisi hiljaa jokaisesta kopiosta.
 */
function copyLine(line: LyricLine): LyricLine {
  return {
    ...line,
    id: uid(),
    chords: line.chords.map((chord) => ({ ...chord, id: uid() })),
    ...(line.bars ? { bars: [...line.bars] } : {}),
    ...(line.meters ? { meters: [...line.meters] } : {}),
  };
}

/**
 * Kopio ilman osiomerkintää.
 *
 * Yksittäisen rivin kopio kuuluu siihen osioon johon se laskeutuu. Jos
 * merkintä tulisi mukana, kertosäkeen ensimmäisen rivin monistus katkaisisi
 * osion kahtia ja lehdelle ilmestyisi toinen «Kertosäe». Osion monistuksessa
 * merkintä sen sijaan säilyy – siellä se on koko tarkoitus.
 */
function copyIntoSection(line: LyricLine): LyricLine {
  const copy = copyLine(line);
  delete copy.section;
  return copy;
}

export function duplicateSection(song: Song, blockId: string): Song {
  const block = getSections(song).find((b) => b.id === blockId);
  if (!block) return song;

  const copies = block.lines.map(copyLine);

  const lines = [...song.lines];
  lines.splice(block.end, 0, ...copies);
  return touch({ ...song, lines });
}

/** Rivin kopio heti sen alle. */
export function duplicateLine(song: Song, lineId: string): Song {
  const idx = song.lines.findIndex((l) => l.id === lineId);
  if (idx === -1) return song;
  const lines = [...song.lines];
  lines.splice(idx + 1, 0, copyIntoSection(song.lines[idx]));
  return touch({ ...song, lines });
}

/**
 * Muualta kopioidun rivin kopio annetun rivin jälkeen.
 *
 * Kopio eikä siirto: sama rivi voi tulla useaan kohtaan, ja lähde voi olla jo
 * toisessa laulussa tai poistettu.
 */
export function insertLineAfter(song: Song, lineId: string, line: LyricLine): Song {
  const idx = song.lines.findIndex((l) => l.id === lineId);
  if (idx === -1) return song;
  const lines = [...song.lines];
  lines.splice(idx + 1, 0, copyIntoSection(line));
  return touch({ ...song, lines });
}

/** Kuinka monta puolisävelaskelta laulu on alkuperäisestä sävellajistaan. */
export function transposeOffset(song: Song): number {
  return song.transpose ?? 0;
}

/**
 * Palauttaa laulun alkuperäiseen sävellajiinsa.
 *
 * Sävelet palaavat oikeiksi, mutta enharmonista kirjoitusasua ei muisteta:
 * `Bb` voi palata muodossa `A#`. ♭/♯-painikkeet korjaavat asun.
 */
export function resetTranspose(song: Song, notation: Notation = 'B'): Song {
  return transposeSong(song, -transposeOffset(song), undefined, notation);
}

/** Transponoi laulun kaikki soinnut pysyvästi ja kirjaa siirtymän. */
export function transposeSong(
  song: Song,
  semitones: number,
  prefer?: Accidental,
  notation: Notation = 'B',
): Song {
  return touch({
    ...song,
    transpose: transposeOffset(song) + semitones,
    songKey: song.songKey ? transposeChord(song.songKey, semitones, prefer, notation) : song.songKey,
    lines: song.lines.map((line) => ({
      ...line,
      chords: line.chords.map((c) => ({
        ...c,
        symbol: transposeChord(c.symbol, semitones, prefer, notation),
      })),
      ...(line.bars ? { bars: line.bars.map((b) => transposeBar(b, semitones, prefer, notation)) } : {}),
    })),
  });
}

/** Vaihtaa kaikkien sointujen enharmonisen kirjoitusasun (# <-> b). */
export function respellSong(song: Song, prefer: Accidental, notation: Notation = 'B'): Song {
  return touch({
    ...song,
    songKey: song.songKey ? respellChord(song.songKey, prefer, notation) : song.songKey,
    lines: song.lines.map((line) => ({
      ...line,
      chords: line.chords.map((c) => ({ ...c, symbol: respellChord(c.symbol, prefer, notation) })),
      ...(line.bars ? { bars: line.bars.map((b) => transposeBar(b, 0, prefer, notation)) } : {}),
    })),
  });
}
