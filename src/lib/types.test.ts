import { describe, expect, it } from 'vitest';
import { pathData } from './annotate';
import { isStroke, isText } from './types';
import type { Annotation } from './types';

const veto: Annotation = {
  id: 'v1',
  songId: 's1',
  lineId: 'l1',
  color: '#e0524f',
  width: 0.1,
  points: [0, 0, 1, 1],
  unit: 'em',
  createdAt: 1,
};

const teksti: Annotation = {
  kind: 'text',
  id: 't1',
  songId: 's1',
  lineId: 'l1',
  color: '#e0524f',
  x: 2,
  y: 0.5,
  text: 'capo 3',
  size: 1,
  font: 'sans',
  bold: false,
  italic: false,
  boxed: false,
  points: [],
  width: 0,
  unit: 'em',
  createdAt: 2,
};

describe('merkinnän laji', () => {
  it('lukee vanhan tietueen vedoksi vaikka kind puuttuu', () => {
    /*
     * Kannassa on jo vetoja, jotka on kirjoitettu ennen kuin tekstikenttiä oli.
     * Niissä ei ole `kind`-kenttää lainkaan, eikä kannan versiota nostettu –
     * siirtymä lepää kokonaan sen varassa, että puuttuva kenttä tarkoittaa
     * vetoa. Jos tämä testi kaatuu, vanhat merkinnät katoavat käyttäjiltä.
     */
    expect('kind' in veto).toBe(false);
    expect(isStroke(veto)).toBe(true);
    expect(isText(veto)).toBe(false);
  });

  it('tunnistaa tekstikentän erottelevasta kentästä', () => {
    expect(isText(teksti)).toBe(true);
    expect(isStroke(teksti)).toBe(false);
  });

  it('lukee myös erikseen merkityn vedon vedoksi', () => {
    // Uusi koodi saa kirjoittaa kentän näkyviin; se ei saa muuttaa tulkintaa.
    expect(isStroke({ ...veto, kind: 'stroke' })).toBe(true);
  });

  it('tekstikentässä on tyhjä vetogeometria vanhaa lukijaa varten', () => {
    /*
     * Varmuuskopio kulkee laitteelta toiselle, ja vastaanottava laite voi olla
     * vanhassa versiossa joka ei tunne tekstikenttiä: se piirtää jokaisen
     * merkinnän vetona ja lukee `points`-kentän. Ilman tyhjää listaa se lukisi
     * `undefined.length` ja kaatuisi kesken renderin.
     */
    expect(teksti.points).toEqual([]);
    expect(teksti.width).toBe(0);
    expect(pathData(teksti.points, 20)).toBe('');
  });
});
