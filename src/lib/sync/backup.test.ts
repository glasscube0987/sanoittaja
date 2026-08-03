import { beforeEach, describe, expect, it } from 'vitest';
import {
  BACKUP_REMINDER_DAYS,
  backupFileName,
  backupIsStale,
  daysSinceBackup,
  lastBackupAt,
  markBackupTaken,
} from './exportFile';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 7, 3, 12, 0, 0);

/** Vitest ajaa Nodessa ilman selainta, joten localStorage tarvitaan tynkänä. */
beforeEach(() => {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage;
});

describe('varmuuskopion ikä', () => {
  it('on tuntematon ennen ensimmäistä kopiota', () => {
    expect(lastBackupAt()).toBeNull();
    expect(daysSinceBackup(NOW)).toBeNull();
  });

  it('lasketaan kokonaisina vuorokausina', () => {
    markBackupTaken(NOW - 3 * DAY);
    expect(daysSinceBackup(NOW)).toBe(3);
  });

  it('on nolla samana päivänä', () => {
    markBackupTaken(NOW - 3600_000);
    expect(daysSinceBackup(NOW)).toBe(0);
  });

  it('ei mene negatiiviseksi jos kellot heittävät', () => {
    markBackupTaken(NOW + DAY);
    expect(daysSinceBackup(NOW)).toBe(0);
  });

  it('sietää rikkinäisen arvon', () => {
    localStorage.setItem('sanoittaja.lastBackup', 'roska');
    expect(lastBackupAt()).toBeNull();
  });
});

describe('backupFileName', () => {
  it('päivää paikallisen kalenterin mukaan', () => {
    // Ilta Suomessa on jo eilinen UTC:ssä; nimen pitää seurata käyttäjän päivää.
    const ilta = new Date(2026, 7, 3, 23, 30);
    expect(backupFileName(ilta)).toBe('sanoittaja-varmuuskopio-2026-08-03.json');
  });

  it('nollaa kuukauden ja päivän kaksinumeroisiksi', () => {
    expect(backupFileName(new Date(2026, 0, 9, 12, 0))).toBe('sanoittaja-varmuuskopio-2026-01-09.json');
  });

  it('antaa saman nimen samana päivänä, jolloin pilvessä on kopio päivää kohti', () => {
    const aamu = new Date(2026, 7, 3, 8, 0);
    const ilta = new Date(2026, 7, 3, 20, 0);
    expect(backupFileName(aamu)).toBe(backupFileName(ilta));
    expect(backupFileName(new Date(2026, 7, 4, 8, 0))).not.toBe(backupFileName(aamu));
  });
});

describe('backupIsStale', () => {
  it('pitää puuttuvaa kopiota vanhentuneena', () => {
    // Ilman varmuuskopiota laulut ovat vain yhdessä laitteessa; se on
    // huomauttamisen arvoista heti.
    expect(backupIsStale(NOW)).toBe(true);
  });

  it('vanhenee vasta rajan täytyttyä', () => {
    markBackupTaken(NOW - (BACKUP_REMINDER_DAYS - 1) * DAY);
    expect(backupIsStale(NOW)).toBe(false);

    markBackupTaken(NOW - BACKUP_REMINDER_DAYS * DAY);
    expect(backupIsStale(NOW)).toBe(true);
  });
});
