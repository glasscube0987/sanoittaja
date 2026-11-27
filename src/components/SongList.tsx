import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { formatDate, useI18n } from '../lib/i18n';
import type { Setlist, Song } from '../lib/types';
import { addSongs, moveSong, newSetlist, removeSong, renameSetlist, setlistSongs } from '../lib/setlists';
import { loadSortOrder, SORT_ORDERS, sortSongs, storeSortOrder } from '../lib/sortSongs';
import { searchSongs } from '../lib/searchSongs';
import { allTags, filterByTags, sameTag } from '../lib/tags';
import type { SongMatch } from '../lib/searchSongs';
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
import ConfirmSheet from './ConfirmSheet';
import Icon from './Icon';
import IdeaSheet from './IdeaSheet';
import type { IdeaRecording } from './IdeaSheet';
import ImportSheet from './ImportSheet';
import NameSheet from './NameSheet';
import SetlistPicker from './SetlistPicker';
import SettingsSheet from './SettingsSheet';
import SwipeRow from './SwipeRow';
import { useDialog } from './useDialog';

interface Props {
  songs: Song[];
  setlists: Setlist[];
  onOpen: (songId: string) => void;
  onCreate: () => void;
  onImport: (result: ImportResult) => void;
  /** Nauhoitettu idea: luo laulun ja tallentaa nauhoitteen sen alle. */
  onIdea: (rec: IdeaRecording) => void;
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
  onIdea,
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
  /* Haku on hetken työkalu eikä asetus, joten sitä ei muisteta kuten
     lajittelujärjestystä: laulusta palatessa lista on taas kokonaisena. */
  const [query, setQuery] = useState('');
  /* Tagivalinta on haun kaltainen hetken työkalu eikä asetus: laulusta
     palatessa lista on taas kokonaisena, eikä kirjasto näytä tyhjältä siksi
     että viime viikon suodatin on yhä päällä. */
  const [valitutTagit, setValitutTagit] = useState<string[]>([]);
  /* Tagit ja järjestys ovat suodatinpaneelissa hakukentän takana. Neljä
     ohjainriviä ennen ensimmäistä laulua vei puhelimen ruudusta puolet, ja
     niistä kahteen kosketaan harvoin. */
  const [suodattimet, setSuodattimet] = useState(false);
  /* Setin nimeäminen ja poisto omina lakanoinaan selaimen kyselyikkunoiden
     sijaan; ks. NameSheet ja ConfirmSheet. */
  const [nimeys, setNimeys] = useState<'new' | 'rename' | null>(null);
  const [poistaSettiAuki, setPoistaSettiAuki] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [ideaOpen, setIdeaOpen] = useState(false);
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

  // Tagit koko kirjastosta eikä suodatetusta: muuten valinta söisi ne chipit
  // joilla valinnan voisi purkaa.
  const kirjastonTagit = useMemo(() => allTags(songs, lang), [songs, lang]);

  /*
   * Valinta rajataan niihin tageihin jotka kirjastossa yhä ovat.
   *
   * Tuonti tai pilvihaku voi vaihtaa kirjaston listan ollessa auki, ja jos
   * valittu tagi katoaa sen mukana, päälle jäänyt suodatin tyhjentäisi listan
   * ilman yhtään chippiä jolla sen voisi purkaa – näkymästä ei pääsisi ulos
   * muuten kuin lataamalla sivun uudelleen.
   */
  const aktiiviset = useMemo(
    () => valitutTagit.filter((tag) => kirjastonTagit.some((v) => sameTag(v, tag))),
    [valitutTagit, kirjastonTagit],
  );

  // Setti näyttää laulut omassa järjestyksessään, kirjasto viimeksi muokattu ensin.
  /* Lajittelu ja suodatus koskevat vain koko kirjastoa: setissä järjestys on
     käyttäjän itse asettama esitysjärjestys, eikä sitä saa lajitella pois alta. */
  /* Tagit ensin, sitten lajittelu, sitten haku: tagit ja haku vain kaventavat
     samaa listaa, ja lajittelu niiden välissä säilyy, koska haku pitää
     lähtöjärjestyksen – tulos on lajiteltu ilman erillistä lajittelua
     osumille. */
  const naytetyt: SongMatch[] = setlist
    ? setlistSongs(setlist, songs).map((song) => ({ song }))
    : searchSongs(
        sortSongs(filterByTags(songs, aktiiviset), sort, lang, t('app.untitled')),
        query,
        t('app.untitled'),
      );

  function vaihdaTagi(tag: string) {
    setValitutTagit((prev) =>
      prev.some((v) => sameTag(v, tag)) ? prev.filter((v) => !sameTag(v, tag)) : [...prev, tag],
    );
  }

