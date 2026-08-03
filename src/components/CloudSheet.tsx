import { useState } from 'react';
import { listRecordings } from '../lib/db';
import { useT } from '../lib/i18n';
import { dropboxProvider } from '../lib/sync/dropbox';
import { gdriveProvider } from '../lib/sync/gdrive';
import type { CloudProvider } from '../lib/sync/provider';
import type { Song } from '../lib/types';
import SettingsSheet from './SettingsSheet';

interface Props {
  song: Song;
  onClose: () => void;
}

export default function CloudSheet({ song, onClose }: Props) {
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
    setStatus(t('cloud.exporting', { provider: provider.label }));
    try {
      if (provider.id === 'dropbox' && !provider.isConnected()) {
        await provider.connect(); // uudelleenohjaa pois sovelluksesta
        return;
      }
      const recordings = await listRecordings(song.id);
      const result = await provider.uploadSong(song, recordings);
      setStatus(t('cloud.done', { files: result.files, provider: provider.label }));
    } catch (err) {
      setStatus(t('common.error', { message: err instanceof Error ? err.message : String(err) }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>{t('cloud.title', { title: song.title || t('app.untitled') })}</h2>
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
