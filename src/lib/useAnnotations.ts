/**
 * Yhden laulun merkinnät kannasta.
 *
 * Merkintöjä lukee kaksi näkymää: live-tila piirtää niitä, ja editorin
 * tulostuslehti näyttää ne. Live-tila avataan editorin päälle, joten editori jää
 * taustalle elämään – ilman ilmoitusta sen kopio jäisi vanhaksi ja keikalla
 * tehdyt merkinnät puuttuisivat tulosteesta. Tallennus ja poisto herättävät
 * siksi tapahtuman kannassa, ja kaikki lukijat kuuntelevat sitä.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { ANNOTATIONS_EVENT, listAnnotations } from './db';
import type { Annotation } from './types';

/**
 * Palauttaa merkinnät ja niiden asettajan. Asettaja on mukana, jotta piirtävä
 * näkymä voi näyttää vedon heti eikä vasta kannan kierroksen jälkeen; kanta
 * korjaa tilan perässä.
 */
export function useAnnotations(songId: string): [Annotation[], Dispatch<SetStateAction<Annotation[]>>] {
  const [notes, setNotes] = useState<Annotation[]>([]);
  /* Ensimmäinen luku laulua kohti siivoaa orvot tyhjät kentät; myöhemmät
     luvut eivät, koska juuri syntynyt kenttä on vielä tyhjä. */
  const ensimmainen = useRef(true);

  const lue = useCallback(() => {
    const siivoa = ensimmainen.current;
    ensimmainen.current = false;
    listAnnotations(songId, siivoa)
      .then(setNotes)
      .catch((err) => console.error('Merkintöjen luku epäonnistui', err));
  }, [songId]);

  useEffect(() => {
    ensimmainen.current = true;
    lue();
    window.addEventListener(ANNOTATIONS_EVENT, lue);
    return () => window.removeEventListener(ANNOTATIONS_EVENT, lue);
  }, [lue]);

  return [notes, setNotes];
}
