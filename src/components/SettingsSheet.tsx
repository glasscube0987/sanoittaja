import { useState } from 'react';
import { LANG_NAMES, LANGS, useI18n } from '../lib/i18n';
import { autoBackupEnabled, setAutoBackupEnabled } from '../lib/sync/autoBackup';
import { DEFAULT_CLIENT_ID, getDropboxClientIdOverride, setDropboxClientId } from '../lib/sync/dropbox';
import { getGdriveClientId, setGdriveClientId } from '../lib/sync/gdrive';

interface Props {
  onClose: () => void;
  /**
   * Koko kirjastoa koskevat toiminnot. Ne olivat aiemmin laululistan alalaidassa,
   * jolloin varmuuskopiointi vaati koko listan ohi vierittämisen. Ne ovat harvoin
   * tarvittavia mutta tärkeitä, joten ne kuuluvat valikkoon eivätkä listaan.
   *
   * Toiminto sulkee asetukset ja suorittaa itsensä, jolloin tilaviesti näkyy
   * listalla siellä missä se ennenkin näkyi.
   */
  onBackup?: () => void;
  onCloud?: () => void;
  onRestore?: () => void;
  onImportText?: () => void;
}

export default function SettingsSheet({
  onClose,
  onBackup,
  onCloud,
  onRestore,
  onImportText,
}: Props) {
  const { t, lang, setLang } = useI18n();
  const [dropboxId, setDropboxId] = useState(getDropboxClientIdOverride());
  const [gdriveId, setGdriveId] = useState(getGdriveClientId());
  const [autoBackup, setAutoBackup] = useState(autoBackupEnabled());

  function save() {
    setDropboxClientId(dropboxId);
    setGdriveClientId(gdriveId);
    setAutoBackupEnabled(autoBackup);
    onClose();
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>{t('settings.title')}</h2>

        {/* Pilvinäkymästä avattuna asetuksissa on vain tunnukset: kirjaston
            toiminnot kuuluvat laululistalle eivätkä pilvivalikon sisään. */}
        {onBackup && onCloud && onRestore && onImportText && (
          <>
            <h3 className="settings-group">{t('settings.library')}</h3>
            <div className="field">
              <div className="button-row">
                <button onClick={onBackup}>{t('list.downloadBackup')}</button>
                <button onClick={onCloud}>{t('list.cloudBackup')}</button>
                <button onClick={onRestore}>{t('list.importBackup')}</button>
                <button onClick={onImportText}>{t('import.open')}</button>
              </div>
            </div>
          </>
        )}

        <h3 className="settings-group">{t('settings.preferences')}</h3>
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
          <label className="check">
            <input
              type="checkbox"
              checked={autoBackup}
              onChange={(e) => setAutoBackup(e.target.checked)}
            />
            {t('settings.autoBackup')}
          </label>
          <small>{t('settings.autoBackupHelp')}</small>
        </div>

        <h3 className="settings-group">{t('settings.credentials')}</h3>
        <div className="field">
          <label htmlFor="dropbox-id">{t('settings.dropboxKey')}</label>
          <input
            id="dropbox-id"
            value={dropboxId}
            placeholder={DEFAULT_CLIENT_ID}
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
