/**
 * Laulujen tagit: kirjaston tagijoukko ja suodatus.
 *
 * Grillauksessa lukittiin tagit tilan sijaan: laulun vaihe ei ole yksi
 * tila-arvo, koska sama laulu voi olla yhtä aikaa «cover» ja «keikkakunto».
 *
 * Puhdas logiikka; laulun muokkaus on `songOps.ts`:ssä kuten kaikki muukin.
 */
import type { Lang } from './i18n';
import { collator } from './sortSongs';
import type { Song } from './types';

/**
 * Tagin tallennusmuoto: reunavälit pois ja sisäiset välit yhdeksi.
 *
 * «keikka  kunto» ja «keikka kunto» olisivat muuten eri tageja, eikä eroa
 * näkisi listalta.
 */
export function normalizeTag(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

/**
 * Vertailumuoto: kirjainkoko ei erota tageja toisistaan.
 *
 * Kieli on kiinteä, toisin kuin aakkostuksessa (`collator(lang)`). Vertailumuoto
 * ei saa riippua käyttöliittymän kielestä: muuten sama kirjasto yhdistäisi tagit
 * eri tavalla eri kielellä, ja suomeksi yksi tagi hajoaisi englanniksi kahdeksi.
 * Aakkostus on eri asia – se on näkymä, ei identiteetti.
 */
function vertailu(tag: string): string {
  return normalizeTag(tag).toLocaleLowerCase('fi');
}

/** Tarkoittavatko kaksi kirjoitusasua samaa tagia. */
export function sameTag(a: string, b: string): boolean {
  return vertailu(a) === vertailu(b);
}

/**
 * Poistaa tyhjät ja kaksoiskappaleet; **ensin kirjoitettu asu voittaa**.
 *
 * Tämä on se yksi paikka jossa «sama tagi» määritellään: sitä tarvitaan niin
 * laulun tageja kirjoitettaessa kuin kirjaston tagilistaa koottaessa, eikä
 * sääntö saa olla kahdessa paikassa. Järjestys on tulon järjestys, koska laulun
 * omat tagit säilyttävät sen järjestyksen jossa ne kirjoitettiin.
 */
export function dedupeTags(tags: string[]): string[] {
  const nahdyt = new Map<string, string>();
  for (const raw of tags) {
    const tag = normalizeTag(raw);
    const avain = vertailu(tag);
    if (tag && !nahdyt.has(avain)) nahdyt.set(avain, tag);
  }
  return [...nahdyt.values()];
}

/**
 * Sama aakkostettuna: valitsimessa näytettävä tagijoukko.
 *
 * Lajittelu samalla `Intl.Collator`illa kuin laululista, jottei «miten suomi
 * aakkostuu» ole kahdessa paikassa.
 */
export function uniqueTags(tags: string[], lang: Lang): string[] {
  return dedupeTags(tags).sort(collator(lang).compare);
}

/**
 * Kirjaston eri tagit aakkosjärjestyksessä, kukin kerran.
 *
 * Ensin kirjoitettu asu voittaa: jos kirjastossa on sekä «Cover» että
 * «cover», listalla näkyy se joka ehti ensin – ne ovat sama tagi, eikä
 * valitsimessa ole mieltä näyttää samaa kahdesti.
 */
export function allTags(songs: Song[], lang: Lang): string[] {
  return uniqueTags(
    songs.flatMap((song) => song.tags ?? []),
    lang,
  );
}

/**
 * Kirjoitettu tagi siinä asussa jossa se jo tunnetaan, jos se tunnetaan.
 *
 * «Tagi on sama, kirjoitatko sen Cover tai cover» on käyttäjälle luvattu, ja
 * lupaus pitää vain jos kirjoitettu asu kartoitetaan olemassa olevaan. Muuten
 * «cover» tallentuisi uutena asuna, ja se kumpi asu suodatinrivillä näkyy
 * ratkeaisi siitä missä järjestyksessä laulut sattuvat kannasta tulemaan.
 */
export function matchExisting(tag: string, known: string[]): string {
  const kirjoitettu = normalizeTag(tag);
  return known.find((v) => sameTag(v, kirjoitettu)) ?? kirjoitettu;
}

/**
 * Suodattaa laulut valituilla tageilla. **Jokaisen** valitun on löydyttävä.
 *
 * Kaventava eikä laajentava: «cover» ja «keikkakunto» yhdessä tarkoittaa niitä
 * covereita jotka ovat keikkakunnossa. Suodattamisen tarkoitus on löytää
 * vähemmän, ja kahdella tagilla laajentava sääntö kasvattaisi listaa.
 *
 * Tyhjä valinta palauttaa kaikki, jolloin suodatin ei tee mitään ennen kuin
 * siihen kosketaan.
 */
export function filterByTags(songs: Song[], selected: string[]): Song[] {
  const etsityt = selected.map(vertailu).filter(Boolean);
  if (etsityt.length === 0) return songs;
  return songs.filter((song) => {
    const omat = new Set((song.tags ?? []).map(vertailu));
    return etsityt.every((tag) => omat.has(tag));
  });
}
