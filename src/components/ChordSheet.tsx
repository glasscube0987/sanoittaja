import { useState } from 'react';
import type { LyricLine } from '../lib/types';
import type { ChordTarget } from './SongEditor';

interface Props {
  target: ChordTarget;
  line: LyricLine;
  suggestions: string[];
  onSave: (symbol: string) => void;
  onClose: () => void;
}

const DEFAULT_SUGGESTIONS = ['C', 'G', 'Am', 'F', 'D', 'Em', 'E', 'A', 'Dm', 'B7'];

export default function ChordSheet({ target, line, suggestions, onSave, onClose }: Props) {
  const [symbol, setSymbol] = useState(target.symbol);
  const chips = suggestions.length > 0 ? suggestions : DEFAULT_SUGGESTIONS;

  const before = line.text.slice(0, target.pos);
  const after = line.text.slice(target.pos);

  return (
    <div className="overlay" onClick={onClose}>
      <form
        className="sheet"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onSave(symbol);
        }}
      >
        <h2>{target.symbol ? 'Muokkaa sointua' : 'Lisää sointu'}</h2>
        <div className="context">
          {before}
          <b>▼</b>
          {after || ' '}
        </div>
        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder="esim. Am7, C#/G#, Bb"
          autoFocus
          autoCapitalize="off"
          autoComplete="off"
          spellCheck={false}
        />
        <div className="chip-row">
          {chips.map((chip) => (
            <button type="button" key={chip} onClick={() => onSave(chip)}>
              {chip}
            </button>
          ))}
        </div>
        <div className="button-row">
          <button type="submit" className="primary">
            Tallenna
          </button>
          {target.symbol && (
            <button type="button" className="danger" onClick={() => onSave('')}>
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
