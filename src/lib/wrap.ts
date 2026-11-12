/**
 * Pitkän rivin rivitys ja merkintöjen siirto rivityksen mukana.
 *
 * Puhelimen pystynäytölle mahtuu noin 30–40 merkkiä, ja seitsemän sanan
 * suomenkielinen säe on helposti 60. Rivi vieri sivulle, eikä soittaessa voi
 * vierittää. Rivitys on **laitekohtainen**: puhelin taittaa rivin, iPad näyttää
 * sen kokonaisena. Kiinteä jako lauluun olisi katkaissut rivit myös siellä
 * missä ne mahtuvat.
 *
 * Laitekohtaisuudesta seuraa tämän tiedoston toinen puoli. Omat merkinnät on
 * ankkuroitu rivin alkuun, ja se toimi koska rivin ladonta oli sama kaikkialla.
 * Kun rivi taittuu, sanan ympärille piirretty ympyrä jäisi väärään kohtaan.
 *
 * Ratkaisu ei koske tallennusmuotoon. Merkintä tallennetaan edelleen suhteessa
 * **kokonaiseen, taittamattomaan riviin** – tässä tiedostossa «nauha». Taitto
 * on pelkkä näyttömuunnos: nauha leikataan sarakkeiden kohdalta paloiksi ja
 * palat pinotaan allekkain, ja merkintä siirtyy sen palan mukana johon se
 * kuuluu. Tekstikoon tai näytön vaihtuessa muunnos lasketaan uudelleen, joten
 * mikään ei vanhene, eikä vanhoja merkintöjä tarvitse muuntaa.
 *
 * Kaikki tässä on puhdasta laskentaa. Mitat (merkin leveys, taitoksen korkeus)
 * tulevat kutsujalta, joka mittaa ne näkyvältä lehdeltä.
 */
import { eraseAlong, toFlat, toPoints } from './annotate';
import type { Point } from './annotate';
import { chordLineText } from './render';
import type { ChordAnchor, LyricLine } from './types';

/** Yksi taitos: pala nauhasta omalla näyttörivillään. */
export interface Segment {
  /** Sarake, josta pala alkaa nauhalla. */
  from: number;
  /**
   * Montako saraketta palan sisältö on siirtynyt vasemmalle. Ei sama kuin
   * `from`: jatkorivi on sisennetty, joten sen sisältö alkaa vähän rivin alun
   * jälkeen.
   */
  shift: number;
}

export interface TextSegment extends Segment {
  text: string;
  chords: ChordAnchor[];
}

/**
 * Jatkorivin sisennys sarakkeina. Ilman sitä taittunutta riviä ei erota
 * uudesta säkeestä, ja laulajalle se ero on fraseerausta.
 */
export const WRAP_INDENT = 2;

/** Tätä kapeammalla rivitys vain pirstoisi tekstin sana per rivi. */
const MIN_COLS = 12;

function pala(line: LyricLine, a: number, b: number, sisennys: number): TextSegment {
  return {
    from: a,
    shift: a - sisennys,
    text: ' '.repeat(sisennys) + line.text.slice(a, b),
    chords: line.chords
      .filter((c) => c.pos >= a && c.pos < b)
      .map((c) => ({ ...c, pos: c.pos - a + sisennys })),
  };
}

/** Palan leveys ladottuna: teksti tai sointurivi, kumpi on pidempi. */
function leveys(seg: TextSegment): number {
  return Math.max(seg.text.trimEnd().length, chordLineText(seg).length);
}

/**
 * Kohdat joista rivin saa katkaista: sanojen alut, ja tekstin jälkeen tulevat
 * soinnut. Sanan keskeltä ei katkaista, eikä soinnun ja sen sanan välistä.
 */
function katkaisukohdat(line: LyricLine): number[] {
  const kohdat = new Set<number>();
  for (let i = 1; i < line.text.length; i++) {
    if (line.text[i] !== ' ' && line.text[i - 1] === ' ') kohdat.add(i);
  }
  for (const chord of line.chords) {
    if (chord.pos > 0 && chord.pos >= line.text.length) kohdat.add(chord.pos);
  }
  return [...kohdat].sort((a, b) => a - b);
}

