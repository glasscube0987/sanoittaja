import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { barRowOf } from '../lib/bars';
import { useI18n } from '../lib/i18n';
import { columnsThatFit, observeWidth } from '../lib/measure';
import { chordLineText, meterGutter, repeatGutter, wrapBarLine } from '../lib/render';
import type { BarSegment } from '../lib/render';
import { getSections, sectionTitle } from '../lib/sections';
import { toAnchored } from '../lib/annotate';
import type { Point } from '../lib/annotate';
import type { Annotation, Song, StrokeAnnotation } from '../lib/types';
import { eraseWrapped, wrapLine } from '../lib/wrap';
import type { Segment, TextSegment } from '../lib/wrap';
import type { DrawTool, ErasePhase, TextTools } from './Annotations';
import LineAnnotations, { taitosMitat } from './Annotations';

/**
 * Pyyhkii yhtä vetoa pyyhkimen tämänhetkisellä liikkeellä. Palauttaa jäljelle
 * jäävät palat, tai `null` jos pyyhin ei osunut.
 */
export type EraseStroke = (note: StrokeAnnotation, radius: number) => number[][] | null;

/** Taittamaton lehti: tuloste, ja live-tila ennen ensimmäistä mittausta. */
const EI_RIVITYSTA = { cols: Infinity, ch: 0 };

interface Props {
  song: Song;
  /** Lisäluokka esitystä varten, esim. live-tila. */
  className?: string;
  /** Rivien päälle piirretyt merkinnät; tyhjä kun niitä ei näytetä. */
  annotations?: Annotation[];
  tool?: DrawTool;
  /** Rivien fonttikoko pikseleinä; merkinnät skaalautuvat sen mukana. */
  fontSize?: number;
  onDraw?: (lineId: string, points: number[], color: string) => void;
  /**
   * Pyyhkiminen. Lehti tietää geometrian – missä rivi on näytöllä ja miten se
   * on taittunut – ja antaa funktion joka pyyhkii yhden vedon. Merkintöjen
   * läpikäynti kuuluu sille joka omistaa ne, jotta osumatesti kohdistuu aina
   * tuoreimpaan tilaan eikä kesken pyyhkäisyn vanhentuvaan propsiin.
   */
  onErase?: (phase: ErasePhase, erase: EraseStroke) => void;
  onPenSeen?: () => void;
  /** Tekstikenttien käsittely; ilman sitä kentät ovat pelkkää tekstiä. */
  text?: TextTools;
  /**
   * Rivittää näytölle mahtumattomat rivit. Vain live-tilassa: rivitys vaatii
   * mittaamista, eikä tulostuslehdeltä voi mitata mitään.
   */
  wrap?: boolean;
}

/**
 * Laulun vain luku -esitys. Näkyy tulostuksessa ja live-tilassa; editorissa se
 * on piilotettu, jotta muokkaus ja esitys eivät kilpaile samasta tilasta.
 *
 * Merkinnät piirretään tähän eikä editoriin: lehti on vakaa ladonta, ja sama
 * esitys menee myös tulosteeseen, joten omat merkinnät tulevat PDF:ään mukaan.
 */
