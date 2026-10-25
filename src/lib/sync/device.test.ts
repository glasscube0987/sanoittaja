import { describe, expect, it } from 'vitest';
import { deviceKind, newDeviceName } from './device';

describe('deviceKind', () => {
  it('tunnistaa omat laitteet', () => {
    expect(deviceKind('Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)')).toBe('iPad');
    expect(deviceKind('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe('iPhone');
    expect(deviceKind('Mozilla/5.0 (Linux; Android 14)')).toBe('Android');
    expect(deviceKind('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('Mac');
  });

  it('tuntematon on silti nimi eikä tyhjä', () => {
    expect(deviceKind('jokin muu')).toBe('laite');
    expect(deviceKind('')).toBe('laite');
  });
});

describe('newDeviceName', () => {
  /*
   * Kahdella samanlaisella laitteella on sama johdettu nimi; ilman päätettä ne
   * kirjoittaisivat edelleen toistensa päälle.
   */
  it('erottaa kaksi samanlaista laitetta', () => {
    const a = newDeviceName('iPad', () => 0.1);
    const b = newDeviceName('iPad', () => 0.9);
    expect(a).not.toBe(b);
    expect(a.startsWith('iPad-')).toBe(true);
  });

  it('kelpaa tiedostonimeen sellaisenaan', () => {
    expect(newDeviceName('iPad', () => 0.5)).toMatch(/^[A-Za-z0-9-]+$/);
  });
});
