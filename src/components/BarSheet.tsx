import { useEffect, useRef, useState } from 'react';
import type { BarRow } from '../lib/bars';
import {
  insertBarAfter,
  removeBarAt,
  setBarAt,
  setMeterAt,
  setRepeatAt,
  splitBarAt,
  splitCount,
} from '../lib/bars';
import { useT } from '../lib/i18n';
import type { BarRepeat } from '../lib/types';
import Icon from './Icon';

interface Props {
  row: BarRow;
  suggestions: string[];
  onSave: (row: BarRow) => void;
  onClose: () => void;
}

const DEFAULT_SUGGESTIONS = ['C', 'G', 'Am', 'F', 'D', 'Em', 'E', 'A', 'Dm', 'B7'];

/** Tavallisimmat tahtilajit; kenttään voi kirjoittaa minkä tahansa muun. */
const METERS = ['4/4', '3/4', '6/8', '2/4', '12/8'];

/** Tavallisimmat kertaluvut; kenttään voi kirjoittaa minkä tahansa muun. */
const TIMES = [3, 4, 8];

/**
 * Sointurivin muokkaus: valittu tahti kerrallaan, samalla vuorovaikutuksella
 * kuin sointuponnahduksessa. Tahtiin voi kirjoittaa useamman soinnun ("Am F")
 * tai muun merkinnän ("%"), joten kenttä on vapaata tekstiä. Myös tahtilaji
 * kohdistuu valittuun tahtiin, koska laji voi vaihtua kesken rivin.
 */
/** Kertaluku näkyviin vain kun se on yli kaksi – kuten ladonnassakin. */
function repeatTimes(mark: BarRepeat | undefined): string {
  return mark?.end && mark.times && mark.times > 2 ? `x${mark.times}` : '';
}

