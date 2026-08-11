/**
 * Tallennustilan pysyvyys.
 *
 * Koko kirjasto elää selaimen IndexedDB:ssä, ja selain saa lähtökohtaisesti
 * häätää sen tilan loppuessa tai käyttämättömyyden jälkeen. `persist()` pyytää
 * merkitsemään tämän sivuston pysyväksi, jolloin häätö ohittaa sen. WebKit
 * myöntää pyynnön heuristiikoilla, ja yksi niistä on että sivusto on asennettu
 * kotiruudulle – juuri se tapa jolla tätä sovellusta on tarkoitus käyttää.
 *
 * Pyyntö tehdään kerran käynnistyksessä eikä sitä toisteta: kielteinen vastaus
 * ei muutu saman istunnon aikana, ja jo myönnetty pysyvyys säilyy.
 *
 * Selain-API omassa moduulissaan, jotta natiivikuoressa tämän voi korvata
 * yhdellä tiedostolla – siellä pysyvyys on käyttöjärjestelmän asia.
 */

/** Onko tallennustila jo merkitty pysyväksi. */
export async function isPersisted(): Promise<boolean> {
  if (!navigator.storage?.persisted) return false;
  try {
    return await navigator.storage.persisted();
  } catch {
    return false;
  }
}

/**
 * Pyytää pysyvää tallennustilaa. Palauttaa lopputilan, myös silloin kun selain
 * ei tunne koko käsitettä – silloin `false`, eikä se ole virhe: kirjasto toimii
 * yhtä lailla, se on vain alttiimpi häädölle.
 */
export async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  try {
    if (await isPersisted()) return true;
    return await navigator.storage.persist();
  } catch {
    // Selain voi kieltää pyynnön; se ei saa estää sovelluksen käynnistymistä.
    return false;
  }
}
