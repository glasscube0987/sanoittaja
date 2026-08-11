import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import LiveView from './components/LiveView';
import SongEditor from './components/SongEditor';
import SongList from './components/SongList';
import {
  deleteSetlist as dbDeleteSetlist,
  deleteSong as dbDeleteSong,
  listSetlists,
  listSongs,
  saveSetlist,
  saveSong,
} from './lib/db';
import type { HistoryEntry } from './lib/history';
import { pushHistory } from './lib/history';
import type { Key, Lang, Params } from './lib/i18n';
import { LangContext, loadLang, storeLang, translate } from './lib/i18n';
import type { ImportResult } from './lib/importText';
import { requestPersistence } from './lib/persist';
import { AUTO_BACKUP_CHECK_MS, markLibraryChanged, maybeAutoBackup } from './lib/sync/autoBackup';
import type { Setlist, Song } from './lib/types';
import { newSong } from './lib/types';

type View = { name: 'list' } | { name: 'editor'; songId: string };

export default function App() {
  const [songs, setSongs] = useState<Song[] | null>(null);
  const [view, setView] = useState<View>({ name: 'list' });
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  /*
   * Live-tila elää täällä eikä editorissa, koska se voi selata settilistan
   * läpi: jono on laulujen tunnuksia, jotka ratkaistaan vasta piirrettäessä,
   * jolloin muokkaus näkyy live-tilassa heti.
   */
  const [live, setLive] = useState<{ ids: string[]; index: number } | null>(null);
  const [lang, setLangState] = useState<Lang>(loadLang);
  // Peruutuspino koskee vain auki olevaa laulua, joten yksi pino riittää.
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const saveTimers = useRef(new Map<string, number>());

  const i18n = useMemo(
    () => ({
      lang,
      t: (key: Key, params?: Params) => translate(lang, key, params),
      setLang: (next: Lang) => {
        storeLang(next);
        setLangState(next);
      },
    }),
    [lang],
  );

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    listSongs().then(setSongs);
    listSetlists().then(setSetlists);
  }, []);

  const updateSetlist = useCallback((list: Setlist) => {
    setSetlists((prev) => {
      const known = prev.some((l) => l.id === list.id);
      return known ? prev.map((l) => (l.id === list.id ? list : l)) : [...prev, list];
    });
    markLibraryChanged();
    saveSetlist(list).catch((err) => console.error('Setin tallennus epäonnistui', err));
  }, []);

  const removeSetlist = useCallback((id: string) => {
    // Setin poisto ei koske lauluihin: ne ovat edelleen kaikissa lauluissa.
    setSetlists((prev) => prev.filter((l) => l.id !== id));
    markLibraryChanged();
    dbDeleteSetlist(id).catch((err) => console.error('Setin poisto epäonnistui', err));
  }, []);

  /*
   * Pyydetään pysyvää tallennustilaa heti käynnistyksessä. Koko kirjasto on
   * selaimen kannassa, ja ilman tätä selain saa häätää sen tilan loppuessa.
   * Kielteinen vastaus ei ole virhe eikä sitä näytetä: varmuuskopio on joka
   * tapauksessa se oikea suoja, tämä vain vähentää tarvetta turvautua siihen.
   */
  useEffect(() => {
    requestPersistence().catch((err) => console.warn('Pysyvää tallennustilaa ei saatu', err));
  }, []);

  // Taustakopio pilveen: tarkistetaan käynnistyessä ja tasaisin välein, sekä
  // kun sovellus palaa näkyviin – silloin se on varmasti hereillä.
  useEffect(() => {
    const check = () => {
      maybeAutoBackup().catch((err) => console.warn('Automaattinen varmuuskopio epäonnistui', err));
    };
    check();
    const timer = window.setInterval(check, AUTO_BACKUP_CHECK_MS);
    const onVisible = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Peruutus koskee aina yhtä laulua kerrallaan, joten pino tyhjenee kun toinen avataan.
  const editingId = view.name === 'editor' ? view.songId : null;
  useEffect(() => {
    setHistory([]);
  }, [editingId]);

  const scheduleSave = useCallback((song: Song) => {
    const timers = saveTimers.current;
    const existing = timers.get(song.id);
    if (existing) window.clearTimeout(existing);
    timers.set(
      song.id,
      window.setTimeout(() => {
        timers.delete(song.id);
        markLibraryChanged();
        saveSong(song).catch((err) => console.error('Tallennus epäonnistui', err));
      }, 400),
    );
  }, []);

  const updateSong = useCallback(
    (song: Song, before?: Song) => {
      if (before) setHistory((stack) => pushHistory(stack, before, song));
      setSongs((prev) => (prev ? prev.map((s) => (s.id === song.id ? song : s)) : prev));
      scheduleSave(song);
    },
    [scheduleSave],
  );

  const startSong = useCallback((song: Song) => {
    setSongs((prev) => [song, ...(prev ?? [])]);
    markLibraryChanged();
    saveSong(song).catch((err) => console.error('Tallennus epäonnistui', err));
    setView({ name: 'editor', songId: song.id });
  }, []);

  const createSong = useCallback(() => startSong(newSong()), [startSong]);

  const importSong = useCallback(
    (result: ImportResult) => {
      const song = newSong(result.title ?? '');
      startSong(result.lines.length > 0 ? { ...song, lines: result.lines } : song);
    },
    [startSong],
  );

  const deleteSong = useCallback((songId: string) => {
    setSongs((prev) => (prev ? prev.filter((s) => s.id !== songId) : prev));
    // Kanta siivoaa viittaukset; sama muutos näkyviin heti ilman uudelleenlukua.
    setSetlists((prev) =>
      prev.map((l) =>
        l.songIds.includes(songId) ? { ...l, songIds: l.songIds.filter((id) => id !== songId) } : l,
      ),
    );
    setView({ name: 'list' });
    markLibraryChanged();
    dbDeleteSong(songId).catch((err) => console.error('Poisto epäonnistui', err));
  }, []);

  const reload = useCallback(() => {
    markLibraryChanged();
    listSongs().then(setSongs);
    listSetlists().then(setSetlists);
  }, []);

  if (songs === null) return null;

  const editing = view.name === 'editor' ? songs.find((s) => s.id === view.songId) : undefined;

  function undo() {
    const entry = history[history.length - 1];
    if (!entry) return;
    const restored = { ...entry.song, updatedAt: Date.now() };
    // Odottava tallennus pitää sisällään peruutetun tilan; ilman perumista se
    // kirjoittaisi sen takaisin kantaan hetkeä myöhemmin.
    const pending = saveTimers.current.get(restored.id);
    if (pending) {
      window.clearTimeout(pending);
      saveTimers.current.delete(restored.id);
    }
    setHistory((stack) => stack.slice(0, -1));
    setSongs((prev) => (prev ? prev.map((s) => (s.id === restored.id ? restored : s)) : prev));
    saveSong(restored).catch((err) => console.error('Tallennus epäonnistui', err));
  }

  // Jono ratkaistaan vasta tässä, jotta live-tila näyttää muokkaukset heti ja
  // poistettu laulu katoaa jonosta itsestään.
  const liveSongs = live
    ? live.ids.map((id) => songs.find((s) => s.id === id)).filter((s): s is Song => !!s)
    : [];
  const liveIndex = Math.min(live?.index ?? 0, Math.max(0, liveSongs.length - 1));

  return (
    <LangContext.Provider value={i18n}>
      {editing ? (
        <SongEditor
          song={editing}
          onChange={(next) => updateSong(next, editing)}
          onUndo={undo}
          canUndo={history.length > 0}
          onBack={() => setView({ name: 'list' })}
          onDelete={() => deleteSong(editing.id)}
          onLive={() => setLive({ ids: [editing.id], index: 0 })}
        />
      ) : (
        <SongList
          songs={songs}
          setlists={setlists}
          onOpen={(songId) => setView({ name: 'editor', songId })}
          onCreate={createSong}
          onImport={importSong}
          onLibraryChanged={reload}
          onSetlistChange={updateSetlist}
          onSetlistDelete={removeSetlist}
          onLive={(ids, index) => setLive({ ids, index })}
        />
      )}
      {liveSongs.length > 0 && (
        <LiveView
          songs={liveSongs}
          index={liveIndex}
          onIndexChange={(index) => setLive((prev) => (prev ? { ...prev, index } : prev))}
          onClose={() => setLive(null)}
        />
      )}
    </LangContext.Provider>
  );
}
