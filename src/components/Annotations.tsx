import { useEffect, useRef, useState } from 'react';
import type { Point } from '../lib/annotate';
import { pathData, simplify, STROKE_WIDTHS, toAnchored, toFlat } from '../lib/annotate';
import type { Annotation } from '../lib/types';

export type ErasePhase = 'start' | 'move' | 'end';

export interface DrawTool {
  /** Piirtotila päällä; pois päältä kerros ei ota vastaan kosketuksia. */
  active: boolean;
  color: string;
  eraser: boolean;
  /**
   * Onko kynää käytetty tällä laitteella. Havainto eikä valinta: sen jälkeen
   * kosketus ei piirrä, jolloin kämmen ei sotke lappua.
   */
  penSeen: boolean;
  /**
   * Sallitaanko sormipiirto kynälaitteella. Kytkin näkyy vasta kun kynä on
   * havaittu; puhelimessa sormi piirtää ilman mitään valintaa.
   */
  fingerDraws: boolean;
  /** Kynän ja pyyhkimen kokovalinnat indeksinä; ks. `STROKE_WIDTHS`. */
  strokeSize: number;
  eraserSize: number;
}

interface Props {
  lineId: string;
  notes: Annotation[];
  /** Piirtotyökalu; ilman sitä kerros vain näyttää merkinnät (tuloste). */
  tool?: DrawTool;
  /** Rivin fonttikoko pikseleinä. Muuttuu kun live-tilassa zoomataan. */
  fontSize?: number;
  onDraw?: (lineId: string, points: number[], color: string) => void;
  /**
   * Pyyhkiminen näytön koordinaateilla, ei rivin omilla, ja **janoina**.
   *
   * Veto kuuluu siihen riviin jolta se alkoi, mutta se saa ulottua rivin
   * ulkopuolelle, joten osumatesti kuuluu lehden tasolle jossa kaikki
   * merkinnät ovat tiedossa. Jana eikä piste, koska nopean sormen
   * näytepisteiden väliin jäisi muuten aukkoja.
   *
   * Vaihe kertoo milloin pyyhkäisy alkaa ja loppuu, jotta kantaan kirjoitetaan
   * kerran eikä jokaisesta osoitintapahtumasta.
   */
  onErase?: (phase: ErasePhase, from: Point | null, to: Point | null) => void;
  /** Kynän havaitseminen: sen jälkeen sormi ei piirrä. */
  onPenSeen?: () => void;
}

/** Katselutila: ei piirtoa, ei kosketuksia. */
const KATSELU: DrawTool = {
  active: false,
  color: '',
  eraser: false,
  penSeen: false,
  fingerDraws: false,
  strokeSize: 1,
  eraserSize: 1,
};

/**
 * Yhden rivin merkinnät ja piirtoalusta.
 *
 * SVG on rivin sisällä, joten sijainti tulee selaimelta eikä sitä tarvitse
 * laskea: rivin siirtyessä merkinnät siirtyvät mukana itsestään. `overflow:
 * visible` sallii vedon ulottua rivin ulkopuolelle, jolloin kertosäkeen
 * ympärille piirretty ympyrä pysyy yhtenä vetona.
 *
 * Osoittimen kaappaus (`setPointerCapture`) pitää kesken olevan vedon tällä
 * rivillä, vaikka sormi liikkuisi toisen rivin päälle – muuten veto katkeaisi
 * rivin reunaan.
 *
 * **Mittakaava on rivin fonttikoko**, ja se luetaan `getComputedStyle`stä.
 * Laskettu fonttikoko on saatavilla ilman ladontaa, joten se toimii myös
 * editorin `display: none` -tulostuslehdellä – juuri se seikka, jonka takia
 * kerros aiemmin skaalattiin mitatulla leveydellä.
 */
export default function LineAnnotations({
  lineId,
  notes,
  tool = KATSELU,
  fontSize,
  onDraw,
  onErase,
  onPenSeen,
}: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const [em, setEm] = useState(16);
  const [kesken, setKesken] = useState<Point[] | null>(null);
  /* Edellinen pyyhkäisykohta näytön koordinaateissa, jotta liike välitetään
     janana eikä irrallisina pisteinä. */
  const edellinen = useRef<Point | null>(null);

  /* Fonttikoko luetaan uudelleen kun live-tilan tekstikoko muuttuu. */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const koko = parseFloat(getComputedStyle(el).fontSize);
    if (koko > 0) setEm(koko);
  }, [fontSize]);

  function piirtaako(e: React.PointerEvent): boolean {
    if (!tool.active) return false;
    if (e.pointerType === 'pen') return true;
    // Kynän jälkeen kosketus on kämmen, ellei sormipiirto ole erikseen päällä.
    if (e.pointerType === 'touch') return !tool.penSeen || tool.fingerDraws;
    return true; // hiiri
  }

  function piste(e: { clientX: number; clientY: number }): Point {
    const box = ref.current!.getBoundingClientRect();
    return toAnchored({ left: box.left, top: box.top, em }, e.clientX, e.clientY);
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (e.pointerType === 'pen') onPenSeen?.();
    if (!piirtaako(e)) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    if (tool.eraser) {
      const at = { x: e.clientX, y: e.clientY };
      edellinen.current = at;
      // Napautus pyyhkii paikallaan; jana alkaa ja päättyy samaan pisteeseen.
      onErase?.('start', at, at);
      setKesken(null);
      return;
    }
    setKesken([piste(e)]);
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!piirtaako(e)) return;
    if (tool.eraser) {
      if (e.buttons === 0 || !edellinen.current) return;
      /* Väliinjääneet pisteet mukaan myös pyyhkiessä: nopea liike tuottaa
         harvoja pointermove-tapahtumia mutta tiheät coalesced-pisteet. */
      const coalesced = e.nativeEvent.getCoalescedEvents?.() ?? [];
      const kohdat = coalesced.length > 0 ? coalesced : [e.nativeEvent];
      for (const kohta of kohdat) {
        const at = { x: kohta.clientX, y: kohta.clientY };
        onErase?.('move', edellinen.current, at);
        edellinen.current = at;
      }
      return;
    }
    if (!kesken) return;
    const at = piste(e);
    e.preventDefault();
    /* Kynän väliinjääneet pisteet mukaan: ilman niitä nopea veto on rosoinen. */
    const coalesced = e.nativeEvent.getCoalescedEvents?.() ?? [];
    const lisatyt = coalesced.length > 0 ? coalesced.map(piste) : [at];
    setKesken((prev) => (prev ? [...prev, ...lisatyt] : prev));
  }

  function onPointerUp() {
    if (edellinen.current) {
      edellinen.current = null;
      onErase?.('end', null, null);
    }
    if (kesken && kesken.length > 0) {
      onDraw?.(lineId, simplify(toFlat(kesken)), tool.color);
    }
    setKesken(null);
  }

  return (
    <svg
      ref={ref}
      className={tool.active ? 'annot active' : 'annot'}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      aria-hidden
    >
      {notes.map((note) => (
        <path
          key={note.id}
          d={pathData(note.points, em)}
          stroke={note.color}
          strokeWidth={Math.max(1, note.width * em)}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {kesken && (
        <path
          d={pathData(toFlat(kesken), em)}
          stroke={tool.color}
          strokeWidth={Math.max(1, STROKE_WIDTHS[tool.strokeSize] * em)}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