export default function BarSheet({ row: initial, suggestions, onSave, onClose }: Props) {
  const t = useT();
  const [row, setRow] = useState<BarRow>(
    initial.bars.length ? initial : { bars: [''], meters: [''], repeats: [{}] },
  );
  const [index, setIndex] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const chips = suggestions.length > 0 ? suggestions : DEFAULT_SUGGESTIONS;

  const bar = row.bars[index] ?? '';
  const meter = row.meters[index] ?? '';
  const repeat = row.repeats[index] ?? {};

  /* Kohdistus lomakkeeseen eikä kenttään: kenttä avaisi näppäimistön ja
     laukaisisi iOS:n zoomin, joka jää päälle ponnahduksen sulkeuduttua. */
  useEffect(() => {
    formRef.current?.focus({ preventScroll: true });
  }, []);

  function setBar(value: string) {
    setRow((prev) => setBarAt(prev, index, value));
  }

  function setMeter(value: string) {
    setRow((prev) => setMeterAt(prev, index, value));
  }

  function setRepeat(muutos: Partial<BarRepeat>) {
    setRow((prev) => {
      const nyt = prev.repeats[index] ?? {};
      const next: BarRepeat = { ...nyt, ...muutos };
      if (!next.start) delete next.start;
      // Kertaluku kuuluu sulkevaan merkkiin, joten se katoaa sen mukana.
      if (!next.end) {
        delete next.end;
        delete next.times;
      }
      return setRepeatAt(prev, index, next);
    });
  }

  function move(step: number) {
    setIndex((i) => Math.max(0, Math.min(row.bars.length - 1, i + step)));
  }

  function addBar() {
    setRow((prev) => insertBarAfter(prev, index));
    setIndex((i) => i + 1);
  }

  function removeBar() {
    if (row.bars.length <= 1) return;
    setRow((prev) => removeBarAt(prev, index));
    setIndex((i) => Math.max(0, Math.min(row.bars.length - 2, i)));
  }

  /**
   * Lisää soinnun tahtiin sen sijaan että korvaisi sen.
   *
   * Tahtiin mahtuu useampi sointu, ja toisen lisääminen on tavallisempaa kuin
   * ensimmäisen vaihtaminen. Korvaaminen onnistuu tyhjentämällä kenttä, joka on
   * samassa näkymässä.
   */
  function addChord(chip: string) {
    const nykyinen = bar.trim();
    setBar(nykyinen ? `${nykyinen} ${chip}` : chip);
  }

  function splitBar() {
    const osat = splitCount(row, index);
    if (osat < 2) return;
    setRow((prev) => splitBarAt(prev, index));
    setIndex((i) => i + osat - 1);
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
          onSave(row);
        }}
      >
        <h2>{t('bars.title')}</h2>

        <div className="context bar-preview">
          {row.bars.map((content, i) => (
            <span key={i} className={i === index ? 'bar current' : 'bar'}>
              {i === 0 && row.meters[0]?.trim() ? `${row.meters[0].trim()} ` : ''}
              {/* Sulkeva merkki tulee edellisestä tahdista, avaava tästä. */}
              {`${i > 0 && row.repeats[i - 1]?.end ? ':' : ''}|${row.repeats[i]?.start ? ':' : ''} `}
              {i > 0 && row.meters[i]?.trim() ? `${row.meters[i].trim()} ` : ''}
              {`${content.trim() || ' '} `}
            </span>
          ))}
          <span className="bar">
            {`${row.repeats[row.bars.length - 1]?.end ? ':' : ''}|`}
            {repeatTimes(row.repeats[row.bars.length - 1])}
          </span>
        </div>

        <div className="nudge-row">
          <button type="button" onClick={() => move(-1)} aria-label={t('chord.moveLeft')}>
            <Icon name="chevronLeft" size={20} />
          </button>
          <span className="nudge-info">
            {t('bars.position', { index: index + 1, count: row.bars.length })}
            <small>{t('bars.hint')}</small>
          </span>
          <button type="button" onClick={() => move(1)} aria-label={t('chord.moveRight')}>
            <Icon name="chevronRight" size={20} />
          </button>
        </div>

        <input
          id="bar-content"
          value={bar}
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
          <button type="button" onClick={removeBar} disabled={row.bars.length <= 1}>
            {t('bars.remove')}
          </button>
          <button type="button" onClick={splitBar} disabled={splitCount(row, index) < 2}>
            {t('bars.split')}
          </button>
        </div>

        {/* Tahtilaji kohdistuu valittuun tahtiin: laji voi vaihtua kesken rivin,
            eikä merkintä siksi kuulu koko riville. */}
        <div className="field">
          <label htmlFor="bar-meter">{t('bars.meter', { index: index + 1 })}</label>
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

        {/* Kertausmerkit kuuluvat tahtiin eivätkä koko riville: kertauksen voi
            avata ja sulkea mistä tahansa tahdista, myös rivien yli. */}
        <div className="field">
          <label>{t('bars.repeat', { index: index + 1 })}</label>
          <div className="chip-row">
            <button
              type="button"
              className={repeat.start ? 'primary' : ''}
              onClick={() => setRepeat({ start: !repeat.start })}
            >
              {t('bars.repeatOpen')}
            </button>
            <button
              type="button"
              className={repeat.end ? 'primary' : ''}
              onClick={() => setRepeat({ end: !repeat.end })}
            >
              {t('bars.repeatClose')}
            </button>
          </div>
          {/* Kertaluku on mielekäs vain sulkevalle merkille. */}
          {repeat.end && (
            <>
              <div className="chip-row">
                <button
                  type="button"
                  className={!repeat.times || repeat.times === 2 ? 'primary' : ''}
                  onClick={() => setRepeat({ times: undefined })}
                >
                  ×2
                </button>
                {TIMES.map((option) => (
                  <button
                    type="button"
                    key={option}
                    className={repeat.times === option ? 'primary' : ''}
                    onClick={() => setRepeat({ times: option })}
                  >
                    ×{option}
                  </button>
                ))}
              </div>
              <input
                id="bar-times"
                type="number"
                min={2}
                inputMode="numeric"
                value={repeat.times ?? 2}
                onChange={(e) => {
                  const luku = Number(e.target.value);
                  setRepeat({ times: Number.isFinite(luku) && luku > 2 ? luku : undefined });
                }}
                aria-label={t('bars.repeatTimes')}
              />
            </>
          )}
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
