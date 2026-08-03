/**
 * Google Drive -synkronointi. Access token haetaan Google Identity Services
 * -kirjastolla (ladataan dynaamisesti); käyttäjä syöttää oman OAuth client
 * id:nsä asetuksissa. Tiedostot viedään Driveen kansioon "Sanoittaja".
 */
import type { CloudProvider } from './provider';

const CLIENT_ID_KEY = 'sanoittaja.gdrive.clientId';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';

let accessToken: string | null = null;

export function getGdriveClientId(): string {
  return localStorage.getItem(CLIENT_ID_KEY) ?? '';
}

export function setGdriveClientId(id: string): void {
  localStorage.setItem(CLIENT_ID_KEY, id.trim());
}

function loadGis(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).google?.accounts?.oauth2) return resolve();
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google-kirjautumiskirjaston lataus epäonnistui'));
    document.head.appendChild(script);
  });
}

async function requestToken(): Promise<string> {
  await loadGis();
  return new Promise((resolve, reject) => {
    const client = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: getGdriveClientId(),
      scope: SCOPE,
      callback: (resp: { access_token?: string; error?: string }) => {
        if (resp.access_token) {
          accessToken = resp.access_token;
          resolve(resp.access_token);
        } else {
          reject(new Error('Google-kirjautuminen epäonnistui: ' + (resp.error ?? 'tuntematon virhe')));
        }
      },
    });
    client.requestAccessToken();
  });
}

async function driveFetch(token: string, url: string, init: RequestInit): Promise<any> {
  const res = await fetch(url, {
    ...init,
    headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    if (res.status === 401) accessToken = null;
    throw new Error(`Google Drive -pyyntö epäonnistui (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

async function findOrCreateFolder(token: string, name: string, parentId?: string): Promise<string> {
  const q = encodeURIComponent(
    `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false` +
      (parentId ? ` and '${parentId}' in parents` : ''),
  );
  const found = await driveFetch(token, `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`, {
    method: 'GET',
  });
  if (found.files?.length) return found.files[0].id;
  const created = await driveFetch(token, 'https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
    }),
  });
  return created.id;
}

async function findFile(token: string, folderId: string, name: string): Promise<string | null> {
  const q = encodeURIComponent(
    `name='${name.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed=false`,
  );
  const found = await driveFetch(token, `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`, {
    method: 'GET',
  });
  return found.files?.[0]?.id ?? null;
}

/**
 * Kirjoittaa tiedoston kansioon: jos samanniminen on jo olemassa, sen sisältö
 * korvataan. Drive sallii samannimiset tiedostot samassa kansiossa, joten ilman
 * hakua joka vienti jättäisi uuden kaksoiskappaleen.
 */
async function uploadFile(token: string, folderId: string, name: string, content: Blob): Promise<void> {
  const existing = await findFile(token, folderId, name);
  if (existing) {
    await driveFetch(
      token,
      `https://www.googleapis.com/upload/drive/v3/files/${existing}?uploadType=media&fields=id`,
      { method: 'PATCH', headers: { 'Content-Type': content.type || 'application/octet-stream' }, body: content },
    );
    return;
  }
  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify({ name, parents: [folderId] })], { type: 'application/json' }),
  );
  form.append('file', content);
  await driveFetch(token, 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST',
    body: form,
  });
}

export const gdriveProvider: CloudProvider = {
  id: 'gdrive',
  label: 'Google Drive',

  isConfigured: () => getGdriveClientId().length > 0,
  isConnected: () => accessToken !== null,

  async connect() {
    await requestToken();
  },

  disconnect() {
    accessToken = null;
  },

  async uploadBackup(blob: Blob, filename: string): Promise<void> {
    const token = accessToken ?? (await requestToken());
    // drive.file-oikeus näkee vain tämän sovelluksen luomat tiedostot, joten
    // kansio ja kopiot ovat käyttäjän omassa Drivessa mutta muu sisältö pysyy
    // sovelluksen ulottumattomissa.
    const folderId = await findOrCreateFolder(token, 'Sanoittaja');
    await uploadFile(token, folderId, filename, blob);
  },
};
