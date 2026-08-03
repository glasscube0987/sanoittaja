import { useState } from 'react';
import { useT } from '../lib/i18n';
import { SECTION_KINDS, sectionName } from '../lib/sections';
import type { LyricLine, SectionKind, SectionMark } from '../lib/types';

export interface LineSettings {
  /** null = rivi ei aloita osiota. */
  section: SectionMark | null;
  /** true = rivi on tahtirivi. */
  bars: boolean;
}

interface Props {
  line: LyricLine;
  onSave: (settings: LineSettings) => void;
  onClose: () => void;
}

/**
 * Rivin asetukset yhdessä paikassa: aloittaako rivi osion ja onko se
 * sanoitus- vai tahtirivi. Molemmat ovat rivin ominaisuuksia, ja välisoitto
 * merkitään käytännössä aina molemmiksi kerralla.
 */
export default function LineSheet({ line, onSave, onClose }: Props) {
  const t = useT();
  const [bars, setBars] = useState(Boolean(line.bars));
  const [kind, setKind] = useState<SectionKind | null>(line.section?.kind ?? null);
  const [label, setLabel] = useState(line.section?.label ?? '');

  function save() {
    const trimmed = label.trim();
    onSave({
      section: kind ? (trimmed ? { kind, label: trimmed } : { kind }) : null,
      bars,
    });
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form
        className="sheet"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <h2>{t('line.title')}</h2>

        <div className="field">
          <label>{t('line.type')}</label>
          <div className="chip-row">
            <button type="button" className={bars ? '' : 'primary'} onClick={() => setBars(false)}>
              {t('line.typeLyrics')}
            </button>
            <button type="button" className={bars ? 'primary' : ''} onClick={() => setBars(true)}>
              {t('line.typeBars')}
            </button>
          </div>
        </div>

        <div className="field">
          <label>{t('line.sectionMarker')}</label>
          <div className="chip-row">
            <button type="button" className={kind ? '' : 'primary'} onClick={() => setKind(null)}>
              —
            </button>
            {SECTION_KINDS.map((k) => (
              <button
                type="button"
                key={k}
                className={k === kind ? 'primary' : ''}
                onClick={() => setKind(k)}
              >
                {sectionName(k, t)}
              </button>
            ))}
          </div>
        </div>

        {kind && (
          <div className="field">
            <label htmlFor="section-label">{t('section.customName')}</label>
            <input
              id="section-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={sectionName(kind, t)}
              autoComplete="off"
            />
            <small>{t('section.numberingHint')}</small>
          </div>
        )}

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
