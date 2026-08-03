import { useEffect, useRef, useState } from 'react';
import { useT } from '../lib/i18n';

interface Props {
  bars: string[];
  suggestions: string[];
  onSave: (bars: string[]) => void;
  onClose: () => void;
}

const DEFAULT_SUGGESTIONS = ['C', 'G', 'Am', 'F', 'D', 'Em', 'E', 'A', 'Dm', 'B7'];

/**
 * Sointurivin muokkaus: valittu tahti kerrallaan, samalla vuorovaikutuksella
 * kuin sointuponnahduksessa. Tahtiin voi kirjoittaa useamman soinnun ("Am F")
 * tai muun merkinnän ("%"), joten kenttä on vapaata tekstiä.
 */
export default function BarSheet({ bars: initial, suggestions, onSave, onClose }: Props) {
  const t = useT();
  const [bars, setBars] = useState<string[]>(initial.length ? initial : ['']);
  const [index, setIndex] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const chips = suggestions.length > 0 ? suggestions : DEFAULT_SUGGESTIONS;

  /* Kohdistus lomakkeeseen eikä kenttään: kenttä avaisi näppäimistön ja
     laukaisisi iOS:n zoomin, joka jää päälle ponnahduksen sulkeuduttua. */
  useEffect(() => {
    formRef.current?.focus({ preventScroll: true });
  }, []);

  function setBar(value: string) {
    setBars((prev) => prev.map((bar, i) => (i === index ? value : bar)));
  }

  function move(step: number) {
    setIndex((i) => Math.max(0, Math.min(bars.length - 1, i + step)));
  }

  function addBar() {
    setBars((prev) => [...prev.slice(0, index + 1), '', ...prev.slice(index + 1)]);
    setIndex((i) => i + 1);
  }

  function removeBar() {
    if (bars.length <= 1) return;
    setBars((prev) => prev.filter((_, i) => i !== index));
    setIndex((i) => Math.max(0, Math.min(bars.length - 2, i)));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    move(e.key === 'ArrowLeft' ? -1 : 1);
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
          onSave(bars);
        }}
      >
        <h2>{t('bars.title')}</h2>

        <div className="context bar-preview">
          {bars.map((bar, i) => (
            <span key={i} className={i === index ? 'bar current' : 'bar'}>
              {`| ${bar.trim() || ' '} `}
            </span>
          ))}
          <span className="bar">|</span>
        </div>

        <div className="nudge-row">
          <button type="button" onClick={() => move(-1)} aria-label={t('chord.moveLeft')}>
            ◀
          </button>
          <span className="nudge-info">
            {t('bars.position', { index: index + 1, count: bars.length })}
            <small>{t('bars.hint')}</small>
          </span>
          <button type="button" onClick={() => move(1)} aria-label={t('chord.moveRight')}>
            ▶
          </button>
        </div>

        <input
          value={bars[index] ?? ''}
          onChange={(e) => setBar(e.target.value)}
          placeholder={t('bars.placeholder')}
          autoCapitalize="off"
          autoComplete="off"
          spellCheck={false}
        />

        <div className="chip-row">
          {chips.map((chip) => (
            <button type="button" key={chip} onClick={() => setBar(chip)}>
              {chip}
            </button>
          ))}
        </div>

        <div className="button-row">
          <button type="button" onClick={addBar}>
            {t('bars.add')}
          </button>
          <button type="button" onClick={removeBar} disabled={bars.length <= 1}>
            {t('bars.remove')}
          </button>
        </div>

        <div className="button-row">
          <button type="submit" className="primary">
            {t('common.save')}
          </button>
          <button type="button" className="ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
        </div>
      </form>
    </div>
  );
}
