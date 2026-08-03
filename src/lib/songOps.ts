/** Laulun muokkausoperaatiot – puhtaita funktioita, jotka palauttavat uuden laulun. */
import { adjustPositions, chordSpan } from './anchors';
import type { Accidental } from './chords';
import { respellChord, transposeBar, transposeChord } from './chords';
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
export function resetTranspose(song: Song): Song {
  return transposeSong(song, -transposeOffset(song));
}

/** Transponoi laulun kaikki soinnut pysyvästi ja kirjaa siirtymän. */
export function transposeSong(song: Song, semitones: number, prefer?: Accidental): Song {
  return touch({
    ...song,
    transpose: transposeOffset(song) + semitones,
    songKey: song.songKey ? transposeChord(song.songKey, semitones, prefer) : song.songKey,
    lines: song.lines.map((line) => ({
      ...line,
      chords: line.chords.map((c) => ({ ...c, symbol: transposeChord(c.symbol, semitones, prefer) })),
      ...(line.bars ? { bars: line.bars.map((b) => transposeBar(b, semitones, prefer)) } : {}),
    })),
  });
}

/** Vaihtaa kaikkien sointujen enharmonisen kirjoitusasun (# <-> b). */
export function respellSong(song: Song, prefer: Accidental): Song {
  return touch({
    ...song,
    songKey: song.songKey ? respellChord(song.songKey, prefer) : song.songKey,
    lines: song.lines.map((line) => ({
      ...line,
      chords: line.chords.map((c) => ({ ...c, symbol: respellChord(c.symbol, prefer) })),
      ...(line.bars ? { bars: line.bars.map((b) => transposeBar(b, 0, prefer)) } : {}),
    })),
  });
}
