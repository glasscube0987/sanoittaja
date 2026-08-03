/**
 * Automaattinen varmuuskopio pilveen. Käsin otettu kopio unohtuu juuri silloin
 * kun sitä tarvitsisi, joten sovellus vie kirjaston Dropboxiin taustalla, kun
 * lauluja on muutettu ja edellisestä kopiosta on kulunut riittävästi aikaa.
 *
 * Vain Dropbox: sen kirjautuminen säilyy refresh tokenilla, kun taas Google
 * Driven token elää vain istunnon ajan ja sen uusiminen vaatii käyttäjän
 * napautuksen. Ilman kirjautumista pudotaan laululistan muistutukseen.
 */
import { dropboxProvider } from './dropbox';
import { backupFileName, exportLibrary, markBackupTaken } from './exportFile';

const ENABLED_KEY = 'sanoittaja.autoBackup';
const CHANGED_KEY = 'sanoittaja.libraryChanged';
const CLOUD_AT_KEY = 'sanoittaja.autoBackup.at';

/** Kuinka usein taustakopio korkeintaan otetaan. */
export const AUTO_BACKUP_INTERVAL_MS = 6 * 3_600_000;

/** Kuinka usein tarkistetaan onko kopion aika. */
export const AUTO_BACKUP_CHECK_MS = 5 * 60_000;

export function autoBackupEnabled(): boolean {
  // Oletuksena päällä: kopio omalle pilvitilille on käyttäjän etu, ja ilman
  // kirjautumista tämä ei tee mitään.
  return localStorage.getItem(ENABLED_KEY) !== 'off';
}

export function setAutoBackupEnabled(on: boolean): void {
  localStorage.setItem(ENABLED_KEY, on ? 'on' : 'off');
}

function readTime(key: string): number | null {
  const raw = localStorage.getItem(key);
  const at = raw ? Number(raw) : NaN;
  return Number.isFinite(at) ? at : null;
}

/** Merkitään kirjasto muuttuneeksi; kestää uudelleenlatauksen yli. */
export function markLibraryChanged(at: number = Date.now()): void {
  localStorage.setItem(CHANGED_KEY, String(at));
}

export function libraryChangedAt(): number | null {
  return readTime(CHANGED_KEY);
}

export function lastCloudBackupAt(): number | null {
  return readTime(CLOUD_AT_KEY);
}

export function markCloudBackupTaken(at: number = Date.now()): void {
  localStorage.setItem(CLOUD_AT_KEY, String(at));
}

export interface AutoBackupState {
  enabled: boolean;
  connected: boolean;
  changedAt: number | null;
  lastAt: number | null;
  now: number;
}

/**
 * Kopio otetaan vain jos on jotain uutta kopioitavaa ja edellisestä on kulunut
 * vähintään väli. Ensimmäinen kopio otetaan heti ensimmäisen muutoksen jälkeen,
 * jottei uusi käyttäjä jää tuntikausiksi ilman kopiota.
 */
export function shouldAutoBackup({ enabled, connected, changedAt, lastAt, now }: AutoBackupState): boolean {
  if (!enabled || !connected || changedAt === null) return false;
  if (lastAt === null) return true;
  if (changedAt <= lastAt) return false;
  return now - lastAt >= AUTO_BACKUP_INTERVAL_MS;
}

export type AutoBackupResult = 'skipped' | 'done';

/** Ottaa taustakopion jos sen aika on. Virheet eivät saa häiritä kirjoittamista. */
export async function maybeAutoBackup(now: number = Date.now()): Promise<AutoBackupResult> {
  const state: AutoBackupState = {
    enabled: autoBackupEnabled(),
    connected: dropboxProvider.isConfigured() && dropboxProvider.isConnected(),
    changedAt: libraryChangedAt(),
    lastAt: lastCloudBackupAt(),
    now,
  };
  if (!shouldAutoBackup(state)) return 'skipped';

  await dropboxProvider.uploadBackup(await exportLibrary(), backupFileName(now));
  markCloudBackupTaken(now);
  // Pilvikopio on yhtä lailla varmuuskopio, joten se nollaa myös muistutuksen.
  markBackupTaken(now);
  return 'done';
}
