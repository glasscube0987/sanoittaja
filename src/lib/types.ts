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
   * Tahtilajit tahdeittain: `meters[i]` on voimassa tahdista `i` eteenpäin,
   * esim. "3/4". Merkitään vain siihen tahtiin jossa laji vaihtuu; laulun oma
   * tahtilaji on `Song.meter`.
   */
  meters?: string[];
  /** Vanha, koko riviä koskenut tahtilaji. Luetaan ensimmäisen tahdin lajiksi. */
  meter?: string;
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
  /**
   * Laulun tahtilaji, esim. "4/4". Vapaata tekstiä samasta syystä kuin
   * sävellaji: "7/8" ja "12/8" ovat yhtä päteviä eikä listaa kannata rajata.
   */
  meter?: string;
  /**
   * Nettosiirtymä puolisävelaskelina alkuperäisestä sävellajista. Soinnut
   * tallennetaan transponoituina, joten tämä on ainoa muisto siitä mistä
   * lähdettiin – sen avulla laulun voi palauttaa alkuperäiseen sävellajiin.
   */
  transpose?: number;
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

/**
 * Nimi on oletuksena tyhjä, ei kiinteä teksti: käyttöliittymä näyttää tyhjän
 * nimen tilalla käännetyn ”Nimetön”, joten kieli ei pääse vuotamaan dataan.
 */
export function newSong(title = ''): Song {
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
