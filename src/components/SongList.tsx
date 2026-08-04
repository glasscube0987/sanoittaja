import { useEffect, useRef, useState } from 'react';
import { formatDate, useI18n } from '../lib/i18n';
import type { Song } from '../lib/types';
import {
  BACKUP_EVENT,
  backupFileName,
  backupIsStale,
  daysSinceBackup,
  downloadBlob,
  exportLibrary,
  importLibrary,
  markBackupTaken,
  shareBlob,
} from '../lib/sync/exportFile';
import type { ImportResult } from '../lib/importText';
import CloudSheet from './CloudSheet';
import Icon from './Icon';
import ImportSheet from './ImportSheet';
import SettingsSheet from './SettingsSheet';

interface Props {
  songs: Song[];
  onOpen: (songId: string) => void;
  onCreate: () => void;
  onImport: (result: ImportResult) => void;
  onLibraryChanged: () => void;
}

export default function SongList({ songs, onOpen, onCreate, onImport, onLibraryChanged }: Props) {
  const { t, lang } = useI18n();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cloudOpen, setCloudOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [status, setStatus] = useState('');
  const [backupDays, setBackupDays] = useState(daysSinceBackup);
  const fileInput = useRef<HTMLInputElement>(null);

  // Myös taustalla otettu kopio päivittää huomautuksen.
  useEffect(() => {
    const onBackup = () => setBackupDays(daysSinceBackup());
    window.addEventListener(BACKUP_EVENT, onBackup);
    return () => window.removeEventListener(BACKUP_EVENT, onBackup);
  }, []);

  const errorText = (err: unknown) =>
    t('common.error', { message: err instanceof Error ? err.message : String(err) });

  async function handleExport() {
    try {
      setStatus(t('list.preparingBackup'));
      const blob = await exportLibrary();
      const name = backupFileName();
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
        <button
          className="icon-button"
          onClick={() => setSettingsOpen(true)}
          aria-label={t('list.settings')}
        >
          <Icon name="settings" />
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
            <span className="song-card-text">
              <span className="title">{song.title || t('app.untitled')}</span>
              <span className="meta">
                {song.songKey ? `${song.songKey} · ` : ''}
                {t('list.meta', {
                  // Sointurivit lasketaan mukaan, jottei pelkistä tahdeista koostuva
                  // laulu näytä tyhjältä.
                  lines: song.lines.filter((l) => l.text.trim() || l.bars?.length).length,
                  date: formatDate(song.updatedAt, lang),
                })}
              </span>
            </span>
            <Icon name="chevronRight" size={18} />
          </button>
        ))}
        {/* Vanhat laulut ovat muualla kirjoitettuina; tuonti on laulun luonnin
            rinnakkainen tapa, joten se on listalla eikä asetuksissa. */}
        <div className="button-row">
          <button onClick={() => setImportOpen(true)}>{t('import.open')}</button>
        </div>

        {/* Varmuuskopio koskee koko kirjastoa, joten myös pilvivienti kuuluu
            tänne eikä yksittäisen laulun editoriin. */}
        <div className="button-row">
          <button onClick={handleExport}>{t('list.downloadBackup')}</button>
          <button onClick={() => setCloudOpen(true)}>{t('list.cloudBackup')}</button>
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
      {importOpen && (
        <ImportSheet
          mode="new"
          onImport={(result) => {
            setImportOpen(false);
            onImport(result);
          }}
          onClose={() => setImportOpen(false)}
        />
      )}
      {cloudOpen && (
        <CloudSheet onClose={() => setCloudOpen(false)} onBackedUp={() => setBackupDays(daysSinceBackup())} />
      )}
    </>
  );
}
