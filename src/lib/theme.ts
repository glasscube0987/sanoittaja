/**
 * Ulkoasun teema: laitteen mukaan, vaalea tai tumma.
 *
 * Tumma on tehty hämärälle lavalle ja vaalea päivänvaloon ja kirjoittamiseen.
 * Kumpikin on sama tyylitiedosto: tämä moduuli vain kertoo juurielementille
 * kumpi on voimassa (`data-theme`), ja ilman valintaa tyylitiedoston
 * mediakysely seuraa laitetta.
 *
 * Laitekohtainen näyttöasetus, ei laulun tietoa, joten se asuu localStoragessa
 * kuten kieli ja sointumerkintä.
 */

export type Theme = 'system' | 'light' | 'dark';

export const THEMES: Theme[] = ['system', 'light', 'dark'];

const STORAGE_KEY = 'sanoittaja.theme';

/** Pohjavärit selaimen palkille; samat kuin tyylitiedoston `--bg`. */
export const THEME_BG = { light: '#f2f5f6', dark: '#0d1b2b' } as const;

export function loadTheme(): Theme {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system';
  } catch {
    // Estetty tallennus ei saa estää käynnistystä; laitteen asetus on hyvä oletus.
    return 'system';
  }
}

export function storeTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* Yksityisessä ikkunassa tallennus voi epäonnistua; valinta jää istuntoon. */
  }
}

/**
 * Selaimen palkin värit kumpaankin laitteen tilaan.
 *
 * `index.html`issä on kaksi `theme-color`-merkintää, yksi kummallekin
 * laitteen tilalle. Kun käyttäjä on valinnut teeman itse, molemmat saavat sen
 * värin – muuten tumman laitteen palkki jäisi tummaksi vaalean sovelluksen
 * yllä.
 */
export function themeBarColors(theme: Theme): { light: string; dark: string } {
  if (theme === 'light') return { light: THEME_BG.light, dark: THEME_BG.light };
  if (theme === 'dark') return { light: THEME_BG.dark, dark: THEME_BG.dark };
  return { ...THEME_BG };
}

/** Asettaa teeman voimaan. Kutsutaan käynnistyksessä ennen piirtoa, jottei
    väärä teema välähdä ruudulla. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
  const colors = themeBarColors(theme);
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    meta.content = meta.media.includes('light') ? colors.light : colors.dark;
  }
}
