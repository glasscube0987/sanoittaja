import { beforeEach, describe, expect, it } from 'vitest';
import { AUTO_BACKUP_INTERVAL_MS, shouldAutoBackup } from './autoBackup';
import {
  authorizeUrl,
  DEFAULT_CLIENT_ID,
  EXPIRY_MARGIN_MS,
  expiryFromResponse,
  getDropboxClientId,
  getDropboxClientIdOverride,
  setDropboxClientId,
} from './dropbox';

const NOW = Date.UTC(2026, 7, 3, 12, 0, 0);
const HOUR = 3_600_000;

/** Perustapaus: kirjautunut käyttäjä, muutos tuoreempi kuin edellinen kopio. */
function tila(muutokset: Partial<Parameters<typeof shouldAutoBackup>[0]> = {}) {
  return {
    enabled: true,
    connected: true,
    changedAt: NOW - HOUR,
    lastAt: NOW - AUTO_BACKUP_INTERVAL_MS,
    now: NOW,
    ...muutokset,
  };
}

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

describe('shouldAutoBackup', () => {
  it('ottaa kopion kun väli on täynnä ja muutoksia on', () => {
    expect(shouldAutoBackup(tila())).toBe(true);
  });

  it('ei tee mitään ilman kirjautumista', () => {
    expect(shouldAutoBackup(tila({ connected: false }))).toBe(false);
  });

  it('ei tee mitään kun asetus on pois päältä', () => {
    expect(shouldAutoBackup(tila({ enabled: false }))).toBe(false);
  });

  it('ei kopioi muuttumatonta kirjastoa', () => {
    expect(shouldAutoBackup(tila({ changedAt: null }))).toBe(false);
    // Muutos on vanhempi kuin edellinen kopio: se on jo pilvessä.
    expect(shouldAutoBackup(tila({ changedAt: NOW - 10 * HOUR, lastAt: NOW - 9 * HOUR }))).toBe(false);
  });

  it('ottaa ensimmäisen kopion heti eikä vasta välin päästä', () => {
    expect(shouldAutoBackup(tila({ lastAt: null }))).toBe(true);
  });

  it('odottaa välin täyttymistä eikä kopioi joka muutoksella', () => {
    const juuriKopioitu = tila({ lastAt: NOW - HOUR, changedAt: NOW - 60_000 });
    expect(shouldAutoBackup(juuriKopioitu)).toBe(false);
    expect(shouldAutoBackup({ ...juuriKopioitu, now: NOW - HOUR + AUTO_BACKUP_INTERVAL_MS })).toBe(true);
  });
});

describe('Dropbox-tunnus', () => {
  it('käyttää sovelluksen omaa tunnusta ilman asetuksia', () => {
    // Käyttöönotto ei saa vaatia omaa Dropbox-sovellusta: pelkkä kirjautuminen riittää.
    expect(getDropboxClientId()).toBe(DEFAULT_CLIENT_ID);
    expect(getDropboxClientIdOverride()).toBe('');
  });

  it('antaa oman tunnuksen ohittaa oletuksen', () => {
    setDropboxClientId('  oma-avain  ');
    expect(getDropboxClientId()).toBe('oma-avain');
    expect(getDropboxClientIdOverride()).toBe('oma-avain');
  });

  it('palaa oletukseen kun kenttä tyhjennetään', () => {
    setDropboxClientId('oma-avain');
    setDropboxClientId('');
    expect(getDropboxClientId()).toBe(DEFAULT_CLIENT_ID);
  });
});

describe('authorizeUrl', () => {
  const url = new URL(authorizeUrl('avain', 'https://esimerkki.fi/app/', 'haaste'));

  it('pyytää pitkäikäisen kirjautumisen', () => {
    // Ilman tätä token vanhenee neljässä tunnissa eikä uusiudu: taustakopio kuolisi.
    expect(url.searchParams.get('token_access_type')).toBe('offline');
  });

  it('käyttää PKCE:tä ilman salaisuutta', () => {
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('code_challenge')).toBe('haaste');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.toString()).not.toContain('secret');
  });

  it('välittää tunnuksen ja paluuosoitteen sellaisenaan', () => {
    expect(url.origin + url.pathname).toBe('https://www.dropbox.com/oauth2/authorize');
    expect(url.searchParams.get('client_id')).toBe('avain');
    // Dropbox vaatii merkintarkan osuman rekisteröityyn Redirect URI:in.
    expect(url.searchParams.get('redirect_uri')).toBe('https://esimerkki.fi/app/');
  });
});

describe('Dropbox-tokenin vanheneminen', () => {
  it('laskee vanhenemisajan turvamarginaalilla', () => {
    // Dropbox antaa neljä tuntia; marginaali estää käytön viime hetkellä.
    expect(expiryFromResponse({ expires_in: 14_400 }, NOW)).toBe(NOW + 14_400_000 - EXPIRY_MARGIN_MS);
  });

  it('ei mene menneisyyteen lyhyellä kestolla', () => {
    expect(expiryFromResponse({ expires_in: 10 }, NOW)).toBe(NOW);
  });

  it('palauttaa null kun kestoa ei kerrota', () => {
    // Vanha, ikuinen token: sitä käytetään kunnes Dropbox vastaa 401.
    expect(expiryFromResponse({}, NOW)).toBeNull();
    expect(expiryFromResponse({ expires_in: NaN }, NOW)).toBeNull();
  });
});
