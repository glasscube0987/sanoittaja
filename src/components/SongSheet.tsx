import { useI18n } from '../lib/i18n';
import { barLineText, chordLineText } from '../lib/render';
import { getSections, sectionTitle } from '../lib/sections';
import type { Song } from '../lib/types';

interface Props {
  song: Song;
  /** Lisäluokka esitystä varten, esim. live-tila. */
  className?: string;
}

/**
 * Laulun vain luku -esitys. Näkyy tulostuksessa ja live-tilassa; editorissa se
 * on piilotettu, jotta muokkaus ja esitys eivät kilpaile samasta tilasta.
 */
export default function SongSheet({ song, className }: Props) {
  const { t } = useI18n();
  const sections = getSections(song);

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
            if (line.bars) {
              return (
                <div className="sheet-line" key={line.id}>
                  <pre className="sheet-bars">{barLineText(line.bars, line.meter)}</pre>
                </div>
              );
            }
            const chords = chordLineText(line);
            return (
              <div className="sheet-line" key={line.id}>
                {/* Tyhjä rivi tarvitsee sisältöä, jottei se romahda korkeudeltaan. */}
                {chords && <pre className="sheet-chords">{chords}</pre>}
                <pre className="sheet-lyric">{line.text || ' '}</pre>
              </div>
            );
          })}
        </section>
      ))}
    </article>
  );
}
