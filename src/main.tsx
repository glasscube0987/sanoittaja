import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { completeDropboxAuthIfReturning } from './lib/sync/dropbox';
import './styles.css';

async function boot() {
  try {
    await completeDropboxAuthIfReturning();
  } catch (err) {
    console.error(err);
    alert(err instanceof Error ? err.message : String(err));
  }
  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
  if ('serviceWorker' in navigator && !import.meta.env.DEV) {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('SW-rekisteröinti epäonnistui', err));
  }
}

boot();
