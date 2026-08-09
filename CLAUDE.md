# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Sanoittaja on mobiilipainotteinen PWA lauluntekijöille: sanoitukset,
merkkipositioon ankkuroidut sointumerkit, transponointi, nauhoitteet,
esitystila ja varmuuskopiot. Vite 8 + React 18 + TypeScript, ei ajonaikaisia
riippuvuuksia Reactin lisäksi.

## Komennot

```bash
npm run dev                 # kehityspalvelin
npm test                    # yksikkötestit (vitest, node-ympäristö)
npm run test:watch          # sama vahtitilassa
npm run test:e2e:chromium   # selaintestit vain Chromiumilla
npm run test:e2e            # chromium + webkit
npm run build               # tsc --noEmit && vite build -> dist/
npm run preview             # tuotantobuildin esikatselu
```

Yksi yksikkötestitiedosto: `npx vitest run src/lib/annotate.test.ts`
Yksi selaintesti nimellä: `npx playwright test --project=chromium e2e/merkinnat.spec.ts -g "nimen osa"`

`npm run build` ajaa `tsc --noEmit` ensin, joten se on samalla tyyppitarkistus.
Selainbinäärit tarvitaan kerran: `npx playwright install chromium webkit`.
Playwright käynnistää itse tuotantobuildin esikatselupalvelimen, joten
erillistä palvelinta ei käynnistetä käsin.

## Arkkitehtuurin ydin

**Puhdas logiikka `src/lib`:ssä, selain-API:t omissa moduuleissaan.** `db.ts`
(IndexedDB), `recorder.ts` (MediaRecorder), `print.ts` (`window.print`) ja
`sync/` ovat ne kohdat, jotka natiivikuoressa vaihtuvat; muu logiikka ei koske
selain-API:hin lainkaan. Uusi selainkutsu kuuluu omaan moduuliinsa, ei
komponenttiin.

**Sointu ankkuroituu merkkipositioon**, ei pikseleihin (`anchors.ts` siirtää
ankkurit tekstin muuttuessa). `songOps.ts` on ainoa paikka joka muokkaa laulua,
puhtaina funktioina; `App.tsx` kytkee ne peruutuspinoon (`history.ts`).

**`SongSheet` on sama komponentti live-tilassa ja tulosteessa.** Editorissa se
on `display: none` ja näkyy vain `@media print`issä. Tästä seuraa sääntö, joka
on jo kerran rikkoutunut julkaisussa asti: **tulosteen on toimittava ilman
ladontaa.** `getComputedStyle(el).fontSize` on käytettävissä myös piilotetulle
elementille, `getBoundingClientRect()` palauttaa nollat.

**Omien merkintöjen koordinaatisto on rivin fonttikoko (em)**, ei pikseli eikä
rivin leveys. Lehti ladotaan uudelleen jokaisesta muokkauksesta,
transponoinnista ja tekstikoon muutoksesta, ja vain em seuraa kirjaimia. Veto
kuuluu riviin mutta saa ulottua sen ulkopuolelle (`overflow: visible`), joten
mikä tahansa merkintöihin kohdistuva osumatesti kuuluu **lehden tasolle** eikä
yhden rivin sisään.

**Versiot.** `DB_VERSION` (`lib/db.ts`) ja `BUNDLE_VERSION`
(`lib/sync/exportFile.ts`) nousevat erikseen. `importLibrary` hyväksyy myös
vanhemman paketin: käyttäjillä on oikeita varmuuskopioita, eivätkä ne saa
lakata toimimasta. Tietomallin muutokset merkitään erottelevalla kentällä
(esim. `Annotation.unit`), jolloin siirtymä on itsestään rajoittuva.

**i18n.** Kaikki näkyvä teksti kulkee `t()`:n kautta, ja uusi avain lisätään
**molempiin** kielitauluihin (`lib/i18n.ts`). Osiot tallentuvat kielineutraalina
lajina, joten kielen voi vaihtaa laulujen muuttumatta.

## Kirjoitusasu

Koodin kommentit, testien nimet ja osa tunnisteista ovat **suomeksi**
(`veda`, `pyyhi`, `kesken`, `naytetyt`). Uuden koodin on sulauduttava tähän.
Kommentit kertovat *miksi*, eivät mitä — usein ne kertovat mikä vika johti
ratkaisuun.

## Testauksesta

Selaintestit ajetaan puhelimen koolla (393×852), koska tähän mennessä löytyneet
asetteluvirheet ovat näkyneet vain kapealla näytöllä.

**Tässä kehitysympäristössä on asennettuna vain Chromium.** `npm run test:e2e`
yrittää käynnistää myös WebKitin ja epäonnistuu — käytä
`npm run test:e2e:chromium`. WebKit-kate tulee CI:stä, eikä sitä pidä väittää
ajetuksi paikallisesti.

Piirtokerroksen (`components/Annotations.tsx`) testeissä on toistunut kaksi
sokeaa pistettä, jotka molemmat päästivät läpi julkaistun vian:

1. **Tapahtuman lähettäminen elementille kuplii ylöspäin kerroksen ohi.**
   Oikeassa kosketuksessa selain valitsee päällimmäisen elementin, joten
   kysymys «onko kerros tässä kohdassa» tarkistetaan `elementFromPoint`illa.
2. **Piirto ja pyyhkiminen samalla rivillä ei kata sitä, että veto ulottuu
   rivin ulkopuolelle.** Testin on ylitettävä rivi.

Osoitintapahtumat syntetisoidaan `pointerType`-arvoineen ja **yksi tapahtuma
per kierros**: kesken oleva veto elää Reactin tilassa, joten saman kierroksen
sisällä lähetetty `pointermove` näkisi vielä vanhan arvon.

Kuvakaappaukset ovat löytäneet toistuvasti vikoja, joita testit eivät näe
(päällekkäinen väri­hierarkia, ruudun ulkopuolelle valuva painike, kahdelle
riville kiertyvä työkalurivi). Käyttöliittymää muuttaessa kannattaa ottaa
kuvakaappaus puhelimen koolla.

## Julkaisu

Push `main`-haaraan ajaa testit ja julkaisee GitHub Pagesiin
(`.github/workflows/deploy.yml`). `deploy` on `needs: build`, joten punainen ajo
ei julkaise mitään.
