import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SongEditor from './components/SongEditor';
import SongList from './components/SongList';
import { deleteSong as dbDeleteSong, listSongs, saveSong } from './lib/db';
import type { HistoryEntry } from './lib/history';
import { pushHistory } from './lib/history';
import type { Key, Lang, Params } from './lib/i18n';
import { LangContext, loadLang, storeLang, translate } from './lib/i18n';
import { AUTO_BACKUP_CHECK_MS, markLibraryChanged, maybeAutoBackup } from './lib/sync/autoBackup';
import type { Song } from './lib/types';
import { newSong } from './lib/types';

type View = { name: 'list' } | { name: 'editor'; songId: string };

export default function App() {
  const [songs, setSongs] = useState<Song[] | null>(null);
  const [view, setView] = useState<View>({ name: 'list' });
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

  const createSong = useCallback(() => {
    const song = newSong();
    setSongs((prev) => [song, ...(prev ?? [])]);
    markLibraryChanged();
    saveSong(song).catch((err) => console.error('Tallennus epäonnistui', err));
    setView({ name: 'editor', songId: song.id });
  }, []);

  const deleteSong = useCallback((songId: string) => {
    setSongs((prev) => (prev ? prev.filter((s) => s.id !== songId) : prev));
    setView({ name: 'list' });
    markLibraryChanged();
    dbDeleteSong(songId).catch((err) => console.error('Poisto epäonnistui', err));
  }, []);

  const reload = useCallback(() => {
    markLibraryChanged();
    listSongs().then(setSongs);
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
        />
      ) : (
        <SongList
          songs={songs}
          onOpen={(songId) => setView({ name: 'editor', songId })}
          onCreate={createSong}
          onLibraryChanged={reload}
        />
      )}
    </LangContext.Provider>
  );
}
