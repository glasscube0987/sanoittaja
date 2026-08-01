import { useState } from 'react';
import { listRecordings } from '../lib/db';
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
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  async function upload(provider: CloudProvider) {
    if (!provider.isConfigured()) {
      setStatus(`${provider.label}: lisää ensin client id asetuksissa.`);
      return;
    }
    setBusy(true);
    setStatus(`Viedään ${provider.label}en…`);
    try {
      if (provider.id === 'dropbox' && !provider.isConnected()) {
        await provider.connect(); // uudelleenohjaa pois sovelluksesta
        return;
      }
      const recordings = await listRecordings(song.id);
      const result = await provider.uploadSong(song, recordings);
      setStatus(`Valmis: ${result.files} tiedostoa viety (${provider.label}).`);
    } catch (err) {
      setStatus('Virhe: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>Vie pilveen: {song.title || 'Nimetön'}</h2>
        <p className="status">
          Laulun sanat ja soinnut viedään JSON-tiedostona ja nauhoitteet äänitiedostoina laulun omaan
          kansioon.
        </p>
        <div className="button-row">
          <button disabled={busy} onClick={() => upload(dropboxProvider)}>
            {dropboxProvider.isConnected() ? 'Vie Dropboxiin' : 'Kirjaudu Dropboxiin'}
          </button>
          <button disabled={busy} onClick={() => upload(gdriveProvider)}>
            Vie Google Driveen
          </button>
        </div>
        <div className="status">{status}</div>
        <div className="button-row">
          <button className="ghost" onClick={() => setSettingsOpen(true)}>
            Pilviasetukset…
          </button>
          <button className="ghost" onClick={onClose}>
            Sulje
          </button>
        </div>
        {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
      </div>
    </div>
  );
}
