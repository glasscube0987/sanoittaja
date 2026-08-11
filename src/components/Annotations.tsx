import { useEffect, useRef, useState } from 'react';
import { useT } from '../lib/i18n';
import type { Point } from '../lib/annotate';
import { DRAG_SLOP, pathData, simplify, STROKE_WIDTHS, toAnchored, toFlat } from '../lib/annotate';
import type { Annotation, TextAnnotation } from '../lib/types';
import { isStroke, isText } from '../lib/types';

export type ErasePhase = 'start' | 'move' | 'end';

/** Mitä lehden kosketus tekee. Yksi tila kerrallaan, ei päällekkäisiä lippuja. */
export type DrawMode = 'pen' | 'eraser' | 'text';

export interface DrawTool {
  /** Piirtotila päällä; pois päältä kerros ei ota vastaan kosketuksia. */
  active: boolean;
  mode: DrawMode;
  color: string;
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
  /** Seuraavan tekstikentän asu; jo kirjoitetut kantavat omansa mukanaan. */
  textSize: number;
  textFont: TextAnnotation['font'];
  textBold: boolean;
  textItalic: boolean;
  textBoxed: boolean;
}

/**
 * Tekstikenttien käsittely. Kerros kertoo mitä sormi teki; kentät omistaa ja
 * tallentaa se näkymä, jolla ne ovat – samasta syystä kuin pyyhkiminenkin.
 */
export interface TextTools {
  /** Kenttä, jota parhaillaan kirjoitetaan; muut ovat pelkkää tekstiä. */
  editingId: string | null;
  create: (lineId: string, at: Point) => void;
  edit: (id: string) => void;
  /** Siirto vedon aikana: näyttöä varten, ei vielä kantaan. */
  move: (id: string, at: Point) => void;
  moveEnd: (id: string) => void;
  change: (id: string, text: string) => void;
  /** Kirjoitus päättyi: tyhjä kenttä katoaa, muuten se tallennetaan. */
  commit: (id: string) => void;
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
  text?: TextTools;
}

