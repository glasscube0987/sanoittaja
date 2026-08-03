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
}
