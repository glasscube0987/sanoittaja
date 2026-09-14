import { describe, expect, it } from 'vitest';
import { ideaTitle } from './ideas';

/* Aikavyöhyke lukitaan, jotta paikallisen ajan testi on ratkaiseva myös
   UTC-ympäristössä – kuten CI:ssä ja tässä kehitysympäristössä. */
process.env.TZ = 'Europe/Helsinki';

describe('ideaTitle', () => {
  it('täyttää nollat niin että muoto on aina samanmittainen', () => {
    expect(ideaTitle(new Date(2026, 0, 5, 9, 7))).toBe('2026-01-05 09:07');
    expect(ideaTitle(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31 23:59');
  });

  it('käyttää paikallista aikaa eikä UTC:tä', () => {
    /*
     * Illalla nauhoitettu idea ei saa näyttää eiliseltä. Hetki on valittu niin,
     * että paikallinen ja UTC-päivä eroavat: Helsingissä 21:30 UTC on jo
     * seuraavan vuorokauden puolella. UTC:tä käyttävä toteutus antaisi
     * «2026-09-14 21:30», joten tämä erottaa ne toisistaan.
     */
    const hetki = Date.parse('2026-09-14T21:30:00Z');
    expect(ideaTitle(hetki)).toBe('2026-09-15 00:30');
  });

  it('lajittuu merkkijonona aikajärjestykseen', () => {
    // Tämä on koko muodon sivuhyöty: A–Ö kokoaa ideat siististi peräkkäin.
    const nimet = [
      ideaTitle(new Date(2026, 8, 14, 9, 5)),
      ideaTitle(new Date(2026, 8, 14, 10, 0)),
      ideaTitle(new Date(2026, 9, 1, 8, 0)),
      ideaTitle(new Date(2027, 0, 1, 0, 0)),
    ];
    expect([...nimet].sort()).toEqual(nimet);
  });
});
