import { useState } from 'react';
import { useT } from '../lib/i18n';
import { dropboxProvider } from '../lib/sync/dropbox';
import { gdriveProvider } from '../lib/sync/gdrive';
import { markCloudBackupTaken } from '../lib/sync/autoBackup';
import { backupFileName, exportLibrary, markBackupTaken } from '../lib/sync/exportFile';
import type { CloudProvider } from '../lib/sync/provider';
import SettingsSheet from './SettingsSheet';

interface Props {
  onClose: () => void;
  /** Kutsutaan onnistuneen viennin jälkeen, jotta listan huomautus päivittyy. */
  onBackedUp: () => void;
}

export default function CloudSheet({ onClose, onBackedUp }: Props) {
  const t = useT();
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
