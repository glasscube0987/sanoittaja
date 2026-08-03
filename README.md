# Sanoittaja 🎵

Mobiilisovellus (PWA) lauluntekijöille: kirjaa laulun sanat kun ne syntyvät, merkitse
sointumerkit minkä tahansa merkin kohdalle, transponoi yhdellä napautuksella, nauhoita
demoja puhelimella ja vie kaikki pilveen.

## Ominaisuudet

- **Sanoituseditori** – rivipohjainen editori; Enter jakaa rivin, askelpalautin rivin
  alussa yhdistää edelliseen.
- **Sointumerkit** – napauta sointuriviä minkä tahansa merkin yläpuolelta lisätäksesi
  soinnun juuri siihen kohtaan. Soinnut on ankkuroitu merkkipositioihin ja ne
  **siirtyvät automaattisesti tekstin mukana**, kun sanoja muokataan.
- **Soinnun hienosäätö** – sointua lisätessä tai jo asetettua napauttaessa sen paikkaa
  voi siirtää merkki kerrallaan ◀ ▶ -painikkeilla tai nuolinäppäimillä. Esikatselu
  näyttää soinnun sanoituksen yllä, joten kohdan näkee ennen tallennusta.
- **Osiot** – merkitse rivi osion aluksi (intro, säkeistö, nousu, kertosäe, C-osa,
  soolo, outro tai oma nimi) rivin §-painikkeesta. Toistuvat osiot **numeroituvat
  automaattisesti** (Säkeistö 1, Säkeistö 2), ja kokonaisen osion voi siirtää
  riveineen ylös tai alas otsikon ▲ ▼ -painikkeilla.
- **Transponointi** – koko laulu puolisävelaskelin ylös/alas, sekä ♯/♭-kirjoitusasun
  vaihto. Tukee mm. laatuja (`m7`, `sus4`, `dim`…) ja bassosäveliä (`C/G`).
- **Nauhoitteet** – jokaiseen lauluun voi tallentaa ääniluonnoksia suoraan puhelimen
  mikrofonilla (MediaRecorder). Nauhoitteet tallentuvat laitteelle (IndexedDB) ja
  kulkevat laulun mukana pilveen.
- **Pilvivienti** – laulu + nauhoitteet omaan kansioonsa **Dropboxiin** (OAuth PKCE)
  tai **Google Driveen** (OAuth). Lisäksi koko kirjaston **varmuuskopio yhtenä
  JSON-tiedostona** ilman mitään pilvitunnuksia – tiedoston voi jakaa puhelimen
  jakovalikosta mihin tahansa palveluun.
- **Kielet** – käyttöliittymä englanniksi ja suomeksi. Kieli tunnistetaan selaimesta
  (oletus englanti) ja sen voi vaihtaa asetuksista. Osiot tallentuvat kielineutraalina
  lajina, joten kielen voi vaihtaa milloin tahansa ilman että laulut muuttuvat.
- **Offline-first PWA** – asentuu puhelimen kotinäytölle, toimii ilman verkkoa;
  kaikki data on ensisijaisesti laitteella.

**Sovellus verkossa:** <https://glasscube0987.github.io/sanoittaja/> – avaa puhelimen
selaimella ja valitse ”Lisää Koti-valikkoon / aloitusnäytölle”, niin äppi asentuu kuin
natiivisovellus ja toimii myös offline.

## Kehitys

```bash
npm install
npm run dev        # kehityspalvelin
npm test           # yksikkötestit (vitest)
npm run test:e2e   # selaintestit (playwright, chromium + webkit)
npm run build      # tyyppitarkistus + tuotantobuild -> dist/
npm run preview    # tuotantobuildin esikatselu
```

Selaintestit tarvitsevat selainbinäärit kerran: `npx playwright install chromium webkit`.
Ne käynnistävät itse tuotantobuildin esikatselupalvelimen, joten erillistä
palvelinta ei tarvitse käynnistää käsin. Pelkän Chromiumin ajaa
`npm run test:e2e:chromium`.

## Julkaisu

Jokainen push `main`-haaraan ajaa testit, buildaa sovelluksen ja julkaisee sen
GitHub Pagesiin automaattisesti (`.github/workflows/deploy.yml`). `npm run build`
tuottaa staattisen `dist/`-kansion, jonka voi halutessaan julkaista myös mihin tahansa
muuhun HTTPS-palveluun (Netlify, Cloudflare Pages…). HTTPS vaaditaan, jotta mikrofoni
ja PWA-asennus toimivat puhelimessa.

### Pilvipalveluiden käyttöönotto

Pilvivienti tarvitsee omat (ilmaiset) sovellustunnukset, jotka syötetään äpin
asetuksissa (⚙︎ / ”Pilviasetukset”):

- **Dropbox**: luo sovellus osoitteessa <https://www.dropbox.com/developers/apps>
  (Scoped access → App folder, oikeus `files.content.write`), lisää julkaistun äpin
  osoite *Redirect URIs* -listaan ja syötä *App key* asetuksiin.
- **Google Drive**: luo OAuth client id (Web application) Google Cloud Consolessa,
  ota *Drive API* käyttöön ja lisää äpin osoite sallittuihin JavaScript-lähteisiin.

Varmuuskopiotiedosto (Lataa/Tuo varmuuskopio) toimii ilman mitään tunnuksia.

## Arkkitehtuuri

```
src/
  lib/
    types.ts        Tietomalli: Song, LyricLine, ChordAnchor, SectionMark, Recording
    chords.ts       Sointusymbolien jäsennys ja transponointi
    anchors.ts      Sointuankkurien siirto tekstimuutoksissa
    i18n.ts         Käännökset (en/fi), kielen tunnistus ja React-konteksti
    sections.ts     Osiorakenteen johtaminen riveistä ja osioiden nimeäminen
    songOps.ts      Laulun muokkausoperaatiot (puhtaita funktioita)
    db.ts           Paikallinen tallennus (IndexedDB)
    recorder.ts     Ääninauhoitus (MediaRecorder)
    sync/           Pilvikerros: provider-rajapinta, Dropbox, Google Drive,
                    varmuuskopiotiedosto
  components/       React-käyttöliittymä (lista, editori, sointuvalitsin,
                    nauhoitteet, pilvivalikko, asetukset)
e2e/                Selaintestit (Playwright): asettelu, osiot, soinnut, zoom
```

Ydinlogiikka (soinnut, ankkurit, muokkausoperaatiot) on erotettu käyttöliittymästä ja
katettu yksikkötestein (`npm test`). Asettelu ja käyttöliittymä katetaan erikseen
selaintestein puhelimen kokoisella näytöllä (`npm run test:e2e`), koska osa vioista
– sointujen kohdistus, sivun leveys – näkyy vasta oikeassa selaimessa ja voi erota
moottorien välillä. Siksi mukana on Chromiumin lisäksi WebKit, sama moottoriperhe
kuin Safarissa. Sama logiikka on siirrettävissä sellaisenaan
React Native / Capacitor -natiivikuoreen, jos sovellus halutaan myöhemmin
sovelluskauppoihin.

## Jatkokehitysideoita

- Kaksisuuntainen synkronointi (muutosten tuonti pilvestä, versiohistoria)
- Laulun vienti tekstinä / PDF:nä (ChordPro-muoto, osiot omina lohkoinaan)
- Osion monistus ja raahaamalla järjestäminen
- Capo-asetus ja soinnun tarttumaotteet
- Natiivipaketointi Capacitorilla (App Store / Play)
