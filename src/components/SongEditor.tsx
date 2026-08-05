import { useEffect, useMemo, useRef, useState } from 'react';
import type { Song } from '../lib/types';
import {
  addLineAfter,
  barsFromLine,
  duplicateSection,
  editLineText,
  insertLinesAfter,
  mergeLineWithPrevious,
  moveSection,
  placeChord,
  removeLine,
  resetTranspose,
  respellSong,
  setLineBars,
  setLineMeter,
  setLineSection,
  splitLine,
  transposeOffset,
  transposeSong,
} from '../lib/songOps';
import { useI18n } from '../lib/i18n';
import { getSections, sectionTitle } from '../lib/sections';
import { isBlankLine } from '../lib/render';
import ChordSheet from './ChordSheet';
import Icon from './Icon';
import ImportSheet from './ImportSheet';
import LineEditor from './LineEditor';
import LiveView from './LiveView';
import BarSheet from './BarSheet';
import LineSheet from './LineSheet';
import RecordingsPanel from './RecordingsPanel';
import SongSheet from './SongSheet';

interface Props {
  song: Song;
  onChange: (song: Song) => void;
  onUndo: () => void;
  canUndo: boolean;
  onBack: () => void;
  onDelete: () => void;
}

/**
 * Kuinka kauan työkalurivi jää näkyviin kohdistuksen kadottua. Riittävän pitkä
 * kattamaan napautuksen (blur tulee juuri ennen clickiä), riittävän lyhyt
 * jottei rivi jää roikkumaan näppäimistön sulkeuduttua.
 */
const TOOLS_HIDE_MS = 250;

export interface ChordTarget {
  lineId: string;
  pos: number;
  symbol: string;
}

