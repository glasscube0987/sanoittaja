/**
 * Live-tilan vieritys ja asetukset.
 *
 * Vieritys lasketaan pikseleinä sekunnissa, mutta `scrollTop` liikkuu vain
 * kokonaisin pikselein. Hitaalla nopeudella yhden ruudunpiirron askel jää alle
 * yhden pikselin, joten murto-osa on kerättävä talteen – muuten näkymä ei
 * liikkuisi lainkaan.
 */
import { TEXT_FONTS } from './annotate';
import type { TextFont } from './types';

export interface LiveSettings {
  /** Vierityksen nopeus pikseleinä sekunnissa. */
  speed: number;
  /** Sanoitusten tekstikoko pikseleinä. */
  fontSize: number;
  /**
   * Onko kynää käytetty tällä laitteella. Muistetaan istuntojen yli, koska
   * kämmen osuu lappuun usein ennen kärkeä: ilman muistia jokaisen istunnon
   * ensimmäinen veto olisi kämmenen jättämä.
   */
  penSeen: boolean;
  /** Kynän ja pyyhkimen kokovalinnat indeksinä; ks. lib/annotate.ts. */
  strokeSize: number;
  eraserSize: number;
  /**
   * Tekstityökalun oletukset seuraavaa kenttää varten. Jo kirjoitetut kentät
   * kantavat oman asunsa mukanaan, joten näiden muuttaminen ei koske niihin.
   */
  textSize: number;
  textFont: TextFont;
  textBold: boolean;
  textItalic: boolean;
  textBoxed: boolean;
}

export const SPEED_MIN = 4;
export const SPEED_MAX = 80;
export const SPEED_STEP = 4;

export const FONT_MIN = 14;
export const FONT_MAX = 40;
export const FONT_STEP = 2;

export const DEFAULT_LIVE: LiveSettings = {
  speed: 16,
  fontSize: 20,
  penSeen: false,
  strokeSize: 1,
  eraserSize: 1,
  textSize: 1,
  textFont: 'sans',
  textBold: false,
  textItalic: false,
  textBoxed: false,
};

const STORAGE_KEY = 'sanoittaja.live';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Yhden ruudunpiirron vieritysaskel. Palauttaa kokonaiset pikselit ja jäljelle
 * jäävän murto-osan, joka annetaan seuraavalle kutsulle.
 */
export function scrollStep(
  carry: number,
  speed: number,
  dtSeconds: number,
): { pixels: number; carry: number } {
  // Välilehden palatessa taustalta dt voi olla suuri; rajataan hyppy siedettäväksi.
  const dt = clamp(dtSeconds, 0, 0.25);
  const total = carry + speed * dt;
  const pixels = Math.floor(total);
  return { pixels, carry: total - pixels };
}

/**
 * Luku tallenteesta rajattuna, oletus vain puuttuvalle tai kelvottomalle.
 *
 * `Number(x) || oletus` ei kelpaa: pienin kokovalinta on indeksi 0, joka on
 * epätosi, jolloin valinta unohtui joka avauksella ja palautui keskikokoon.
 */
function luku(arvo: unknown, oletus: number, min: number, max: number): number {
  const n = Number(arvo);
  return Number.isFinite(n) ? clamp(n, min, max) : oletus;
}

export function loadLiveSettings(): LiveSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LIVE;
    const parsed = JSON.parse(raw) as Partial<LiveSettings>;
    return {
      speed: luku(parsed.speed, DEFAULT_LIVE.speed, SPEED_MIN, SPEED_MAX),
      fontSize: luku(parsed.fontSize, DEFAULT_LIVE.fontSize, FONT_MIN, FONT_MAX),
      penSeen: parsed.penSeen === true,
      strokeSize: luku(parsed.strokeSize, DEFAULT_LIVE.strokeSize, 0, 2),
      eraserSize: luku(parsed.eraserSize, DEFAULT_LIVE.eraserSize, 0, 2),
      /* Tekstin asetukset tulivat myöhemmin: vanhassa tallenteessa niitä ei ole,
         eikä puuttuva kenttä saa palauttaa muita asetuksia oletuksiin. */
      textSize: luku(parsed.textSize, DEFAULT_LIVE.textSize, 0, 2),
      textFont: TEXT_FONTS.includes(parsed.textFont as TextFont)
        ? (parsed.textFont as TextFont)
        : DEFAULT_LIVE.textFont,
      textBold: parsed.textBold === true,
      textItalic: parsed.textItalic === true,
      textBoxed: parsed.textBoxed === true,
    };
  } catch {
    // Rikkinäinen asetus ei saa estää esiintymistä.
    return DEFAULT_LIVE;
  }
}

export function storeLiveSettings(settings: LiveSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