  function vaihdaJarjestys(order: SortOrder) {
    setSort(order);
    storeSortOrder(order);
  }

  function luoSetti() {
    setNimeys('new');
  }

  function nimeaSetti() {
    if (setlist) setNimeys('rename');
  }

  function tallennaNimi(name: string) {
    if (nimeys === 'rename' && setlist) {
      onSetlistChange(renameSetlist(setlist, name));
    } else {
      const list = newSetlist(name);
      onSetlistChange(list);
      setSetlistId(list.id);
    }
    setNimeys(null);
  }

  function poistaSetti() {
    if (setlist) setPoistaSettiAuki(true);
  }

  function vahvistaSetinPoisto() {
    if (setlist) {
      onSetlistDelete(setlist.id);
      setSetlistId(null);
    }
    setPoistaSettiAuki(false);
  }

  return (
    <>
      {/* Kirjaston yläreunassa iltarusko: ainoa paikka sovelluksessa jossa
          liukuväri on taustana. Se kertoo missä ollaan, eikä toistu muualla
          ettei se kulu. */}
      <header className="topbar home">
        <h1 className="brand">{t('app.name')}</h1>
        <button
          className="icon-button"
          onClick={() => setSettingsOpen(true)}
          aria-label={t('list.settings')}
        >
          <Icon name="settings" />
        </button>
        {/* Idea kestää kymmenen sekuntia, joten nauhoitus on yhden napautuksen
            päässä eikä valikon takana. Sama toiminto on myös luontilakanassa
            löydettävyyden vuoksi. */}
        <button
          className="icon-button"
          onClick={() => setIdeaOpen(true)}
          aria-label={t('idea.record')}
        >
          <Icon name="mic" />
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

        {/* Haku vain koko kirjastolle, samoin kuin lajittelu: setti on lyhyt ja
            sen järjestys on esitysjärjestys. Suodattimet hakukentän vieressä
            samalla rivillä, koska ne ovat sama asia – listan kaventamista. */}
        {!setlist && songs.length > 1 && (
          <div className="search-row">
            <input
              className="search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('list.searchPlaceholder')}
              aria-label={t('list.search')}
              autoCapitalize="off"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              className={suodattimet || aktiiviset.length > 0 ? 'icon-button filter-toggle current' : 'icon-button filter-toggle'}
              aria-label={t('list.filters')}
              aria-expanded={suodattimet}
              onClick={() => setSuodattimet((auki) => !auki)}
            >
              <Icon name="filter" />
              {/* Määrä näkyy myös paneelin ollessa kiinni: kavennettu lista ei
                  saa näyttää koko kirjastolta. */}
              {aktiiviset.length > 0 && <span className="filter-count">{aktiiviset.length}</span>}
            </button>
          </div>
        )}

        {!setlist && songs.length > 1 && suodattimet && (
          <div className="filter-panel">
            {/* Tagivalitsin vain jos tageja on olemassa: tyhjä valitsinrivi
                olisi pelkkä selittämätön otsikko niille jotka eivät tageja
                käytä. */}
            {kirjastonTagit.length > 0 && (
              <div className="tag-bar" role="group" aria-label={t('tags.filter')}>
                <span className="label">{t('tags.label')}</span>
                {kirjastonTagit.map((tag) => {
                  const paalla = aktiiviset.some((v) => sameTag(v, tag));
                  return (
                    <button
                      key={tag}
                      className={paalla ? 'tag small current' : 'tag small'}
                      aria-pressed={paalla}
                      onClick={() => vaihdaTagi(tag)}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            )}
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
          </div>
        )}

        {/* Paneelin ollessa kiinni valitut tagit näkyvät hakurivin alla ja ne
            voi purkaa suoraan: päällä oleva suodatin ei saa jäädä näkymättömiin
            paneelin taakse. */}
        {!setlist && !suodattimet && aktiiviset.length > 0 && (
          <div className="active-filters" role="group" aria-label={t('tags.active')}>
            {aktiiviset.map((tag) => (
              <button
                key={tag}
                className="tag small current"
                aria-label={t('tags.removeFilter', { tag })}
                onClick={() => vaihdaTagi(tag)}
              >
                {tag} ×
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
              onClick={() => onLive(naytetyt.map((m) => m.song.id), 0)}
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
        {/* Nykyinen huomautus kertoo hakusanan, joten pelkällä tagisuodatuksella
            tyhjä lista jäisi selittämättä: ilman hakusanaa näytetään tagien oma
            huomautus. */}
        {!setlist && naytetyt.length === 0 && songs.length > 0 && (
          <p className="empty-note">
            {query.trim() ? t('list.noMatches', { query: query.trim() }) : t('list.noTagMatches')}
          </p>
        )}
        {setlist && naytetyt.length === 0 && songs.length > 0 && (
          <p className="empty-note">
            {t('set.empty')}
            <br />
            {t('set.emptyHint')}
          </p>
        )}
        {/* Rivit yhdessä laatikossa eivätkä näkymän väleillä: hiusviivoin
            erotettu lista luetaan yhtenä kokonaisuutena, ja näkymän välistys
            olisi irrottanut rivit toisistaan kuin erilliset kortit. */}
        <div className="song-list">
          {naytetyt.map(({ song, snippet }, i) => {
            const kortti = (
              <button className="song-card" onClick={() => onOpen(song.id)}>
                {/* Sävellaji omassa sarakkeessaan rivin alussa, kuten tekijän
                    sivuston päivämäärät: se on se mitä etsitään kun bändi kysyy
                    «missä sävellajissa?», ja sarakkeena sen löytää silmäilemällä. */}
                <span className="song-key">{song.songKey}</span>
                <span className="song-card-text">
                  <span className="title">
                    {setlist && <span className="song-number">{i + 1}.</span>}
                    {song.title || t('app.untitled')}
                  </span>
                  <span className="meta">
                    {t('list.meta', {
                      // Sointurivit lasketaan mukaan, jottei pelkistä tahdeista koostuva
                      // laulu näytä tyhjältä.
                      lines: song.lines.filter((l) => l.text.trim() || l.bars?.length).length,
                      date: formatDate(song.updatedAt, lang),
                    })}
                  </span>
                  {/* Tagit metarivin alle eivätkä sen sisään: ne ovat lyhyitä,
                      mutta kolme tagia ja päiväys samalla rivillä kiertyisi
                      kahdelle puhelimen leveydellä. */}
                  {song.tags && song.tags.length > 0 && (
                    <span className="card-tags">
                      {song.tags.map((tag) => (
                        <span className="card-tag" key={tag}>
                          {tag}
                        </span>
                      ))}
                    </span>
                  )}
                  {/* Katkelma kertoo miksi laulu on listalla silloin kun syy ei
                      ole otsikossa; ilman sitä suodatus näyttäisi satunnaiselta. */}
                  {snippet && <span className="snippet">{snippet}</span>}
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
        </div>
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
        <NewSongSheet
          onClose={() => setNewOpen(false)}
          onBlank={() => {
            setNewOpen(false);
            onCreate();
          }}
          onFromText={() => {
            setNewOpen(false);
            setImportOpen(true);
          }}
          onIdea={() => {
            setNewOpen(false);
            setIdeaOpen(true);
          }}
        />
      )}
      {ideaOpen && (
        <IdeaSheet
          onDone={(rec) => {
            setIdeaOpen(false);
            onIdea(rec);
          }}
          onCancel={() => setIdeaOpen(false)}
        />
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
        <CloudSheet
          onClose={() => setCloudOpen(false)}
          onBackedUp={() => setBackupDays(daysSinceBackup())}
          onImported={onLibraryChanged}
        />
      )}
      {nimeys && (
        <NameSheet
          title={t(nimeys === 'rename' ? 'set.renameTitle' : 'set.newTitle')}
          label={t('set.namePrompt')}
          initial={nimeys === 'rename' ? setlist?.name ?? '' : ''}
          onSave={tallennaNimi}
          onCancel={() => setNimeys(null)}
        />
      )}
      {poistaSettiAuki && setlist && (
        <ConfirmSheet
          title={t('set.confirmDelete', { name: setlist.name })}
          confirmLabel={t('set.deleteConfirm')}
          danger
          onConfirm={vahvistaSetinPoisto}
          onCancel={() => setPoistaSettiAuki(false)}
        />
      )}
    </>
  );
}

/** Uuden laulun valinta: tyhjä, tekstistä vai nauhoitettu idea. */
function NewSongSheet({
  onClose,
  onBlank,
  onFromText,
  onIdea,
}: {
  onClose: () => void;
  onBlank: () => void;
  onFromText: () => void;
  onIdea: () => void;
}) {
  const { t } = useI18n();
  const dialogi = useRef<HTMLDivElement>(null);
  const otsikko = useId();
  useDialog(dialogi, onClose);
  return (
    <div className="overlay" onClick={onClose}>
      <div
        ref={dialogi}
        role="dialog"
        aria-modal="true"
        aria-labelledby={otsikko}
        className="sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={otsikko}>{t('list.newTitle')}</h2>
        <div className="button-row">
          <button className="primary" onClick={onBlank}>
            {t('list.newBlank')}
          </button>
          <button onClick={onFromText}>{t('list.newFromText')}</button>
          <button onClick={onIdea}>{t('list.newIdea')}</button>
          <button className="ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
