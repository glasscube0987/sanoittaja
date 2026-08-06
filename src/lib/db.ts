/**
 * Paikallinen tallennus: IndexedDB. Laulut, nauhoitteet (äänidata Blobeina),
 * settilistat ja nuottilehden merkinnät omissa tauluissaan. Kaikki toimii
 * offline; pilvisynkronointi on erillinen kerros tämän päällä.
 *
 * Taulut luodaan `if (!contains)` -vartioituna, joten version nosto lisää
 * puuttuvat taulut koskematta olemassa olevaan dataan.
 */
import type { Annotation, Recording, Setlist, Song } from './types';

const DB_NAME = 'sanoittaja';
export const DB_VERSION = 2;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('songs')) {
          db.createObjectStore('songs', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('recordings')) {
          const store = db.createObjectStore('recordings', { keyPath: 'id' });
          store.createIndex('songId', 'songId');
        }
        if (!db.objectStoreNames.contains('setlists')) {
          db.createObjectStore('setlists', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('annotations')) {
          const store = db.createObjectStore('annotations', { keyPath: 'id' });
          store.createIndex('songId', 'songId');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function reqResult<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listSongs(): Promise<Song[]> {
  const db = await openDb();
  const songs = await reqResult(db.transaction('songs').objectStore('songs').getAll());
  return (songs as Song[]).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveSong(song: Song): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('songs', 'readwrite');
  tx.objectStore('songs').put(song);
  await txDone(tx);
}

/**
 * Poistaa laulun ja kaiken siihen kuuluvan samassa transaktiossa: nauhoitteet,
 * merkinnät ja viittaukset settilistoilta. Orvoksi jäänyt viittaus näkyisi
 * setissä tyhjänä rivinä.
 */
export async function deleteSong(songId: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(['songs', 'recordings', 'annotations', 'setlists'], 'readwrite');
  tx.objectStore('songs').delete(songId);

  for (const name of ['recordings', 'annotations'] as const) {
    const keys = await reqResult(tx.objectStore(name).index('songId').getAllKeys(songId));
    for (const key of keys) tx.objectStore(name).delete(key);
  }

  const setlists = (await reqResult(tx.objectStore('setlists').getAll())) as Setlist[];
  for (const list of setlists) {
    if (!list.songIds.includes(songId)) continue;
    tx.objectStore('setlists').put({
      ...list,
      songIds: list.songIds.filter((id) => id !== songId),
      updatedAt: Date.now(),
    });
  }

  await txDone(tx);
}

export async function listSetlists(): Promise<Setlist[]> {
  const db = await openDb();
  const lists = await reqResult(db.transaction('setlists').objectStore('setlists').getAll());
  return (lists as Setlist[]).sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveSetlist(list: Setlist): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('setlists', 'readwrite');
  tx.objectStore('setlists').put(list);
  await txDone(tx);
}

export async function deleteSetlist(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('setlists', 'readwrite');
  tx.objectStore('setlists').delete(id);
  await txDone(tx);
}

export async function listAnnotations(songId: string): Promise<Annotation[]> {
  const db = await openDb();
  const index = db.transaction('annotations').objectStore('annotations').index('songId');
  const rows = await reqResult(index.getAll(songId));
  return (rows as Annotation[]).sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Merkintöjen muutoksesta kerrotaan tapahtumalla, koska niitä näyttää kaksi
 * näkymää yhtä aikaa: live-tila piirtää editorin päällä, eikä taustalle jäävä
 * editori muuten tietäisi tulostuslehtensä vanhentuneen.
 *
 * Tapahtuma herätetään vasta transaktion valmistuttua. Aiemmin herätetty
 * lukija ehtisi lukea vielä vanhan tilan, ja juuri piirretty veto välähtäisi
 * pois näkyvistä.
 */
export const ANNOTATIONS_EVENT = 'sanoittaja:annotations';

function merkinnatMuuttuivat(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(ANNOTATIONS_EVENT));
}

export async function saveAnnotation(note: Annotation): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('annotations', 'readwrite');
  tx.objectStore('annotations').put(note);
  await txDone(tx);
  merkinnatMuuttuivat();
}

export async function deleteAnnotation(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('annotations', 'readwrite');
  tx.objectStore('annotations').delete(id);
  await txDone(tx);
  merkinnatMuuttuivat();
}

/** Kaikki merkinnät varmuuskopiota varten. */
export async function listAllAnnotations(): Promise<Annotation[]> {
  const db = await openDb();
  const rows = await reqResult(db.transaction('annotations').objectStore('annotations').getAll());
  return rows as Annotation[];
}

export async function listRecordings(songId: string): Promise<Recording[]> {
  const db = await openDb();
  const index = db.transaction('recordings').objectStore('recordings').index('songId');
  const recs = await reqResult(index.getAll(songId));
  return (recs as Recording[]).sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveRecording(rec: Recording): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('recordings', 'readwrite');
  tx.objectStore('recordings').put(rec);
  await txDone(tx);
}

export async function deleteRecording(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('recordings', 'readwrite');
  tx.objectStore('recordings').delete(id);
  await txDone(tx);
}