export default function SongSheet({
  song,
  className,
  annotations,
  tool,
  fontSize,
  onDraw,
  onErase,
  onPenSeen,
  text,
  wrap = false,
}: Props) {
  const { t } = useI18n();
  const ref = useRef<HTMLElement>(null);
  const mitta = useRef<HTMLSpanElement>(null);
  const [tila, setTila] = useState(EI_RIVITYSTA);
  const sections = getSections(song);
  const gutter = meterGutter(song.lines);
  const kertaus = repeatGutter(song.lines);

  /*
   * Montako merkkiä lehdelle mahtuu. Mitataan ennen ensimmäistä piirtoa, jottei
   * lehti välähdä taittamattomana, ja uudelleen kun leveys tai tekstikoko
   * muuttuu – näyttö kääntyy kesken laulun.
   *
   * Merkin leveys luetaan piilotetusta kymmenen nollan jonosta samalla fontilla
   * kuin lehti. Sitä ei voi johtaa fonttikoosta: suhde vaihtelee fontin mukaan,
   * ja tasalevyinen fontti on eri laitteilla eri.
   */
  useLayoutEffect(() => {
    const lehti = ref.current;
    if (!wrap || !lehti) {
      setTila(EI_RIVITYSTA);
      return;
    }
    return observeWidth(lehti, () => {
      const chPx = (mitta.current?.getBoundingClientRect().width ?? 0) / 10;
      const emPx = parseFloat(getComputedStyle(lehti).fontSize) || 16;
      const cols = columnsThatFit(lehti.clientWidth, chPx);
      const ch = chPx / emPx;
      setTila((prev) => (prev.cols === cols && prev.ch === ch ? prev : { cols, ch }));
    });
  }, [wrap, fontSize]);

  /* Rivien taitokset. Sama jako ladonnalle ja pyyhkimiselle: jos ne laskisivat
     sen erikseen, pyyhin osuisi eri kohtaan kuin missä veto näkyy. */
  const taitokset = useMemo(() => {
    const tekstit = new Map<string, TextSegment[]>();
    const tahdit = new Map<string, BarSegment[]>();
    for (const line of song.lines) {
      if (line.bars) {
        tahdit.set(
          line.id,
          wrapBarLine(
            line.bars,
            barRowOf(line).meters,
            gutter,
            { marks: line.repeats, gutter: kertaus },
            tila.cols,
          ),
        );
      } else {
        tekstit.set(line.id, wrapLine(line, tila.cols));
      }
    }
    return { tekstit, tahdit };
  }, [song.lines, tila.cols, gutter, kertaus]);
  /* Kerros piirretään aina kun merkintöjä on annettu. Ilman työkalua se on
     pelkkä näyttö – niin merkinnät päätyvät myös tulosteeseen ja PDF:ään. */
  const piirretaan = annotations !== undefined;

  const rivinMerkinnat = (lineId: string) =>
    (annotations ?? []).filter((note) => note.lineId === lineId);

  /**
   * Muuntaa pyyhkäisyn näytön koordinaateista rivin koordinaatistoon.
   *
   * Veto kuuluu siihen riviin jolta se alkoi, mutta se saa ulottua rivin
   * ulkopuolelle – kertosäkeen ympäri piirretty ympyrä näkyy monen rivin
   * päällä. Siksi jokainen merkintä on käsiteltävä **oman rivinsä**
   * koordinaatistossa, ei sen rivin, jonka kerrokseen kosketus osui.
   *
   * Mittaaminen on tässä turvallista: pyyhkiminen tapahtuu aina näytöllä,
   * toisin kuin merkintöjen piirtäminen, jonka on toimittava myös
   * `display: none` -tulostuslehdellä.
   */
  function pyyhi(phase: ErasePhase, from: Point | null, to: Point | null) {
    if (!onErase) return;
    onErase(phase, (note, radius) => {
      const juuri = ref.current;
      if (!juuri || !from || !to) return null;
      const rivi = juuri.querySelector<HTMLElement>(`[data-line="${CSS.escape(note.lineId)}"]`);
      if (!rivi) return null;

      const box = rivi.getBoundingClientRect();
      const em = parseFloat(getComputedStyle(rivi).fontSize) || 16;
      const laatikko = { left: box.left, top: box.top, em };
      /* Taitetulla rivillä veto ei näy siinä kohdassa jossa se on tallessa,
         joten pyyhin viedään vedon luo eikä toisin päin; ks. `eraseWrapped`. */
      const segments = taitokset.tekstit.get(note.lineId) ??
        taitokset.tahdit.get(note.lineId) ?? [{ from: 0, shift: 0 }];
      return eraseWrapped(
        { segments, ch: tila.ch, ...taitosMitat(rivi, em) },
        note.points,
        toAnchored(laatikko, from.x, from.y),
        toAnchored(laatikko, to.x, to.y),
        radius,
      );
    });
  }

  return (
    <article ref={ref} className={className ? `song-sheet ${className}` : 'song-sheet'}>
      {wrap && (
        <span ref={mitta} className="sheet-measure" aria-hidden>
          0000000000
        </span>
      )}
      <header className="sheet-head">
        <h1>{song.title || t('app.untitled')}</h1>
        {(song.songKey || song.meter) && (
          <p className="sheet-key">{[song.songKey, song.meter].filter(Boolean).join(' · ')}</p>
        )}
      </header>

      {sections.map((block) => (
        <section className="sheet-section" key={block.id}>
          {block.lines.map((line, i) => {
            /* Osion otsikko ensimmäisen rivin sisään, jotta rivin merkintäkerros
               kattaa myös sen. Otsikon päällä ei aiemmin ollut kerrosta lainkaan,
               eikä sieltä alkava veto osunut mihinkään – ja juuri sen kohdan yli
               vedetään kun kertosäe ympyröidään. */
            const otsikko = i === 0 && block.mark && <h2>{sectionTitle(block, t)}</h2>;
            const merkinnat = (palat: Segment[]) =>
              piirretaan && (
                <LineAnnotations
                  lineId={line.id}
                  notes={rivinMerkinnat(line.id)}
                  tool={tool}
                  fontSize={fontSize}
                  onDraw={onDraw}
                  onErase={pyyhi}
                  onPenSeen={onPenSeen}
                  text={text}
                  /* Taitto vain kun rivi oikeasti taittui: yhdellä palalla
                     kaikki muunnokset ovat identiteettejä. */
                  wrap={palat.length > 1 ? { segments: palat, ch: tila.ch } : undefined}
                />
              );

            if (line.bars) {
              const palat = taitokset.tahdit.get(line.id) ?? [];
              return (
                <div className="sheet-line" data-line={line.id} key={line.id}>
                  {otsikko}
                  {palat.map((seg) => (
                    <div className="sheet-seg" data-seg key={seg.from}>
                      <pre className="sheet-bars">{seg.text}</pre>
                    </div>
                  ))}
                  {merkinnat(palat)}
                </div>
              );
            }
            const palat = taitokset.tekstit.get(line.id) ?? [];
            return (
              <div className="sheet-line" data-line={line.id} key={line.id}>
                {otsikko}
                {/* Sointurivi vain niille taitoksille joiden yllä on sointuja.
                    Tyhjä sointurivi jokaisella jatkorivillä piti taitokset yhtä
                    korkeina, mutta säe näytti hajoavan erillisiksi pätkiksi –
                    ja puhelimessa pystytila on se mistä on pulaa. */}
                {palat.map((seg) => (
                  <div className="sheet-seg" data-seg key={seg.from}>
                    {seg.chords.length > 0 && (
                      <pre className="sheet-chords">{chordLineText(seg)}</pre>
                    )}
                    {/* Tyhjä rivi tarvitsee sisältöä, jottei se romahda korkeudeltaan. */}
                    <pre className="sheet-lyric">{seg.text || ' '}</pre>
                  </div>
                ))}
                {merkinnat(palat)}
              </div>
            );
          })}
        </section>
      ))}
    </article>
  );
}
