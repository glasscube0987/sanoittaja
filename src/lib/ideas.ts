/**
 * Nauhoitetun idean nimi.
 *
 * Idea syntyy ilman nimeä, ja pelkkä «Nimetön» tekee kymmenestä ideasta
 * listalla erottamattomia. Päiväys on ainoa asia joka on tiedossa sillä
 * hetkellä, ja se riittää tunnistamiseen.
 *
 * Muoto on tahallaan kielineutraali eikä käännetty päivämäärä: laulun nimi on
 * tallennettua dataa, eikä kieli saa vuotaa sinne (ks. `newSong` types.ts:ssä).
 * Sivuhyötynä aakkosjärjestys on samalla aikajärjestys.
 */

/**
 * Päiväysnimi muodossa `2026-09-14 20:41`.
 *
 * Kellonaika on **paikallinen eikä UTC**, samasta syystä kuin varmuuskopion
 * tiedostonimessä: illalla nauhoitettu idea ei saa näyttää eiliseltä.
 */
export function ideaTitle(at: number | Date = Date.now()): string {
  const d = at instanceof Date ? at : new Date(at);
  const pad = (n: number) => String(n).padStart(2, '0');
  const paiva = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return `${paiva} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
