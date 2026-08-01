import { useRef, useState } from 'react';
import type { Song } from '../lib/types';
import { downloadBlob, exportLibrary, importLibrary } from '../lib/sync/exportFile';
import SettingsSheet from './SettingsSheet';

interface Props {
  songs: Song[];
  onOpen: (songId: string) => void;
  onCreate: () => void;
  onLibraryChanged: () => void;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('fi-FI', { day: 'numeric', month: 'numeric', year: 'numeric' });
}

export default function SongList({ songs, onOpen, onCreate, onLibraryChanged }: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [status, setStatus] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleExport() {
    try {
      setStatus('Kootaan varmuuskopiota…');
      const blob = await exportLibrary();
      downloadBlob(blob, `sanoittaja-varmuuskopio-${new Date().toISOString().slice(0, 10)}.json`);
      setStatus('Varmuuskopio ladattu.');
    } catch (err) {
      setStatus('Virhe: ' + (err instanceof Error ? err.message : String(err)));
    }
  }

  async function handleImportFile(file: File) {
    try {
      setStatus('Tuodaan…');
      const result = await importLibrary(file);
      onLibraryChanged();
      setStatus(`Tuotu ${result.songs} laulua ja ${result.recordings} nauhoitetta.`);
    } catch (err) {
      setStatus('Virhe: ' + (err instanceof Error ? err.message : String(err)));
    }
  }

  return (
    <>
      <header className="topbar">
        <h1>Sanoittaja</h1>
        <button className="ghost" onClick={() => setSettingsOpen(true)} aria-label="Asetukset">
          ⚙︎
        </button>
        <button className="primary" onClick={onCreate}>
          + Uusi laulu
        </button>
      </header>
      <main className="screen">
        {songs.length === 0 && (
          <p className="empty-note">
            Ei vielä lauluja.
            <br />
            Aloita painamalla ”Uusi laulu” – sanat, soinnut ja nauhoitteet tallentuvat puhelimeesi.
          </p>
        )}
        {songs.map((song) => (
          <button key={song.id} className="song-card" onClick={() => onOpen(song.id)}>
            <div className="title">{song.title || 'Nimetön'}</div>
            <div className="meta">
              {song.songKey ? `${song.songKey} · ` : ''}
              {song.lines.filter((l) => l.text.trim()).length} riviä · muokattu {formatDate(song.updatedAt)}
            </div>
          </button>
        ))}
        <div className="button-row">
          <button onClick={handleExport}>Lataa varmuuskopio</button>
          <button onClick={() => fileInput.current?.click()}>Tuo varmuuskopio</button>
        </div>
        <div className="status">{status}</div>
        <input
          ref={fileInput}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImportFile(file);
            e.target.value = '';
          }}
        />
      </main>
      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
    </>
  );
}