/**
 * Jakaa rivin paloiksi, joista jokainen mahtuu `cols` sarakkeeseen.
 *
 * Ahne rivitys: palaan otetaan niin monta sanaa kuin mahtuu. Soinnut kulkevat
 * sanansa mukana, ja palan leveyteen lasketaan myös sointurivi – rivin viimeisen
 * sanan yllä oleva pitkä sointu ei saa valua reunan yli.
 *
 * Rivi joka mahtuu palautetaan yhtenä palana, jolloin kaikki muunnokset ovat
 * identiteettejä: leveällä näytöllä ja tulosteessa mikään ei muutu.
 */
export function wrapLine(line: LyricLine, cols: number): TextSegment[] {
  const koko = pala(line, 0, Infinity, 0);
  if (!Number.isFinite(cols) || cols < MIN_COLS || leveys(koko) <= cols) return [koko];

  const kohdat = katkaisukohdat(line);
  const palat: TextSegment[] = [];
  let alku = 0;
  for (;;) {
    const sisennys = palat.length === 0 ? 0 : WRAP_INDENT;
    const loppu = pala(line, alku, Infinity, sisennys);
    if (leveys(loppu) <= cols) {
      palat.push(loppu);
      return palat;
    }

    // Viimeinen kohta jolla pala vielä mahtuu. Leveys kasvaa kohdan mukana,
    // joten ensimmäinen liian leveä päättää haun.
    let katko = -1;
    for (const kohta of kohdat) {
      if (kohta <= alku) continue;
      if (leveys(pala(line, alku, kohta, sisennys)) > cols) break;
      katko = kohta;
    }
    /* Yksi sana on riviä pidempi: katkaistaan keskeltä. Vaihtoehto olisi antaa
       sen valua yli, ja juuri sitä tämä kaikki yrittää estää. */
    if (katko === -1) katko = alku + Math.max(1, cols - sisennys);

    palat.push(pala(line, alku, katko, sisennys));
    alku = katko;
  }
}

/* --- Merkintöjen siirto --- */

/**
 * Taitetun rivin mitat. Yksiköt ovat samat kuin merkinnöillä: em, eli rivin
 * fonttikoon monikerta.
 */
export interface WrapLayout {
  segments: Segment[];
  /** Yhden merkin leveys. */
  ch: number;
  /**
   * Kuinka paljon alempana kunkin taitoksen tekstirivi on kuin ensimmäisen.
   * Ensimmäinen on nolla.
   *
   * Taitoskohtainen eikä yksi rivikorkeus, koska taitokset eivät ole yhtä
   * korkeita: sointurivi ladotaan vain niihin joiden yllä on sointuja. Tyhjä
   * sointurivi jokaisella jatkorivillä näytti siltä kuin säe olisi hajonnut
   * erillisiksi pätkiksi. Mitta on tekstirivistä, koska sanat ovat se mihin
   * merkintä liittyy – alleviivaus osuu sanansa alle joka taitoksessa.
   */
  dy: number[];
  /** Kunkin taitoksen laatikon yläreuna rivin laatikossa. */
  tops: number[];
}

/**
 * Veto piirtyy yhtenä kappaleena, kun tämä osuus sen leveydestä on yhden
 * taitoksen alueella. Sanan ympärille piirretty ympyrä ylittää aina vähän
 * sanansa reunat; jos se leikattaisiin taitoskohdasta, ympyrän kaari ilmestyisi
 * seuraavan rivin alkuun.
 */
const RIGID_SHARE = 0.7;

/** Tätä korkeampi veto on kuvio usean rivin ympärillä, ei rivin merkintä. */
const TALL_ROWS = 2;

/** Taitos johon sarake kuuluu. */
export function segmentIndex(segments: Segment[], col: number): number {
  let k = 0;
  while (k + 1 < segments.length && col >= segments[k + 1].from) k++;
  return k;
}

/** Taitoksen sarakealue nauhalla. Ensimmäinen ja viimeinen ovat avoimia. */
function alue(segments: Segment[], k: number): [number, number] {
  return [
    k === 0 ? -Infinity : segments[k].from,
    k + 1 < segments.length ? segments[k + 1].from : Infinity,
  ];
}

function siirra(flat: number[], dx: number, dy: number): number[] {
  return flat.map((arvo, i) => (i % 2 === 0 ? arvo + dx : arvo + dy));
}

function rajat(flat: number[]): { x0: number; x1: number; y0: number; y1: number } {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (let i = 0; i + 1 < flat.length; i += 2) {
    x0 = Math.min(x0, flat[i]);
    x1 = Math.max(x1, flat[i]);
    y0 = Math.min(y0, flat[i + 1]);
    y1 = Math.max(y1, flat[i + 1]);
  }
  return { x0, x1, y0, y1 };
}

