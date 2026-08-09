import { useRef } from 'react';
import { barRowOf } from '../lib/bars';
import { useI18n } from '../lib/i18n';
import { barLineText, chordLineText, meterGutter } from '../lib/render';
import { getSections, sectionTitle } from '../lib/sections';
import { toAnchored } from '../lib/annotate';
import type { Point } from '../lib/annotate';
import type { Annotation, Song } from '../lib/types';
import type { DrawTool, ErasePhase } from './Annotations';
import LineAnnotations from './Annotations';

/** Pyyhkäisyn jana yhden rivin koordinaatistossa. */
export interface EraseSegment {
  from: Point;
  to: Point;
}

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
   * Pyyhkiminen. Lehti muuntaa näytön koordinaatit rivin koordinaatistoon;
   * merkintöjen läpikäynti kuuluu sille joka omistaa ne, jotta osumatesti
   * kohdistuu aina tuoreimpaan tilaan eikä kesken pyyhkäisyn vanhentuvaan
   * propsiin.
   */
  onErase?: (phase: ErasePhase, segment: (lineId: string) => EraseSegment | null) => void;
  onPenSeen?: () => void;
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
}: Props) {
  const { t } = useI18n();
  const ref = useRef<HTMLElement>(null);
  const sections = getSections(song);
  const gutter = meterGutter(song.lines);
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
    onErase(phase, (lineId) => {
      const juuri = ref.current;
      if (!juuri || !from || !to) return null;
      const rivi = juuri.querySelector<HTMLElement>(`[data-line="${CSS.escape(lineId)}"]`);
      if (!rivi) return null;

      const box = rivi.getBoundingClientRect();
      const em = parseFloat(getComputedStyle(rivi).fontSize) || 16;
      const laatikko = { left: box.left, top: box.top, em };
      return {
        from: toAnchored(laatikko, from.x, from.y),
        to: toAnchored(laatikko, to.x, to.y),
      };
    });
  }

  return (
    <article ref={ref} className={className ? `song-sheet ${className}` : 'song-sheet'}>
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
            const merkinnat = piirretaan && (
              <LineAnnotations
                lineId={line.id}
                notes={rivinMerkinnat(line.id)}
                tool={tool}
                fontSize={fontSize}
                onDraw={onDraw}
                onErase={pyyhi}
                onPenSeen={onPenSeen}
              />
            );

            if (line.bars) {
              return (
                <div className="sheet-line" data-line={line.id} key={line.id}>
                  {otsikko}
                  <pre className="sheet-bars">
                    {barLineText(line.bars, barRowOf(line).meters, gutter)}
                  </pre>
                  {merkinnat}
                </div>
              );
            }
            const chords = chordLineText(line);
            return (
              <div className="sheet-line" data-line={line.id} key={line.id}>
                {otsikko}
                {/* Tyhjä rivi tarvitsee sisältöä, jottei se romahda korkeudeltaan. */}
                {chords && <pre className="sheet-chords">{chords}</pre>}
                <pre className="sheet-lyric">{line.text || ' '}</pre>
                {merkinnat}
              </div>
            );
          })}
        </section>
      ))}
    </article>
  );
}
