import { useState } from 'react';
import { SECTION_KINDS, SECTION_NAMES } from '../lib/sections';
import type { SectionKind, SectionMark } from '../lib/types';

interface Props {
  /** Rivin nykyinen merkintä, tai null jos rivi ei aloita osiota. */
  mark: SectionMark | null;
  onSave: (mark: SectionMark) => void;
  onRemove: () => void;
  onClose: () => void;
}

export default function SectionSheet({ mark, onSave, onRemove, onClose }: Props) {
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
        <h2>{mark ? 'Muokkaa osiota' : 'Aloita osio tästä'}</h2>

        <div className="chip-row">
          {SECTION_KINDS.map((k) => (
            <button
              type="button"
              key={k}
              className={k === kind ? 'primary' : ''}
              onClick={() => setKind(k)}
            >
              {SECTION_NAMES[k]}
            </button>
          ))}
        </div>

        <div className="field">
          <label htmlFor="section-label">Oma nimi</label>
          <input
            id="section-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={SECTION_NAMES[kind]}
            autoComplete="off"
          />
          <small>Tyhjänä osiot numeroidaan automaattisesti, esim. Säkeistö 1 ja Säkeistö 2.</small>
        </div>

        <div className="button-row">
          <button type="submit" className="primary">
            Tallenna
          </button>
          {mark && (
            <button type="button" className="danger" onClick={onRemove}>
              Poista merkintä
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
