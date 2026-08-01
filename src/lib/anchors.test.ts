import { describe, expect, it } from 'vitest';
import { adjustPositions } from './anchors';

describe('adjustPositions', () => {
  it('ei muuta mitään kun teksti ei muutu', () => {
    expect(adjustPositions('hello', 'hello', [0, 3, 5])).toEqual([0, 3, 5]);
  });

  it('siirtää ankkureita lisäyksen jälkeen', () => {
    // "kuu tuo" -> "kuu aina tuo": lisäys kohtaan 4
    expect(adjustPositions('kuu tuo', 'kuu aina tuo', [0, 4])).toEqual([0, 9]);
  });

  it('ei siirrä ankkureita ennen lisäyskohtaa', () => {
    expect(adjustPositions('abc def', 'abc xdef', [0, 2])).toEqual([0, 2]);
  });

  it('siirtää ankkureita poiston jälkeen', () => {
    // "kuu aina tuo" -> "kuu tuo": poisto kohdasta 4
    expect(adjustPositions('kuu aina tuo', 'kuu tuo', [0, 9])).toEqual([0, 4]);
  });

  it('napsauttaa poistetulla alueella olleen ankkurin muutoskohtaan', () => {
    expect(adjustPositions('kuu aina tuo', 'kuu tuo', [6])).toEqual([4]);
  });

  it('käsittelee korvauksen', () => {
    // "sininen taivas" -> "harmaa taivas"
    expect(adjustPositions('sininen taivas', 'harmaa taivas', [0, 8])).toEqual([0, 7]);
  });

  it('käsittelee lisäyksen rivin loppuun', () => {
    expect(adjustPositions('abc', 'abcdef', [0, 3])).toEqual([0, 6]);
  });

  it('käsittelee tyhjennyksen', () => {
    expect(adjustPositions('abc', '', [0, 1, 3])).toEqual([0, 0, 0]);
  });
});
