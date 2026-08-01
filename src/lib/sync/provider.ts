/**
 * Pilvipalveluiden yhteinen rajapinta. Toteutukset: Dropbox ja Google Drive.
 *
 * Synkronointimalli on yksinkertainen ja luotettava: jokainen laulu viedään
 * pilveen omana JSON-tiedostonaan ja nauhoitteet ääni­tiedostoina laulun
 * alikansioon. Sovellus toimii aina offline; pilveen viedään käyttäjän
 * pyynnöstä ("Vie pilveen") kaikki paikallinen sisältö.
 */
import type { Recording, Song } from '../types';

export interface UploadResult {
  files: number;
}

export interface CloudProvider {
  readonly id: 'dropbox' | 'gdrive';
  readonly label: string;
  /** Onko käyttöön tarvittava client id asetettu. */
  isConfigured(): boolean;
  /** Onko voimassa oleva kirjautuminen. */
  isConnected(): boolean;
  /** Käynnistää OAuth-kirjautumisen (uudelleenohjaus tai ponnahdus). */
  connect(): Promise<void>;
  disconnect(): void;
  /** Vie laulun ja sen nauhoitteet pilveen. */
  uploadSong(song: Song, recordings: Recording[]): Promise<UploadResult>;
}

export function songFileName(song: Song): string {
  const safe = song.title.replace(/[\\/:*?"<>|]/g, '_').trim() || 'nimeton';
  return `${safe}-${song.id}`;
}

export function songToJson(song: Song): string {
  return JSON.stringify(song, null, 2);
}

export function recordingExtension(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'm4a';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('mpeg')) return 'mp3';
  return 'webm';
}
