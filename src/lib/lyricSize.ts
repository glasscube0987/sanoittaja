/**
 * Sanoitusrivien tekstikoko editorissa.
 *
 * Puhelimen näytöllä 16 px:n tasalevyistä fonttia mahtuu noin 36 merkkiä, eikä
 * pitkä sanoitusrivi mahdu kerralla millään. Koko on siksi käyttäjän
 * valittavissa: pienempi näyttää enemmän riviä kerralla, suurempi on luettavampi
 * hämärässä. Vaihtokauppa on käyttäjän eikä sovelluksen tehtävä ratkaista.
 *
 * **Yksi koko koskee sekä sointuriviä että tekstiä.** Sointujen sijainti
 * lasketaan `ch`-yksiköllä, joka on elementin oman fontin merkkileveys, joten
 * eri koot siirtäisivät sointuja rivin edetessä yhä kauemmas oikeasta
 * merkistä. Siksi koko viedään yhtenä CSS-muuttujana (`--lyric-size`) eikä
 * kutakin sääntöä erikseen.
 *
 * Oletusta pienempi koko alittaa 16 px:n rajan, jonka alapuolella iOS
 * suurentaa näkymän kenttään kohdistettaessa. Se on turvallista täällä, koska
 * `lib/iosZoom.ts` asettaa iOS:llä `maximum-scale`n juuri tuon automaattisen
 * zoomin estämiseksi; käyttäjän oma nipistys toimii siitä huolimatta.
 *
 * Laitekohtainen näyttöasetus, ei laulun tietoa, joten se asuu localStoragessa
 * eikä kannassa – samoin kuin kieli, merkintätapa ja laululistan järjestys.
 */

const STORAGE_KEY = 'sanoittaja.lyricSize';

/** Oletus on entinen kiinteä koko, jolloin käytös säilyy ennallaan kaikille. */
export const DEFAULT_LYRIC_SIZE = 16;
export const LYRIC_SIZE_MIN = 12;
export const LYRIC_SIZE_MAX = 24;
export const LYRIC_SIZE_STEP = 2;

/** Rajaa koon sallitulle välille ja pyöristää kokonaisiksi pikseleiksi. */
export function clampLyricSize(size: number): number {
  if (!Number.isFinite(size)) return DEFAULT_LYRIC_SIZE;
  return Math.min(LYRIC_SIZE_MAX, Math.max(LYRIC_SIZE_MIN, Math.round(size)));
}

export function loadLyricSize(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_LYRIC_SIZE;
    return clampLyricSize(Number(raw));
  } catch {
    // Rikkinäinen tai estetty tallennus ei saa estää sovelluksen käyttöä.
    return DEFAULT_LYRIC_SIZE;
  }
}

export function storeLyricSize(size: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(clampLyricSize(size)));
  } catch {
    /* Yksityisessä ikkunassa tallennus voi epäonnistua; valinta jää istuntoon. */
  }
}
