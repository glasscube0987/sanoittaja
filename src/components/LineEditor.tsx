import { useEffect, useRef } from 'react';
import { chordSpan, columnGuide } from '../lib/anchors';
import { useT } from '../lib/i18n';
import type { LyricLine } from '../lib/types';

interface Props {
  line: LyricLine;
  /** Jos ei null, riville siirretään fokus tähän kohtaan (rivinvaihdon/yhdistämisen jälkeen). */
  autoFocus: number | null;
  onAutoFocused: () => void;
  onTextChange: (text: string) => void;
  onSplit: (at: number) => void;
  onMergeWithPrevious: () => void;
  onChordTap: (pos: number, currentSymbol: string) => void;
  onSectionTap: () => void;
}

export default function LineEditor({
  line,
  autoFocus,
  onAutoFocused,
  onTextChange,
  onSplit,
  onMergeWithPrevious,
  onChordTap,
  onSectionTap,
}: Props) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (autoFocus !== null && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.setSelectionRange(autoFocus, autoFocus);
      onAutoFocused();
    }
  }, [autoFocus, onAutoFocused]);

  function charWidth(): number {
    const el = measureRef.current;
    return el ? el.getBoundingClientRect().width / 10 : 9;
  }

  function handleChordRowTap(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const span = chordSpan(line.text);
    const pos = Math.max(0, Math.min(span, Math.round((e.clientX - rect.left - 2) / charWidth())));
    const existing = line.chords.find((c) => c.pos === pos);
    onChordTap(pos, existing?.symbol ?? '');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    if (e.key === 'Enter') {
      e.preventDefault();
      onSplit(input.selectionStart ?? line.text.length);
    } else if (e.key === 'Backspace' && input.selectionStart === 0 && input.selectionEnd === 0) {
      e.preventDefault();
      onMergeWithPrevious();
    }
  }

  return (
    <div className="line">
      <button
        className={`section-mark${line.section ? ' set' : ''}`}
        onClick={onSectionTap}
        aria-label={t(line.section ? 'line.editSection' : 'line.startSection')}
        title={t(line.section ? 'line.editSection' : 'line.startSection')}
      >
        §
      </button>
      <div className="line-body">
        <div
          className="chord-row"
          onClick={handleChordRowTap}
          title={t('line.addChordHere')}
          style={{ width: `calc(${chordSpan(line.text)}ch + 8px)` }}
        >
          <span
            ref={measureRef}
            aria-hidden
            style={{ position: 'absolute', visibility: 'hidden', whiteSpace: 'pre' }}
          >
            0000000000
          </span>
          {/* Sanattomalla rivillä sarakkeet näkyviin, jottei sointuja tarvitse arvata. */}
          {line.text.length === 0 && (
            <span className="hint" aria-hidden>
              {columnGuide(chordSpan(line.text))}
            </span>
          )}
          {line.chords.map((chord) => (
            <button
              key={chord.id}
              className="chord"
              style={{ left: `calc(${chord.pos}ch + 2px)` }}
              onClick={(e) => {
                e.stopPropagation();
                onChordTap(chord.pos, chord.symbol);
              }}
            >
              {chord.symbol}
            </button>
          ))}
        </div>
        <input
          ref={inputRef}
          className="text"
          value={line.text}
          placeholder="…"
          autoCapitalize="sentences"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => onTextChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
    </div>
  );
}
