import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

/*
 * Lakanoiden dialogikäytös yhdessä paikassa: Esc sulkee, Tab kiertää lakanan
 * sisällä, ja kohdistus palaa suljettaessa sinne mistä lakana avattiin.
 * Aiemmin lakana oli pelkkä laatikko ruudun päällä: Esc ei tehnyt mitään,
 * Tab vei kohdistuksen sen alla olevaan editoriin, eikä ruudunlukija tiennyt
 * että kyse on dialogista (rooli annetaan lakanan elementissä).
 *
 * Pinossa vain päällimmäinen kuuntelee: asetuksista avattu pilvilakana on
 * asetusten päällä, eikä yksi Esc saa sulkea molempia.
 */

const pino: RefObject<HTMLElement | null>[] = [];

const KOHDISTETTAVAT =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

export function useDialog(ref: RefObject<HTMLElement | null>, onClose: () => void): void {
  /* Tuorein sulkija viitteessä: kuuntelija rakennetaan kerran, mutta
     sulkija voi vaihtua joka piirrolla. */
  const sulje = useRef(onClose);
  sulje.current = onClose;

  useEffect(() => {
    const lakana = ref.current;
    if (!lakana) return;
    pino.push(ref);
    const aiempi = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    /* Kohdistus lakanaan, ellei se jo ole siellä. Lakanaan itseensä eikä
       ensimmäiseen kenttään: kenttään kohdistaminen avaisi puhelimen
       näppäimistön ja saisi iOS:n zoomaamaan. */
    if (!lakana.contains(document.activeElement)) {
      if (!lakana.hasAttribute('tabindex')) lakana.setAttribute('tabindex', '-1');
      lakana.focus({ preventScroll: true });
    }

    function onKey(e: KeyboardEvent) {
      if (pino[pino.length - 1] !== ref || !lakana) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        sulje.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const kohteet = [...lakana.querySelectorAll<HTMLElement>(KOHDISTETTAVAT)].filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (kohteet.length === 0) {
        e.preventDefault();
        return;
      }
      const eka = kohteet[0];
      const vika = kohteet[kohteet.length - 1];
      const nyt = document.activeElement;
      if (e.shiftKey && (nyt === eka || !lakana.contains(nyt))) {
        e.preventDefault();
        vika.focus();
      } else if (!e.shiftKey && (nyt === vika || !lakana.contains(nyt))) {
        e.preventDefault();
        eka.focus();
      }
    }

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      const i = pino.lastIndexOf(ref);
      if (i !== -1) pino.splice(i, 1);
      /* Takaisin avanneeseen painikkeeseen, mutta ei tekstikenttään: iOS
         avaisi näppäimistön ilman että käyttäjä pyysi sitä. */
      if (aiempi && aiempi.isConnected && aiempi.tagName === 'BUTTON') aiempi.focus({ preventScroll: true });
    };
  }, [ref]);
}
