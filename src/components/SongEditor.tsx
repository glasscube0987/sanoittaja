import { useMemo, useRef, useState } from 'react';
import type { Song } from '../lib/types';
import {
  addLineAfter,
  editLineText,
  mergeLineWithPrevious,
  moveSection,
  placeChord,
  respellSong,
  setLineSection,
  splitLine,
  transposeSong,
} from '../lib/songOps';
import { getSections, sectionTitle } from '../lib/sections';
import ChordSheet from './ChordSheet';
import CloudSheet from './CloudSheet';
import LineEditor from './LineEditor';
import RecordingsPanel from './RecordingsPanel';
import SectionSheet from './SectionSheet';

interface Props {
  song: Song;
  onChange: (song: Song) => void;
  onBack: () => void;
  onDelete: () => void;
}

export interface ChordTarget {
  lineId: string;
  pos: number;
  symbol: string;
}

export default function SongEditor({ song, onChange, onBack, onDelete }: Props) {
  const [chordTarget, setChordTarget] = useState<ChordTarget | null>(null);
  const [sectionTargetId, setSectionTargetId] = useState<string | null>(null);
  const [cloudOpen, setCloudOpen] = useState(false);
  const focusLineId = useRef<{ id: string; caret: number } | null>(null);

  const sections = useMemo(() => getSections(song), [song]);
  const sectionTargetLine = song.lines.find((l) => l.id === sectionTargetId) ?? null;

  const usedChords = useMemo(() => {
    const seen: string[] = [];
    for (const line of song.lines) {
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

  function handleMerge(lineId: string) {
    const idx = song.lines.findIndex((l) => l.id === lineId);
    if (idx <= 0) return;
    const prev = song.lines[idx - 1];
    focusLineId.current = { id: prev.id, caret: prev.text.length };
    onChange(mergeLineWithPrevious(song, lineId));
  }

  return (
    <>
      <header className="topbar">
        <button className="ghost" onClick={onBack} aria-label="Takaisin">
          ‹ Laulut
        </button>
        <h1>{song.title || 'Nimetön'}</h1>
        <button className="ghost" onClick={() => setCloudOpen(true)} aria-label="Pilvi">
          ☁︎
        </button>
      </header>
      <main className="screen">
        <div className="title-row">
          <input
            value={song.title}
            placeholder="Laulun nimi"
            onChange={(e) => onChange({ ...song, title: e.target.value, updatedAt: Date.now() })}
          />
          <input
            className="key"
            value={song.songKey}
            placeholder="Sävel."
            onChange={(e) => onChange({ ...song, songKey: e.target.value, updatedAt: Date.now() })}
          />
        </div>

        <div className="transpose-bar">
          <span className="label">Transponoi</span>
          <button onClick={() => onChange(transposeSong(song, -1))} aria-label="Puolisävelaskel alas">
            − ½
          </button>
          <button onClick={() => onChange(transposeSong(song, 1))} aria-label="Puolisävelaskel ylös">
            + ½
          </button>
          <button onClick={() => onChange(respellSong(song, 'flat'))} title="Kirjoita alennusmerkein">
            ♭
          </button>
          <button onClick={() => onChange(respellSong(song, 'sharp'))} title="Kirjoita ylennysmerkein">
            ♯
          </button>
        </div>

        <div className="lyrics">
          {sections.map((block, i) => (
            <section className="section" key={block.id}>
              {block.mark && (
                <div className="section-head">
                  <button className="section-name" onClick={() => setSectionTargetId(block.id)}>
                    {sectionTitle(block)}
                  </button>
                  <button
                    className="ghost"
                    aria-label={`Siirrä osiota ${sectionTitle(block)} ylös`}
                    disabled={i === 0 || !sections[i - 1].mark}
                    onClick={() => onChange(moveSection(song, block.id, -1))}
                  >
                    ▲
                  </button>
                  <button
                    className="ghost"
                    aria-label={`Siirrä osiota ${sectionTitle(block)} alas`}
                    disabled={i === sections.length - 1}
                    onClick={() => onChange(moveSection(song, block.id, 1))}
                  >
                    ▼
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
                  onSectionTap={() => setSectionTargetId(line.id)}
                />
              ))}
            </section>
          ))}
        </div>

        <div className="editor-actions">
          <button onClick={() => onChange(addLineAfter(song, song.lines[song.lines.length - 1].id))}>
            + Rivi
          </button>
          <button
            className="danger"
            onClick={() => {
              if (confirm(`Poistetaanko laulu ”${song.title || 'Nimetön'}” ja sen nauhoitteet?`)) onDelete();
            }}
          >
            Poista laulu
          </button>
        </div>

        <RecordingsPanel songId={song.id} />
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
      {sectionTargetLine && (
        <SectionSheet
          mark={sectionTargetLine.section ?? null}
          onSave={(mark) => {
            onChange(setLineSection(song, sectionTargetLine.id, mark));
            setSectionTargetId(null);
          }}
          onRemove={() => {
            onChange(setLineSection(song, sectionTargetLine.id, null));
            setSectionTargetId(null);
          }}
          onClose={() => setSectionTargetId(null)}
        />
      )}
      {cloudOpen && <CloudSheet song={song} onClose={() => setCloudOpen(false)} />}
    </>
  );
}
