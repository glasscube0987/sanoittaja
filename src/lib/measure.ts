/**
 * Lehden mitat rivitystä varten: montako merkkiä näytölle mahtuu.
 *
 * Vain live-tilalle. Tulostuslehti on editorissa `display: none`, eikä siltä
 * voi mitata mitään – siksi tuloste ei rivity, ja siksi nämä mitat ovat
 * valinnaisia kaikkialla missä niitä käytetään.
 */

/**
 * Montako tasalevyistä merkkiä leveyteen mahtuu.
 *
 * Pyöristetään alaspäin ja jätetään pikselin vara: murto-osan verran liian
 * leveä rivi toisi vaakavierityksen takaisin, ja juuri siitä rivitys päästää
 * eroon.
 */
export function columnsThatFit(widthPx: number, chPx: number): number {
  if (!(widthPx > 0) || !(chPx > 0)) return Infinity;
  return Math.floor((widthPx - 1) / chPx);
}

/**
 * Seuraa elementin leveyttä ja kirjasinten latautumista ja ilmoittaa
 * muutoksista. Palauttaa lopetusfunktion.
 *
 * Näyttö kääntyy, jaettu näkymä muuttuu ja näppäimistö avautuu: leveys ei ole
 * vakio edes yhden laulun aikana. Ilman `ResizeObserver`ia (vanha selain)
 * mitataan kerran, jolloin rivitys toimii mutta ei seuraa kääntöä.
 *
 * Kirjasin kuuluu mukaan, koska sovelluksen oma tasalevyinen ladataan vasta
 * käytettäessä (`font-display: swap`). Ensimmäinen mittaus voi siis osua
 * varakirjasimeen, jonka merkki on eri levyinen; leveys ei silti muutu, joten
 * pelkkä `ResizeObserver` jättäisi rivityksen laskemaan väärällä merkillä.
 */
export function observeWidth(el: Element, onChange: () => void): () => void {
  onChange();
  const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
  const onFonts = () => onChange();
  fonts?.addEventListener?.('loadingdone', onFonts);
  if (typeof ResizeObserver === 'undefined') return () => fonts?.removeEventListener?.('loadingdone', onFonts);
  const observer = new ResizeObserver(() => onChange());
  observer.observe(el);
  return () => {
    observer.disconnect();
    fonts?.removeEventListener?.('loadingdone', onFonts);
  };
}
