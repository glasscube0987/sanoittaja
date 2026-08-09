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

/**
 * Janan ne osuudet, jotka jäävät ympyrän ulkopuolelle, parametrivälinä 0–1.
 *
 * Ratkaistaan toisen asteen yhtälöstä eikä pisteitä poimimalla: `simplify`
 * typistää suoran vedon kahdeksi pisteeksi, joten pistekohtainen pyyhkiminen ei
 * osuisi alleviivauksen keskelle lainkaan – ja alleviivaus on juuri se yleisin
 * merkintä.
 */
function outsideSpans(a: Point, b: Point, c: Point, r: number): Array<[number, number]> {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const fx = a.x - c.x;
  const fy = a.y - c.y;
  const A = dx * dx + dy * dy;
  if (A === 0) return Math.hypot(fx, fy) <= r ? [] : [[0, 1]];

  const B = 2 * (fx * dx + fy * dy);
  const C = fx * fx + fy * fy - r * r;
  const disc = B * B - 4 * A * C;
  // Yksikin jana ympyrän sisällä tekee diskriminantista positiivisen, joten
  // ei-positiivinen tarkoittaa että koko jana on ulkopuolella.
  if (disc <= 0) return [[0, 1]];

  const juuri = Math.sqrt(disc);
  const t1 = (-B - juuri) / (2 * A);
  const t2 = (-B + juuri) / (2 * A);

  const spans: Array<[number, number]> = [];
  if (t1 > 0) spans.push([0, Math.min(1, t1)]);
  if (t2 < 1) spans.push([Math.max(0, t2), 1]);
  return spans.filter(([alku, loppu]) => loppu > alku);
}

/**
 * Pyyhkii vedosta pyyhkimen alle jäävän osan ja palauttaa jäljelle jäävät palat.
 *
 * Palasia on nolla kun koko veto pyyhkiytyi, yksi kun pyyhittiin päästä ja
 * kaksi kun keskeltä. Koko vedon poistaminen yhdestä kosketuksesta oli tylsä
 * työkalu: ympyrästä ei voinut siistiä yhtä kohtaa siistimättä koko ympyrää
 * uudelleen.
 */
export function eraseAt(flat: number[], at: Point, radius: number): number[][] {
  const points = toPoints(flat);
  if (points.length === 0) return [];
  if (points.length === 1) {
    return Math.hypot(points[0].x - at.x, points[0].y - at.y) <= radius ? [] : [flat.slice()];
  }

  const palat: Point[][] = [];
  let kesken: Point[] = [];
  const lisaa = (p: Point) => {
    const edellinen = kesken[kesken.length - 1];
    if (!edellinen || edellinen.x !== p.x || edellinen.y !== p.y) kesken.push(p);
  };
  const katkaise = () => {
    if (kesken.length > 1) palat.push(kesken);
    kesken = [];
  };

  let jatkuu = false;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const kohdassa = (t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

    const spans = outsideSpans(a, b, at, radius);
    if (spans.length === 0) {
      katkaise();
      jatkuu = false;
      continue;
    }
    for (const [t0, t1] of spans) {
      // Pala jatkuu vain jos edellinen jana päättyi loppuun asti ja tämä alkaa alusta.
      if (!jatkuu || t0 > 0) katkaise();
      lisaa(kohdassa(t0));
      lisaa(kohdassa(t1));
      jatkuu = t1 === 1;
    }
  }
  katkaise();

  /* Yksittäiseksi jäänyt piste on pyyhkimen reunaan jäänyt tähde, ei merkintä:
     se piirtyisi pisteenä keskelle juuri pyyhittyä kohtaa. */
  return palat.filter((pala) => pala.length > 1).map(toFlat);
}

/**
 * Pyyhkii kaiken, mikä jää pyyhkimen kulkeman **janan** ympärille jäävän
 * kapselin sisään. Palauttaa `null` jos mikään ei muuttunut.
 *
 * Yhteen pisteeseen kohdistuva pyyhkiminen jätti nopeasti liikkuvan sormen
 * näytepisteiden väliin aukkoja: veto hajosi paloiksi sen sijaan että olisi
 * kadonnut sormen alta. Polku näytteistetään säteen puolikkaan välein, jolloin
 * aukko ei voi kasvaa sädettä suuremmaksi, ja kukin näyte käsitellään jo
 * testatulla `eraseAt`illa.
 */
export function eraseAlong(
  flat: number[],
  from: Point,
  to: Point,
  radius: number,
): number[][] | null {
  const matka = Math.hypot(to.x - from.x, to.y - from.y);
  const askelia = Math.max(1, Math.ceil(matka / (radius / 2)));

  let palat: number[][] = [flat];
  let muuttui = false;
  for (let i = 0; i <= askelia; i++) {
    const t = askelia === 0 ? 0 : i / askelia;
    const at = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };

    const seuraava: number[][] = [];
    for (const pala of palat) {
      const jaljelle = eraseAt(pala, at, radius);
      /* Arvot vertailtava, ei pelkkää lukumäärää: vedon lyhentäminen päästä
         jättää yhtä monta pistettä, jolloin muutos jäisi huomaamatta. */
      const sama =
        jaljelle.length === 1 &&
        jaljelle[0].length === pala.length &&
        jaljelle[0].every((arvo, i) => arvo === pala[i]);
      if (!sama) muuttui = true;
      seuraava.push(...jaljelle);
    }
    palat = seuraava;
    if (palat.length === 0) return [];
  }
  return muuttui ? palat : null;
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
 * Viivan paksuudet em-yksiköissä. Keskimmäinen on oletus ja vastaa noin kahta
 * pikseliä oletustekstikoolla; kaikki kasvavat tekstin mukana niin kuin muukin
 * lehti. Vedon paksuus tallentuu merkintään, joten koon vaihto ei muuta
 * aiemmin piirrettyjä vetoja.
 */
export const STROKE_WIDTHS = [0.05, 0.1, 0.2];

/** Oletuspaksuus. Erikseen nimettynä, jotta vanhat vedot piirtyvät ennallaan. */
export const STROKE_WIDTH = STROKE_WIDTHS[1];

/**
 * Pyyhkimen säteet samassa yksikössä. Pienin on kirjaimen neljännes tarkkaan
 * siistimiseen, suurin reilusti rivin korkuinen isojen merkintöjen poistoon.
 */
export const ERASER_RADII = [0.25, 0.5, 1.2];

export const ERASER_RADIUS = ERASER_RADII[1];
