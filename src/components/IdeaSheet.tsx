import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { formatDuration, startRecording, type ActiveRecording } from '../lib/recorder';

export interface IdeaRecording {
  blob: Blob;
  mimeType: string;
  durationMs: number;
}

interface Props {
  /** Valmis nauhoite. Lakana ei tallenna itse: laulu syntyy vasta tästä. */
  onDone: (rec: IdeaRecording) => void;
  onCancel: () => void;
}

/**
 * Idean nauhoitus ilman laulua.
 *
 * Nauhoitus alkaa heti kun lakana avautuu: se napautus joka avasi sen **on** se
 * ele jolla nauhoitus haluttiin aloittaa, eikä idea odota toista napautusta.
 *
 * Laulua ei ole vielä olemassa. Se syntyy vasta kun nauhoitus lopetetaan, joten
 * peruutus tai kielletty mikrofoni ei jätä kantaan mitään – sama oppi kuin
 * tekstikentissä: tyhjä tietue on ansa, ja paras tapa välttää se on olla
 * luomatta sitä.
 */
export default function IdeaSheet({ onDone, onCancel }: Props) {
  const { t } = useI18n();
  const [elapsed, setElapsed] = useState(0);
  const [status, setStatus] = useState('');
  const active = useRef<ActiveRecording | null>(null);
  const timer = useRef<number>();

  useEffect(() => {
    let peruttu = false;

    startRecording()
      .then((started) => {
        // Purku ehti ensin: vapautetaan mikrofoni eikä jäädä nauhoittamaan.
        if (peruttu) {
          void started.stop();
          return;
        }
        active.current = started;
        const alkoi = Date.now();
        timer.current = window.setInterval(() => setElapsed(Date.now() - alkoi), 500);
      })
      .catch((err) => {
        setStatus(t('rec.micFailed', { message: err instanceof Error ? err.message : String(err) }));
      });

    return () => {
      peruttu = true;
      window.clearInterval(timer.current);
      // Mikrofoni on vapautettava myös silloin kun näkymä katoaa alta.
      void active.current?.stop();
      active.current = null;
    };
  }, [t]);

  async function lopeta() {
    const nauhuri = active.current;
    if (!nauhuri) return;
    active.current = null;
    window.clearInterval(timer.current);
    onDone(await nauhuri.stop());
  }

  return (
    /* Lakana ei sulkeudu ulkopuolelta napauttamalla, toisin kuin muut: kesken
       oleva nauhoitus katoaisi vahingossa osuneesta sormesta. */
    <div className="overlay">
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>{t('idea.title')}</h2>
        {status ? (
          <>
            <p className="idea-status">{status}</p>
            <div className="button-row">
              <button className="primary" onClick={onCancel}>
                {t('common.close')}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="idea-elapsed" aria-label={t('idea.recording')}>
              <span className="idea-dot" aria-hidden />
              {formatDuration(elapsed)}
            </p>
            <div className="button-row">
              <button className="primary" onClick={lopeta}>
                {t('idea.stop')}
              </button>
              <button className="ghost" onClick={onCancel}>
                {t('common.cancel')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
