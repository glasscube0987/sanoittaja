import { useMemo, useRef, useState } from 'react';
import { useT } from '../lib/i18n';
import type { ImportKind, ImportResult } from '../lib/importText';
import { buildLines, classifyLines, IMPORT_KINDS, splitLines } from '../lib/importText';
import type { Key } from '../lib/i18n';

interface Props {
  /** 'new' luo uuden laulun, 'append' lisää rivit avoinna olevan perään. */
  mode: 'new' | 'append';
  onImport: (result: ImportResult) => void;
  onClose: () => void;
}

const KIND_LABELS: Record<ImportKind, Key> = {
  lyrics: 'import.kindLyrics',
  chords: 'import.kindChords',
  bars: 'import.kindBars',
  section: 'import.kindSection',
  blank: 'import.kindBlank',
};

/**
 * Vanhan laulun tuonti tekstistä.
 *
 * Tunnistus on heuristiikkaa, joten esikatselu näyttää mitä kustakin rivistä
 * tuli ja antaa korjata tulkinnan ennen kuin laulu syntyy. Korjaus kohdistuu
 * lähderiviin eikä lopputulokseen, koska rivin tyyppi ratkaisee myös sen,
 * pariutuuko sointurivi allaan olevaan sanoitusriviin.
 */
export default function ImportSheet({ mode, onImport, onClose }: Props) {
  const t = useT();
  const [text, setText] = useState('');
  const [overrides, setOverrides] = useState<Record<number, ImportKind>>({});
  const [title, setTitle] = useState('');
  const [titleEdited, setTitleEdited] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const rawLines = useMemo(() => splitLines(text), [text]);
  const kinds = useMemo(
    () => classifyLines(rawLines).map((kind, i) => overrides[i] ?? kind),
    [rawLines, overrides],
  );
  const result = useMemo(
    () => buildLines(rawLines, kinds, { withTitle: mode === 'new' }),
    [rawLines, kinds, mode],
  );

  // Pääteltyä nimeä ei tuputeta, jos käyttäjä on jo kirjoittanut oman.
  const shownTitle = titleEdited ? title : (result.title ?? '');
  const hasContent = text.trim().length > 0;

  function setKind(index: number, kind: ImportKind) {
    setOverrides((prev) => ({ ...prev, [index]: kind }));
  }

  async function readFile(file: File) {
    setText(await file.text());
    setOverrides({});
  }

  function submit() {
    const trimmed = shownTitle.trim();
    onImport(trimmed ? { ...result, title: trimmed } : { ...result, title: undefined });
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form
        className="sheet import-sheet"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <h2>{t(mode === 'new' ? 'import.title' : 'import.appendTitle')}</h2>

        <div className="field">
          <textarea
            className="import-input"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setOverrides({});
            }}
            placeholder={t('import.placeholder')}
            rows={5}
            autoCapitalize="off"
            autoComplete="off"
            spellCheck={false}
          />
          <div className="button-row">
            <button type="button" className="ghost" onClick={() => fileInput.current?.click()}>
              {t('import.chooseFile')}
            </button>
          </div>
          <small>{t('import.spacingHint')}</small>
        </div>

        {hasContent && (
          <>
            {mode === 'new' && (
              <div className="field">
                <label htmlFor="import-title">{t('import.songTitle')}</label>
                <input
                  id="import-title"
                  value={shownTitle}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setTitleEdited(true);
                  }}
                  placeholder={t('editor.titlePlaceholder')}
                  autoComplete="off"
                />
              </div>
            )}

            <div className="field">
              <label>{t('import.preview')}</label>
              <div className="import-preview">
                {rawLines.map((raw, i) => (
                  <div className="import-row" key={i}>
                    <select
                      value={kinds[i]}
                      aria-label={t('import.rowKind', { row: i + 1 })}
                      onChange={(e) => setKind(i, e.target.value as ImportKind)}
                    >
                      {IMPORT_KINDS.map((kind) => (
                        <option key={kind} value={kind}>
                          {t(KIND_LABELS[kind])}
                        </option>
                      ))}
                    </select>
                    {/* Laji data-attribuuttina eikä luokkana: `lyrics` on jo
                        editorin sanoituslaatikon luokka, ja rivit perivät sen
                        reunan ja taustan. */}
                    <pre className="import-text" data-kind={kinds[i]}>
                      {i === result.titleIndex ? t('import.usedAsTitle') : raw || ' '}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="button-row">
          <button type="submit" className="primary" disabled={!hasContent}>
            {t(mode === 'new' ? 'import.create' : 'import.append')}
          </button>
          <button type="button" className="ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
        </div>

        <input
          ref={fileInput}
          type="file"
          accept="text/plain,.txt"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) readFile(file);
            e.target.value = '';
          }}
        />
      </form>
    </div>
  );
}
