import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  const [symbol, setSymbol] = useState(target.symbol);
  const [pos, setPos] = useState(target.pos);
  const chips = suggestions.length > 0 ? suggestions : DEFAULT_SUGGESTIONS;
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
    setPos((p) => Math.max(0, Math.min(line.text.length, p + step)));
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
        <h2>{target.symbol ? 'Muokkaa sointua' : 'Lisää sointu'}</h2>

        <div className="context" ref={contextRef}>
          <div className="mark">
            {' '.repeat(pos)}
            <span ref={markRef}>{symbol.trim() || '▼'}</span>
          </div>
          <div className="lyric">{line.text || ' '}</div>
        </div>

        <div className="nudge-row">
          <button type="button" onClick={() => nudge(-1)} aria-label="Siirrä merkki vasemmalle">
            ◀
          </button>
          <span className="nudge-info">
            merkki {pos}/{line.text.length}
            <small>nuolinäppäimet siirtävät</small>
          </span>
          <button type="button" onClick={() => nudge(1)} aria-label="Siirrä merkki oikealle">
            ▶
          </button>
        </div>

        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder="esim. Am7, C#/G#, Bb"
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
            Tallenna
          </button>
          {target.symbol && (
            <button type="button" className="danger" onClick={() => onSave('', pos)}>
              Poista
            </button>
          )}
          <button type="button" className="ghost" onClick={onClose}>
            Peruuta
          </button>
        </div>
      </form>
    </div>
  );
}
