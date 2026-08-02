import { describe, expect, it } from 'vitest';
import { isIos, viewportContent } from './iosZoom';

function nav(platform: string, userAgent: string, maxTouchPoints = 0): Navigator {
  return { platform, userAgent, maxTouchPoints } as Navigator;
}

describe('isIos', () => {
  it('tunnistaa iPhonen ja iPadin', () => {
    expect(isIos(nav('iPhone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'))).toBe(true);
    expect(isIos(nav('iPad', 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)'))).toBe(true);
  });

  it('tunnistaa iPadOS:n, joka esiintyy Macina', () => {
    expect(isIos(nav('MacIntel', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5))).toBe(true);
  });

  it('ei tunnista työpöytä-Macia eikä Androidia', () => {
    expect(isIos(nav('MacIntel', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0))).toBe(false);
    expect(isIos(nav('Linux armv8l', 'Mozilla/5.0 (Linux; Android 14; Pixel 8)'))).toBe(false);
  });
});

describe('viewportContent', () => {
  it('rajoittaa skaalan vain iOS:llä', () => {
    // Android-Chrome tottelisi maximum-scalea kirjaimellisesti ja estäisi
    // nipistyszoomin, joten sitä ei anneta muille kuin iOS:lle.
    expect(viewportContent(true)).toContain('maximum-scale=1.0');
    expect(viewportContent(false)).not.toContain('maximum-scale');
  });

  it('säilyttää perusasetukset molemmissa', () => {
    for (const content of [viewportContent(true), viewportContent(false)]) {
      expect(content).toContain('width=device-width');
      expect(content).toContain('initial-scale=1.0');
      expect(content).toContain('viewport-fit=cover');
    }
  });
});
