/**
 * Paikallinen varmuuskopio: koko kirjasto (laulut + nauhoitteet base64:nä)
 * yhtenä JSON-tiedostona. Toimii ilman mitään pilvitunnuksia, ja tiedoston
 * voi jakaa puhelimen jakovalikosta suoraan Driveen tai Dropboxiin.
 */
import {
  listAllAnnotations,
  listRecordings,
  listSetlists,
  listSongs,
  saveAnnotation,
  saveRecording,
  saveSetlist,
  saveSong,
} from '../db';
import type { Annotation, Recording, Setlist, Song } from '../types';

interface ExportedRecording extends Omit<Recording, 'blob'> {
  dataBase64: string;
}

/** Nykyinen pakettiversio. Versio 1 oli ilman settilistoja ja merkintöjä. */
export const BUNDLE_VERSION = 2;

interface ExportBundle {
  app: 'sanoittaja';
  version: number;
  exportedAt: number;
  songs: Song[];
  recordings: ExportedRecording[];
  /** Versiosta 2 alkaen. Vanhemmissa paketeissa puuttuvat. */
  setlists?: Setlist[];
  annotations?: Annotation[];
}

export interface ImportResult {
  songs: number;
  recordings: number;
  setlists: number;
  annotations: number;
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
  const bundle: ExportBundle = {
    app: 'sanoittaja',
    version: BUNDLE_VERSION,
    exportedAt: Date.now(),
    songs,
    recordings,
    setlists: await listSetlists(),
    annotations: await listAllAnnotations(),
  };
  return new Blob([JSON.stringify(bundle)], { type: 'application/json' });
}

/**
 * Lukee varmuuskopion. Vanhemmat paketit kelpaavat sellaisinaan: puuttuvat
 * kentät ovat tyhjiä listoja, eikä jo otettu kopio saa lakata toimimasta
 * siksi, että sovellukseen on myöhemmin lisätty uutta tallennettavaa.
 */
export async function importLibrary(file: Blob): Promise<ImportResult> {
  const bundle = JSON.parse(await file.text()) as ExportBundle;
  if (bundle.app !== 'sanoittaja') throw new Error('Tiedosto ei ole Sanoittaja-varmuuskopio');

  /*
   * Uudempi paketti torjutaan, vanhempi kelpaa.
   *
   * Epäsymmetria on tarkoituksellinen. Vanha paketti on tuttua muotoa ja
   * puuttuvat kentät ovat tyhjiä listoja. Uudessa voi sen sijaan olla tietuelaji
   * jota tämä versio ei tunne, ja se päätyisi kantaan asti ennen kuin mikään
   * huomaa mitään — vika näkyisi vasta piirtovaiheessa, väärässä paikassa ja
   * ilman yhteyttä tuontiin. Selkeä virhe heti on parempi kuin rikkinäinen
   * kirjasto myöhemmin.
   */
  if (typeof bundle.version === 'number' && bundle.version > BUNDLE_VERSION) {
    throw new Error(
      `Varmuuskopio on uudemmasta versiosta (${bundle.version}) kuin tämä sovellus (${BUNDLE_VERSION}). Päivitä sovellus ensin.`,
    );
  }

  const setlists = bundle.setlists ?? [];
  const annotations = bundle.annotations ?? [];

  for (const song of bundle.songs) await saveSong(song);
  for (const rec of bundle.recordings) {
    const { dataBase64, ...meta } = rec;
    await saveRecording({ ...meta, blob: base64ToBlob(dataBase64, rec.mimeType) });
  }
  for (const list of setlists) await saveSetlist(list);
  for (const note of annotations) await saveAnnotation(note);

  return {
    songs: bundle.songs.length,
    recordings: bundle.recordings.length,
    setlists: setlists.length,
    annotations: annotations.length,
  };
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

/**
 * Yläraja automaattiselle pilvikopiolle.
 *
 * Paketti koodaa nauhoitteet ja muun binäärin base64:ksi, joten iso kirjasto
 * kasvaa nopeasti kymmeniin megatavuihin. Taustalla toistuva hidas ja
 * epäonnistuva lataus on käyttäjälle huonompi kuin rehellinen huomautus, joten
 * rajan ylittävä paketti jätetään lähettämättä ja se kerrotaan.
 */
export const AUTO_BACKUP_MAX_BYTES = 40 * 1024 * 1024;

/** Paketin koko luettavana tekstinä, esim. "12,4 Mt". */
export function formatSize(bytes: number, lang: 'en' | 'fi' = 'en'): string {
  const mb = bytes / (1024 * 1024);
  const unit = lang === 'fi' ? 'Mt' : 'MB';
  if (mb >= 10) return `${Math.round(mb)} ${unit}`;
  if (mb >= 0.1) return `${mb.toFixed(1).replace('.', lang === 'fi' ? ',' : '.')} ${unit}`;
  return `${Math.max(1, Math.round(bytes / 1024))} ${lang === 'fi' ? 'kt' : 'kB'}`;
}

const LAST_BACKUP_KEY = 'sanoittaja.lastBackup';

/** Milloin varmuuskopio viimeksi tehtiin, tai null jos ei koskaan. */
export function lastBackupAt(): number | null {
  const raw = localStorage.getItem(LAST_BACKUP_KEY);
  const at = raw ? Number(raw) : NaN;
  return Number.isFinite(at) ? at : null;
}

/**
 * Tapahtuma varmuuskopion ottamisesta. Taustakopio tapahtuu ilman käyttäjän
 * napautusta, joten listan huomautus ei muuten päivittyisi ennen seuraavaa
 * uudelleenlatausta.
 */
export const BACKUP_EVENT = 'sanoittaja:backup';

export function markBackupTaken(at: number = Date.now()): void {
  localStorage.setItem(LAST_BACKUP_KEY, String(at));
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(BACKUP_EVENT));
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
