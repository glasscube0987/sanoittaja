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

**H on sama sävel kuin B**, ja se hyväksytään syötteenä aina. `B` sen sijaan
tarkoittaa syötteenä **aina** h-säveltä, vaikka suomalais-saksalaisessa
perinteessä se on b-sävel: merkityksen muuttaminen vaihtaisi jokaisen jo
kirjoitetun B-soinnun korkeutta ilman että käyttäjä huomaisi. Merkintätapa-asetus
(`lib/notation.ts`) ohjaa siksi vain sitä mitä transponointi **kirjoittaa**.

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

**Merkintöjä on kahta lajia** (`Annotation` on erotteleva unioni): veto ja
tekstikenttä. Vedot piirtyvät SVG-kerrokseen, tekstikentät omaan
HTML-kerrokseensa sen alle, ja kerroksista **vain yksi ottaa kosketuksia
kerrallaan** työkalun mukaan – muuten kynällä ei voisi piirtää kentän päälle.
Kentän sijainti ja koko ovat em-yksiköitä suoraan CSS:ssä, joten selain latoo ne
eikä mitään mitata; leveyttä ei talleteta. Pyyhekumi koskee **vain vetoihin**:
kirjoitettua ei voi piirtää takaisin. `kind` puuttuu vanhoista tietueista, ja
sen puuttuminen tarkoittaa vetoa.

**Sanoitusrivin ja sointurivin fonttikoko on yksi ja sama.** Sointujen sijainti
lasketaan `ch`-yksiköllä, joka on elementin oman fontin merkkileveys, joten eri
koot irrottaisivat soinnut kirjaimistaan rivin edetessä. Koko tulee siksi
yhdestä CSS-muuttujasta (`--lyric-size`, `lib/lyricSize.ts`), jonka editori
asettaa `.lyrics`-laatikkoon. Samasta syystä tekstikenttä saa leveytensä samasta
`chordSpan`-laskennasta kuin sointurivi: rivi ja sen soinnut vierittyvät yhtenä,
eikä pitkän rivin loppupäästä puutu tekstiä.

**Rivin toiminnot asuvat `LineSheet`issä**, eivät kohdistetun rivin
työkalurivissä: sointurivi on painike ilman tekstikenttää, joten se ei voi
saada kohdistusta, eikä keskellä olevaan pelkistä sointuriveistä koostuvaan
osioon päässyt käsiksi mitenkään. Toiminto kulkee **tallennuksen mukana**
(`onSave(settings, action?)`), koska erillinen kutsu laskisi muutoksensa
vanhasta laulusta ja ylikirjoittaisi juuri tallennetut asetukset. Kopion
sisällön tietää yksi funktio (`copyLine`), ja yksittäisen rivin kopio
pudottaa `section`-merkinnän – muuten osion ensimmäisen rivin monistus
katkaisisi osion kahtia.

**Versiot.** `DB_VERSION` (`lib/db.ts`) ja `BUNDLE_VERSION`
(`lib/sync/exportFile.ts`) nousevat erikseen. `importLibrary` hyväksyy myös
vanhemman paketin: käyttäjillä on oikeita varmuuskopioita, eivätkä ne saa
lakata toimimasta — mutta **uudempi paketti torjutaan**, koska siinä voi olla
tietuelaji jota tämä versio ei tunne. Tietomallin muutokset merkitään
erottelevalla kentällä (esim. `Annotation.unit`), jolloin siirtymä on itsestään
rajoittuva.

**Uusi tietuelaji on vanhalle lukijalle vaaraton.** Varmuuskopio kulkee
laitteelta toiselle, ja vastaanottava laite voi olla vielä vanhassa versiossa.
Siksi uusi laji kantaa mukanaan sen verran vanhan mallin kenttiä, ettei vanha
koodi kaadu niitä lukiessaan: tekstimerkinnässä on `points: []` ja `width: 0`,
vaikka se ei käytä kumpaakaan. Ilman niitä vanha piirtokerros lukisi
`undefined.length` ja koko lehti jäisi valkoiseksi.

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

**Blobia ei voi tallentaa kantaan WebKit-testissä.** Playwrightin WebKit ajaa
IndexedDB:n väliaikaisessa istunnossa ilman levytallennusta, ja WebKit
tallentaa blobin tiedostona, joten kirjoitus katkeaa virheeseen «Error
preparing Blob/File data to be stored in object store». Sama tietue ilman
blobia menee läpi. Nauhoite on ainoa tietue jossa on blobi, joten sen
kantatarkistukset ovat `idea.spec.ts`:ssä ehdon takana;
`kanta-blob.spec.ts` mittaa rajoitteen ja **väittää sen molemmille
moottoreille**, jotta testi kaatuu jos WebKit joskus alkaa ottaa blobin
vastaan. Rajoite on tiedossa vain tästä ympäristöstä — oikealla
iOS-Safarilla sitä ei ole todennettu kumpaankaan suuntaan.

Kuvakaappaukset ovat löytäneet toistuvasti vikoja, joita testit eivät näe
(päällekkäinen väri­hierarkia, ruudun ulkopuolelle valuva painike, kahdelle
riville kiertyvä työkalurivi). Käyttöliittymää muuttaessa kannattaa ottaa
kuvakaappaus puhelimen koolla.

## Julkaisu

Push `main`-haaraan ajaa testit ja julkaisee GitHub Pagesiin
(`.github/workflows/deploy.yml`). `deploy` on `needs: build`, joten punainen ajo
ei julkaise mitään.
