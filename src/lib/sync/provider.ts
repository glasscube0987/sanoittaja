/**
 * Pilvipalveluiden yhteinen rajapinta. Toteutukset: Dropbox ja Google Drive.
 *
 * Pilveen viedään sama koko kirjaston paketti kuin varmuuskopiotiedostoon
 * (`exportLibrary`), jolloin se on palautettavissa `importLibrary`llä. Aiempi
 * laulukohtainen JSON ei kelvannut tuontiin lainkaan, joten pilvivienti ei
 * ollut varmuuskopio vaan umpikuja.
 *
 * Sovellus toimii aina offline; pilvi on vain kopio pois laitteelta.
 */

/** Pilvessä oleva varmuuskopio. */
export interface CloudFile {
  /** Palvelun oma viittaus lataukseen; ei näytetä käyttäjälle. */
  path: string;
  name: string;
  size: number;
  modifiedAt: number;
}

export interface CloudProvider {
  readonly id: 'dropbox' | 'gdrive';
  readonly label: string;
  /** Onko käyttöön tarvittava client id asetettu. */
  isConfigured(): boolean;
  /** Onko voimassa oleva kirjautuminen. */
  isConnected(): boolean;
  /** Käynnistää OAuth-kirjautumisen (uudelleenohjaus tai ponnahdus). */
  connect(): Promise<void>;
  disconnect(): void;
  /** Vie koko kirjaston varmuuskopion pilveen annetulla nimellä. */
  uploadBackup(blob: Blob, filename: string): Promise<void>;
  /**
   * Pilvessä olevat kopiot, uusin ensin.
   *
   * Valinnainen samasta syystä kuin automaattikopio on vain Dropboxille:
   * Driven token elää vain istunnon ajan, eikä hakua voi tarjota toiminnoksi
   * joka vaatii kirjautumisen joka kerta. Käyttöliittymä näyttää haun vain kun
   * palvelu osaa sen.
   */
  listBackups?(): Promise<CloudFile[]>;
  /** Lataa yhden kopion sisällön tuontia varten. */
  downloadBackup?(path: string): Promise<Blob>;
}
