/**
 * Laululistan haku.
 *
 * Koskee vain «Kaikki laulut» -näkymää, kuten lajittelukin: setissä lista on
 * lyhyt ja järjestys on käyttäjän asettama esitysjärjestys, eikä suodatus
 * kuulu sinne.
 *
 * Puhdas funktio ja johdettu näkymä: haku ei muuta tietomallia eikä kantaa.
 */
import type { Song } from './types';

export interface SongMatch {
  song: Song;
  /**
   * Osuman rivi, kun osuma **ei** ole nimessä.
   *
   * Nimiosuma näkyy jo kortin otsikossa, joten katkelma olisi toistoa.
   * Sanoitusosuman kohdalla se on ainoa asia joka kertoo miksi laulu on
   * listalla – ilman sitä lista näyttäisi suodattuneen sattumanvaraisesti.
   */
  snippet?: string;
}

/**
 * Hakusanan ja tekstin vertailumuoto.
 *
 * Kirjainkoko ei merkitse, mutta **tarkkeita ei pudoteta**: suomessa ä ja ö
 * ovat omia kirjaimiaan eivätkä a:n ja o:n muunnelmia, ja `sortSongs` sanoo
 * saman lajittelusta. Käyttäjä etsii omaa tekstiään, jonka hän on itse
 * kirjoittanut oikein.
 */
function vertailumuoto(text: string): string {
  return text.toLocaleLowerCase('fi');
}

/**
 * Suodattaa laulut hakusanalla. Tyhjä haku palauttaa kaikki ilman katkelmia,
 * jolloin näkymä on täsmälleen ennallaan ennen kuin kenttään kirjoitetaan.
 *
 * `untitled` on nimettömän laulun näkyvä otsikko. Se on mukana samasta syystä
 * kuin `sortSongs`issa: käyttäjä etsii sitä mitä näkee, ei tyhjää merkkijonoa.
 */
export function searchSongs(songs: Song[], query: string, untitled: string): SongMatch[] {
  const haku = vertailumuoto(query.trim());
  if (!haku) return songs.map((song) => ({ song }));

  const matches: SongMatch[] = [];
  for (const song of songs) {
    const otsikko = song.title.trim() || untitled;
    if (vertailumuoto(otsikko).includes(haku)) {
      matches.push({ song });
      continue;
    }
    const rivi = song.lines.find((line) => vertailumuoto(line.text).includes(haku));
    if (rivi) matches.push({ song, snippet: rivi.text.trim() });
  }
  return matches;
}
