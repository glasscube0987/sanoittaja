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
import { COLORS, eraseAlong, ERASER_RADII, STROKE_WIDTHS } from '../lib/annotate';
import { deleteAnnotation, saveAnnotation } from '../lib/db';
import { useAnnotations } from '../lib/useAnnotations';
import type { Annotation, Song } from '../lib/types';
import { uid } from '../lib/types';
import type { DrawTool, ErasePhase } from './Annotations';
import type { EraseSegment } from './SongSheet';
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

  /* Merkinnät luetaan laulukohtaisesti: setissä selattaessa vaihtuvat mukana. */
  const [notes, setNotes] = useAnnotations(song.id);
  const [tool, setTool] = useState<DrawTool>({
    active: false,
    color: COLORS[0],
    eraser: false,
    // Havainto eikä valinta: kynän jälkeen kosketus on kämmen.
    penSeen: initial.penSeen,
    // Kynälaitteella sormipiirto on erikseen valittava; puhelimessa kytkintä ei näy.
    fingerDraws: false,
    strokeSize: initial.strokeSize,
    eraserSize: initial.eraserSize,
  });

  function lisaaVeto(lineId: string, points: number[], color: string) {
    if (points.length < 2) return;
    const note: Annotation = {
      id: uid(),
      songId: song.id,
      lineId,
      color,
      width: STROKE_WIDTHS[tool.strokeSize],
      points,
      unit: 'em',
      createdAt: Date.now(),
    };
    setNotes((prev) => [...prev, note]);
    saveAnnotation(note).catch((err) => console.error('Merkinnän tallennus epäonnistui', err));
  }

  function poistaVeto(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    deleteAnnotation(id).catch((err) => console.error('Merkinnän poisto epäonnistui', err));
  }

  /**
   * Pyyhkäisyn työkopio: lähtötilanne ja nykytila.
   *
   * Pyyhkiminen tehdään kokonaan muistissa ja kirjoitetaan kantaan vasta kun
   * ote irtoaa. Kaksi syytä. Ensinnäkin propsina saatu merkintälista ei ehdi
   * päivittyä kesken pyyhkäisyn, joten jokainen osoitintapahtuma näki saman
   * alkuperäisen vedon ja loi siitä uudet palat – jo pyyhitty ilmestyi
   * takaisin ja paloja kertyi kymmeniä. Toiseksi kirjoitus jokaisesta
   * tapahtumasta luki koko merkintäjoukon uudelleen ja teki pyyhkimisestä
   * takkuavan.
   */
  const pyyhkaisy = useRef<{ alku: Annotation[]; nyt: Annotation[] } | null>(null);

  function pyyhi(phase: ErasePhase, segment: (lineId: string) => EraseSegment | null) {
    if (phase === 'start') pyyhkaisy.current = { alku: notes, nyt: notes };

    const tila = pyyhkaisy.current;
    if (!tila) return;

    if (phase === 'end') {
      pyyhkaisy.current = null;
      // Yksi kirjoitus koko pyyhkäisystä: poistetut pois, syntyneet palat sisään.
      const ennen = new Set(tila.alku.map((n) => n.id));
      const jalkeen = new Set(tila.nyt.map((n) => n.id));
      for (const note of tila.alku) {
        if (jalkeen.has(note.id)) continue;
        deleteAnnotation(note.id).catch((err) => console.error('Merkinnän poisto epäonnistui', err));
      }
      for (const note of tila.nyt) {
        if (ennen.has(note.id)) continue;
        saveAnnotation(note).catch((err) => console.error('Merkinnän tallennus epäonnistui', err));
      }
      return;
    }

    const sade = ERASER_RADII[tool.eraserSize];
    let muuttui = false;
    const seuraava: Annotation[] = [];
    for (const note of tila.nyt) {
      const jana = segment(note.lineId);
      const palat = jana ? eraseAlong(note.points, jana.from, jana.to, sade) : null;
      if (!palat) {
        seuraava.push(note);
        continue;
      }
      muuttui = true;
      for (const points of palat) {
        seuraava.push({ ...note, id: uid(), points, createdAt: Date.now() });
      }
    }

    if (!muuttui) return;
    tila.nyt = seuraava;
    setNotes(seuraava);
  }

  function kumoaVeto() {
    const viimeisin = notes[notes.length - 1];
    if (viimeisin) poistaVeto(viimeisin.id);
  }

  const wake = useCallback(() => setPoke((p) => p + 1), []);

  useEffect(() => {
    storeLiveSettings({
      speed,
      fontSize,
      penSeen: tool.penSeen,
      strokeSize: tool.strokeSize,
      eraserSize: tool.eraserSize,
    });
  }, [speed, fontSize, tool.penSeen, tool.strokeSize, tool.eraserSize]);

  /*
   * Ohjaimet piiloon, jotta lehti näkyy esiintyessä kokonaan. Piilotettuna
   * palkki on myös läpäisemätön, joten jokaisesta tilasta on oltava tie
   * takaisin – muuten laulusta ei pääse ulos muuten kuin lataamalla appi
   * uudelleen, eikä puhelimessa ole näppäimistöä varareitiksi.
   *
   * Piirtotilassa palkkia ei piiloteta lainkaan: siellä lehden napautus on
   * varattu piirtämiselle, eikä mikään ele toisi palkkia takaisin. Työkalut
   * ovat sitä paitsi juuri se asia jota piirtäessä käytetään.
   */
  useEffect(() => {
    setShowControls(true);
    if (tool.active) return;
    const id = window.setTimeout(() => setShowControls(false), 3500);
    return () => window.clearTimeout(id);
  }, [poke, tool.active]);

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
        className={tool.active ? 'live-scroll drawing' : 'live-scroll'}
        ref={scrollRef}
        /* Piirtotilassa napautus jättää jäljen; se ei saa myös käynnistää
           vieritystä, joten toisto kytketään vain tavallisessa tilassa. */
        onClick={tool.active ? undefined : toggle}
        /* Herätys on erikseen osoittimessa eikä napautuksessa: napautus voi olla
           varattu piirtoon, mutta kosketuksen on aina tuotava ohjaimet esiin.
           Näin uusi tila, joka varaa napautuksen, ei voi vahingossa hukata
           ainoaa tietä takaisin ohjaimiin. */
        onPointerDown={wake}
        style={{
          fontSize: `${fontSize}px`,
          /* Piirtotilassa vieritys on estettävä kokonaan. Myös Apple Pencil on
             `touch-action`in alainen, joten ehdollisena tämä vei kynävedon
             vieritykseksi – ja pakotti pitämään sormipiirron päällä, jolloin
             kämmen sotki lapun. Vieritys tapahtuu piirtotilan ulkopuolella. */
          touchAction: tool.active ? 'none' : undefined,
        }}
      >
        <SongSheet
          song={song}
          className="live"
          annotations={notes}
          tool={tool}
          onDraw={lisaaVeto}
          onErase={pyyhi}
          fontSize={fontSize}
          onPenSeen={() => setTool((prev) => (prev.penSeen ? prev : { ...prev, penSeen: true }))}
        />
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
        {tool.active && (
          <div className="draw-tools">
            {COLORS.map((color) => (
              <button
                key={color}
                className={!tool.eraser && tool.color === color ? 'swatch current' : 'swatch'}
                style={{ background: color }}
                aria-label={t('draw.color', { color })}
                onClick={() => setTool((prev) => ({ ...prev, color, eraser: false }))}
              />
            ))}
            <button
              className={tool.eraser ? 'primary' : ''}
              onClick={() => setTool((prev) => ({ ...prev, eraser: !prev.eraser }))}
            >
              {t('draw.eraser')}
            </button>
            {/* Kuvake ja lyhyt teksti, jotta työkalut mahtuvat puhelimessa
                yhdelle riville: toinen rivi söisi lehteä juuri keikalla. */}
            <button onClick={kumoaVeto} disabled={notes.length === 0} aria-label={t('draw.undo')}>
              <Icon name="undo" size={18} />
            </button>
            {/* Kolme kokoa, merkitys vaihtuu tilan mukana: piirtäessä kynän
                paksuus, pyyhkiessä pyyhkimen säde. Rivi ei kasva, ja säätö
                koskee aina sitä työkalua joka on kädessä. */}
            <span className="draw-sizes">
              {[0, 1, 2].map((koko) => {
                const valittu = tool.eraser ? tool.eraserSize : tool.strokeSize;
                return (
                  <button
                    key={koko}
                    className={koko === valittu ? 'size current' : 'size'}
                    aria-label={t(tool.eraser ? 'draw.eraserSize' : 'draw.penSize', {
                      size: koko + 1,
                    })}
                    aria-pressed={koko === valittu}
                    onClick={() =>
                      setTool((prev) =>
                        prev.eraser ? { ...prev, eraserSize: koko } : { ...prev, strokeSize: koko },
                      )
                    }
                  >
                    <span className="size-dot" style={{ width: 4 + koko * 5, height: 4 + koko * 5 }} />
                  </button>
                );
              })}
            </span>
            {/* Vain kynälaitteella: puhelimessa sormi piirtää ilman valintaa,
                ja kynän kanssa kosketus on oletuksena kämmen. */}
            {tool.penSeen && (
              <button
                className={tool.fingerDraws ? 'primary' : ''}
                aria-label={t('draw.finger')}
                onClick={() => setTool((prev) => ({ ...prev, fingerDraws: !prev.fingerDraws }))}
              >
                {t('draw.fingerShort')}
              </button>
            )}
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
        <button
          className={tool.active ? 'primary' : ''}
          onClick={() => setTool((prev) => ({ ...prev, active: !prev.active }))}
          aria-label={t('draw.toggle')}
        >
          <Icon name="pen" size={20} />
        </button>
        <button className="ghost" onClick={onClose} aria-label={t('live.exit')}>
          ✕
        </button>
        </div>
      </div>
    </div>
  );
}
