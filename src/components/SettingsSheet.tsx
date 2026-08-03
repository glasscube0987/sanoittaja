import { useState } from 'react';
import { LANG_NAMES, LANGS, useI18n } from '../lib/i18n';
import { getDropboxClientId, setDropboxClientId } from '../lib/sync/dropbox';
import { getGdriveClientId, setGdriveClientId } from '../lib/sync/gdrive';

interface Props {
  onClose: () => void;
}

export default function SettingsSheet({ onClose }: Props) {
  const { t, lang, setLang } = useI18n();
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
        <h2>{t('settings.title')}</h2>

        <div className="field">
          <label>{t('settings.language')}</label>
          {/* Kieli vaihtuu heti valittaessa, jotta muutoksen näkee ennen tallennusta. */}
          <div className="chip-row">
            {LANGS.map((option) => (
              <button
                type="button"
                key={option}
                className={option === lang ? 'primary' : ''}
                onClick={() => setLang(option)}
              >
                {LANG_NAMES[option]}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="dropbox-id">{t('settings.dropboxKey')}</label>
          <input
            id="dropbox-id"
            value={dropboxId}
            onChange={(e) => setDropboxId(e.target.value)}
            autoCapitalize="off"
            autoComplete="off"
            spellCheck={false}
          />
          <small>{t('settings.dropboxHelp')}</small>
        </div>

        <div className="field">
          <label htmlFor="gdrive-id">{t('settings.gdriveKey')}</label>
          <input
            id="gdrive-id"
            value={gdriveId}
            onChange={(e) => setGdriveId(e.target.value)}
            autoCapitalize="off"
            autoComplete="off"
            spellCheck={false}
          />
          <small>{t('settings.gdriveHelp')}</small>
        </div>

        <div className="button-row">
          <button className="primary" onClick={save}>
            {t('common.save')}
          </button>
          <button className="ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
