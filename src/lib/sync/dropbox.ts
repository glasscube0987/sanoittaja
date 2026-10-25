/**
 * Dropbox-synkronointi OAuth 2 PKCE -kululla (ei vaadi salaisuutta, sopii
 * selain-/mobiilisovellukselle). Käyttäjä syöttää oman Dropbox-sovelluksensa
 * client id:n asetuksissa; tunnukset tallennetaan localStorageen.
 *
 * Kirjautuminen pyydetään pitkäikäisenä (`token_access_type=offline`), jolloin
 * Dropbox antaa neljä tuntia voimassa olevan access tokenin *ja* refresh
 * tokenin. Ilman jälkimmäistä kirjautuminen katkeaisi muutaman tunnin välein,
 * eikä automaattinen varmuuskopiointi toimisi käytännössä lainkaan.
 */
import type { CloudProvider } from './provider';

/**
 * Sovelluksen oma Dropbox-sovellus. PKCE-kulussa client id on tarkoitettu
 * julkiseksi eikä sillä yksin pääse mihinkään: käyttäjä hyväksyy kirjautumisen
 * itse, ja tokenit jäävät hänen laitteelleen. App secretiä ei käytetä.
 */
export const DEFAULT_CLIENT_ID = 'gvl73tnz8a7by9s';

const CLIENT_ID_KEY = 'sanoittaja.dropbox.clientId';
const TOKEN_KEY = 'sanoittaja.dropbox.token';
const REFRESH_KEY = 'sanoittaja.dropbox.refresh';
const EXPIRES_KEY = 'sanoittaja.dropbox.expires';
const VERIFIER_KEY = 'sanoittaja.dropbox.verifier';

const TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';

/** Turvamarginaali: token katsotaan vanhentuneeksi hieman ennen aikojaan. */
export const EXPIRY_MARGIN_MS = 60_000;

export interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
}

/** Milloin token on vanhentunut, tai null jos kesto ei ole tiedossa. */
export function expiryFromResponse(data: TokenResponse, now: number): number | null {
  const seconds = data.expires_in;
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return null;
  return now + Math.max(0, seconds * 1000 - EXPIRY_MARGIN_MS);
}

function storedExpiry(): number | null {
  const raw = localStorage.getItem(EXPIRES_KEY);
  const at = raw ? Number(raw) : NaN;
  return Number.isFinite(at) ? at : null;
}

function storeTokens(data: TokenResponse, now = Date.now()): void {
  if (data.access_token) localStorage.setItem(TOKEN_KEY, data.access_token);
  // Refresh token tulee vain ensimmäisessä vastauksessa; päivityksessä ei.
  if (data.refresh_token) localStorage.setItem(REFRESH_KEY, data.refresh_token);
  const expiry = expiryFromResponse(data, now);
  if (expiry === null) localStorage.removeItem(EXPIRES_KEY);
  else localStorage.setItem(EXPIRES_KEY, String(expiry));
}

function forgetTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(EXPIRES_KEY);
}

function redirectUri(): string {
  return window.location.origin + window.location.pathname;
}

async function sha256Base64Url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function randomVerifier(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(48));
  return Array.from(bytes, (b) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[b % 62]).join('');
}

/** Asetuksissa syötetty client id, tai sovelluksen oma jos kenttä on tyhjä. */
export function getDropboxClientId(): string {
  return localStorage.getItem(CLIENT_ID_KEY)?.trim() || DEFAULT_CLIENT_ID;
}

/** Mitä asetuskentässä näytetään: vain käyttäjän oma arvo, ei oletusta. */
export function getDropboxClientIdOverride(): string {
  return localStorage.getItem(CLIENT_ID_KEY) ?? '';
}

/**
 * Tarvittavat oikeudet: kirjoitus kopiota varten, luku ja listaus hakua varten.
 */
export const SCOPES = [
  'files.content.write',
  'files.content.read',
  'files.metadata.read',
];

/**
 * Kirjautumisosoite. Erillisenä funktiona, jotta parametrit — erityisesti
 * pitkäikäisyys ja PKCE — voidaan varmistaa testillä ilman selainta.
 */
export function authorizeUrl(clientId: string, redirect: string, challenge: string): string {
  const url = new URL('https://www.dropbox.com/oauth2/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', redirect);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  // Ilman tätä kirjautuminen kestää vain neljä tuntia.
  url.searchParams.set('token_access_type', 'offline');
  /*
   * Luvat pyydetään nimeltä. Ilman tätä token kantaa vain ne oikeudet jotka
   * Dropbox-sovellukseen on asetettu, eikä haku pilvestä toimi lainkaan jos
   * luku puuttuu. Vanha kirjautuminen ei saa lukuoikeutta takautuvasti, joten
   * haku kehottaa kirjautumaan uudelleen jos palvelu vastaa 401/403.
   */
  url.searchParams.set('scope', SCOPES.join(' '));
  return url.toString();
}

export function setDropboxClientId(id: string): void {
  localStorage.setItem(CLIENT_ID_KEY, id.trim());
}

