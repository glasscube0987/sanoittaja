import { useRef, useState } from 'react';
import { engagesHorizontally, OPEN_PX, swipeOffset, swipeOutcome } from '../lib/swipe';

interface Props {
  children: React.ReactNode;
  /** Painikkeen näkyvä teksti ja saavutettava nimi. */
  actionLabel: string;
  actionName: string;
  onAction: () => void;
  /** Avattuna vain yksi rivi kerrallaan; lista omistaa tiedon. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Rivi, joka paljastaa toimintopainikkeen vasemmalle liu'uttamalla.
 *
 * Pieni ✕ rivin reunassa oli puhelimella liian helppo osua vahingossa, ja
 * poisto ilman varmistusta on huono yhdistelmä. Liu'utus on tarkoituksellinen
 * tavalla jota napautus ei ole, ja se on iOS:llä ennestään tuttu ele.
 *
 * Kynnykset ovat `lib/swipe.ts`:ssä ja testattu ilman selainta; täällä on vain
 * eleen kytkentä.
 */
export default function SwipeRow({
  children,
  actionLabel,
  actionName,
  onAction,
  open,
  onOpenChange,
}: Props) {
  const alku = useRef<{ x: number; y: number } | null>(null);
  const tarttui = useRef(false);
  /* Liu'utuksen jälkeen tuleva napautus estetään, ettei laulu aukea vedosta. */
  const vedettiin = useRef(false);
  const [dx, setDx] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  function onPointerDown(e: React.PointerEvent) {
    // Painikkeen napautus ei ole liu'utuksen alku.
    if ((e.target as HTMLElement).closest('.swipe-action')) return;
    alku.current = { x: e.clientX, y: e.clientY };
    tarttui.current = false;
    vedettiin.current = false;
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!alku.current) return;
    const ero = { x: e.clientX - alku.current.x, y: e.clientY - alku.current.y };

    if (!tarttui.current) {
      if (!engagesHorizontally(ero.x, ero.y)) return;
      tarttui.current = true;
      vedettiin.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    setDx(ero.x);
  }

  function onPointerUp() {
    if (!alku.current) return;
    const liike = dx ?? 0;
    alku.current = null;

    if (!tarttui.current) {
      setDx(null);
      return;
    }
    tarttui.current = false;

    const leveys = ref.current?.getBoundingClientRect().width ?? 0;
    const tulos = swipeOutcome(swipeOffset(liike, open), leveys);
    setDx(null);

    if (tulos === 'remove') {
      onOpenChange(false);
      onAction();
      return;
    }
    onOpenChange(tulos === 'open');
  }

  const siirtyma = dx === null ? (open ? -OPEN_PX : 0) : swipeOffset(dx, open);

  return (
    <div className={open ? 'swipe-row open' : 'swipe-row'} ref={ref}>
      <div className="swipe-action">
        <button
          className="danger"
          aria-label={actionName}
          onClick={() => {
            onOpenChange(false);
            onAction();
          }}
        >
          {actionLabel}
        </button>
      </div>
      <div
        className={dx === null ? 'swipe-content' : 'swipe-content dragging'}
        style={{ transform: `translateX(${siirtyma}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        /* Liu'utuksen jälkeinen napautus ei saa avata laulua. Klikki tulee
           vasta pointerupin jälkeen, joten lippu on vielä voimassa. */
        onClickCapture={(e) => {
          if (vedettiin.current || open) {
            e.preventDefault();
            e.stopPropagation();
            vedettiin.current = false;
            if (open) onOpenChange(false);
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
