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
 * Seuraa elementtien kokoa ja ilmoittaa muutoksista. Palauttaa
 * lopetusfunktion.
 *
 * Näyttö kääntyy, jaettu näkymä muuttuu ja näppäimistö avautuu: leveys ei ole
 * vakio edes yhden laulun aikana. Ilman `ResizeObserver`ia (vanha selain)
 * mitataan kerran, jolloin rivitys toimii mutta ei seuraa kääntöä.
 *
 * Lehti antaa seurattavaksi myös merkkimittarinsa (kymmenen nollaa lehden
 * kirjasimella). Sovelluksen oma tasalevyinen latautuu vasta käytettäessä,
 * joten ensimmäinen mittaus voi osua varakirjasimeen; lehden leveys ei
 * kirjasimen vaihtuessa muutu, mutta mittarin leveys muuttuu. Selaimen
 * `loadingdone`-tapahtumaan ei voinut luottaa: WebKitissä rivitys jäi
 * laskemaan vanhalla merkillä.
 */
export function observeWidth(els: Element | Element[], onChange: () => void): () => void {
  onChange();
  if (typeof ResizeObserver === 'undefined') return () => {};
  const observer = new ResizeObserver(() => onChange());
  for (const el of Array.isArray(els) ? els : [els]) observer.observe(el);
  return () => observer.disconnect();
}
