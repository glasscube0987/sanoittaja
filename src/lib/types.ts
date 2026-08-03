/** Sointumerkki, joka on ankkuroitu rivin merkkipositioon. */
export interface ChordAnchor {
  id: string;
  /** 0-pohjainen merkki-indeksi rivin tekstissä (voi olla text.length = rivin loppu). */
  pos: number;
  /** Sointusymboli, esim. "Am7", "C#/G#", "Bb". */
  symbol: string;
}

export type SectionKind = 'intro' | 'verse' | 'prechorus' | 'chorus' | 'bridge' | 'solo' | 'outro';

/** Osion alkumerkintä. Osio jatkuu seuraavaan merkintään asti. */
export interface SectionMark {
  kind: SectionKind;
  /** Vapaa nimi, joka korvaa lajin oletusnimen ja numeroinnin. */
  label?: string;
}

export interface LyricLine {
  id: string;
  text: string;
  chords: ChordAnchor[];
  /** Jos asetettu, rivi aloittaa uuden osion. */
  section?: SectionMark;
  /**
   * Jos asetettu, rivi on sointurivi: soinnut luetaan tahteina eikä sanoihin
   * ankkuroituna, eikä rivillä ole sanoja. Yksi alkio on yhden tahdin sisältö
   * vapaana tekstinä, esim. "Am", "Am F" tai "%".
   */
  bars?: string[];
}

export interface Song {
  id: string;
  title: string;
  /** Vapaamuotoinen sävellajimerkintä, esim. "Em". */
  songKey: string;
  lines: LyricLine[];
  createdAt: number;
  updatedAt: number;
}

export interface Recording {
  id: string;
  songId: string;
  name: string;
  mimeType: string;
  durationMs: number;
  createdAt: number;
  blob: Blob;
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function newSong(title = 'Uusi laulu'): Song {
  const now = Date.now();
  return {
    id: uid(),
    title,
    songKey: '',
    lines: [{ id: uid(), text: '', chords: [] }],
    createdAt: now,
    updatedAt: now,
  };
}
