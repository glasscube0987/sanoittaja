/**
 * Dropbox-synkronointi OAuth 2 PKCE -kululla (ei vaadi salaisuutta, sopii
 * selain-/mobiilisovellukselle). Käyttäjä syöttää oman Dropbox-sovelluksensa
 * client id:n asetuksissa; token tallennetaan localStorageen.
 */
import type { CloudProvider } from './provider';

const CLIENT_ID_KEY = 'sanoittaja.dropbox.clientId';
const TOKEN_KEY = 'sanoittaja.dropbox.token';
const VERIFIER_KEY = 'sanoittaja.dropbox.verifier';

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

export function getDropboxClientId(): string {
  return localStorage.getItem(CLIENT_ID_KEY) ?? '';
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
  const res = await fetch('https://api.dropboxapi.com/oauth2/token', { method: 'POST', body });
  if (!res.ok) throw new Error('Dropbox-kirjautuminen epäonnistui: ' + (await res.text()));
  const data = await res.json();
  localStorage.setItem(TOKEN_KEY, data.access_token);
  window.history.replaceState({}, '', redirectUri());
  return true;
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
    if (res.status === 401) localStorage.removeItem(TOKEN_KEY);
    throw new Error(`Dropbox-vienti epäonnistui (${res.status}): ${await res.text()}`);
  }
}

export const dropboxProvider: CloudProvider = {
  id: 'dropbox',
  label: 'Dropbox',

  isConfigured: () => getDropboxClientId().length > 0,
  isConnected: () => !!localStorage.getItem(TOKEN_KEY),

  async connect() {
    const verifier = randomVerifier();
    sessionStorage.setItem(VERIFIER_KEY, verifier);
    const challenge = await sha256Base64Url(verifier);
    const url = new URL('https://www.dropbox.com/oauth2/authorize');
    url.searchParams.set('client_id', getDropboxClientId());
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', redirectUri());
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    window.location.assign(url.toString());
  },

  disconnect() {
    localStorage.removeItem(TOKEN_KEY);
  },

  async uploadBackup(blob: Blob, filename: string): Promise<void> {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) throw new Error('Ei Dropbox-kirjautumista');
    // App folder -oikeudella "/" on kansio Apps/<sovellus>/ käyttäjän omalla
    // tilillä, ei kehittäjän. Saman päivän kopio ylikirjoittuu, eri päivien
    // kopiot jäävät talteen.
    await dropboxUpload(token, `/${filename}`, blob);
  },
};
