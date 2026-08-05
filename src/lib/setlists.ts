/**
 * Settilistojen operaatiot – puhtaita funktioita, jotka palauttavat uuden setin.
 *
 * Setti sisältää vain laulujen tunnuksia. Kopioita ei tehdä, joten sama laulu
 * voi olla useassa setissä ja laulun muokkaus näkyy kaikissa niistä. ”Kaikki
 * laulut” ei ole tallennettu setti vaan oletusnäkymä: niin mikään laulu ei voi
 * pudota näkyvistä sen mukana, että se poistetaan setistä.
 */
import type { Setlist, Song } from './types';
import { uid } from './types';

function touch(list: Setlist): Setlist {
  return { ...list, updatedAt: Date.now() };
}

export function newSetlist(name: string): Setlist {
  const now = Date.now();
  return { id: uid(), name: name.trim(), songIds: [], createdAt: now, updatedAt: now };
}

export function renameSetlist(list: Setlist, name: string): Setlist {
  return touch({ ...list, name: name.trim() });
}

/** Lisää laulut setin loppuun. Jo setissä olevat ohitetaan, ei kahdenneta. */
export function addSongs(list: Setlist, songIds: string[]): Setlist {
  const added = songIds.filter((id) => !list.songIds.includes(id));
  if (added.length === 0) return list;
  return touch({ ...list, songIds: [...list.songIds, ...added] });
}

export function removeSong(list: Setlist, songId: string): Setlist {
  if (!list.songIds.includes(songId)) return list;
  return touch({ ...list, songIds: list.songIds.filter((id) => id !== songId) });
}

/** Siirtää laulun yhden askeleen ylös (-1) tai alas (1). Reunojen yli ei siirretä. */
export function moveSong(list: Setlist, songId: string, direction: -1 | 1): Setlist {
  const from = list.songIds.indexOf(songId);
  const to = from + direction;
  if (from === -1 || to < 0 || to >= list.songIds.length) return list;
  const songIds = [...list.songIds];
  [songIds[from], songIds[to]] = [songIds[to], songIds[from]];
  return touch({ ...list, songIds });
}

/**
 * Setin laulut sen omassa järjestyksessä.
 *
 * Tuntematon tunnus ohitetaan: laulun poisto siivoaa viittaukset, mutta
 * palautettu varmuuskopio voi sisältää setin, jonka laulua ei ole tuotu.
 * Tyhjä rivi setissä olisi pahempi kuin puuttuva.
 */
export function setlistSongs(list: Setlist, songs: Song[]): Song[] {
  const byId = new Map(songs.map((song) => [song.id, song]));
  return list.songIds.map((id) => byId.get(id)).filter((song): song is Song => song !== undefined);
}
