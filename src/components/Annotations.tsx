import { useEffect, useRef, useState } from 'react';
import type { Point } from '../lib/annotate';
import {
  ERASER_RADIUS,
  hitsStroke,
  pathData,
  simplify,
  STROKE_WIDTH,
  toAnchored,
  toFlat,
} from '../lib/annotate';
import type { Annotation } from '../lib/types';

export interface DrawTool {
  /** Piirtotila päällä; pois päältä kerros ei ota vastaan kosketuksia. */
  active: boolean;
  color: string;
  eraser: boolean;
  /**
   * Onko kynää käytetty tällä laitteella. Sen jälkeen sormi ei enää piirrä,
   * jolloin kämmen ei sotke lappua. Tämä ei ole käyttäjän valinta vaan havainto.
   */
  penSeen: boolean;
}

interface Props {
  lineId: string;
  notes: Annotation[];
  /** Piirtotyökalu; ilman sitä kerros vain näyttää merkinnät (tuloste). */
  tool?: DrawTool;
  /** Rivin fonttikoko pikseleinä. Muuttuu kun live-tilassa zoomataan. */
  fontSize?: number;
  onDraw?: (lineId: string, points: number[], color: string) => void;
  onErase?: (id: string) => void;
  /** Kynän havaitseminen: sen jälkeen sormi ei piirrä. */
  onPenSeen?: () => void;
}

/** Katselutila: ei piirtoa, ei kosketuksia. */
const KATSELU: DrawTool = { active: false, color: '', eraser: false, penSeen: false };

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
    // Kynän jälkeen sormi ja kämmen jätetään rauhaan.
    if (e.pointerType === 'touch') return !tool.penSeen;
    return true; // hiiri
  }

  function piste(e: { clientX: number; clientY: number }): Point {
    const box = ref.current!.getBoundingClientRect();
    return toAnchored({ left: box.left, top: box.top, em }, e.clientX, e.clientY);
  }

  function pyyhi(at: Point) {
    for (const note of notes) {
      if (hitsStroke(note.points, at, ERASER_RADIUS)) onErase?.(note.id);
    }
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (e.pointerType === 'pen') onPenSeen?.();
    if (!piirtaako(e)) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const at = piste(e);
    if (tool.eraser) {
      pyyhi(at);
      setKesken(null);
      return;
    }
    setKesken([at]);
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!piirtaako(e)) return;
    const at = piste(e);
    if (tool.eraser) {
      if (e.buttons !== 0 || kesken) pyyhi(at);
      return;
    }
    if (!kesken) return;
    e.preventDefault();
    /* Kynän väliinjääneet pisteet mukaan: ilman niitä nopea veto on rosoinen. */
    const coalesced = e.nativeEvent.getCoalescedEvents?.() ?? [];
    const lisatyt = coalesced.length > 0 ? coalesced.map(piste) : [at];
    setKesken((prev) => (prev ? [...prev, ...lisatyt] : prev));
  }

  function onPointerUp() {
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
          strokeWidth={Math.max(1, STROKE_WIDTH * em)}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