/** Nauhalta näytölle: taitoksen `k` sisältö siirtyy vasemmalle ja alas. */
function naytolle(layout: WrapLayout, flat: number[], k: number): number[] {
  return siirra(flat, -layout.segments[k].shift * layout.ch, layout.dy[k] ?? 0);
}

/** Tyypillinen taitoksen korkeus: kahden ensimmäisen tekstirivin väli. */
function rivikorkeus(layout: WrapLayout): number {
  return layout.dy[1] ?? 0;
}

/**
 * Taitos jossa veto piirtyy yhtenä kappaleena, tai `null` jos se on jaettava.
 *
 * Yhtenä kappaleena pysyvät vedot jotka ovat pääosin yhden taitoksen alueella
 * (ympyrä, nuoli, lyhyt alleviivaus) ja korkeat kuviot. Jaettavaksi jää pitkä,
 * matala veto joka ulottuu kahdelle taitokselle – käytännössä alleviivaus
 * taittokohdan yli, josta tulee kaksi alleviivausta.
 */
export function strokeSegment(layout: WrapLayout, flat: number[]): number | null {
  if (layout.segments.length <= 1 || flat.length < 2) return 0;
  const { x0, x1, y0, y1 } = rajat(flat);
  const c0 = x0 / layout.ch;
  const c1 = x1 / layout.ch;
  const k = segmentIndex(layout.segments, (c0 + c1) / 2);
  if (y1 - y0 > TALL_ROWS * rivikorkeus(layout)) return k;
  if (c1 === c0) return k;

  const [lo, hi] = alue(layout.segments, k);
  const sisalla = Math.min(c1, hi) - Math.max(c0, lo);
  return sisalla / (c1 - c0) >= RIGID_SHARE ? k : null;
}

/** Nauhan veto paloina, kukin omassa taitoksessaan. Koordinaatit ovat nauhan. */
export function splitStroke(layout: WrapLayout, flat: number[]): { k: number; points: number[] }[] {
  const yhtena = strokeSegment(layout, flat);
  if (yhtena !== null) return [{ k: yhtena, points: flat }];

  const { segments, ch } = layout;
  const points = toPoints(flat);
  const palat: { k: number; points: Point[] }[] = [];
  let k = segmentIndex(segments, points[0].x / ch);
  let kesken: Point[] = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const maali = segmentIndex(segments, b.x / ch);
    /* Jana voi ylittää useamman taitoskohdan. Jokaisessa katkaistaan täsmälleen
       rajalla: pala päättyy siihen ja seuraava alkaa samasta pisteestä, jolloin
       kokonaisena näytettynä palat liittyvät saumatta. */
    while (k !== maali) {
      const raja = (maali > k ? segments[k + 1].from : segments[k].from) * ch;
      const t = (raja - a.x) / (b.x - a.x);
      const kohta = { x: raja, y: a.y + (b.y - a.y) * t };
      kesken.push(kohta);
      palat.push({ k, points: kesken });
      k += maali > k ? 1 : -1;
      kesken = [kohta];
    }
    kesken.push(b);
  }
  palat.push({ k, points: kesken });

  return palat.map((osa) => ({ k: osa.k, points: toFlat(osa.points) }));
}

/** Vedon palat näytön koordinaateissa, valmiina piirrettäviksi. */
export function placeStroke(layout: WrapLayout, flat: number[]): number[][] {
  if (layout.segments.length <= 1) return [flat];
  return splitStroke(layout, flat).map((osa) => naytolle(layout, osa.points, osa.k));
}

/** Taitos jonka kohdalla näytön korkeus `y` on. */
function taitos(layout: WrapLayout, y: number): number {
  let k = 0;
  while (k + 1 < layout.segments.length && y >= layout.tops[k + 1]) k++;
  return k;
}

/**
 * Liu'uttaa nauhan vetoa vaakasuunnassa sen verran, että se piirtyy yhtenä
 * kappaleena taitoksessa `k`.
 *
 * Taitetun rivin loppupään tyhjä tila ei vastaa mitään kohtaa nauhalla: nauhalla
 * rivin lopun jälkeen tulee heti seuraavan taitoksen alku. Sinne piirretty veto
 * hyppäisi siksi seuraavan näyttörivin alkuun heti kun sormi nousee. Vähemmän
 * yllättävää on, että se asettuu sen rivin loppuun jolle se piirrettiin.
 */
