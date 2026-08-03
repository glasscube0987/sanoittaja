import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { chordSpan, columnGuide } from '../lib/anchors';
import { useT } from '../lib/i18n';
import type { LyricLine } from '../lib/types';
import type { ChordTarget } from './SongEditor';

interface Props {
  target: ChordTarget;
  line: LyricLine;
  suggestions: string[];
  onSave: (symbol: string, pos: number) => void;
  onClose: () => void;
}

const DEFAULT_SUGGESTIONS = ['C', 'G', 'Am', 'F', 'D', 'Em', 'E', 'A', 'Dm', 'B7'];

export default function ChordSheet({ target, line, suggestions, onSave, onClose }: Props) {
  const t = useT();
  const [symbol, setSymbol] = useState(target.symbol);
  const [pos, setPos] = useState(target.pos);
  const chips = suggestions.length > 0 ? suggestions : DEFAULT_SUGGESTIONS;
  const span = chordSpan(line.text);
  const contextRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLSpanElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  /*
   * Kohdistetaan lomakkeeseen, ei symbolikenttään. Tekstikenttään kohdistaminen
   * avaisi puhelimen näppäimistön ja saisi iOS:n zoomaamaan koko näkymän
   * sisään – eikä iOS palauta zoomia kentästä poistuttaessa, joten näkymä jää
   * suurennetuksi vielä ponnahduksen sulkemisen jälkeen. Nuolinäppäimet
   * toimivat silti, koska käsittelijä on lomakkeella.
   */
  useEffect(() => {
    formRef.current?.focus({ preventScroll: true });
  }, []);

  /*
   * Esikatselu ei mahdu näytölle pitkillä riveillä, joten se vieritetään niin
   * että sointumerkki pysyy näkyvissä myös siirrettäessä.
   */
  useLayoutEffect(() => {
    const box = contextRef.current;
    const mark = markRef.current;
    if (!box || !mark) return;
    const margin = 24;
    const left = mark.offsetLeft;
    const right = left + mark.offsetWidth;
    if (left - margin < box.scrollLeft) {
      box.scrollLeft = Math.max(0, left - margin);
    } else if (right + margin > box.scrollLeft + box.clientWidth) {
      box.scrollLeft = right + margin - box.clientWidth;
    }
  }, [pos, symbol]);

  function nudge(step: number) {
    setPos((p) => Math.max(0, Math.min(span, p + step)));
  }

  /*
   * Nuolinäppäimet siirtävät sointua koko lomakkeen alueella, myös symbolikentän
   * ollessa aktiivinen – siirtäminen on tässä näkymässä tavallisempaa kuin
   * kohdistimen liikuttelu muutaman merkin sointunimessä.
   */
  function handleKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    nudge(e.key === 'ArrowLeft' ? -1 : 1);
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form
        className="sheet"
        ref={formRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        onSubmit={(e) => {
          e.preventDefault();
          onSave(symbol, pos);
        }}
      >
        <h2>{t(target.symbol ? 'chord.edit' : 'chord.add')}</h2>

        <div className="context" ref={contextRef}>
          <div className="mark">
            {' '.repeat(pos)}
            <span ref={markRef}>{symbol.trim() || '▼'}</span>
          </div>
          {/* Sanattomalla rivillä sarakeruudukko näyttää mihin sointu asettuu. */}
          <div className={line.text ? 'lyric' : 'lyric guide'}>{line.text || columnGuide(span)}</div>
        </div>

        <div className="nudge-row">
          <button type="button" onClick={() => nudge(-1)} aria-label={t('chord.moveLeft')}>
            ◀
          </button>
          <span className="nudge-info">
            {t('chord.position', { pos, max: span })}
            <small>{t('chord.arrowHint')}</small>
          </span>
          <button type="button" onClick={() => nudge(1)} aria-label={t('chord.moveRight')}>
            ▶
          </button>
        </div>

        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder={t('chord.placeholder')}
          autoCapitalize="off"
          autoComplete="off"
          spellCheck={false}
        />
        <div className="chip-row">
          {chips.map((chip) => (
            <button type="button" key={chip} onClick={() => onSave(chip, pos)}>
              {chip}
            </button>
          ))}
        </div>
        <div className="button-row">
          <button type="submit" className="primary">
            {t('common.save')}
          </button>
          {target.symbol && (
            <button type="button" className="danger" onClick={() => onSave('', pos)}>
              {t('common.delete')}
            </button>
          )}
          <button type="button" className="ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
        </div>
      </form>
    </div>
  );
}
