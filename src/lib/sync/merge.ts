/**
 * Yhdistämissääntö: vanhempi ei koskaan ylikirjoita uudempaa.
 *
 * Tuonti kirjoitti aiemmin jokaisen tietueen kantaan sellaisenaan, jolloin
 * tuleva versio voitti aina – myös kun paikallinen oli uudempi. Kahdella
 * laitteella se tarkoitti, että iPadin kopion palautus puhelimeen palautti
 * puhelimessa myöhemmin muokatun laulun vanhaan asuunsa.
 *
 * Puhdas funktio: ei kantaa eikä verkkoa, jotta sääntö on luettavissa ja
 * testattavissa yhdestä paikasta.
 */

/** Tietue jolla on muokkausaika. Kaikilla ei ole; ks. `chooseRecord`. */
interface Ajoitettu {
  updatedAt?: number;
}

export type MergeChoice = 'incoming' | 'local';

/**
 * Kumpi versio jää voimaan.
 *
 * - **Aikaleima olemassa** (laulut, setit): uudempi voittaa. Tasapeli jää
 *   paikalliseen – muutos jota ei näy aikaleimassa on todennäköisemmin
 *   paikallinen kuin tuleva, ja paikallisen säilyttäminen on palautuva valinta.
 * - **Aikaleima puuttuu** (nauhoitteet, merkinnät): lisätään jos puuttuu, eikä
 *   koskaan ylikirjoiteta. Ilman aikaleimaa ei ole mitään tapaa tietää kumpi on
 *   uudempi, ja ylikirjoitus on ainoa lopputulos joka voi hävittää työtä.
 */
export function chooseRecord(local: Ajoitettu | undefined, incoming: Ajoitettu): MergeChoice {
  if (!local) return 'incoming';
  if (typeof local.updatedAt !== 'number' || typeof incoming.updatedAt !== 'number') return 'local';
  return incoming.updatedAt > local.updatedAt ? 'incoming' : 'local';
}
