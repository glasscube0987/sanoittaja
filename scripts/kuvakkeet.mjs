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
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const svg = await readFile(new URL('../public/icon.svg', import.meta.url), 'utf8');
// Kaikki pyöristykset: tausta ja iltarusko ovat kumpikin oma suorakulmionsa.
const taysi = svg.replaceAll('rx="112"', 'rx="0"');
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

/*
 * Kuvakkeiden osoitteisiin versio sisällön tiivisteestä. Tiedostojen nimet
 * eivät muutu, joten ilman tätä service worker ja selain tarjosivat vanhaa
 * kuvaketta välimuistista uuden julkaisun jälkeenkin. Sama tiiviste kaikkiin
 * viittauksiin; `e2e/laatu.spec.ts` tarkistaa että se vastaa icon.svg:tä.
 */
const versio = createHash('sha1').update(svg).digest('hex').slice(0, 8);
for (const tiedosto of ['../index.html', '../public/manifest.webmanifest']) {
  const url = new URL(tiedosto, import.meta.url);
  const sisalto = await readFile(url, 'utf8');
  const uusi = sisalto.replace(
    /((?:\.\/)?(?:icon[\w-]*|apple-touch-icon)\.(?:svg|png))(?:\?v=[0-9a-f]+)?"/g,
    `$1?v=${versio}"`,
  );
  await writeFile(url, uusi);
}
console.log('kuvakeversio', versio);
