import { describe, expect, it } from 'vitest';
import { themeBarColors, THEME_BG } from './theme';

describe('themeBarColors', () => {
  it('laitteen mukaan: kumpikin tila saa oman värinsä', () => {
    expect(themeBarColors('system')).toEqual({ light: THEME_BG.light, dark: THEME_BG.dark });
  });

  /* Tumman laitteen palkki jäisi muuten tummaksi vaalean sovelluksen yllä. */
  it('valittu teema voittaa laitteen tilan kumpaankin suuntaan', () => {
    expect(themeBarColors('light')).toEqual({ light: THEME_BG.light, dark: THEME_BG.light });
    expect(themeBarColors('dark')).toEqual({ light: THEME_BG.dark, dark: THEME_BG.dark });
  });
});
