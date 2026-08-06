import { barRowOf } from '../lib/bars';
import { useI18n } from '../lib/i18n';
import { barLineText, chordLineText, meterGutter } from '../lib/render';
import { getSections, sectionTitle } from '../lib/sections';
import type { Annotation, Song } from '../lib/types';
import type { DrawTool } from './Annotations';
import LineAnnotations from './Annotations';

interface Props {
  song: Song;
  /** Lisäluokka esitystä varten, esim. live-tila. */
  className?: string;
  /** Rivien päälle piirretyt merkinnät; tyhjä kun niitä ei näytetä. */
  annotations?: Annotation[];
  tool?: DrawTool;
  onDraw?: (lineId: string, points: number[], color: string) => void;
  onErase?: (id: string) => void;
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
  onDraw,
  onErase,
  onPenSeen,
}: Props) {
  const { t } = useI18n();
  const sections = getSections(song);
  const gutter = meterGutter(song.lines);
  /* Kerros piirretään aina kun merkintöjä on annettu. Ilman työkalua se on
     pelkkä näyttö – niin merkinnät päätyvät myös tulosteeseen ja PDF:ään. */
  const piirretaan = annotations !== undefined;

  const rivinMerkinnat = (lineId: string) =>
    (annotations ?? []).filter((note) => note.lineId === lineId);

  return (
    <article className={className ? `song-sheet ${className}` : 'song-sheet'}>
      <header className="sheet-head">
        <h1>{song.title || t('app.untitled')}</h1>
        {(song.songKey || song.meter) && (
          <p className="sheet-key">{[song.songKey, song.meter].filter(Boolean).join(' · ')}</p>
        )}
      </header>

      {sections.map((block) => (
        <section className="sheet-section" key={block.id}>
          {block.mark && <h2>{sectionTitle(block, t)}</h2>}
          {block.lines.map((line) => {
            const merkinnat = piirretaan && (
              <LineAnnotations
                lineId={line.id}
                notes={rivinMerkinnat(line.id)}
                tool={tool}
                onDraw={onDraw}
                onErase={onErase}
                onPenSeen={onPenSeen}
              />
            );

            if (line.bars) {
              return (
                <div className="sheet-line" key={line.id}>
                  <pre className="sheet-bars">
                    {barLineText(line.bars, barRowOf(line).meters, gutter)}
                  </pre>
                  {merkinnat}
                </div>
              );
            }
            const chords = chordLineText(line);
            return (
              <div className="sheet-line" key={line.id}>
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
