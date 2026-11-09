/**
 * Tallennusvirheiden ilmoituskanava.
 *
 * Kanta kirjoitetaan taustalla ja näkymä päivitetään heti, joten epäonnistunut
 * kirjoitus ei näy missään: laulu on ruudulla, mutta ei kannassa. Aiemmin
 * jokainen tällainen virhe meni vain konsoliin – käyttäjä luuli työn olevan
 * tallessa ja huomasi puutteen vasta kun sovellus avattiin uudelleen. Täynnä
 * oleva tallennustila ja selaimen häätämä kanta ovat juuri tällaisia virheitä.
 *
 * Kanava on tavallinen kuuntelijajoukko eikä selaintapahtuma, jotta se ei koske
 * selain-API:hin ja on testattavissa ilman selainta.
 */

/** Mitä yritettiin: viesti käyttäjälle riippuu siitä mitä jäi tekemättä. */
export type FailureKind = 'save' | 'delete' | 'read';

export interface Failure {
  kind: FailureKind;
  /** Selaimen oma virheilmoitus; näytetään sellaisenaan lisätietona. */
  message: string;
}

type Listener = (failure: Failure) => void;

const kuuntelijat = new Set<Listener>();

/** Tilaa virheet. Palauttaa funktion jolla tilaus puretaan. */
export function onFailure(listener: Listener): () => void {
  kuuntelijat.add(listener);
  return () => {
    kuuntelijat.delete(listener);
  };
}

export function reportFailure(kind: FailureKind, err: unknown): void {
  // Konsoliin edelleen: pinon jälki on vianetsinnässä arvokkaampi kuin viesti.
  console.error(`Kantatoiminto epäonnistui (${kind})`, err);
  const failure: Failure = { kind, message: err instanceof Error ? err.message : String(err) };
  for (const kuuntelija of kuuntelijat) kuuntelija(failure);
}

/**
 * Ajaa kantatoiminnon taustalla niin, ettei sen virhe huku.
 *
 * Korvaa kaavan `lupaus.catch((err) => console.error(...))`, joka oli
 * sovelluksessa parissakymmenessä kohdassa.
 */
export function guard(kind: FailureKind, promise: Promise<unknown>): void {
  promise.catch((err) => reportFailure(kind, err));
}
