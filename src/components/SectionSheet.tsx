import { useState } from 'react';
import { useT } from '../lib/i18n';
import { SECTION_KINDS, sectionName } from '../lib/sections';
import type { SectionKind, SectionMark } from '../lib/types';

interface Props {
  /** Rivin nykyinen merkintä, tai null jos rivi ei aloita osiota. */
  mark: SectionMark | null;
  onSave: (mark: SectionMark) => void;
  onRemove: () => void;
  onClose: () => void;
}

export default function SectionSheet({ mark, onSave, onRemove, onClose }: Props) {
  const t = useT();
  const [kind, setKind] = useState<SectionKind>(mark?.kind ?? 'verse');
  const [label, setLabel] = useState(mark?.label ?? '');

  return (
    <div className="overlay" onClick={onClose}>
      <form
        className="sheet"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = label.trim();
          onSave(trimmed ? { kind, label: trimmed } : { kind });
        }}
      >
        <h2>{t(mark ? 'section.edit' : 'section.start')}</h2>

        <div className="chip-row">
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

        <div className="button-row">
          <button type="submit" className="primary">
            {t('common.save')}
          </button>
          {mark && (
            <button type="button" className="danger" onClick={onRemove}>
              {t('section.removeMarker')}
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
