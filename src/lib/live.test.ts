import { describe, expect, it } from 'vitest';
import { clamp, DEFAULT_LIVE, FONT_MAX, scrollStep, SPEED_MAX, SPEED_MIN } from './live';

describe('scrollStep', () => {
  it('kerää murto-osapikselit talteen', () => {
    // scrollTop liikkuu vain kokonaisin pikselein: ilman kertymää hidas nopeus
    // pyöristyisi joka ruudulla nollaan eikä näkymä liikkuisi lainkaan.
    const dt = 1 / 60;
    let carry = 0;
    let liikuttu = 0;
    for (let i = 0; i < 60; i++) {
      const step = scrollStep(carry, 10, dt);
      carry = step.carry;
      liikuttu += step.pixels;
    }
    // Sekunnissa 10 px/s tekee 10 pikseliä: osa on jo liikuttu, loput kertymässä.
    expect(liikuttu + carry).toBeCloseTo(10, 5);
    expect(liikuttu).toBeGreaterThanOrEqual(9);
  });

  it('ei hukkaa liikettä pitkälläkään ajolla', () => {
    let carry = 0;
    let liikuttu = 0;
    for (let i = 0; i < 600; i++) {
      const step = scrollStep(carry, 7, 1 / 60);
      carry = step.carry;
      liikuttu += step.pixels;
    }
    expect(liikuttu + carry).toBeCloseTo(70, 4);
  });

  it('ei liikuta yhtään ensimmäisellä hitaalla ruudulla mutta kertyy silti', () => {
    const step = scrollStep(0, 10, 1 / 60);
    expect(step.pixels).toBe(0);
    expect(step.carry).toBeCloseTo(10 / 60, 5);
  });

  it('vierittää nopeuden verran sekunnissa', () => {
    expect(scrollStep(0, 40, 0.25).pixels).toBe(10);
  });

  it('rajaa pitkän tauon jälkeisen hypyn', () => {
    // Taustalta palatessa dt voi olla sekunteja; ilman rajausta näkymä hyppäisi
    // keskeltä kappaletta johonkin aivan muualle.
    expect(scrollStep(0, 40, 10).pixels).toBe(10);
  });

  it('ei liiku taaksepäin', () => {
    expect(scrollStep(0, 16, -1).pixels).toBe(0);
  });
});

describe('clamp', () => {
  it('pitää arvot rajoissa', () => {
    expect(clamp(SPEED_MIN - 10, SPEED_MIN, SPEED_MAX)).toBe(SPEED_MIN);
    expect(clamp(SPEED_MAX + 10, SPEED_MIN, SPEED_MAX)).toBe(SPEED_MAX);
    expect(clamp(20, SPEED_MIN, SPEED_MAX)).toBe(20);
  });
});

describe('oletusasetukset', () => {
  it('ovat sallituissa rajoissa', () => {
    expect(DEFAULT_LIVE.speed).toBeGreaterThanOrEqual(SPEED_MIN);
    expect(DEFAULT_LIVE.speed).toBeLessThanOrEqual(SPEED_MAX);
    expect(DEFAULT_LIVE.fontSize).toBeLessThanOrEqual(FONT_MAX);
  });
});
