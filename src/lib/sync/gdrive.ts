/**
 * Google Drive -synkronointi. Access token haetaan Google Identity Services
 * -kirjastolla (ladataan dynaamisesti); käyttäjä syöttää oman OAuth client
 * id:nsä asetuksissa. Tiedostot viedään Driveen kansioon "Sanoittaja".
 */
import type { Recording, Song } from '../types';
import type { CloudProvider, UploadResult } from './provider';
import { recordingExtension, songFileName, songToJson } from './provider';

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

async function uploadFile(
  token: string,
  folderId: string,
  name: string,
  mimeType: string,
  content: Blob | string,
): Promise<void> {
  const metadata = { name, parents: [folderId] };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', content instanceof Blob ? content : new Blob([content], { type: mimeType }));
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

  async uploadSong(song: Song, recordings: Recording[]): Promise<UploadResult> {
    const token = accessToken ?? (await requestToken());
    const rootId = await findOrCreateFolder(token, 'Sanoittaja');
    const songFolderId = await findOrCreateFolder(token, songFileName(song), rootId);
    await uploadFile(token, songFolderId, 'laulu.json', 'application/json', songToJson(song));
    for (const rec of recordings) {
      const ext = recordingExtension(rec.mimeType);
      const safe = rec.name.replace(/[\\/:*?"<>|]/g, '_') || rec.id;
      await uploadFile(token, songFolderId, `${safe}-${rec.id}.${ext}`, rec.mimeType, rec.blob);
    }
    return { files: 1 + recordings.length };
  },
};