/** Kutsutaan sovelluksen käynnistyessä: viimeistelee OAuth-paluun jos URL:ssa on code. */
export async function completeDropboxAuthIfReturning(): Promise<boolean> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  if (!code || !verifier) return false;
  sessionStorage.removeItem(VERIFIER_KEY);

  const body = new URLSearchParams({
    code,
    grant_type: 'authorization_code',
    client_id: getDropboxClientId(),
    redirect_uri: redirectUri(),
    code_verifier: verifier,
  });
  const res = await fetch(TOKEN_URL, { method: 'POST', body });
  if (!res.ok) throw new Error('Dropbox-kirjautuminen epäonnistui: ' + (await res.text()));
  storeTokens(await res.json());
  window.history.replaceState({}, '', redirectUri());
  return true;
}

/** Voimassa oleva access token; uusitaan refresh tokenilla tarvittaessa. */
async function freshAccessToken(): Promise<string> {
  const token = localStorage.getItem(TOKEN_KEY);
  const expiry = storedExpiry();
  // Vanha kirjautuminen ilman tallennettua vanhenemisaikaa: käytetään sitä
  // kunnes Dropbox vastaa 401, jolloin pyydetään uusi kirjautuminen.
  if (token && (expiry === null || expiry > Date.now())) return token;

  const refresh = localStorage.getItem(REFRESH_KEY);
  if (!refresh) {
    forgetTokens();
    throw new Error('Dropbox-kirjautuminen on vanhentunut, kirjaudu uudelleen');
  }
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refresh,
    client_id: getDropboxClientId(),
  });
  const res = await fetch(TOKEN_URL, { method: 'POST', body });
  if (!res.ok) {
    forgetTokens();
    throw new Error('Dropbox-kirjautumisen uusiminen epäonnistui: ' + (await res.text()));
  }
  const data: TokenResponse = await res.json();
  storeTokens(data);
  if (!data.access_token) throw new Error('Dropbox ei palauttanut tokenia');
  return data.access_token;
}

async function dropboxUpload(token: string, path: string, content: Blob | string): Promise<void> {
  const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({ path, mode: 'overwrite', mute: true }),
    },
    body: content,
  });
  if (!res.ok) {
    if (res.status === 401) forgetTokens();
    throw new Error(`Dropbox-vienti epäonnistui (${res.status}): ${await res.text()}`);
  }
}

/** Varmuuskopioiden nimeämiskäytäntö; muut tiedostot jätetään listaamatta. */
const BACKUP_PREFIX = 'sanoittaja-varmuuskopio-';

interface DropboxEntry {
  '.tag': string;
  name: string;
  path_lower?: string;
  size?: number;
  server_modified?: string;
}

/**
 * Luku- ja listausvirheet erotetaan muista: puuttuva lupa on käyttäjän
 * korjattavissa kirjautumalla uudelleen, eikä se saa näyttää samalta kuin
 * verkkovirhe.
 */
function lukuvirhe(status: number, teksti: string): Error {
  if (status === 401 || status === 403) {
    forgetTokens();
    return new Error('Dropboxin lukuoikeus puuttuu. Kirjaudu uudelleen.');
  }
  return new Error(`Dropbox-haku epäonnistui (${status}): ${teksti}`);
}

export const dropboxProvider: CloudProvider = {
  id: 'dropbox',
  label: 'Dropbox',

  // Oletustunnus on aina olemassa, joten käyttöönotto ei vaadi asetuksia.
  isConfigured: () => getDropboxClientId().length > 0,
  // Refresh token riittää: access token uusitaan lennossa.
  isConnected: () => !!localStorage.getItem(REFRESH_KEY) || !!localStorage.getItem(TOKEN_KEY),

  async connect() {
    const verifier = randomVerifier();
    sessionStorage.setItem(VERIFIER_KEY, verifier);
    const challenge = await sha256Base64Url(verifier);
    window.location.assign(authorizeUrl(getDropboxClientId(), redirectUri(), challenge));
  },

  disconnect() {
    forgetTokens();
  },

  async uploadBackup(blob: Blob, filename: string): Promise<void> {
    const token = await freshAccessToken();
    // App folder -oikeudella "/" on kansio Apps/<sovellus>/ käyttäjän omalla
    // tilillä, ei kehittäjän. Saman laitteen saman päivän kopio ylikirjoittuu,
    // muut jäävät talteen.
    await dropboxUpload(token, `/${filename}`, blob);
  },

  async listBackups() {
    const token = await freshAccessToken();
    const res = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '' }),
    });
    if (!res.ok) throw lukuvirhe(res.status, await res.text());

    const data = (await res.json()) as { entries?: DropboxEntry[] };
    return (data.entries ?? [])
      .filter((e) => e['.tag'] === 'file' && e.name.startsWith(BACKUP_PREFIX))
      .map((e) => ({
        path: e.path_lower ?? `/${e.name}`,
        name: e.name,
        size: e.size ?? 0,
        modifiedAt: e.server_modified ? Date.parse(e.server_modified) : 0,
      }))
      // Uusin ensin: siirto laitteelta toiselle koskee lähes aina tuoreinta.
      .sort((a, b) => b.modifiedAt - a.modifiedAt);
  },

  async downloadBackup(path: string) {
    const token = await freshAccessToken();
    const res = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Dropbox-API-Arg': JSON.stringify({ path }) },
    });
    if (!res.ok) throw lukuvirhe(res.status, await res.text());
    return res.blob();
  },
};
