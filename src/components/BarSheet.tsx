import { useEffect, useRef, useState } from 'react';
import { useT } from '../lib/i18n';
import Icon from './Icon';

interface Props {
  bars: string[];
  /** Rivin oma tahtilaji, jos se poikkeaa laulun tahtilajista. */
  meter?: string;
  suggestions: string[];
  onSave: (bars: string[], meter: string) => void;
  onClose: () => void;
}

const DEFAULT_SUGGESTIONS = ['C', 'G', 'Am', 'F', 'D', 'Em', 'E', 'A', 'Dm', 'B7'];

/** Tavallisimmat tahtilajit; kenttään voi kirjoittaa minkä tahansa muun. */
const METERS = ['4/4', '3/4', '6/8', '2/4', '12/8'];

/**
 * Sointurivin muokkaus: valittu tahti kerrallaan, samalla vuorovaikutuksella
 * kuin sointuponnahduksessa. Tahtiin voi kirjoittaa useamman soinnun ("Am F")
 * tai muun merkinnän ("%"), joten kenttä on vapaata tekstiä.
 */
export default function BarSheet({ bars: initial, meter: initialMeter, suggestions, onSave, onClose }: Props) {
  const t = useT();
  const [bars, setBars] = useState<string[]>(initial.length ? initial : ['']);
  const [meter, setMeter] = useState(initialMeter ?? '');
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

  /**
   * Lisää soinnun tahtiin sen sijaan että korvaisi sen.
   *
   * Tahtiin mahtuu useampi sointu, ja toisen lisääminen on tavallisempaa kuin
   * ensimmäisen vaihtaminen. Korvaaminen onnistuu tyhjentämällä kenttä, joka on
   * samassa näkymässä.
   */
  function addChord(chip: string) {
    const nykyinen = (bars[index] ?? '').trim();
    setBar(nykyinen ? `${nykyinen} ${chip}` : chip);
  }

  /** Tahtiviiva sointujen väliin: `Am F` → `| Am | F |`. */
  function splitBar() {
    const osat = (bars[index] ?? '').trim().split(/\s+/).filter(Boolean);
    if (osat.length < 2) return;
    setBars((prev) => [...prev.slice(0, index), ...osat, ...prev.slice(index + 1)]);
    setIndex((i) => i + osat.length - 1);
  }

  const voiJakaa = (bars[index] ?? '').trim().split(/\s+/).filter(Boolean).length > 1;

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
          onSave(bars, meter);
        }}
      >
        <h2>{t('bars.title')}</h2>

        <div className="context bar-preview">
          {meter.trim() && <span className="bar meter">{`${meter.trim()} `}</span>}
          {bars.map((bar, i) => (
            <span key={i} className={i === index ? 'bar current' : 'bar'}>
              {`| ${bar.trim() || ' '} `}
            </span>
          ))}
          <span className="bar">|</span>
        </div>

        <div className="nudge-row">
          <button type="button" onClick={() => move(-1)} aria-label={t('chord.moveLeft')}>
            <Icon name="chevronLeft" size={20} />
          </button>
          <span className="nudge-info">
            {t('bars.position', { index: index + 1, count: bars.length })}
            <small>{t('bars.hint')}</small>
          </span>
          <button type="button" onClick={() => move(1)} aria-label={t('chord.moveRight')}>
            <Icon name="chevronRight" size={20} />
          </button>
        </div>

        <input
          id="bar-content"
          value={bars[index] ?? ''}
          onChange={(e) => setBar(e.target.value)}
          placeholder={t('bars.placeholder')}
          autoCapitalize="off"
          autoComplete="off"
          spellCheck={false}
        />

        <div className="chip-row">
          {chips.map((chip) => (
            <button type="button" key={chip} onClick={() => addChord(chip)}>
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
          <button type="button" onClick={splitBar} disabled={!voiJakaa}>
            {t('bars.split')}
          </button>
        </div>

        {/* Tahtilaji merkitään vain siihen riviin josta se vaihtuu; laulun oma
            tahtilaji on otsikkorivillä. */}
        <div className="field">
          <label htmlFor="bar-meter">{t('bars.meter')}</label>
          <div className="chip-row">
            <button type="button" className={meter ? '' : 'primary'} onClick={() => setMeter('')}>
              —
            </button>
            {METERS.map((option) => (
              <button
                type="button"
                key={option}
                className={option === meter ? 'primary' : ''}
                onClick={() => setMeter(option)}
              >
                {option}
              </button>
            ))}
          </div>
          <input
            id="bar-meter"
            value={meter}
            onChange={(e) => setMeter(e.target.value)}
            placeholder={t('bars.meterPlaceholder')}
            autoCapitalize="off"
            autoComplete="off"
            spellCheck={false}
          />
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
