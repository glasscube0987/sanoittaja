import { useEffect, useRef, useState } from 'react';
import { deleteRecording, listRecordings, saveRecording } from '../lib/db';
import { formatDateTime, useI18n, type T } from '../lib/i18n';
import { formatDuration, startRecording, type ActiveRecording } from '../lib/recorder';
import type { Recording } from '../lib/types';
import { uid } from '../lib/types';

interface Props {
  songId: string;
}

export default function RecordingsPanel({ songId }: Props) {
  const { t, lang } = useI18n();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [active, setActive] = useState<ActiveRecording | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [status, setStatus] = useState('');
  const timer = useRef<number>();

  useEffect(() => {
    listRecordings(songId).then(setRecordings);
  }, [songId]);

  useEffect(() => () => window.clearInterval(timer.current), []);

  async function toggleRecording() {
    if (active) {
      window.clearInterval(timer.current);
      const { blob, mimeType, durationMs } = await active.stop();
      setActive(null);
      const rec: Recording = {
        id: uid(),
        songId,
        name: t('rec.defaultName', { date: formatDateTime(Date.now(), lang) }),
        mimeType,
        durationMs,
        createdAt: Date.now(),
        blob,
      };
      await saveRecording(rec);
      setRecordings((prev) => [rec, ...prev]);
      setStatus('');
      return;
    }
    try {
      setStatus('');
      const started = await startRecording();
      setActive(started);
      const startedAt = Date.now();
      setElapsed(0);
      timer.current = window.setInterval(() => setElapsed(Date.now() - startedAt), 500);
    } catch (err) {
      setStatus(t('rec.micFailed', { message: err instanceof Error ? err.message : String(err) }));
    }
  }

  function rename(rec: Recording, name: string) {
    const updated = { ...rec, name };
    setRecordings((prev) => prev.map((r) => (r.id === rec.id ? updated : r)));
    saveRecording(updated).catch((err) => console.error(err));
  }

  async function remove(rec: Recording) {
    if (!confirm(t('rec.confirmDelete', { name: rec.name }))) return;
    setRecordings((prev) => prev.filter((r) => r.id !== rec.id));
    await deleteRecording(rec.id);
  }

  return (
    <section>
      <h2 className="section-title">{t('rec.title')}</h2>
      <div className="screen" style={{ padding: '8px 0 0' }}>
        <div className="button-row">
          <button className={active ? 'danger' : 'primary'} onClick={toggleRecording}>
            {t(active ? 'rec.stop' : 'rec.record')}
          </button>
          {active && <span className="rec-live">REC {formatDuration(elapsed)}</span>}
        </div>
        <div className="status">{status}</div>
        {recordings.map((rec) => (
          <RecordingCard
            key={rec.id}
            rec={rec}
            t={t}
            onRename={(name) => rename(rec, name)}
            onDelete={() => remove(rec)}
          />
        ))}
      </div>
    </section>
  );
}

function RecordingCard({
  rec,
  t,
  onRename,
  onDelete,
}: {
  rec: Recording;
  t: T;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    const objectUrl = URL.createObjectURL(rec.blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [rec.blob]);

  return (
    <div className="rec-card">
      <div className="rec-head">
        <input value={rec.name} onChange={(e) => onRename(e.target.value)} />
        <span className="status">{formatDuration(rec.durationMs)}</span>
        <button className="ghost" onClick={onDelete} aria-label={t('rec.deleteLabel')}>
          🗑
        </button>
      </div>
      {url && <audio controls preload="metadata" src={url} />}
    </div>
  );
}
