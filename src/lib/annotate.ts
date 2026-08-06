/**
 * Käsin piirrettyjen merkintöjen koordinaatisto ja vetojen käsittely.
 *
 * Nuottilehti ladotaan uudelleen aina kun laulua muokataan tai tekstikoko
 * vaihtuu, joten näyttöpikselit eivät kelpaa merkinnän paikaksi. Veto kuuluu
 * riviin, ja sen pisteet ovat **em-yksiköissä**: yksi yksikkö on rivin
 * fonttikoko.
 *
 * Fonttikoko eikä rivin leveys, koska lehti on tasalevyistä tekstiä eikä
 * rivity: silloin jokainen kirjaimen paikka on fonttikoon monikerta, ja
 * em-yksiköissä piirretty veto seuraa kirjaimia kun tekstikokoa muutetaan.
 * Leveyteen suhteutettuna veto jäi paikalleen tekstin kasvaessa, koska rivin
 * leveys on säiliön leveys eikä muutu tekstikoon mukana.
 *
 * Sekä x että y jaetaan samalla luvulla, jolloin muoto säilyy – ympyrä pysyy
 * ympyränä. Origo on rivin vasen yläkulma, joten veto seuraa riviään kun
 * rivejä lisätään, poistetaan tai osioita siirretään, ja se saa ulottua rivin
 * ulkopuolelle: iso ympyrä kertosäkeen ympärillä on yksi veto eikä katkea.
 */

export interface Box {
  left: number;
  top: number;
  /** Rivin fonttikoko pikseleinä; yksi em. */
  em: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Näyttöpiste rivin koordinaatistoon. */
export function toAnchored(box: Box, clientX: number, clientY: number): Point {
  // Nollaa ei tule vastaan oikeasta fonttikoosta; varmistus jakolaskua varten.
  const scale = box.em || 1;
  return { x: (clientX - box.left) / scale, y: (clientY - box.top) / scale };
}

/** Rivin koordinaatisto takaisin näyttöpikseleiksi. */
export function toPixels(box: Box, point: Point): Point {
  const scale = box.em || 1;
  return { x: box.left + point.x * scale, y: box.top + point.y * scale };
}

/** Litteä lukulista pisteiksi. */
export function toPoints(flat: number[]): Point[] {
  const points: Point[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) points.push({ x: flat[i], y: flat[i + 1] });
  return points;
}

export function toFlat(points: Point[]): number[] {
  return points.flatMap((p) => [p.x, p.y]);
}

/**
 * SVG-polku vedosta. Pelkkä piste piirretään lyhyenä viivana, jotta napautus
 * jättää näkyvän jäljen – muuten `M`-komento yksinään ei piirrä mitään.
 */
export function pathData(flat: number[], scale: number): string {
  const points = toPoints(flat);
  if (points.length === 0) return '';
  /* Kolme desimaalia: skaala on pikseleitä, joten tämä on selvästi alle
     näkyvän. Kahdella desimaalilla ja suhdelukuskaalalla veto porrastui
     näkyvästi ennen kuin karsinta siisti sen. */
  const xy = (p: Point) => `${(p.x * scale).toFixed(3)} ${(p.y * scale).toFixed(3)}`;
  if (points.length === 1) {
    const p = points[0];
    return `M${xy(p)}L${((p.x + 0.01) * scale).toFixed(3)} ${(p.y * scale).toFixed(3)}`;
  }
  return `M${xy(points[0])}` + points.slice(1).map((p) => `L${xy(p)}`).join('');
}

/** Pisteen etäisyys janasta a–b. */
function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const pituus = dx * dx + dy * dy;
  if (pituus === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / pituus));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * Karsii vedosta pisteet, jotka eivät muuta sen muotoa (Douglas–Peucker).
 *
 * Kynä tuottaa satoja pisteitä sekunnissa; karsimatta yksi veto olisi
 * kilotavuja ja koko laulun merkinnät kasvattaisivat varmuuskopiota
 * tarpeettomasti.
 */
export function simplify(flat: number[], tolerance = 0.03): number[] {
  const points = toPoints(flat);
  if (points.length < 3) return flat.slice();

  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;

  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [alku, loppu] = stack.pop()!;
    let kaukaisin = -1;
    let etaisyys = tolerance;
    for (let i = alku + 1; i < loppu; i++) {
      const d = distanceToSegment(points[i], points[alku], points[loppu]);
      if (d > etaisyys) {
        etaisyys = d;
        kaukaisin = i;
      }
    }
    if (kaukaisin === -1) continue;
    keep[kaukaisin] = true;
    stack.push([alku, kaukaisin], [kaukaisin, loppu]);
  }

  return toFlat(points.filter((_, i) => keep[i]));
}

/** Osuuko pyyhekumi vetoon: etäisyys mihin tahansa janaan alle säteen. */
export function hitsStroke(flat: number[], at: Point, radius: number): boolean {
  const points = toPoints(flat);
  if (points.length === 0) return false;
  if (points.length === 1) return Math.hypot(points[0].x - at.x, points[0].y - at.y) <= radius;
  for (let i = 1; i < points.length; i++) {
    if (distanceToSegment(at, points[i - 1], points[i]) <= radius) return true;
  }
  return false;
}

/**
 * Käytettävissä olevat värit. Vähän ja erottuvia, myös tummalla pinnalla.
 *
 * Ensimmäinen on oletus, ja siksi se ei ole lehden korostusväri: kullalla
 * piirretty merkintä näyttäisi soinnulta tai osion otsikolta. Kulta on silti
 * valittavissa, jos merkinnän on tarkoitus sulautua.
 */
export const COLORS = ['#e0524f', '#4f9de0', '#5fc07a', '#eceef4', '#e5b45f'];

/**
 * Viivan paksuus em-yksiköissä: noin 2 pikseliä oletustekstikoolla, ja se
 * kasvaa tekstin mukana niin kuin muukin lehti.
 */
export const STROKE_WIDTH = 0.1;

/** Pyyhekumin säde samassa yksikössä, noin kirjaimen korkeuden puolikas. */
export const ERASER_RADIUS = 0.5;
