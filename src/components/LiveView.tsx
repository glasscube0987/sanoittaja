import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '../lib/i18n';
import {
  clamp,
  FONT_MAX,
  FONT_MIN,
  FONT_STEP,
  loadLiveSettings,
  scrollStep,
  SPEED_MAX,
  SPEED_MIN,
  SPEED_STEP,
  storeLiveSettings,
} from '../lib/live';
import type { Song } from '../lib/types';
import Icon from './Icon';
import SongSheet from './SongSheet';

interface Props {
  /** Soittojono: yksi laulu editorista, tai settilistan laulut järjestyksessä. */
  songs: Song[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

/** Näytön hereilläpito; ei kaikissa selaimissa, eikä se saa estää live-tilaa. */
interface WakeLockSentinelLike {
  release: () => Promise<void>;
}
type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
};

export default function LiveView({ songs, index, onIndexChange, onClose }: Props) {
  const t = useT();
  const song = songs[index];
  const monta = songs.length > 1;
  const initial = useRef(loadLiveSettings()).current;
  const [speed, setSpeed] = useState(initial.speed);
  const [fontSize, setFontSize] = useState(initial.fontSize);
  const [running, setRunning] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [poke, setPoke] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const wake = useCallback(() => setPoke((p) => p + 1), []);

  useEffect(() => {
    storeLiveSettings({ speed, fontSize });
  }, [speed, fontSize]);

  /* Ohjaimet piiloon, jottei esiintyessä tarvitse osua pieniin painikkeisiin. */
  useEffect(() => {
    setShowControls(true);
    const id = window.setTimeout(() => setShowControls(false), 3500);
    return () => window.clearTimeout(id);
  }, [poke]);

  /* Vieritys: murto-osapikselit kerätään talteen, jotta hidas nopeus liikkuu. */
  useEffect(() => {
    const el = scrollRef.current;
    if (!running || !el) return;
    let frame = 0;
    let last = performance.now();
    let carry = 0;

    const tick = (now: number) => {
      const step = scrollStep(carry, speed, (now - last) / 1000);
      last = now;
      carry = step.carry;
      if (step.pixels > 0) {
        el.scrollTop += step.pixels;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
          setRunning(false);
          return;
        }
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, speed]);

  /* Näyttö hereille. iOS vapauttaa lukon taustalle mennessä, joten se otetaan
     uudelleen kun näkymä palaa esiin. */
  useEffect(() => {
    const api = (navigator as WakeLockNavigator).wakeLock;
    if (!api) return;
    let sentinel: WakeLockSentinelLike | null = null;
    let closed = false;

    const acquire = () => {
      api
        .request('screen')
        .then((s) => {
          if (closed) void s.release();
          else sentinel = s;
        })
        .catch(() => {
          /* Selain voi kieltää lukon; live-tila toimii silti. */
        });
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') acquire();
    };

    acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      closed = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release().catch(() => {});
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === ' ') {
        e.preventDefault();
        setRunning((r) => !r);
        wake();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, wake]);

  /*
   * Biisin vaihtuessa aloitetaan alusta ja vieritys pysäytetään. Setin
   * eteneminen on aina käyttäjän napautus: itsestään seuraavan biisin päälle
   * jatkuva vieritys olisi keikalla pahempi kuin yksi ylimääräinen painallus.
   */
  useEffect(() => {
    setRunning(false);
    scrollRef.current?.scrollTo({ top: 0 });
    wake();
  }, [index, wake]);

  function toggle() {
    setRunning((r) => !r);
    wake();
  }

  function siirry(step: number) {
    const next = index + step;
    if (next < 0 || next >= songs.length) return;
    onIndexChange(next);
  }

  function adjust(setter: (fn: (v: number) => number) => void, delta: number, min: number, max: number) {
    setter((v) => clamp(v + delta, min, max));
    wake();
  }

  return (
    <div className="live-view">
      <div
        className="live-scroll"
        ref={scrollRef}
        onClick={toggle}
        style={{ fontSize: `${fontSize}px` }}
      >
        <SongSheet song={song} className="live" />
        {/* Loppuun tilaa, jotta viimeinen rivi ehtii ruudun keskelle. */}
        <div className="live-tail" />
      </div>

      <div
        className={showControls ? 'live-bar' : 'live-bar hidden'}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Settilistan selaus omalla rivillään: ohjainrivi on jo täynnä. */}
        {monta && (
          <div className="live-nav">
            <button onClick={() => siirry(-1)} disabled={index === 0} aria-label={t('live.previousSong')}>
              <Icon name="chevronLeft" size={20} />
            </button>
            <span className="live-position">
              {t('live.position', { index: index + 1, count: songs.length })}
              <small>{song.title || t('app.untitled')}</small>
            </span>
            <button
              onClick={() => siirry(1)}
              disabled={index === songs.length - 1}
              aria-label={t('live.nextSong')}
            >
              <Icon name="chevronRight" size={20} />
            </button>
          </div>
        )}
        <div className="live-controls">
        <button onClick={toggle} className="primary" aria-label={t(running ? 'live.pause' : 'live.play')}>
          <Icon name={running ? 'pause' : 'play'} size={20} />
        </button>
        <button
          onClick={() => adjust(setSpeed, -SPEED_STEP, SPEED_MIN, SPEED_MAX)}
          aria-label={t('live.slower')}
        >
          −
        </button>
        <span className="live-speed">{t('live.speed', { speed })}</span>
        <button
          onClick={() => adjust(setSpeed, SPEED_STEP, SPEED_MIN, SPEED_MAX)}
          aria-label={t('live.faster')}
        >
          +
        </button>
        <button
          onClick={() => adjust(setFontSize, -FONT_STEP, FONT_MIN, FONT_MAX)}
          aria-label={t('live.smallerText')}
        >
          A−
        </button>
        <button
          onClick={() => adjust(setFontSize, FONT_STEP, FONT_MIN, FONT_MAX)}
          aria-label={t('live.largerText')}
        >
          A+
        </button>
        <button className="ghost" onClick={onClose} aria-label={t('live.exit')}>
          ✕
        </button>
        </div>
      </div>
    </div>
  );
}
