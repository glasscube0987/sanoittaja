/**
 * Paikallinen varmuuskopio: koko kirjasto (laulut + nauhoitteet base64:nä)
 * yhtenä JSON-tiedostona. Toimii ilman mitään pilvitunnuksia, ja tiedoston
 * voi jakaa puhelimen jakovalikosta suoraan Driveen tai Dropboxiin.
 */
import { listRecordings, listSongs, saveRecording, saveSong } from '../db';
import type { Recording, Song } from '../types';

interface ExportedRecording extends Omit<Recording, 'blob'> {
  dataBase64: string;
}

interface ExportBundle {
  app: 'sanoittaja';
  version: 1;
  exportedAt: number;
  songs: Song[];
  recordings: ExportedRecording[];
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mimeType });
}

export async function exportLibrary(): Promise<Blob> {
  const songs = await listSongs();
  const recordings: ExportedRecording[] = [];
  for (const song of songs) {
    for (const rec of await listRecordings(song.id)) {
      const { blob, ...meta } = rec;
      recordings.push({ ...meta, dataBase64: await blobToBase64(blob) });
    }
  }
  const bundle: ExportBundle = { app: 'sanoittaja', version: 1, exportedAt: Date.now(), songs, recordings };
  return new Blob([JSON.stringify(bundle)], { type: 'application/json' });
}

export async function importLibrary(file: Blob): Promise<{ songs: number; recordings: number }> {
  const bundle = JSON.parse(await file.text()) as ExportBundle;
  if (bundle.app !== 'sanoittaja') throw new Error('Tiedosto ei ole Sanoittaja-varmuuskopio');
  for (const song of bundle.songs) await saveSong(song);
  for (const rec of bundle.recordings) {
    const { dataBase64, ...meta } = rec;
    await saveRecording({ ...meta, blob: base64ToBlob(dataBase64, rec.mimeType) });
  }
  return { songs: bundle.songs.length, recordings: bundle.recordings.length };
}

/**
 * Varmuuskopion tiedostonimi. Päiväys on paikallinen eikä UTC, jotta illalla
 * otettu kopio ei näytä eiliseltä. Sama nimi käy tiedostoon ja pilveen, jolloin
 * pilveen kertyy päiväkohtainen historia yhden ylikirjoittuvan tiedoston sijaan.
 */
export function backupFileName(at: number | Date = Date.now()): string {
  const d = at instanceof Date ? at : new Date(at);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `sanoittaja-varmuuskopio-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const LAST_BACKUP_KEY = 'sanoittaja.lastBackup';

/** Milloin varmuuskopio viimeksi tehtiin, tai null jos ei koskaan. */
export function lastBackupAt(): number | null {
  const raw = localStorage.getItem(LAST_BACKUP_KEY);
  const at = raw ? Number(raw) : NaN;
  return Number.isFinite(at) ? at : null;
}

export function markBackupTaken(at: number = Date.now()): void {
  localStorage.setItem(LAST_BACKUP_KEY, String(at));
}

/** Kokonaisia vuorokausia edellisestä varmuuskopiosta, tai null jos ei koskaan. */
export function daysSinceBackup(now: number = Date.now(), at = lastBackupAt()): number | null {
  if (at === null) return null;
  return Math.max(0, Math.floor((now - at) / 86_400_000));
}

/** Muistutuksen raja: viikko riittää, jottei huomautus muutu taustakohinaksi. */
export const BACKUP_REMINDER_DAYS = 7;

export function backupIsStale(now: number = Date.now(), at = lastBackupAt()): boolean {
  const days = daysSinceBackup(now, at);
  return days === null || days >= BACKUP_REMINDER_DAYS;
}

/**
 * Tarjoaa varmuuskopion jakovalikon kautta, jos selain tukee tiedostojen
 * jakamista. iPhonella siitä pääsee suoraan Tiedostoihin tai iCloud Driveen,
 * mikä on huomattavasti vähemmän askelia kuin lataus ja siirto käsin.
 * Palauttaa false, jos jakaminen ei ole käytettävissä ja on ladattava.
 */
export async function shareBlob(blob: Blob, filename: string): Promise<boolean> {
  const file = new File([blob], filename, { type: blob.type });
  if (!navigator.canShare?.({ files: [file] })) return false;
  try {
    await navigator.share({ files: [file], title: filename });
    return true;
  } catch (err) {
    // Käyttäjän peruutus ei ole virhe eikä saa pudottaa lataukseen.
    if (err instanceof DOMException && err.name === 'AbortError') return true;
    return false;
  }
}
