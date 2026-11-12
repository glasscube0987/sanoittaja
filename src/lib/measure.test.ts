import { describe, expect, it } from 'vitest';
import { columnsThatFit } from './measure';

describe('columnsThatFit', () => {
  it('pyöristää alaspäin', () => {
    expect(columnsThatFit(361, 12.04)).toBe(29);
  });

  /* Täsmälleen mahtuva rivi jättäisi pyöristysvirheen varaan sen, tuleeko
     vaakavieritys takaisin. */
  it('jättää pikselin varan', () => {
    expect(columnsThatFit(120, 12)).toBe(9);
  });

  it('mittaamaton leveys ei rivitä', () => {
    expect(columnsThatFit(0, 12)).toBe(Infinity);
    expect(columnsThatFit(300, 0)).toBe(Infinity);
    expect(columnsThatFit(NaN, 12)).toBe(Infinity);
  });
});
