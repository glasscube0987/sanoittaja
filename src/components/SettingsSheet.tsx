import { useState } from 'react';
import { getDropboxClientId, setDropboxClientId } from '../lib/sync/dropbox';
import { getGdriveClientId, setGdriveClientId } from '../lib/sync/gdrive';

interface Props {
  onClose: () => void;
}

export default function SettingsSheet({ onClose }: Props) {
  const [dropboxId, setDropboxId] = useState(getDropboxClientId());
  const [gdriveId, setGdriveId] = useState(getGdriveClientId());

  function save() {
    setDropboxClientId(dropboxId);
    setGdriveClientId(gdriveId);
    onClose();
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>Pilviasetukset</h2>
        <div className="field">
          <label htmlFor="dropbox-id">Dropbox app key</label>
          <input
            id="dropbox-id"
            value={dropboxId}
            onChange={(e) => setDropboxId(e.target.value)}
            autoCapitalize="off"
            autoComplete="off"
            spellCheck={false}
          />
          <small>
            Luo ilmainen sovellus osoitteessa dropbox.com/developers/apps (scoped access, App folder,
            oikeus files.content.write) ja lisää tämän sovelluksen osoite Redirect URI -listaan.
          </small>
        </div>
        <div className="field">
          <label htmlFor="gdrive-id">Google OAuth client id</label>
          <input
            id="gdrive-id"
            value={gdriveId}
            onChange={(e) => setGdriveId(e.target.value)}
            autoCapitalize="off"
            autoComplete="off"
            spellCheck={false}
          />
          <small>
            Luo OAuth client id (Web application) osoitteessa console.cloud.google.com, ota Drive API
            käyttöön ja lisää tämän sovelluksen osoite sallittuihin JavaScript-lähteisiin.
          </small>
        </div>
        <div className="button-row">
          <button className="primary" onClick={save}>
            Tallenna
          </button>
          <button className="ghost" onClick={onClose}>
            Peruuta
          </button>
        </div>
      </div>
    </div>
  );
}
