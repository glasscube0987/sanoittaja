import { defineConfig, devices } from '@playwright/test';

/**
 * Selaintestit ajetaan puhelimen kokoisella näytöllä (iPhone 15 Pro, 393x852),
 * koska sovellusta käytetään ensisijaisesti puhelimella ja tähän mennessä
 * löytyneet asetteluvirheet ovat näkyneet vain kapealla näytöllä.
 *
 * Mukana on Chromiumin lisäksi WebKit, joka on sama moottoriperhe kuin
 * Safarissa. Osa vioista on johtunut nimenomaan siitä, että moottorit
 * mitoittavat flex-lapset eri tavalla, eikä Chromium yksin paljasta niitä.
 * WebKit ei silti ole iOS-Safari: puhelimen käyttöliittymäkäytökset, kuten
 * automaattinen zoomaus kenttään kohdistettaessa, eivät toistu siinä.
 */
const PUHELIN = { width: 393, height: 852 };
const PORT = 4173;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: PUHELIN, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
    },
    {
      // isMobile ei ole tuettu WebKitissä, joten mukana on vain näytön koko.
      name: 'webkit',
      use: { ...devices['Desktop Safari'], viewport: PUHELIN, hasTouch: true },
    },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
