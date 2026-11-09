/**
 * Renderöi `public/icon.svg`:stä PNG-kuvakkeet.
 *
 *   node scripts/kuvakkeet.mjs
 *
 * iOS ei käytä SVG:tä kotiruutukuvakkeena: `apple-touch-icon` vaatii PNG:n, ja
 * ilman sitä kotiruudulle päätyy kuvakaappaus sivusta tai pelkkä kirjain.
 * Android taas haluaa manifestiin rasterikoot ja erillisen maskattavan version.
 *
 * Kuvat ovat versionhallinnassa eikä niitä tehdä buildissa: SVG:n teksti
 * ladotaan koneen fontilla, joten eri koneella syntyisi eri kuvake. Aja tämä
 * vain kun `icon.svg` muuttuu, ja katso tulos ennen kuin viet sen sisään.
 *
 * Kaksi asua:
 *  - pyöristetty (sama kuin SVG) selaimen välilehteen ja manifestin `any`-kuvaksi
 *  - täysi neliö iOS:lle ja maskattavaksi – kumpikin leikkaa kulmat itse, ja
 *    läpinäkyvät kulmat näkyisivät niissä mustina.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const svg = await readFile(new URL('../public/icon.svg', import.meta.url), 'utf8');
const taysi = svg.replace('rx="112"', 'rx="0"');
if (taysi === svg) throw new Error('icon.svg:n taustasta ei löytynyt pyöristystä (rx="112")');

const KUVAT = [
  { nimi: 'icon-192.png', koko: 192, lahde: svg },
  { nimi: 'icon-512.png', koko: 512, lahde: svg },
  { nimi: 'icon-maskable-512.png', koko: 512, lahde: taysi },
  { nimi: 'apple-touch-icon.png', koko: 180, lahde: taysi },
];

const browser = await chromium.launch();
for (const { nimi, koko, lahde } of KUVAT) {
  const page = await browser.newPage({ viewport: { width: koko, height: koko } });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${koko}px;height:${koko}px}</style>${lahde}`,
  );
  const png = await page.screenshot({ omitBackground: true });
  await writeFile(new URL(`../public/${nimi}`, import.meta.url), png);
  await page.close();
  console.log(nimi, `${koko}×${koko}`);
}
await browser.close();
