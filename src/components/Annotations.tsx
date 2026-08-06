import { useRef, useState } from 'react';
import type { Point } from '../lib/annotate';
import {
  COLORS,
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
  /** Piirtääkö sormi. Kynän kanssa sormi jätetään vierittämiselle. */
  fingerDraws: boolean;
}

interface Props {
  lineId: string;
  notes: Annotation[];
  /** Piirtotyökalu; ilman sitä kerros vain näyttää merkinnät (tuloste). */
  tool?: DrawTool;
  onDraw?: (lineId: string, points: number[], color: string) => void;
  onErase?: (id: string) => void;
  /** Kynän havaitseminen: sen jälkeen sormi vierittää eikä piirrä. */
  onPenSeen?: () => void;
}

/** Katselutila: ei piirtoa, ei kosketuksia. */
const KATSELU: DrawTool = { active: false, color: COLORS[0], eraser: false, fingerDraws: false };

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
 * **Skaalaus tehdään viewBoxilla eikä mittaamalla.** Aiemmin polut piirrettiin
 * pikseleinä ResizeObserverin antamasta leveydestä, mutta editorin tulostuslehti
 * on `display: none` kunnes selain siirtyy tulostustilaan – silloin leveys on 0,
 * ja tuloste sai merkinnät nollan mittaisina viivoina (`0 0 m 0 0 l`) origoon.
 * Mittausta ei ehdi tapahtua ennen tulostuksen kuvantamista.
 *
 * Koska x ja y on molemmat suhteutettu rivin leveyteen, muoto skaalautuu
 * tasaisesti: `viewBox="0 0 1 1"` ja `preserveAspectRatio="xMinYMin slice"`
 * antavat mittakaavaksi `max(leveys, korkeus)` = rivin leveys, ilman JavaScriptiä.
 * Tämä nojaa siihen että rivi on leveämpi kuin korkea – sanoitusrivi on
 * tasalevyistä tekstiä eikä rivity, joten se pitää paikkansa.
 */
export default function LineAnnotations({
  lineId,
  notes,
  tool = KATSELU,
  onDraw,
  onErase,
  onPenSeen,
}: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const [kesken, setKesken] = useState<Point[] | null>(null);

  function piirtaako(e: React.PointerEvent): boolean {
    if (!tool.active) return false;
    if (e.pointerType === 'pen') return true;
    if (e.pointerType === 'touch') return tool.fingerDraws;
    return true; // hiiri
  }

  function piste(e: { clientX: number; clientY: number }): Point {
    const box = ref.current!.getBoundingClientRect();
    return toAnchored({ left: box.left, top: box.top, width: box.width }, e.clientX, e.clientY);
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
      viewBox="0 0 1 1"
      preserveAspectRatio="xMinYMin slice"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      aria-hidden
    >
      {notes.map((note) => (
        <path
          key={note.id}
          d={pathData(note.points, 1)}
          stroke={note.color}
          strokeWidth={note.width}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {kesken && (
        <path
          d={pathData(toFlat(kesken), 1)}
          stroke={tool.color}
          strokeWidth={STROKE_WIDTH}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
