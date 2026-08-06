import { describe, expect, it } from 'vitest';
import {
  engagesHorizontally,
  ENGAGE_PX,
  OPEN_PX,
  REMOVE_RATIO,
  swipeOffset,
  swipeOutcome,
} from './swipe';

const LEVEYS = 360;

describe('engagesHorizontally', () => {
  it('ei tartu pieneen liikkeeseen', () => {
    expect(engagesHorizontally(-4, 0)).toBe(false);
    expect(engagesHorizontally(0, 0)).toBe(false);
  });

  it('tarttuu selvään vaakavetoon', () => {
    expect(engagesHorizontally(-20, 3)).toBe(true);
    expect(engagesHorizontally(20, -3)).toBe(true);
  });

  it('jättää pystyvedon listan vieritykselle', () => {
    expect(engagesHorizontally(-20, 40)).toBe(false);
    // Vino veto kuuluu myös vieritykselle: muuten listaa ei voisi vierittää
    // rivien päältä ilman että rivit lähtevät liikkeelle.
    expect(engagesHorizontally(-30, 30)).toBe(false);
  });
});

describe('swipeOutcome', () => {
  it('pysyy kiinni kun vetoa ei juuri ole', () => {
    expect(swipeOutcome(0, LEVEYS)).toBe('closed');
    expect(swipeOutcome(-3, LEVEYS)).toBe('closed');
  });

  it('pysyy kiinni lyhyestä vedosta', () => {
    expect(swipeOutcome(-20, LEVEYS)).toBe('closed');
  });

  it('avaa poistopainikkeen keskipitkällä vedolla', () => {
    expect(swipeOutcome(-OPEN_PX / 2, LEVEYS)).toBe('open');
    expect(swipeOutcome(-100, LEVEYS)).toBe('open');
  });

  it('poistaa kun rivi vedetään yli rajan', () => {
    expect(swipeOutcome(-LEVEYS * REMOVE_RATIO, LEVEYS)).toBe('remove');
    expect(swipeOutcome(-LEVEYS, LEVEYS)).toBe('remove');
  });

  it('sulkee kun vedetään oikealle', () => {
    expect(swipeOutcome(60, LEVEYS)).toBe('closed');
  });

  it('skaalaa poistorajan rivin leveyden mukaan', () => {
    // Sama pikselimatka on kapealla puhelimella poisto, tabletilla ei vielä.
    const matka = -200;
    expect(swipeOutcome(matka, 320)).toBe('remove');
    expect(swipeOutcome(matka, 1000)).toBe('open');
  });
});

describe('swipeOffset', () => {
  it('ei liuku oikealle suljetusta rivistä', () => {
    expect(swipeOffset(50, false)).toBe(0);
  });

  it('seuraa sormea vasemmalle', () => {
    expect(swipeOffset(-40, false)).toBe(-40);
  });

  it('jatkaa avatusta rivistä', () => {
    expect(swipeOffset(-10, true)).toBe(-OPEN_PX - 10);
  });

  it('sulkeutuu kun avattua riviä vedetään oikealle', () => {
    expect(swipeOffset(OPEN_PX, true)).toBe(0);
    expect(swipeOffset(OPEN_PX + 50, true)).toBe(0);
  });

  it('tarttumiskynnys on pienempi kuin avautuma', () => {
    expect(ENGAGE_PX).toBeLessThan(OPEN_PX);
  });
});