/** Katselutila: ei piirtoa, ei kosketuksia. */
const KATSELU: DrawTool = {
  active: false,
  mode: 'pen',
  color: '',
  penSeen: false,
  fingerDraws: false,
  strokeSize: 1,
  eraserSize: 1,
  textSize: 1,
  textFont: 'sans',
  textBold: false,
  textItalic: false,
  textBoxed: false,
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
 *
 * Tekstikentät ovat omana HTML-kerroksenaan SVG:n alla. Ne asemoidaan
 * `em`-yksiköin suoraan tyylissä, jolloin selain latoo ne ilman että mitään
 * mitataan – sama syy kuin yllä: tuloste on `display: none` eikä siellä voi
 * mitata mitään.
 */
export default function LineAnnotations({
  lineId,
  notes,
  tool = KATSELU,
  fontSize,
  onDraw,
  onErase,
  onPenSeen,
  text,
}: Props) {
  const t = useT();
  const ref = useRef<SVGSVGElement>(null);
  const [em, setEm] = useState(16);
  const [kesken, setKesken] = useState<Point[] | null>(null);
  /* Edellinen pyyhkäisykohta näytön koordinaateissa, jotta liike välitetään
     janana eikä irrallisina pisteinä. */
  const edellinen = useRef<Point | null>(null);
  /* Kesken oleva tekstikentän veto: mitä tartuttiin, mistä kohtaa laatikkoa ja
     onko sormi jo liikkunut tarpeeksi jotta napautus muuttuu siirroksi. */
  const veto = useRef<{
    id: string;
    /** Tarttumakohta laatikon vasemmasta yläkulmasta, jottei laatikko hyppää. */
    dx: number;
    dy: number;
    alku: Point;
    siirretty: boolean;
  } | null>(null);
  /* Kenttä, johon kohdistus on jo annettu. Ilman muistia kohdistus siirtyisi
     takaisin kentän alkuun joka renderillä, eli jokaisen kirjoitetun merkin
     jälkeen. */
  const kohdistettu = useRef<string | null>(null);

  const vedot = notes.filter(isStroke);
  const tekstit = notes.filter(isText);
  const tekstitila = tool.active && tool.mode === 'text';

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

  /**
   * Tekstitilassa kämmentuki ei ole voimassa.
   *
   * Kämmentuki on piirtämisen sääntö: lappuun nojaava käsi vetäisi viivan yli
   * koko lehden. Napautukseen se ei päde – vahingossa syntynyt kenttä on tyhjä
   * ja katoaa itsestään. Sääntö oli kuitenkin yhteinen, joten kynälaitteella
   * sormi ei tehnyt tekstitilassa yhtään mitään: kenttää joutui napauttamaan
   * uudelleen ja uudelleen, eikä siirto tarttunut kuin kynällä.
   */
  function koskettaako(): boolean {
    return tool.active;
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
    if (tool.mode === 'eraser') {
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
    if (tool.mode === 'eraser') {
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

  /* --- Tekstikerros --- */

  /**
   * Kenttä syntyy jo sormen laskusta, ei nostosta.
   *
   * Kaksi syytä. Napautus tuntuu välittömältä, ja mikä tärkeämpää: iOS avaa
   * näppäimistön vain kun kohdistus tapahtuu käyttäjän eleen aikana. Mitä
   * aikaisemmin eleessä kenttä on olemassa, sitä varmemmin kohdistus osuu vielä
   * eleen sisään.
   *
   * Kesken ollut kirjoitus päätetään tässä eikä jätetä kohdistuksen katoamisen
   * varaan, jotta järjestys on sama joka kerta. Aiemmin napautus lehdelle vain
   * lopetti kirjoituksen, ja uusi kenttä vaati toisen napautuksen.
   */
  function tekstiDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'pen') onPenSeen?.();
    if (!koskettaako() || !text) return;
    if (text.editingId) text.commit(text.editingId);
    text.create(lineId, piste(e));
  }

  function laatikkoDown(e: React.PointerEvent<HTMLDivElement>, note: TextAnnotation) {
    if (!koskettaako() || !text) return;
    // Kenttä käsittelee kosketuksen itse; muuten kerros loisi samalla uuden.
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const at = piste(e);
    veto.current = { id: note.id, dx: at.x - note.x, dy: at.y - note.y, alku: at, siirretty: false };
  }

  function laatikkoMove(e: React.PointerEvent<HTMLDivElement>) {
    const vedossa = veto.current;
    if (!vedossa || !text) return;
    const at = piste(e);
    /* Napautus muuttuu siirroksi vasta kynnyksen jälkeen: sormi liikkuu aina
       vähän, eikä kenttä saa karata sen takia että sitä napautettiin. */
    if (!vedossa.siirretty && Math.hypot(at.x - vedossa.alku.x, at.y - vedossa.alku.y) < DRAG_SLOP) {
      return;
    }
    vedossa.siirretty = true;
    text.move(vedossa.id, { x: at.x - vedossa.dx, y: at.y - vedossa.dy });
  }

  /** Kosketus ei jatka kerrokselle. */
  function pysayta(e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation();
  }

  /**
   * Kohdistaa juuri syntyneen kentän – kerran, ei joka renderillä.
   *
   * `autoFocus` tekee saman mutta ei kerro milloin, ja iOS avaa näppäimistön
   * vain jos kohdistus tapahtuu käyttäjän eleen aikana. Tämä ajetaan Reactin
   * commit-vaiheessa eli synkronisesti sen tapahtuman sisällä joka kentän loi.
   */
  function kohdista(el: HTMLTextAreaElement | null, id: string) {
    if (!el) {
      kohdistettu.current = null;
      return;
    }
    if (kohdistettu.current === id) return;
    kohdistettu.current = id;
    el.focus();
  }

  function laatikkoUp(e: React.PointerEvent<HTMLDivElement>, note: TextAnnotation) {
    const vedossa = veto.current;
    veto.current = null;
    if (!vedossa || !text) return;
    e.stopPropagation();
    if (vedossa.siirretty) {
      text.moveEnd(note.id);
      return;
    }
    /* Napautus kentän päällä: kesken ollut kirjoitus tallennetaan ensin, jottei
       kaksi kenttää ole auki yhtä aikaa. */
    if (text.editingId && text.editingId !== note.id) text.commit(text.editingId);
    text.edit(note.id);
  }

  return (
    <>
      <div
        className={tekstitila ? 'annot-texts active' : 'annot-texts'}
        onPointerDown={tekstitila ? tekstiDown : undefined}
      >
        {tekstit.map((note) => {
          const muokataan = text?.editingId === note.id;
          const asu = {
            fontSize: `${note.size}em`,
            color: note.color,
            fontWeight: note.bold ? 700 : 400,
            fontStyle: note.italic ? 'italic' : 'normal',
          } as const;
          return (
            <div
              key={note.id}
              className={muokataan ? 'annot-text editing' : 'annot-text'}
              data-text={note.id}
              style={{ left: `${note.x}em`, top: `${note.y}em` }}
              /* Kirjoitettavana olevan kentän kosketukset kuuluvat kentälle:
                 ilman pysäytystä kerros näki ne lopetuksena, eikä kohdistinta
                 voinut siirtää sanan keskelle koskettamatta samalla «valmis». */
              onPointerDown={
                muokataan ? pysayta : tekstitila ? (e) => laatikkoDown(e, note) : undefined
              }
              onPointerMove={tekstitila && !muokataan ? laatikkoMove : undefined}
              onPointerUp={
                muokataan ? pysayta : tekstitila ? (e) => laatikkoUp(e, note) : undefined
              }
            >
              {muokataan && text ? (
                <textarea
                  className={note.boxed ? 'annot-text-body boxed' : 'annot-text-body'}
                  data-font={note.font}
                  style={asu}
                  value={note.text}
                  rows={note.text.split('\n').length}
                  cols={leveys(note.text)}
                  ref={(el) => kohdista(el, note.id)}
                  spellCheck={false}
                  placeholder={t('text.placeholder')}
                  aria-label={t('text.placeholder')}
                  onChange={(e) => text.change(note.id, e.target.value)}
                  onBlur={() => text.commit(note.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') text.commit(note.id);
                  }}
                />
              ) : (
                <span
                  className={note.boxed ? 'annot-text-body boxed' : 'annot-text-body'}
                  data-font={note.font}
                  style={asu}
                >
                  {note.text}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <svg
        ref={ref}
        className={tool.active && tool.mode !== 'text' ? 'annot active' : 'annot'}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-hidden
      >
        {vedot.map((note) => (
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
    </>
  );
}

/**
 * Kirjoituskentän leveys merkkeinä. Arvio riittää: kenttä saa olla tekstiä
 * leveämpi, kunhan se ei ole kapeampi – kapea kenttä rivittäisi kesken sanan ja
 * teksti hyppisi kirjoittaessa.
 */
function leveys(text: string): number {
  const pisin = text.split('\n').reduce((max, rivi) => Math.max(max, rivi.length), 0);
  return Math.max(6, pisin + 2);
}
