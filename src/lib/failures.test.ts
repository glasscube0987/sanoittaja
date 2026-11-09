import { afterEach, describe, expect, it, vi } from 'vitest';
import { guard, onFailure, reportFailure, type Failure } from './failures';

describe('failures', () => {
  afterEach(() => vi.restoreAllMocks());

  /** Kuuntelija joka kerää saamansa virheet; tilaus puretaan testin lopuksi. */
  function kuuntele(): { saadut: Failure[]; pura: () => void } {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const saadut: Failure[] = [];
    return { saadut, pura: onFailure((f) => saadut.push(f)) };
  }

  it('välittää virheen lajin ja selaimen viestin', () => {
    const { saadut, pura } = kuuntele();
    reportFailure('save', new Error('QuotaExceededError'));
    pura();
    expect(saadut).toEqual([{ kind: 'save', message: 'QuotaExceededError' }]);
  });

  it('kelpuuttaa myös muun kuin Error-olion', () => {
    const { saadut, pura } = kuuntele();
    reportFailure('read', 'kanta kiinni');
    pura();
    expect(saadut[0].message).toBe('kanta kiinni');
  });

  it('purettu tilaus ei saa enää virheitä', () => {
    const { saadut, pura } = kuuntele();
    pura();
    reportFailure('save', new Error('x'));
    expect(saadut).toEqual([]);
  });

  /* Koko kanavan tarkoitus: hylätty lupaus ei saa jäädä huomaamatta. */
  it('guard ilmoittaa hylätyn lupauksen', async () => {
    const { saadut, pura } = kuuntele();
    guard('delete', Promise.reject(new Error('ei onnistu')));
    await Promise.resolve();
    await Promise.resolve();
    pura();
    expect(saadut).toEqual([{ kind: 'delete', message: 'ei onnistu' }]);
  });

  it('guard ei ilmoita onnistuneesta', async () => {
    const { saadut, pura } = kuuntele();
    guard('save', Promise.resolve());
    await Promise.resolve();
    await Promise.resolve();
    pura();
    expect(saadut).toEqual([]);
  });
});
