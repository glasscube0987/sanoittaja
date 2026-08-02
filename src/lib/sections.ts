/**
 * Osiorakenne johdetaan riveistä: rivi, jolla on `section`, aloittaa osion, ja
 * sitä seuraavat merkitsemättömät rivit kuuluvat samaan osioon. Rivit pysyvät
 * yhtenä listana, joten rivioperaatiot toimivat osioista riippumatta.
 */
import type { LyricLine, SectionKind, SectionMark, Song } from './types';

export const SECTION_NAMES: Record<SectionKind, string> = {
  intro: 'Intro',
  verse: 'Säkeistö',
  prechorus: 'Nousu',
  chorus: 'Kertosäe',
  bridge: 'C-osa',
  solo: 'Soolo',
  outro: 'Outro',
};

export const SECTION_KINDS = Object.keys(SECTION_NAMES) as SectionKind[];

export interface SectionBlock {
  /** Lohkon tunnus on sen ensimmäisen rivin id. */
  id: string;
  /** null vain laulun alussa, jos ensimmäisiä rivejä ei ole merkitty osioksi. */
  mark: SectionMark | null;
  /** Järjestysnumero saman lajin osioiden joukossa; 0 kun numerointia ei tarvita. */
  ordinal: number;
  /** Rivien indeksit song.lines-listassa, loppu poissulkevana. */
  start: number;
  end: number;
  lines: LyricLine[];
}

export function getSections(song: Song): SectionBlock[] {
  const blocks: SectionBlock[] = [];

  song.lines.forEach((line, i) => {
    const current = blocks[blocks.length - 1];
    if (line.section || !current) {
      blocks.push({
        id: line.id,
        mark: line.section ?? null,
        ordinal: 0,
        start: i,
        end: i + 1,
        lines: [line],
      });
      return;
    }
    current.lines.push(line);
    current.end = i + 1;
  });

  /*
   * Numeroidaan vain lajit, joita esiintyy useammin kuin kerran: yksittäinen
   * kertosäe luetaan selkeämmin ilman numeroa. Nimetyt osiot jäävät ulos,
   * koska niiden nimi on jo käyttäjän valitsema.
   */
  const total = new Map<SectionKind, number>();
  for (const block of blocks) {
    if (block.mark && !block.mark.label) total.set(block.mark.kind, (total.get(block.mark.kind) ?? 0) + 1);
  }
  const running = new Map<SectionKind, number>();
  for (const block of blocks) {
    if (!block.mark || block.mark.label) continue;
    if ((total.get(block.mark.kind) ?? 0) < 2) continue;
    const n = (running.get(block.mark.kind) ?? 0) + 1;
    running.set(block.mark.kind, n);
    block.ordinal = n;
  }

  return blocks;
}

export function sectionTitle(block: SectionBlock): string {
  if (!block.mark) return '';
  if (block.mark.label) return block.mark.label;
  const name = SECTION_NAMES[block.mark.kind];
  return block.ordinal ? `${name} ${block.ordinal}` : name;
}