export default function SongEditor({ song, onChange, onUndo, canUndo, onBack, onDelete }: Props) {
  const { t } = useI18n();
  const [chordTarget, setChordTarget] = useState<ChordTarget | null>(null);
  const [lineTargetId, setLineTargetId] = useState<string | null>(null);
  const [barsTargetId, setBarsTargetId] = useState<string | null>(null);
  const [liveOpen, setLiveOpen] = useState(false);
  // null = tuonti laulun loppuun, muuten rivin id jonka perään rivit menevät.
  const [importAfterId, setImportAfterId] = useState<string | null | undefined>(undefined);
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const focusLineId = useRef<{ id: string; caret: number } | null>(null);
  const blurTimer = useRef<number | null>(null);

  useEffect(() => () => window.clearTimeout(blurTimer.current ?? undefined), []);

  const offset = transposeOffset(song);
  const offsetLabel = offset > 0 ? `+${offset}` : String(offset);
  const sections = useMemo(() => getSections(song), [song]);
  const lineTarget = song.lines.find((l) => l.id === lineTargetId) ?? null;
  const barsTarget = song.lines.find((l) => l.id === barsTargetId) ?? null;

  const usedChords = useMemo(() => {
    const seen: string[] = [];
    for (const line of song.lines) {
      // Tahtien soinnut mukaan, jotta pikavalinnat tuntevat myös välisoitot.
      for (const symbol of line.bars?.flatMap((bar) => bar.trim().split(/\s+/)) ?? []) {
        if (symbol && !seen.includes(symbol)) seen.push(symbol);
      }
      for (const chord of line.chords) {
        if (!seen.includes(chord.symbol)) seen.push(chord.symbol);
      }
    }
    return seen.slice(0, 10);
  }, [song.lines]);

  function handleSplit(lineId: string, at: number) {
    const next = splitLine(song, lineId, at);
    const idx = next.lines.findIndex((l) => l.id === lineId);
    focusLineId.current = { id: next.lines[idx + 1].id, caret: 0 };
    onChange(next);
  }

  /**
   * Kohdistuksen katoaminen piilottaa työkalurivin vasta pienen viiveen
   * jälkeen.
   *
   * Painallus vie kohdistuksen kentältä ennen kuin napautus ehtii perille, ja
   * ilman viivettä rivi purettaisiin juuri sillä hetkellä – painike ei
   * laukeaisi kertaakaan. `preventDefault` korjaisi tämän työpöydällä, mutta
   * iOS ei noudata sitä osoitintapahtumissa, joten viive on ainoa keino joka
   * toimii kaikkialla samoin.
   */
  function setActive(lineId: string, active: boolean) {
    if (blurTimer.current) {
      window.clearTimeout(blurTimer.current);
      blurTimer.current = null;
    }
    if (active) {
      setActiveLineId(lineId);
      return;
    }
    blurTimer.current = window.setTimeout(() => {
      blurTimer.current = null;
      setActiveLineId((prev) => (prev === lineId ? null : prev));
    }, TOOLS_HIDE_MS);
  }

  /** Työkalurivi kohdistetun rivin alle. */
  function lineTools(lineId: string) {
    /* Kohdistus takaisin riville: työkalut jäävät näkyviin ja näppäimistö
       auki, joten esimerkiksi kumoamista voi toistaa ilman rivin etsimistä. */
    const stayOnLine = () => {
      const line = song.lines.find((l) => l.id === lineId);
      if (line && !line.bars) focusLineId.current = { id: lineId, caret: line.text.length };
    };

    return (
      <div className="line-tools">
        <button
          type="button"
          onClick={() => {
            const next = addLineAfter(song, lineId);
            const idx = next.lines.findIndex((l) => l.id === lineId);
            focusLineId.current = { id: next.lines[idx + 1].id, caret: 0 };
            onChange(next);
          }}
        >
          {t('editor.addLine')}
        </button>
        <button type="button" onClick={() => setImportAfterId(lineId)}>
          {t('import.pasteText')}
        </button>
        <button
          type="button"
          disabled={!canUndo}
          onClick={() => {
            onUndo();
            stayOnLine();
          }}
        >
          ↶ {t('editor.undo')}
        </button>
      </div>
    );
  }

  function handleMerge(lineId: string) {
    const idx = song.lines.findIndex((l) => l.id === lineId);
    if (idx === -1) return;
    // Ensimmäisellä rivillä ei ole edellistä johon yhdistää, joten tyhjä rivi
    // poistetaan: muuten laulun alkuun jäänyttä tyhjää riviä ei saanut pois.
    if (idx === 0) {
      const line = song.lines[0];
      if (line.text !== '' || line.bars || song.lines.length <= 1) return;
      focusLineId.current = { id: song.lines[1].id, caret: 0 };
      onChange(removeLine(song, lineId));
      return;
    }
    const prev = song.lines[idx - 1];
    focusLineId.current = { id: prev.id, caret: prev.text.length };
    onChange(mergeLineWithPrevious(song, lineId));
  }

  return (
    <>
      <header className="topbar">
        <button className="icon-button" onClick={onBack} aria-label={t('editor.backLabel')}>
          <Icon name="back" />
        </button>
        <h1>{song.title || t('app.untitled')}</h1>
        {/* Peruutus on turhaa jos sen luo pitää rullata: vahinko huomataan heti. */}
        <button
          className="icon-button"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label={t('editor.undo')}
        >
          <Icon name="undo" />
        </button>
        {/* Yläpalkki on sticky, joten live-tila on käytettävissä heti biisin
            avatessa ilman että näkymää tarvitsee rullata alas. */}
        <button className="live-open" onClick={() => setLiveOpen(true)}>
          {t('editor.live')}
        </button>
      </header>
      <main className="screen">
        <div className="title-row">
          <input
            value={song.title}
            placeholder={t('editor.titlePlaceholder')}
            onChange={(e) => onChange({ ...song, title: e.target.value, updatedAt: Date.now() })}
          />
          <input
            className="key"
            value={song.songKey}
            placeholder={t('editor.keyPlaceholder')}
            aria-label={t('editor.keyLabel')}
            onChange={(e) => onChange({ ...song, songKey: e.target.value, updatedAt: Date.now() })}
          />
          <input
            className="key"
            value={song.meter ?? ''}
            placeholder={t('editor.meterPlaceholder')}
            aria-label={t('editor.meterLabel')}
            inputMode="text"
            autoComplete="off"
            onChange={(e) => onChange({ ...song, meter: e.target.value, updatedAt: Date.now() })}
          />
        </div>

        <div className="transpose-bar">
          <span className="label">{t('editor.transpose')}</span>
          <button onClick={() => onChange(transposeSong(song, -1))} aria-label={t('editor.semitoneDown')}>
            − ½
          </button>
          <button onClick={() => onChange(transposeSong(song, 1))} aria-label={t('editor.semitoneUp')}>
            + ½
          </button>
          <button onClick={() => onChange(respellSong(song, 'flat'))} title={t('editor.useFlats')}>
            ♭
          </button>
          <button onClick={() => onChange(respellSong(song, 'sharp'))} title={t('editor.useSharps')}>
            ♯
          </button>
          {/* Siirtymä ja paluu näkyvät vain kun laulu ei ole alkuperäisessä
              sävellajissaan – muuten ne olisivat pelkkää kohinaa. */}
          {offset !== 0 && (
            <button
              className="reset-key"
              onClick={() => onChange(resetTranspose(song))}
              title={t('editor.resetKey')}
              aria-label={t('editor.transposedBy', { offset: offsetLabel })}
            >
              {offsetLabel} ↺
            </button>
          )}
        </div>

        <div className="lyrics">
          {sections.map((block, i) => (
            <section className="section" key={block.id}>
              {block.mark && (
                <div className="section-head">
                  <button className="section-name" onClick={() => setLineTargetId(block.id)}>
                    {sectionTitle(block, t)}
                  </button>
                  <button
                    className="icon-button small"
                    aria-label={t('editor.duplicateSection', { name: sectionTitle(block, t) })}
                    onClick={() => onChange(duplicateSection(song, block.id))}
                  >
                    <Icon name="copy" size={17} />
                  </button>
                  <button
                    className="icon-button small"
                    aria-label={t('editor.moveSectionUp', { name: sectionTitle(block, t) })}
                    disabled={i === 0 || !sections[i - 1].mark}
                    onClick={() => onChange(moveSection(song, block.id, -1))}
                  >
                    <Icon name="chevronUp" size={18} />
                  </button>
                  <button
                    className="icon-button small"
                    aria-label={t('editor.moveSectionDown', { name: sectionTitle(block, t) })}
                    disabled={i === sections.length - 1}
                    onClick={() => onChange(moveSection(song, block.id, 1))}
                  >
                    <Icon name="chevronDown" size={18} />
                  </button>
                </div>
              )}
              {block.lines.map((line) => (
                <LineEditor
                  key={line.id}
                  line={line}
                  autoFocus={focusLineId.current?.id === line.id ? focusLineId.current.caret : null}
                  onAutoFocused={() => (focusLineId.current = null)}
                  onTextChange={(text) => onChange(editLineText(song, line.id, text))}
                  onSplit={(at) => handleSplit(line.id, at)}
                  onMergeWithPrevious={() => handleMerge(line.id)}
                  onChordTap={(pos, symbol) => setChordTarget({ lineId: line.id, pos, symbol })}
                  onSectionTap={() => setLineTargetId(line.id)}
                  onBarsTap={() => setBarsTargetId(line.id)}
                  onActive={(active) => setActive(line.id, active)}
                  tools={activeLineId === line.id ? lineTools(line.id) : undefined}
                />
              ))}
            </section>
          ))}
        </div>

        <div className="editor-actions">
          <button onClick={() => onChange(addLineAfter(song, song.lines[song.lines.length - 1].id))}>
            {t('editor.addLine')}
          </button>
          <button onClick={() => setImportAfterId(null)}>{t('import.pasteText')}</button>
          {/* Tulostusvalikosta valitaan "Tallenna PDF:nä"; erillistä kirjastoa ei tarvita. */}
          <button onClick={() => window.print()}>{t('editor.exportPdf')}</button>
          <button
            className="danger"
            onClick={() => {
              const title = song.title || t('app.untitled');
              if (confirm(t('editor.confirmDeleteSong', { title }))) onDelete();
            }}
          >
            {t('editor.deleteSong')}
          </button>
        </div>

        <RecordingsPanel songId={song.id} />
        <SongSheet song={song} />
      </main>

      {chordTarget && (
        <ChordSheet
          target={chordTarget}
          line={song.lines.find((l) => l.id === chordTarget.lineId)!}
          suggestions={usedChords}
          onSave={(symbol, pos) => {
            onChange(placeChord(song, chordTarget.lineId, chordTarget.pos, pos, symbol));
            setChordTarget(null);
          }}
          onClose={() => setChordTarget(null)}
        />
      )}
      {lineTarget && (
        <LineSheet
          line={lineTarget}
          canDelete={song.lines.length > 1}
          onDelete={() => {
            onChange(removeLine(song, lineTarget.id));
            setLineTargetId(null);
          }}
          onSave={({ section, bars }) => {
            // Tahtien sisältö säilyy, jos rivi on jo sointurivi; muuten rivin
            // omat soinnut siirtyvät tahdeiksi eikä niitä tarvitse kirjoittaa
            // uudelleen.
            const withBars = setLineBars(
              song,
              lineTarget.id,
              bars ? (lineTarget.bars ?? barsFromLine(lineTarget)) : null,
            );
            onChange(setLineSection(withBars, lineTarget.id, section));
            setLineTargetId(null);
            if (bars && !lineTarget.bars) setBarsTargetId(lineTarget.id);
          }}
          onClose={() => setLineTargetId(null)}
        />
      )}
      {barsTarget?.bars && (
        <BarSheet
          bars={barsTarget.bars}
          meter={barsTarget.meter}
          suggestions={usedChords}
          onSave={(bars, meter) => {
            onChange(setLineMeter(setLineBars(song, barsTarget.id, bars), barsTarget.id, meter));
            setBarsTargetId(null);
          }}
          onClose={() => setBarsTargetId(null)}
        />
      )}
      {importAfterId !== undefined && (
        <ImportSheet
          mode="append"
          onImport={(result) => {
            const after = importAfterId;
            setImportAfterId(undefined);
            if (result.lines.length === 0) return;
            // Koskematon uusi laulu on yksi tyhjä rivi; sen perään lisääminen
            // jättäisi turhan tyhjän rivin laulun alkuun.
            if (song.lines.length === 1 && isBlankLine(song.lines[0])) {
              onChange({ ...song, lines: result.lines, updatedAt: Date.now() });
              return;
            }
            onChange(insertLinesAfter(song, after, result.lines));
          }}
          onClose={() => setImportAfterId(undefined)}
        />
      )}
      {liveOpen && <LiveView song={song} onClose={() => setLiveOpen(false)} />}
    </>
  );
}
