import { useEffect, useRef, useState } from 'react';
import { formatDate, useI18n } from '../lib/i18n';
import type { Setlist, Song } from '../lib/types';
import { addSongs, moveSong, newSetlist, removeSong, renameSetlist, setlistSongs } from '../lib/setlists';
import { loadSortOrder, SORT_ORDERS, sortSongs, storeSortOrder } from '../lib/sortSongs';
import type { SortOrder } from '../lib/sortSongs';
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
import SetlistPicker from './SetlistPicker';
import SettingsSheet from './SettingsSheet';
import SwipeRow from './SwipeRow';

interface Props {
  songs: Song[];
  setlists: Setlist[];
  onOpen: (songId: string) => void;
  onCreate: () => void;
  onImport: (result: ImportResult) => void;
  onLibraryChanged: () => void;
  onSetlistChange: (list: Setlist) => void;
  onSetlistDelete: (id: string) => void;
  onLive: (songIds: string[], index: number) => void;
}

export default function SongList({
  songs,
  setlists,
  onOpen,
  onCreate,
  onImport,
  onLibraryChanged,
  onSetlistChange,
  onSetlistDelete,
  onLive,
}: Props) {
  const { t, lang } = useI18n();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cloudOpen, setCloudOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [status, setStatus] = useState('');
  // null = ”Kaikki laulut”, joka ei ole tallennettu setti vaan oletusnäkymä.
  const [setlistId, setSetlistId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  /* Vain yksi rivi kerrallaan auki, jotta poistopainikkeita ei jää roikkumaan. */
  const [avoinId, setAvoinId] = useState<string | null>(null);
  const [sort, setSort] = useState<SortOrder>(loadSortOrder);
  const [newOpen, setNewOpen] = useState(false);
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

  const setlist = setlists.find((l) => l.id === setlistId) ?? null;
  // Setti näyttää laulut omassa järjestyksessään, kirjasto viimeksi muokattu ensin.
  /* Lajittelu koskee vain koko kirjastoa: setissä järjestys on käyttäjän itse
     asettama esitysjärjestys, eikä sitä saa lajitella pois alta. */
  const naytetyt = setlist
    ? setlistSongs(setlist, songs)
    : sortSongs(songs, sort, lang, t('app.untitled'));

  function vaihdaJarjestys(order: SortOrder) {
    setSort(order);
    storeSortOrder(order);
  }

  function luoSetti() {
    const name = prompt(t('set.namePrompt'))?.trim();
    if (!name) return;
    const list = newSetlist(name);
    onSetlistChange(list);
    setSetlistId(list.id);
  }

  function nimeaSetti() {
    if (!setlist) return;
    const name = prompt(t('set.namePrompt'), setlist.name)?.trim();
    if (!name) return;
    onSetlistChange(renameSetlist(setlist, name));
  }

  function poistaSetti() {
    if (!setlist) return;
    if (!confirm(t('set.confirmDelete', { name: setlist.name }))) return;
    onSetlistDelete(setlist.id);
    setSetlistId(null);
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
        {/* Valinta eikä suora luonti: tyhjä laulu tallentuu heti, joten
            «luo tyhjä ja tuo sitten» jättäisi keskeytettäessä tyhjän laulun. */}
        <button className="primary" onClick={() => setNewOpen(true)}>
          {t('list.newSong')}
        </button>
      </header>
      <main className="screen">
        {/* Settivalitsin: ”Kaikki laulut” ensimmäisenä, jotta koko kirjasto on
            aina yhden napautuksen päässä myös setin sisältä. */}
        <div className="setlist-bar">
          <button
            className={setlist ? '' : 'primary'}
            onClick={() => setSetlistId(null)}
          >
            {t('set.all')}
          </button>
          {setlists.map((list) => (
            <button
              key={list.id}
              className={list.id === setlistId ? 'primary' : ''}
              onClick={() => setSetlistId(list.id)}
            >
              {list.name}
            </button>
          ))}
          <button className="ghost" onClick={luoSetti}>
            {t('set.new')}
          </button>
        </div>

        {/* Lajittelu vain koko kirjastolle; setissä järjestys on esitysjärjestys. */}
        {!setlist && songs.length > 1 && (
          <div className="sort-bar">
            <span className="sort-label">{t('sort.label')}</span>
            {SORT_ORDERS.map((order) => (
              <button
                key={order}
                className={order === sort ? 'small current' : 'ghost small'}
                onClick={() => vaihdaJarjestys(order)}
              >
                {t(`sort.${order}`)}
              </button>
            ))}
          </div>
        )}

        {setlist && (
          <div className="button-row">
            <button onClick={() => setPickerOpen(true)}>{t('set.addSongs')}</button>
            <button
              className="primary"
              disabled={naytetyt.length === 0}
              onClick={() => onLive(naytetyt.map((s) => s.id), 0)}
            >
              {t('set.playLive')}
            </button>
            <button className="ghost small" onClick={nimeaSetti}>
              {t('set.rename')}
            </button>
            <button className="ghost small danger" onClick={poistaSetti}>
              {t('set.delete')}
            </button>
          </div>
        )}

        {songs.length === 0 && (
          <p className="empty-note">
            {t('list.emptyTitle')}
            <br />
            {t('list.emptyHint')}
          </p>
        )}
        {setlist && naytetyt.length === 0 && songs.length > 0 && (
          <p className="empty-note">
            {t('set.empty')}
            <br />
            {t('set.emptyHint')}
          </p>
        )}
        {naytetyt.map((song, i) => {
          const kortti = (
            <button className="song-card" onClick={() => onOpen(song.id)}>
              <span className="song-card-text">
                <span className="title">
                  {setlist && <span className="song-number">{i + 1}.</span>}
                  {song.title || t('app.untitled')}
                </span>
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
          );

          if (!setlist) return <div className="song-row" key={song.id}>{kortti}</div>;

          /* Poisto on liu'utuksen takana eikä painikkeena: ✕ rivin reunassa oli
             puhelimella liian helppo osua vahingossa. Vain setissä – «Kaikki
             laulut» -näkymässä sama ele hävittäisi laulun kokonaan. */
          return (
            <div className="song-row" key={song.id}>
              {/* Liu'utus koskee vain korttia: jos koko rivi liukuisi, ▲▼
                  siirtyisivät sen mukana keskelle ruutua. */}
              <SwipeRow
                open={avoinId === song.id}
                onOpenChange={(auki) => setAvoinId(auki ? song.id : null)}
                actionLabel={t('set.removeAction')}
                actionName={t('set.removeSong', { title: song.title || t('app.untitled') })}
                onAction={() => onSetlistChange(removeSong(setlist, song.id))}
              >
                {kortti}
              </SwipeRow>
              <div className="song-order">
                <button
                  className="icon-button small"
                  disabled={i === 0}
                  aria-label={t('set.moveUp', { title: song.title || t('app.untitled') })}
                  onClick={() => onSetlistChange(moveSong(setlist, song.id, -1))}
                >
                  <Icon name="chevronUp" size={18} />
                </button>
                <button
                  className="icon-button small"
                  disabled={i === naytetyt.length - 1}
                  aria-label={t('set.moveDown', { title: song.title || t('app.untitled') })}
                  onClick={() => onSetlistChange(moveSong(setlist, song.id, 1))}
                >
                  <Icon name="chevronDown" size={18} />
                </button>
              </div>
            </div>
          );
        })}
        {/* Varmuuskopiohuomautus jää listalle, koska se on muistutus eikä
            toiminto: valikon takana piilotettuna se ei muistuttaisi mistään.
            Toiminnot itse ovat asetuksissa. */}
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
      {settingsOpen && (
        <SettingsSheet
          onClose={() => setSettingsOpen(false)}
          onBackup={() => {
            setSettingsOpen(false);
            void handleExport();
          }}
          onCloud={() => {
            setSettingsOpen(false);
            setCloudOpen(true);
          }}
          onRestore={() => {
            setSettingsOpen(false);
            fileInput.current?.click();
          }}
          onImportText={() => {
            setSettingsOpen(false);
            setImportOpen(true);
          }}
        />
      )}

      {newOpen && (
        <div className="overlay" onClick={() => setNewOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h2>{t('list.newTitle')}</h2>
            <div className="button-row">
              <button
                className="primary"
                onClick={() => {
                  setNewOpen(false);
                  onCreate();
                }}
              >
                {t('list.newBlank')}
              </button>
              <button
                onClick={() => {
                  setNewOpen(false);
                  setImportOpen(true);
                }}
              >
                {t('list.newFromText')}
              </button>
              <button className="ghost" onClick={() => setNewOpen(false)}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
      {pickerOpen && setlist && (
        <SetlistPicker
          setlist={setlist}
          songs={songs}
          onAdd={(ids) => {
            onSetlistChange(addSongs(setlist, ids));
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
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
