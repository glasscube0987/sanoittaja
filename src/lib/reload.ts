/**
 * Sovelluksen uudelleenlataus.
 *
 * Oma moduulinsa samasta syystä kuin `print.ts`: selainkutsu ei kuulu
 * komponenttiin, ja natiivikuoressa uudelleenlataus tehdään toisin.
 */
export function reloadApp(): void {
  window.location.reload();
}
