/**
 * Sointurivin tahdit ja niiden tahtilajit yhtenä käsiteltävänä rakenteena.
 *
 * Tahtilaji kuuluu siihen tahtiin josta laji vaihtuu, ei koko riville: laji voi
 * vaihtua kesken rivin. Merkinnät ovat siksi omassa taulukossaan tahtien
 * rinnalla, ja jokainen tahteja muuttava operaatio siirtää molempia yhdessä.
 * Juuri tämä indeksikirjanpito rikkoutuu huomaamatta, joten operaatiot ovat
 * puhtaita funktioita ja testattuja erikseen.
 */
import type { BarRepeat, LyricLine } from './types';

export interface BarRow {
  bars: string[];
  /** `meters[i]` näkyy tahdin `i` alussa; tyhjä merkkijono = ei merkintää. */
  meters: string[];
  /** `repeats[i]` on tahdin `i` kertausmerkit; tyhjä olio = ei merkintää. */
  repeats: BarRepeat[];
}

function padMeters(bars: string[], meters: string[]): string[] {
  return bars.map((_, i) => meters[i] ?? '');
}

function padRepeats(bars: string[], repeats: BarRepeat[]): BarRepeat[] {
  return bars.map((_, i) => repeats[i] ?? {});
}

/** Onko tahdissa mitään kertausmerkintää. */
export function hasRepeat(mark: BarRepeat | undefined): boolean {
  return Boolean(mark?.start || mark?.end);
}

/**
 * Rivin tahdit ja tahtilajit.
 *
 * Vanhempi `meter`-kenttä koski koko riviä; se luetaan ensimmäisen tahdin
 * merkinnäksi, jolloin jo tallennetut laulut säilyvät ennallaan.
 */
export function barRowOf(line: Pick<LyricLine, 'bars' | 'meters' | 'meter' | 'repeats'>): BarRow {
  const bars = line.bars ?? [];
  const meters = line.meters ?? (line.meter ? [line.meter] : []);
  return {
    bars: [...bars],
    meters: padMeters(bars, meters),
    repeats: padRepeats(bars, line.repeats ?? []),
  };
}

/**
 * Tahtiviivoin kirjoitettu rivi tahdeiksi: `| Am | F |` -> `['Am', 'F']`.
 *
 * Uloimmat tahtiviivat tuottavat tyhjät päät, jotka eivät ole tahteja.
 * Sama jäsennys tarvitaan kahdessa paikassa – tekstin tuonnissa ja rivin
 * sointurivimuunnoksessa – joten se asuu täällä eikä kummassakaan niistä.
 */
export function splitBars(raw: string): string[] {
  const parts = raw.split('|').map((part) => part.trim());
  if (parts[0] === '') parts.shift();
  if (parts[parts.length - 1] === '') parts.pop();
  return parts;
}

/** Tallennettava muoto: tyhjät merkinnät jätetään kokonaan pois. */
export function storedMeters(meters: string[]): string[] | null {
  const trimmed = meters.map((m) => m.trim());
  return trimmed.some(Boolean) ? trimmed : null;
}

/** Sama kertausmerkeille: merkitsemätön rivi ei kanna kenttää lainkaan. */
export function storedRepeats(repeats: BarRepeat[]): BarRepeat[] | null {
  return repeats.some(hasRepeat) ? repeats.map((mark) => (hasRepeat(mark) ? mark : {})) : null;
}

export function setBarAt(row: BarRow, index: number, value: string): BarRow {
  return { ...row, bars: row.bars.map((bar, i) => (i === index ? value : bar)) };
}

export function setMeterAt(row: BarRow, index: number, meter: string): BarRow {
  return { ...row, meters: row.meters.map((m, i) => (i === index ? meter.trim() : m)) };
}

export function setRepeatAt(row: BarRow, index: number, mark: BarRepeat): BarRow {
  return { ...row, repeats: row.repeats.map((r, i) => (i === index ? mark : r)) };
}

/**
 * Uusi tyhjä tahti annetun tahdin perään.
 *
 * Uusi tahti syntyy merkittömänä, eikä naapurin kertausmerkkiä siirretä sille.
 * Siirto olisi arvaus siitä kumpaa käyttäjä tarkoitti, ja pariton merkki on
 * joka tapauksessa kelvollinen – sovellus ei parita merkkejä.
 */
export function insertBarAfter(row: BarRow, index: number): BarRow {
  const at = index + 1;
  return {
    bars: [...row.bars.slice(0, at), '', ...row.bars.slice(at)],
    meters: [...row.meters.slice(0, at), '', ...row.meters.slice(at)],
    repeats: [...row.repeats.slice(0, at), {}, ...row.repeats.slice(at)],
  };
}

/** Poistetun tahdin merkinnät katoavat sen mukana, samasta syystä. */
export function removeBarAt(row: BarRow, index: number): BarRow {
  if (row.bars.length <= 1) return row;
  return {
    bars: row.bars.filter((_, i) => i !== index),
    meters: row.meters.filter((_, i) => i !== index),
    repeats: row.repeats.filter((_, i) => i !== index),
  };
}

/**
 * Tahtiviiva sointujen väliin: `Am F` → `| Am | F |`.
 *
 * Tahtilaji jää ensimmäiseen osaan, koska se on se tahti josta laji vaihtui.
 * Kertaus kehystää edelleen saman musiikin, joten avaus jää ensimmäiseen
 * osaan ja sulku siirtyy viimeiseen.
 */
export function splitBarAt(row: BarRow, index: number): BarRow {
  const parts = (row.bars[index] ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return row;
  const meters = parts.map((_, i) => (i === 0 ? row.meters[index] : ''));
  const mark = row.repeats[index] ?? {};
  const repeats = parts.map((_, i) => {
    const osa: BarRepeat = {};
    if (i === 0 && mark.start) osa.start = true;
    if (i === parts.length - 1 && mark.end) {
      osa.end = true;
      if (mark.times) osa.times = mark.times;
    }
    return osa;
  });
  return {
    bars: [...row.bars.slice(0, index), ...parts, ...row.bars.slice(index + 1)],
    meters: [...row.meters.slice(0, index), ...meters, ...row.meters.slice(index + 1)],
    repeats: [...row.repeats.slice(0, index), ...repeats, ...row.repeats.slice(index + 1)],
  };
}

/** Montako tahtia syntyisi jakamisesta; 1 = ei jaettavaa. */
export function splitCount(row: BarRow, index: number): number {
  return (row.bars[index] ?? '').trim().split(/\s+/).filter(Boolean).length;
}