function asetu(layout: WrapLayout, flat: number[], k: number): number[] {
  if (strokeSegment(layout, flat) === k) return flat;
  const { x0, x1 } = rajat(flat);
  const [lo, hi] = alue(layout.segments, k);
  const c0 = x0 / layout.ch;
  const c1 = x1 / layout.ch;

  let dc = 0;
  if (c1 > hi) dc = hi - c1;
  // Vasen reuna ratkaisee, jos veto on taitosta leveämpi eikä mahdu kokonaan.
  if (c0 + dc < lo) dc = lo - c0;
  return siirra(flat, dc * layout.ch, 0);
}

/**
 * Näytölle piirretty veto nauhan koordinaatteihin.
 *
 * Koko veto siirtyy yhtenä kappaleena sen taitoksen mukaan, jonka korkeudella
 * sen keskikohta on. Pisteittäin muunnettuna rivin yläreunan yli kaartuva
 * ympyrä repeäisi kahtia, koska sen yläosa on jo edellisen taitoksen kohdalla.
 */
export function strokeToStrip(layout: WrapLayout, flat: number[]): number[] {
  if (layout.segments.length <= 1 || flat.length < 2) return flat;
  const { y0, y1 } = rajat(flat);
  const k = taitos(layout, (y0 + y1) / 2);
  const nauhalla = siirra(flat, layout.segments[k].shift * layout.ch, -(layout.dy[k] ?? 0));
  return asetu(layout, nauhalla, k);
}

/** Nauhan piste näytölle. Tekstikentän ankkuri on sen vasen yläkulma. */
export function pointToWrapped(layout: WrapLayout, p: Point): Point {
  if (layout.segments.length <= 1) return p;
  const k = segmentIndex(layout.segments, p.x / layout.ch);
  return { x: p.x - layout.segments[k].shift * layout.ch, y: p.y + (layout.dy[k] ?? 0) };
}

/**
 * Näytön piste nauhalle. Sarake rajataan taitoksen alueelle samasta syystä kuin
 * `asetu`: rivin lopun tyhjään tilaan pudotettu kenttä ei saa hypätä seuraavan
 * rivin alkuun.
 */
export function pointToStrip(layout: WrapLayout, p: Point): Point {
  if (layout.segments.length <= 1) return p;
  const k = taitos(layout, p.y);
  const [lo, hi] = alue(layout.segments, k);
  const col = p.x / layout.ch + layout.segments[k].shift;
  // Avoin yläraja: sarake `hi` kuuluu jo seuraavalle taitokselle.
  const rajattu = Math.max(lo, Math.min(hi - 0.01, col));
  return { x: rajattu * layout.ch, y: p.y - (layout.dy[k] ?? 0) };
}

/**
 * Pyyhkii vetoa näytöllä kulkevalla janalla. Palauttaa jäljelle jäävät palat
 * nauhan koordinaateissa, tai `null` jos mikään ei muuttunut.
 *
 * Veto pyyhitään siinä muodossa kuin se näkyy: jaettu veto käsitellään
 * taitoksittain, ja pyyhkimen jana viedään kunkin palan kohdalle nauhalla.
 * Jäljelle jäävät palat asetetaan samaan taitokseen – muuten ympyrästä jäänyt
 * kaaren pätkä, joka ylittää taitoskohdan, hyppäisi viereiselle riville.
 */
export function eraseWrapped(
  layout: WrapLayout,
  flat: number[],
  from: Point,
  to: Point,
  radius: number,
): number[][] | null {
  if (layout.segments.length <= 1) return eraseAlong(flat, from, to, radius);

  let muuttui = false;
  const jaljelle: number[][] = [];
  for (const osa of splitStroke(layout, flat)) {
    const dx = layout.segments[osa.k].shift * layout.ch;
    const dy = -(layout.dy[osa.k] ?? 0);
    const palat = eraseAlong(
      osa.points,
      { x: from.x + dx, y: from.y + dy },
      { x: to.x + dx, y: to.y + dy },
      radius,
    );
    if (!palat) {
      jaljelle.push(osa.points);
      continue;
    }
    muuttui = true;
    for (const pala of palat) jaljelle.push(asetu(layout, pala, osa.k));
  }
  return muuttui ? jaljelle : null;
}
