/**
 * Sointurivin tahdit ja niiden tahtilajit yhtenä käsiteltävänä rakenteena.
 *
 * Tahtilaji kuuluu siihen tahtiin josta laji vaihtuu, ei koko riville: laji voi
 * vaihtua kesken rivin. Merkinnät ovat siksi omassa taulukossaan tahtien
 * rinnalla, ja jokainen tahteja muuttava operaatio siirtää molempia yhdessä.
 * Juuri tämä indeksikirjanpito rikkoutuu huomaamatta, joten operaatiot ovat
 * puhtaita funktioita ja testattuja erikseen.
 */
import type { LyricLine } from './types';

export interface BarRow {
  bars: string[];
  /** `meters[i]` näkyy tahdin `i` alussa; tyhjä merkkijono = ei merkintää. */
  meters: string[];
}

function padMeters(bars: string[], meters: string[]): string[] {
  return bars.map((_, i) => meters[i] ?? '');
}

/**
 * Rivin tahdit ja tahtilajit.
 *
 * Vanhempi `meter`-kenttä koski koko riviä; se luetaan ensimmäisen tahdin
 * merkinnäksi, jolloin jo tallennetut laulut säilyvät ennallaan.
 */
export function barRowOf(line: Pick<LyricLine, 'bars' | 'meters' | 'meter'>): BarRow {
  const bars = line.bars ?? [];
  const meters = line.meters ?? (line.meter ? [line.meter] : []);
  return { bars: [...bars], meters: padMeters(bars, meters) };
}

/** Tallennettava muoto: tyhjät merkinnät jätetään kokonaan pois. */
export function storedMeters(meters: string[]): string[] | null {
  const trimmed = meters.map((m) => m.trim());
  return trimmed.some(Boolean) ? trimmed : null;
}

export function setBarAt(row: BarRow, index: number, value: string): BarRow {
  return { ...row, bars: row.bars.map((bar, i) => (i === index ? value : bar)) };
}

export function setMeterAt(row: BarRow, index: number, meter: string): BarRow {
  return { ...row, meters: row.meters.map((m, i) => (i === index ? meter.trim() : m)) };
}

/** Uusi tyhjä tahti annetun tahdin perään. */
export function insertBarAfter(row: BarRow, index: number): BarRow {
  const at = index + 1;
  return {
    bars: [...row.bars.slice(0, at), '', ...row.bars.slice(at)],
    meters: [...row.meters.slice(0, at), '', ...row.meters.slice(at)],
  };
}

export function removeBarAt(row: BarRow, index: number): BarRow {
  if (row.bars.length <= 1) return row;
  return {
    bars: row.bars.filter((_, i) => i !== index),
    meters: row.meters.filter((_, i) => i !== index),
  };
}

/**
 * Tahtiviiva sointujen väliin: `Am F` → `| Am | F |`.
 *
 * Tahtilaji jää ensimmäiseen osaan, koska se on se tahti josta laji vaihtui.
 */
export function splitBarAt(row: BarRow, index: number): BarRow {
  const parts = (row.bars[index] ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return row;
  const meters = parts.map((_, i) => (i === 0 ? row.meters[index] : ''));
  return {
    bars: [...row.bars.slice(0, index), ...parts, ...row.bars.slice(index + 1)],
    meters: [...row.meters.slice(0, index), ...meters, ...row.meters.slice(index + 1)],
  };
}

/** Montako tahtia syntyisi jakamisesta; 1 = ei jaettavaa. */
export function splitCount(row: BarRow, index: number): number {
  return (row.bars[index] ?? '').trim().split(/\s+/).filter(Boolean).length;
}
