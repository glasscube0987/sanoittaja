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

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
