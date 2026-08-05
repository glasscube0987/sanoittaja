/**
 * Nuottilehden tulostus.
 *
 * Selaimessa tämä on yksi kutsu, mutta se on silti oma moduulinsa: `window.print`
 * on yksi niistä harvoista selain-API:sta, joihin sovellus nojaa, eikä sitä ole
 * natiivikuoressa lainkaan – Androidin WebViewissä ei ole tulostusvalintaikkunaa
 * ja WKWebViewistä puuttuu käyttöliittymä. Kun kutsu on täällä eikä
 * komponentissa, natiiviportissa vaihdetaan tämä tiedosto eikä etsitä kutsuja
 * käyttöliittymän seasta. Sama peruste kuin `shareBlob`illa.
 */

/** Onko tulostus käytettävissä tässä ympäristössä. */
export function canPrint(): boolean {
  return typeof window !== 'undefined' && typeof window.print === 'function';
}

/**
 * Avaa järjestelmän tulostusvalikon, josta laulun voi tallentaa PDF:nä.
 * Palauttaa false, jos tulostusta ei ole käytettävissä.
 */
export function printSheet(): boolean {
  if (!canPrint()) return false;
  window.print();
  return true;
}
