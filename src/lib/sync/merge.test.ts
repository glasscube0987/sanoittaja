import { describe, expect, it } from 'vitest';
import { chooseRecord } from './merge';

describe('chooseRecord', () => {
  it('puuttuva paikallinen tietue lisätään', () => {
    expect(chooseRecord(undefined, { updatedAt: 1 })).toBe('incoming');
    expect(chooseRecord(undefined, {})).toBe('incoming');
  });

  it('uudempi tuleva voittaa', () => {
    expect(chooseRecord({ updatedAt: 1 }, { updatedAt: 2 })).toBe('incoming');
  });

  /* Koko erän ydin: tämä on se tapaus joka aiemmin hävitti työtä. */
  it('vanhempi tuleva ei voita', () => {
    expect(chooseRecord({ updatedAt: 5 }, { updatedAt: 2 })).toBe('local');
  });

  it('tasapeli jää paikalliseen', () => {
    expect(chooseRecord({ updatedAt: 3 }, { updatedAt: 3 })).toBe('local');
  });

  /*
   * Ilman aikaleimaa ei ole tapaa tietää kumpi on uudempi, ja ylikirjoitus on
   * ainoa lopputulos joka voi hävittää työtä.
   */
  it('aikaleimaton tietue ei ylikirjoitu', () => {
    expect(chooseRecord({}, {})).toBe('local');
    expect(chooseRecord({}, { updatedAt: 9 })).toBe('local');
    expect(chooseRecord({ updatedAt: 9 }, {})).toBe('local');
  });
});
