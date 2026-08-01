/**
 * Paikallinen tallennus: IndexedDB, jossa kaksi taulua – laulut ja
 * nauhoitteet (äänidata Blobeina). Kaikki toimii offline; pilvisynkronointi
 * on erillinen kerros tämän päällä.
 */
import type { Recording, Song } from './types';

const DB_NAME = 'sanoittaja';
const DB_VERSION = 1;

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

export async function deleteSong(songId: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(['songs', 'recordings'], 'readwrite');
  tx.objectStore('songs').delete(songId);
  const index = tx.objectStore('recordings').index('songId');
  const keys = await reqResult(index.getAllKeys(songId));
  for (const key of keys) tx.objectStore('recordings').delete(key);
  await txDone(tx);
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
