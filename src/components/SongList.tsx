import { useRef, useState } from 'react';
import { formatDate, useI18n } from '../lib/i18n';
import type { Song } from '../lib/types';
import {
  backupIsStale,
  daysSinceBackup,
  downloadBlob,
  exportLibrary,
  importLibrary,
  markBackupTaken,
  shareBlob,
} from '../lib/sync/exportFile';
import SettingsSheet from './SettingsSheet';

interface Props {
  songs: Song[];
  onOpen: (songId: string) => void;
  onCreate: () => void;
  onLibraryChanged: () => void;
}

export default function SongList({ songs, onOpen, onCreate, onLibraryChanged }: Props) {
  const { t, lang } = useI18n();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [status, setStatus] = useState('');
  const [backupDays, setBackupDays] = useState(daysSinceBackup);
  const fileInput = useRef<HTMLInputElement>(null);

  const errorText = (err: unknown) =>
    t('common.error', { message: err instanceof Error ? err.message : String(err) });

  async function handleExport() {
    try {
      setStatus(t('list.preparingBackup'));
      const blob = await exportLibrary();
      const name = `sanoittaja-varmuuskopio-${new Date().toISOString().slice(0, 10)}.json`;
      // Jakovalikko ensin: iPhonella tiedosto menee sieltä suoraan Tiedostoihin
      // tai iCloud Driveen. Työpöydällä pudotaan lataukseen.
      if (!(await shareBlob(blob, name))) downloadBlob(blob, name);
      markBackupTaken();
      setBackupDays(daysSinceBackup());
      setStatus(t('list.backupDownloaded'));
    } catch (err) {
      setStatus(errorText(err));
    }
  }

  function backupNote(): string {
    if (backupDays === null) return t('list.backupNever');
    if (backupIsStale()) return t('list.backupStale', { days: backupDays });
    if (backupDays === 0) return t('list.backupToday');
    return t('list.backupDays', { days: backupDays });
  }

  async function handleImportFile(file: File) {
    try {
      setStatus(t('list.importing'));
      const result = await importLibrary(file);
      onLibraryChanged();
      setBackupDays(daysSinceBackup());
      setStatus(t('list.imported', { songs: result.songs, recordings: result.recordings }));
    } catch (err) {
      setStatus(errorText(err));
    }
  }

  return (
    <>
      <header className="topbar">
        <h1>Sanoittaja</h1>
        <button className="ghost" onClick={() => setSettingsOpen(true)} aria-label={t('list.settings')}>
          ⚙︎
        </button>
        <button className="primary" onClick={onCreate}>
          {t('list.newSong')}
        </button>
      </header>
      <main className="screen">
        {songs.length === 0 && (
          <p className="empty-note">
            {t('list.emptyTitle')}
            <br />
            {t('list.emptyHint')}
          </p>
        )}
        {songs.map((song) => (
          <button key={song.id} className="song-card" onClick={() => onOpen(song.id)}>
            <div className="title">{song.title || t('app.untitled')}</div>
            <div className="meta">
              {song.songKey ? `${song.songKey} · ` : ''}
              {t('list.meta', {
                // Sointurivit lasketaan mukaan, jottei pelkistä tahdeista koostuva
                // laulu näytä tyhjältä.
                lines: song.lines.filter((l) => l.text.trim() || l.bars?.length).length,
                date: formatDate(song.updatedAt, lang),
              })}
            </div>
          </button>
        ))}
        <div className="button-row">
          <button onClick={handleExport}>{t('list.downloadBackup')}</button>
          <button onClick={() => fileInput.current?.click()}>{t('list.importBackup')}</button>
        </div>
        <div className={backupIsStale() ? 'status backup-note stale' : 'status backup-note'}>
          {backupNote()}
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
