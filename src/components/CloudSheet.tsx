import { useState } from 'react';
import { useT } from '../lib/i18n';
import { dropboxProvider } from '../lib/sync/dropbox';
import { gdriveProvider } from '../lib/sync/gdrive';
import { markCloudBackupTaken } from '../lib/sync/autoBackup';
import { backupFileName, exportLibrary, markBackupTaken } from '../lib/sync/exportFile';
import { importLibrary } from '../lib/sync/exportFile';
import { formatSize } from '../lib/sync/exportFile';
import type { CloudFile, CloudProvider } from '../lib/sync/provider';
import SettingsSheet from './SettingsSheet';

interface Props {
  onClose: () => void;
  /** Kutsutaan onnistuneen viennin jälkeen, jotta listan huomautus päivittyy. */
  onBackedUp: () => void;
  /** Kutsutaan kun pilvestä haettu kopio on yhdistetty kirjastoon. */
  onImported: () => void;
}

export default function CloudSheet({ onClose, onBackedUp, onImported }: Props) {
  const t = useT();
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  /* null = listaa ei ole haettu; tyhjä taulukko = haettiin eikä löytynyt. */
  const [files, setFiles] = useState<CloudFile[] | null>(null);

  async function upload(provider: CloudProvider) {
    if (!provider.isConfigured()) {
      setStatus(t('cloud.needsClientId', { provider: provider.label }));
      return;
    }
    setBusy(true);
    try {
      if (provider.id === 'dropbox' && !provider.isConnected()) {
        setStatus(t('cloud.signingIn', { provider: provider.label }));
        await provider.connect(); // uudelleenohjaa pois sovelluksesta
        return;
      }
      setStatus(t('cloud.exporting', { provider: provider.label }));
      const name = backupFileName();
      await provider.uploadBackup(await exportLibrary(), name);
      // Pilveen viety paketti on sama palautuva varmuuskopio kuin tiedostoon
      // tallennettu, joten se nollaa myös muistutuksen. Taustakopion aikaleima
      // päivittyy samalla, jottei automatiikka toistaisi juuri tehtyä työtä.
      markBackupTaken();
      if (provider.id === 'dropbox') markCloudBackupTaken();
      onBackedUp();
      setStatus(t('cloud.done', { file: name, provider: provider.label }));
    } catch (err) {
      setStatus(t('common.error', { message: err instanceof Error ? err.message : String(err) }));
    } finally {
      setBusy(false);
    }
  }

  /**
   * Haku on tahallaan käyttäjän napautus eikä taustatoiminto: ensimmäinen
   * versio joka yhdistää taustalla on juuri se, jonka vikoja ei huomaa ennen
   * kuin jotain on jo väärin.
   */
  async function listaa() {
    if (!dropboxProvider.listBackups) return;
    setBusy(true);
    try {
      if (!dropboxProvider.isConnected()) {
        setStatus(t('cloud.signingIn', { provider: dropboxProvider.label }));
        await dropboxProvider.connect();
        return;
      }
      setStatus(t('cloud.listing'));
      const rows = await dropboxProvider.listBackups();
      setFiles(rows);
      setStatus(rows.length === 0 ? t('cloud.noBackups') : '');
    } catch (err) {
      setStatus(t('common.error', { message: err instanceof Error ? err.message : String(err) }));
    } finally {
      setBusy(false);
    }
  }

  async function hae(file: CloudFile) {
    if (!dropboxProvider.downloadBackup) return;
    setBusy(true);
    try {
      setStatus(t('cloud.fetching', { file: file.name }));
      const blob = await dropboxProvider.downloadBackup(file.path);
      const result = await importLibrary(blob);
      onImported();
      /* Väliin jätetyt kerrotaan erikseen: se on ainoa merkki siitä että
         turvasääntö esti vanhempaa versiota ylikirjoittamasta uudempaa. */
      setStatus(
        t('cloud.merged', {
          songs: result.songs,
          recordings: result.recordings,
          skipped: result.skipped,
        }),
      );
    } catch (err) {
      setStatus(t('common.error', { message: err instanceof Error ? err.message : String(err) }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>{t('cloud.title')}</h2>
        <p className="status">{t('cloud.description')}</p>
        <div className="button-row">
          <button disabled={busy} onClick={() => upload(dropboxProvider)}>
            {t(dropboxProvider.isConnected() ? 'cloud.exportDropbox' : 'cloud.signInDropbox')}
          </button>
          <button disabled={busy} onClick={() => upload(gdriveProvider)}>
            {t('cloud.exportDrive')}
          </button>
        </div>
        {/* Haku vain Dropboxille, samoin kuin taustakopio: Driven token elää
            vain istunnon ajan. */}
        {dropboxProvider.listBackups && (
          <div className="button-row">
            <button disabled={busy} onClick={listaa}>
              {t('cloud.fetchFromCloud')}
            </button>
          </div>
        )}

        {files && files.length > 0 && (
          <div className="cloud-files">
            {files.map((file) => (
              <button key={file.path} disabled={busy} onClick={() => hae(file)}>
                <span className="cloud-file-name">{file.name}</span>
                <span className="cloud-file-meta">
                  {new Date(file.modifiedAt).toLocaleString()} · {formatSize(file.size)}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="status">{status}</div>
        <div className="button-row">
          <button className="ghost" onClick={() => setSettingsOpen(true)}>
            {t('cloud.settings')}
          </button>
          <button className="ghost" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
        {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
      </div>
    </div>
  );
}
