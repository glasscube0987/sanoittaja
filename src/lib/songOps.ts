/** Laulun muokkausoperaatiot – puhtaita funktioita, jotka palauttavat uuden laulun. */
import { adjustPositions } from './anchors';
import type { Accidental } from './chords';
import { respellChord, transposeChord } from './chords';
import type { ChordAnchor, LyricLine, Song } from './types';
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
  return touch({ ...song, lines: song.lines.filter((l) => l.id !== lineId) });
}

export function addLineAfter(song: Song, lineId: string): Song {
  const idx = song.lines.findIndex((l) => l.id === lineId);
  if (idx === -1) return song;
  const lines = [...song.lines];
  lines.splice(idx + 1, 0, { id: uid(), text: '', chords: [] });
  return touch({ ...song, lines });
}

/** Asettaa, korvaa tai (tyhjällä symbolilla) poistaa soinnun kohdassa pos. */
export function setChord(song: Song, lineId: string, pos: number, symbol: string): Song {
  return touch({
    ...song,
    lines: song.lines.map((line) => {
      if (line.id !== lineId) return line;
      const others = line.chords.filter((c) => c.pos !== pos);
      const trimmed = symbol.trim();
      if (!trimmed) return { ...line, chords: others };
      return { ...line, chords: sortChords([...others, { id: uid(), pos, symbol: trimmed }]) };
    }),
  });
}

/** Transponoi laulun kaikki soinnut pysyvästi. */
export function transposeSong(song: Song, semitones: number, prefer?: Accidental): Song {
  return touch({
    ...song,
    songKey: song.songKey ? transposeChord(song.songKey, semitones, prefer) : song.songKey,
    lines: song.lines.map((line) => ({
      ...line,
      chords: line.chords.map((c) => ({ ...c, symbol: transposeChord(c.symbol, semitones, prefer) })),
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
    })),
  });
}
