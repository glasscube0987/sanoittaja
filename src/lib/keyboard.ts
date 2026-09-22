/**
 * Kuinka paljon näppäimistö peittää näkymän alareunasta.
 *
 * iOS ei kutista asetteluikkunaa näppäimistön auetessa, joten `position: fixed`
 * -elementti jää sen alle. Live-tilassa se tarkoittaa työkalupalkkia: kenttään
 * kirjoittaminen avaa näppäimistön, ja samalla katoaa se rivi jolla kentän
 * poisto, kirjasin ja lihavointi ovat. Vika oli raportoitu kerran aiemminkin
 * eikä sitä saatu toistettua – syy näkyy vain oikealla laitteella.
 *
 * `visualViewport` kertoo sen alueen jonka käyttäjä oikeasti näkee, ja ero
 * ikkunan korkeuteen on näppäimistön (ja muiden peittävien palkkien) osuus.
 *
 * Selain-API omassa moduulissaan; laskenta on puhdas funktio, jotta se voidaan
 * testata ilman selainta.
 */

/** Näkyvän alueen mitat siltä osin kuin laskenta niitä tarvitsee. */
export interface ViewportMitat {
  height: number;
  offsetTop: number;
}

/**
 * Peitetty osuus pikseleinä, nolla kun mitään ei peitä.
 *
 * Pyöristetään alaspäin: murto-osan pikselin marginaali on parempi kuin
 * yhden pikselin rako, jossa palkin reuna jäisi näppäimistön alle.
 */
export function keyboardInset(view: ViewportMitat | null, innerHeight: number): number {
  if (!view) return 0;
  return Math.max(0, Math.floor(innerHeight - (view.height + view.offsetTop)));
}

/**
 * Seuraa peitettyä osuutta ja ilmoittaa muutoksista. Palauttaa lopetusfunktion.
 *
 * Sekä `resize` että `scroll` ovat tarpeen: näppäimistön avautuminen muuttaa
 * korkeutta, mutta iOS vierittää näkyvää aluetta erikseen kun kohdistettu
 * kenttä on matalalla.
 */
export function observeKeyboard(onChange: (inset: number) => void): () => void {
  const view = typeof window === 'undefined' ? null : window.visualViewport;
  if (!view) return () => {};

  const paivita = () => onChange(keyboardInset(view, window.innerHeight));
  paivita();
  view.addEventListener('resize', paivita);
  view.addEventListener('scroll', paivita);
  return () => {
    view.removeEventListener('resize', paivita);
    view.removeEventListener('scroll', paivita);
  };
}
