/**
 * iOS suurentaa näkymän aina kun tekstikenttään kohdistetaan, jos se pitää
 * kenttää liian pienenä – eikä palauta zoomia kentästä poistuttaessa, joten
 * näkymä jää suurennetuksi. Kenttien 16px:n fonttikoko poistaa zoomin
 * useimmiten, mutta ei kaikissa tilanteissa: raja lasketaan lopullisesta
 * piirretystä koosta, ei CSS-arvosta.
 *
 * `maximum-scale` estää iOS:llä nimenomaan tämän automaattisen zoomin.
 * Käyttäjän oma nipistyszoom toimii siitä huolimatta iOS 10:stä lähtien, joten
 * saavutettavuus säilyy. Muille selaimille asetusta ei anneta, koska esimerkiksi
 * Android-Chrome tottelee sitä kirjaimellisesti ja estäisi nipistyksen.
 */
const VIEWPORT_BASE = 'width=device-width, initial-scale=1.0, viewport-fit=cover';

export function isIos(nav: Navigator = navigator): boolean {
  // iPadOS esiintyy Macina, mutta erottuu kosketuspisteiden määrästä.
  return (
    /iP(hone|ad|od)/.test(nav.platform ?? '') ||
    (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1) ||
    /iPhone|iPad|iPod/.test(nav.userAgent ?? '')
  );
}

export function viewportContent(ios: boolean): string {
  return ios ? `${VIEWPORT_BASE}, maximum-scale=1.0` : VIEWPORT_BASE;
}

export function applyIosZoomFix(doc: Document = document, nav: Navigator = navigator): void {
  if (!isIos(nav)) return;
  const meta = doc.querySelector('meta[name="viewport"]');
  meta?.setAttribute('content', viewportContent(true));
}
