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
import {
  COLORS,
  eraseAlong,
  ERASER_RADII,
  isBlank,
  STROKE_WIDTHS,
  TEXT_FONTS,
  TEXT_SIZES,
} from '../lib/annotate';
import type { Point } from '../lib/annotate';
import { deleteAnnotation, saveAnnotation } from '../lib/db';
import { useAnnotations } from '../lib/useAnnotations';
import type { Annotation, Song, TextAnnotation } from '../lib/types';
import { isStroke, isText, uid } from '../lib/types';
import type { DrawMode, DrawTool, ErasePhase, TextTools } from './Annotations';
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

/** Kirjasinvalinnan näkyvät nimet. Taulukkona, jotta avain kelpaa `t()`:lle. */
const FONTIN_NIMI = {
  sans: 'text.fontSans',
  mono: 'text.fontMono',
  serif: 'text.fontSerif',
} as const;

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
    mode: 'pen',
    color: COLORS[0],
    // Havainto eikä valinta: kynän jälkeen kosketus on kämmen.
    penSeen: initial.penSeen,
    // Kynälaitteella sormipiirto on erikseen valittava; puhelimessa kytkintä ei näy.
    fingerDraws: false,
    strokeSize: initial.strokeSize,
    eraserSize: initial.eraserSize,
    textSize: initial.textSize,
    textFont: initial.textFont,
    textBold: initial.textBold,
    textItalic: initial.textItalic,
    textBoxed: initial.textBoxed,
  });
  /** Kenttä, jota kirjoitetaan. Vain yksi kerrallaan. */
  const [editing, setEditing] = useState<string | null>(null);

  /*
   * Tuorein merkintälista käsittelijöitä varten.
   *
   * Kirjoittaminen ja siirtäminen päättyvät omaan tapahtumaansa, joka näkee
   * sulkeumassaan sen renderin tilan jossa käsittelijä syntyi. Ilman tätä
   * viimeinen kirjoitettu merkki tai viimeinen siirron pykälä jäisi
   * tallentamatta.
   */
  const notesRef = useRef(notes);
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

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

  function poistaMerkinta(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    setEditing((nyt) => (nyt === id ? null : nyt));
    deleteAnnotation(id).catch((err) => console.error('Merkinnän poisto epäonnistui', err));
  }

  /* --- Tekstikentät --- */

  /** Kenttä syntyy tyhjänä ja kirjoitettavana; tallennus vasta valmiista. */
  function lisaaTeksti(lineId: string, at: Point) {
    const note: TextAnnotation = {
      kind: 'text',
      id: uid(),
      songId: song.id,
      lineId,
      color: tool.color,
      x: at.x,
      y: at.y,
      text: '',
      size: TEXT_SIZES[tool.textSize],
      font: tool.textFont,
      bold: tool.textBold,
      italic: tool.textItalic,
      boxed: tool.textBoxed,
      unit: 'em',
      createdAt: Date.now(),
    };
    setNotes((prev) => [...prev, note]);
    setEditing(note.id);
  }

  /** Muokkaa kenttää näytöllä; kantaan kirjoitetaan vasta kun ote irtoaa. */
  function muokkaaTekstia(id: string, muutos: Partial<TextAnnotation>) {
    setNotes((prev) =>
      prev.map((n) => (n.id === id && isText(n) ? { ...n, ...muutos } : n)),
    );
  }

  function tallennaTeksti(id: string) {
    const note = notesRef.current.find((n) => n.id === id);
    if (note && isText(note)) {
      saveAnnotation(note).catch((err) => console.error('Merkinnän tallennus epäonnistui', err));
    }
  }

  /**
   * Kirjoitus päättyi. Tyhjä kenttä katoaa: näkymätön laatikko keskellä lehteä
   * olisi pelkkä ansa, ja tyhjentäminen on luonteva tapa poistaa kenttä.
   */
  function paataTeksti(id: string) {
    setEditing((nyt) => (nyt === id ? null : nyt));
    const note = notesRef.current.find((n) => n.id === id);
    if (!note || !isText(note)) return;
    if (isBlank(note.text)) {
      poistaMerkinta(id);
      return;
    }
    tallennaTeksti(id);
  }

  /* Live-tilasta poistuminen kesken kirjoituksen ei saa hukata tekstiä.
     Sulkeuma uusitaan joka renderillä, joten purku näkee tuoreimman tilan. */
  const lopetus = useRef<() => void>(() => {});
  lopetus.current = () => {
    if (editing) paataTeksti(editing);
  };
  useEffect(() => () => lopetus.current(), []);

  const tekstityokalut: TextTools = {
    editingId: editing,
    create: lisaaTeksti,
    edit: setEditing,
    move: (id, at) => muokkaaTekstia(id, { x: at.x, y: at.y }),
    moveEnd: tallennaTeksti,
    change: (id, text) => muokkaaTekstia(id, { text }),
    commit: paataTeksti,
  };

  /**
   * Tekstin asun säätimet. Kirjoitettavana oleva kenttä muuttuu heti, ja valinta
   * jää myös seuraavan kentän oletukseksi – muuten sama asu pitäisi valita joka
   * kerta uudelleen.
   */
  function asu(muutos: Partial<TextAnnotation>, oletus: Partial<DrawTool>) {
    setTool((prev) => ({ ...prev, ...oletus }));
    if (editing) muokkaaTekstia(editing, muutos);
  }

  /**
   * Työkalupainike ei saa varastaa kohdistusta kirjoitettavalta kentältä:
   * muuten lihavointia painaessa kirjoitus päättyisi ja valinta osuisi vasta
   * seuraavaan kenttään. Sekä osoitin- että hiiritapahtuma, koska kohdistuksen
   * siirtää se kumpi selaimessa sattuu olemaan oletustoiminto.
   */
  const kohdistus = {
    onPointerDown: (e: { preventDefault: () => void }) => {
      if (editing) e.preventDefault();
    },
    onMouseDown: (e: { preventDefault: () => void }) => {
      if (editing) e.preventDefault();
    },
  };

  function vaihdaTila(mode: DrawMode) {
    // Tekstitilasta poistuminen päättää kirjoituksen; muuten kenttä jäisi auki.
    if (mode !== 'text' && editing) paataTeksti(editing);
    setTool((prev) => ({ ...prev, mode }));
  }

  function vaihdaKoko(koko: number) {
    if (tool.mode === 'eraser') setTool((prev) => ({ ...prev, eraserSize: koko }));
    else if (tool.mode === 'text') asu({ size: TEXT_SIZES[koko] }, { textSize: koko });
    else setTool((prev) => ({ ...prev, strokeSize: koko }));
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
      /* Pyyhekumi koskee vetoihin. Tekstikenttä poistetaan tyhjentämällä tai
         roskakorista: yksi harhainen pyyhkäisy ei saa viedä kirjoitettua
         merkintää, jota ei voi piirtää takaisin. */
      if (!isStroke(note)) {
        seuraava.push(note);
        continue;
      }
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

  /** Kumoaa viimeisimmän merkinnän, oli se veto tai tekstikenttä. */
  function kumoa() {
    const viimeisin = notes[notes.length - 1];
    if (viimeisin) poistaMerkinta(viimeisin.id);
  }

  const wake = useCallback(() => setPoke((p) => p + 1), []);

  useEffect(() => {
    storeLiveSettings({
      speed,
      fontSize,
      penSeen: tool.penSeen,
      strokeSize: tool.strokeSize,
      eraserSize: tool.eraserSize,
      textSize: tool.textSize,
      textFont: tool.textFont,
      textBold: tool.textBold,
      textItalic: tool.textItalic,
      textBoxed: tool.textBoxed,
    });
  }, [
    speed,
    fontSize,
    tool.penSeen,
    tool.strokeSize,
    tool.eraserSize,
    tool.textSize,
    tool.textFont,
    tool.textBold,
    tool.textItalic,
    tool.textBoxed,
  ]);

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
      /*
       * Kirjoitettavassa kentässä näppäimet kuuluvat tekstille. Ilman tätä
       * välilyönti käynnisti vierityksen eikä päätynyt tekstiin lainkaan – siis
       * «capo 3» oli mahdoton kirjoittaa – ja Escape sulki koko live-tilan
       * kesken kirjoituksen.
       */
      const kohde = e.target as HTMLElement | null;
      if (kohde && (kohde.isContentEditable || /^(TEXTAREA|INPUT|SELECT)$/.test(kohde.tagName))) {
        return;
      }
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
          text={tekstityokalut}
          fontSize={fontSize}
          onPenSeen={() => setTool((prev) => (prev.penSeen ? prev : { ...prev, penSeen: true }))}
        />
        {/* Loppuun tilaa, jotta viimeinen rivi ehtii ruudun keskelle. */}
        <div className="live-tail" />
      </div>

      {/* Vihje vain kunnes ensimmäinen kenttä on olemassa: sen jälkeen ele on
          opittu, eikä palkki saa syödä lehteä turhaan. */}
      {tool.active && tool.mode === 'text' && !editing && !notes.some(isText) && (
        <p className="text-hint">{t('text.hint')}</p>
      )}

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
          <>
            {/*
             * Työkalut kahdella rivillä: ylhäällä mitä kädessä on, alhaalla
             * miltä jälki näyttää. Yhdellä rivillä kaikki kiertyi puhelimessa
             * toiselle riville joka tapauksessa, mutta mielivaltaisesta
             * kohdasta – kahtena rivinä jako on ainakin ymmärrettävä.
             */}
            <div className="draw-tools">
              <span className="draw-modes">
                {(['pen', 'eraser', 'text'] as const).map((mode) => (
                  <button
                    key={mode}
                    className={tool.mode === mode ? 'primary' : ''}
                    aria-label={t(`draw.${mode}`)}
                    aria-pressed={tool.mode === mode}
                    onClick={() => vaihdaTila(mode)}
                  >
                    <Icon name={mode === 'pen' ? 'pen' : mode === 'eraser' ? 'eraser' : 'text'} size={18} />
                  </button>
                ))}
              </span>
              {/* Kolme kokoa, merkitys vaihtuu tilan mukana: piirtäessä kynän
                  paksuus, pyyhkiessä pyyhkimen säde, tekstitilassa kirjasinkoko.
                  Rivi ei kasva, ja säätö koskee aina sitä työkalua joka on
                  kädessä. */}
              <span className="draw-sizes">
                {[0, 1, 2].map((koko) => {
                  const valittu =
                    tool.mode === 'eraser'
                      ? tool.eraserSize
                      : tool.mode === 'text'
                        ? tool.textSize
                        : tool.strokeSize;
                  const avain =
                    tool.mode === 'eraser'
                      ? 'draw.eraserSize'
                      : tool.mode === 'text'
                        ? 'draw.textSize'
                        : 'draw.penSize';
                  return (
                    <button
                      key={koko}
                      className={koko === valittu ? 'size current' : 'size'}
                      aria-label={t(avain, { size: koko + 1 })}
                      aria-pressed={koko === valittu}
                      {...kohdistus}
                      onClick={() => vaihdaKoko(koko)}
                    >
                      {tool.mode === 'text' ? (
                        <span className="size-letter" style={{ fontSize: 9 + koko * 4 }}>
                          A
                        </span>
                      ) : (
                        <span
                          className="size-dot"
                          style={{ width: 4 + koko * 5, height: 4 + koko * 5 }}
                        />
                      )}
                    </button>
                  );
                })}
              </span>
              <button onClick={kumoa} disabled={notes.length === 0} aria-label={t('draw.undo')}>
                <Icon name="undo" size={18} />
              </button>
              {/* Roskakori kumoamisen vierellä: molemmat ovat tekoja eivätkä
                  asua, ja asurivi oli jo täynnä. */}
              {editing && (
                <button
                  className="ghost"
                  aria-label={t('text.delete')}
                  {...kohdistus}
                  onClick={() => poistaMerkinta(editing)}
                >
                  <Icon name="trash" size={18} />
                </button>
              )}
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

            {tool.mode !== 'eraser' && (
              <div className="draw-attrs">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    className={tool.color === color ? 'swatch current' : 'swatch'}
                    style={{ background: color }}
                    aria-label={t('draw.color', { color })}
                    {...kohdistus}
                    onClick={() => asu({ color }, { color })}
                  />
                ))}
                {tool.mode === 'text' && (
                  <>
                    {/* Kierrätyspainike eikä valikko: valikon leveys vaihtelee
                        nimen mukaan ja kiersi rivin toiselle riville. Näyte on
                        kirjoitettu valitulla kirjasimella, joten valinta näkyy
                        painikkeessa itsessään. */}
                    <button
                      className="draw-font"
                      data-font={tool.textFont}
                      aria-label={t('text.font', { name: t(FONTIN_NIMI[tool.textFont]) })}
                      {...kohdistus}
                      onClick={() => {
                        const font = TEXT_FONTS[(TEXT_FONTS.indexOf(tool.textFont) + 1) % TEXT_FONTS.length];
                        asu({ font }, { textFont: font });
                      }}
                    >
                      Aa
                    </button>
                    <button
                      className={tool.textBold ? 'primary bold' : 'bold'}
                      aria-label={t('text.bold')}
                      aria-pressed={tool.textBold}
                      {...kohdistus}
                      onClick={() => asu({ bold: !tool.textBold }, { textBold: !tool.textBold })}
                    >
                      B
                    </button>
                    <button
                      className={tool.textItalic ? 'primary italic' : 'italic'}
                      aria-label={t('text.italic')}
                      aria-pressed={tool.textItalic}
                      {...kohdistus}
                      onClick={() =>
                        asu({ italic: !tool.textItalic }, { textItalic: !tool.textItalic })
                      }
                    >
                      I
                    </button>
                    <button
                      className={tool.textBoxed ? 'primary' : ''}
                      aria-label={t('text.boxed')}
                      aria-pressed={tool.textBoxed}
                      {...kohdistus}
                      onClick={() => asu({ boxed: !tool.textBoxed }, { textBoxed: !tool.textBoxed })}
                    >
                      <span className="boxed-sample">A</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </>
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
