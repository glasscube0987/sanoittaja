/**
 * Laitteen nimi varmuuskopion tiedostonimeen.
 *
 * Tiedostonimi oli pelkkä päiväys, joten kaksi laitetta samana päivänä
 * kirjoitti pilvessä saman tiedoston päälle: päivän kopio oli sen laitteen
 * kirjasto joka ehti viimeiseksi. Nimeen lisätty laite pitää kopiot erillään ja
 * tekee pilven listasta luettavan – «iPad» ja «iPhone» erottuvat toisistaan.
 *
 * Satunnainen pääte on siksi, että kahdella samanlaisella laitteella on sama
 * johdettu nimi. Ilman sitä ne kirjoittaisivat edelleen toistensa päälle.
 *
 * Laitekohtainen arvo localStoragessa, kuten kieli ja merkintätapa.
 */

const STORAGE_KEY = 'sanoittaja.device';

/** Nimeen kelpaavat merkit: tiedostonimi kulkee pilven polkuna. */
const SALLITUT = /[^A-Za-z0-9-]/g;

/** Laji käyttäjäagentista. Tarkkuus riittää erottamaan omat laitteet. */
export function deviceKind(ua: string): string {
  if (/iPad/.test(ua)) return 'iPad';
  if (/iPhone|iPod/.test(ua)) return 'iPhone';
  if (/Android/.test(ua)) return 'Android';
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  return 'laite';
}

/** Uusi nimi: laji ja lyhyt satunnainen pääte. */
export function newDeviceName(ua: string, random: () => number = Math.random): string {
  const suffix = Math.floor(random() * 0xffff)
    .toString(16)
    .padStart(4, '0');
  return `${deviceKind(ua).replace(SALLITUT, '')}-${suffix}`;
}

/** Tämän laitteen nimi; luodaan ensimmäisellä kerralla ja muistetaan. */
export function deviceName(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
    const name = newDeviceName(navigator.userAgent);
    localStorage.setItem(STORAGE_KEY, name);
    return name;
  } catch {
    /*
     * Estetty tallennus ei saa estää varmuuskopiota. Nimi vaihtuu silloin joka
     * kerta, jolloin pilveen kertyy ylimääräisiä tiedostoja – tarpeetonta mutta
     * vaaratonta, ja kopio on tärkeämpi kuin siisti lista.
     */
    return newDeviceName(typeof navigator === 'undefined' ? '' : navigator.userAgent);
  }
}
