# Sanoittaja 🎵

Mobiilisovellus (PWA) lauluntekijöille: kirjaa laulun sanat kun ne syntyvät, merkitse
sointumerkit minkä tahansa merkin kohdalle, transponoi yhdellä napautuksella, nauhoita
demoja puhelimella ja vie kaikki pilveen.

## Ominaisuudet

- **Sanoituseditori** – rivipohjainen editori; Enter jakaa rivin, askelpalautin rivin
  alussa yhdistää edelliseen.
- **Peruutus** – yläpalkin ↶ kumoaa viimeisimmän muutoksen. Kirjoittaminen peruuntuu
  rupeama kerrallaan, ei kirjain kerrallaan, ja rakenteelliset muutokset omina
  askelinaan. Rivin muuttaminen sointuriviksi ei myöskään hävitä sanoja: ne palaavat
  kun rivi muutetaan takaisin.
- **Sointumerkit** – napauta sanoitusrivin yläpuolelta minkä tahansa merkin kohdalta
  lisätäksesi soinnun juuri siihen kohtaan. Soinnut on ankkuroitu merkkipositioihin ja
  ne **siirtyvät automaattisesti tekstin mukana**, kun sanoja muokataan.
- **Rivin työkalut** – kirjoitettavan rivin alle ilmestyy kapea rivi, josta saa
  lisättyä rivin, liitettyä tekstiä *tähän kohtaan* ja kumottua viimeisimmän
  muutoksen. Työkalut näkyvät niin kauan kuin rivillä on kohdistus, eli katoavat
  kun näppäimistön sulkee.
- **Sointurivit** – rivin voi muuttaa sointuriviksi rivin §-painikkeesta, jolloin
  soinnut merkitään tahteina: `| Am | F | C | G |`. Rivillä jo olevat soinnut
  siirtyvät tahdeiksi, yksi sointu tahtia kohti. Yhteen tahtiin mahtuu useampi
  sointu (`Am F`) tai muu merkintä (`%`), pikavalinnat lisäävät soinnun tahtiin
  entistä hävittämättä, ja ”Jaa tahti” pilkkoo tahdin kahdeksi. Tahdit tasataan
  saman levyisiksi niin että tahtiviivat ovat allekkain, ja transponointi
  käsittelee jokaisen tahdin soinnun erikseen.
- **Tahtilaji** – laulun tahtilaji (esim. `4/4`) otsikkorivillä sävellajin
  vieressä. Jos laji vaihtuu kesken laulun, merkintä tehdään siihen **tahtiin**
  josta laji vaihtuu, myös keskelle riviä: `| Am | F | 3/4 Dm |`. Rivin alussa
  se on tapansa mukaan ennen ensimmäistä tahtiviivaa, ja merkinnälle varataan
  oma sarake, joten muiden sointurivien tahtiviivat pysyvät allekkain.
  Transponointi ei koske tahtilajiin.
- **Välisoitot** – sanattomalle riville voi merkitä useita sointuja, joten introt,
  soolot ja väliosat mahtuvat mukaan. Tyhjällä rivillä näkyy himmeä sarakeruudukko,
  ja sointuja voi asettaa myös viimeisen sanan jälkeen kierrosointua varten.
- **Soinnun hienosäätö** – sointua lisätessä tai jo asetettua napauttaessa sen paikkaa
  voi siirtää merkki kerrallaan ◀ ▶ -painikkeilla tai nuolinäppäimillä. Esikatselu
  näyttää soinnun sanoituksen yllä, joten kohdan näkee ennen tallennusta.
- **Tuonti tekstistä** – vanhat laulut siirtyvät appiin liittämällä: sanoitus,
  jonka yllä on soinnut välilyönnein kohdistettuna, luetaan riveiksi niin että
  soinnut ankkuroituvat siihen merkkiin, jonka yllä ne olivat. Osio-otsikot
  (`[Kertosäe]`, `Verse 2`) tunnistetaan molemmilla kielillä, tahtirivit
  (`| Am | F |`) sointuriveiksi ja sanattomat sointurivit välisoitoiksi.
  Esikatselu näyttää miten kukin rivi tulkittiin, ja tulkinnan voi korjata ennen
  laulun luomista. Tuonti onnistuu myös `.txt`-tiedostosta ja avoimen laulun
  perään. *Kohdistus säilyy vain jos soinnut on aseteltu välilyönnein;
  sarkaimilla tehty asettelu tai PDF:stä kopiointi voi siirtää sointuja merkin
  verran, jolloin nuolinäppäimet korjaavat ne.*
- **Osion kopiointi** – toistuvan osion saa monistettua otsikkorivin
  kopiointipainikkeesta. Kopio menee alkuperäisen perään ja osiot numeroituvat
  automaattisesti (Kertosäe 1, Kertosäe 2).
- **Osiot** – merkitse rivi osion aluksi (intro, säkeistö, nousu, kertosäe, C-osa,
  soolo, outro tai oma nimi) rivin §-painikkeesta. Toistuvat osiot **numeroituvat
  automaattisesti** (Säkeistö 1, Säkeistö 2), ja kokonaisen osion voi siirtää
  riveineen ylös tai alas otsikon ▲ ▼ -painikkeilla.
- **Transponointi** – koko laulu puolisävelaskelin ylös/alas, sekä ♯/♭-kirjoitusasun
  vaihto. Tukee mm. laatuja (`m7`, `sus4`, `dim`…) ja bassosäveliä (`C/G`). Siirtymä
  alkuperäisestä näkyy palkissa (esim. `+2 ↺`), ja siitä pääsee yhdellä napautuksella
  takaisin alkuperäiseen sävellajiin. *Sävelet palaavat oikeiksi, mutta enharmoninen
  kirjoitusasu voi vaihtua (`Bb` → `A#`); ♭/♯ korjaa asun.*
- **Nauhoitteet** – jokaiseen lauluun voi tallentaa ääniluonnoksia suoraan puhelimen
  mikrofonilla (MediaRecorder). Nauhoitteet tallentuvat laitteelle (IndexedDB) ja
  kulkevat laulun mukana pilveen.
- **Varmuuskopio** – koko kirjasto yhtenä JSON-tiedostona ilman mitään tunnuksia.
  Puhelimessa ”Varmuuskopioi” avaa jakovalikon, josta tiedoston tallentaa suoraan
  Tiedostoihin tai iCloud Driveen; työpöydällä se latautuu normaalisti. Laululistalla
  näkyy milloin kopio on viimeksi otettu, ja viikon jälkeen huomautus korostuu.
  ”Palauta” lukee tiedoston takaisin.
- **Varmuuskopio pilveen** – sama palautuva paketti **Dropboxiin** (OAuth PKCE) tai
  **Google Driveen** (OAuth) yhdellä napautuksella laululistalta. Tiedosto on
  päivätty (`sanoittaja-varmuuskopio-2026-08-03.json`), joten pilveen kertyy
  historiaa päivä kerrallaan, ja ”Palauta” lukee sen sellaisenaan takaisin.
  Tiedostot menevät kunkin käyttäjän *omaan* pilvitiliin, eivät kehittäjän.
- **Automaattinen varmuuskopio** – kun Dropboxiin on kerran kirjauduttu, kirjasto
  kopioidaan taustalla muutaman kerran päivässä aina kun jotain on muuttunut;
  mitään ei tarvitse muistaa painaa. Kirjautuminen säilyy refresh tokenilla, ja
  toiminnon voi kytkeä pois asetuksista.
- **Settilistat** – laulut ovat aina ”Kaikki laulut” -näkymässä, ja niistä voi
  koota keikkakohtaisia settejä. Setti sisältää vain viittauksia, joten sama
  laulu voi olla useassa setissä ja muokkaus näkyy kaikissa. Järjestys ▲▼:llä,
  ja **live-tilassa setin läpi pääsee biisistä toiseen** poistumatta
  esitysnäkymästä. Biisin vaihto on aina käyttäjän napautus: automaattinen
  vieritys ei jatku seuraavan biisin päälle itsestään.
- **Omat merkinnät** – live-tilan kynäpainike avaa piirtotilan, jossa
  sointulapun päälle voi merkitä muistiinpanoja kynällä tai sormella viidellä
  värillä. Pyyhekumi ja «kumoa veto» ovat samassa rivissä. Kun kynää on kerran
  käytetty, sormi vierittää eikä piirrä – kämmen ei siis sotke lappua – ja
  sormipiirron saa takaisin päälle yhdellä napautuksella (puhelimella, jossa
  kynää ei ole, se on valmiiksi päällä). **Merkintä kuuluu riviin, ei
  näyttöpikseleihin**, joten se pysyy paikallaan vaikka laulua muokataan,
  transponoidaan tai tekstikokoa vaihdetaan, ja se seuraa riviään kun ylle
  lisätään rivejä. Merkinnät tulevat mukaan sekä tulosteeseen että
  varmuuskopioon, ja poistuvat laulun mukana.
- **Live-tila** – esiintymisnäkymä, joka vierittää laulua valitulla nopeudella,
  jolloin kädet pysyvät soittimessa. Tekstikoko ja nopeus säädettävissä, ruudun
  napautus pysäyttää ja jatkaa, ja näyttö pidetään hereillä (Wake Lock). Nopeus ja
  tekstikoko muistetaan seuraavalle kerralle.
- **PDF-vienti** – ”Vie PDF” avaa järjestelmän tulostusvalikon, josta laulun voi
  tallentaa PDF:nä tai tulostaa. Tuloste on puhdas nuottilehti: soinnut sanojen yllä
  tasalevyisellä fontilla, osiot otsikoituna ja osiot pyritään pitämään yhdellä
  sivulla. *iOS: kotivalikkoon asennetussa äpissä tulostus ei aina avaudu suoraan;
  varareitti on jakovalikon Print → Save to Files.*
- **Kielet** – käyttöliittymä englanniksi ja suomeksi. Kieli tunnistetaan selaimesta
  (oletus englanti) ja sen voi vaihtaa asetuksista. Osiot tallentuvat kielineutraalina
  lajina, joten kielen voi vaihtaa milloin tahansa ilman että laulut muuttuvat.
- **Offline-first PWA** – asentuu puhelimen kotinäytölle, toimii ilman verkkoa;
  kaikki data on ensisijaisesti laitteella.
- **Tabletti** – 768 pikselistä ylöspäin palsta levenee tuhanteen pikseliin.
  Sanoitus ja sointumerkit ovat tasalevyistä tekstiä, joten jokainen lisäsarake
  näyttää enemmän kerralla ja tavallinen pitkä rivi mahtuu näkyviin ilman
  vaakavieritystä. Ponnahdukset pysyvät kapeina, koska leveä lomake on
  hankalampi käyttää kuin kapea.

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

**Dropbox on valmiiksi käytössä:** sovelluksella on oma Dropbox-sovelluksensa,
joten käyttäjän tarvitsee vain kirjautua. Data menee silti kunkin käyttäjän
*omalle* Dropbox-tilille kansioon `Apps/Sanoittaja/`. Google Drive tarvitsee
edelleen oman OAuth client id:n asetuksissa (⚙︎ / ”Pilviasetukset”), ja
varmuuskopiotiedosto (”Varmuuskopioi” / ”Palauta”) toimii ilman mitään tunnuksia.

#### Dropbox omalla sovelluksella

Tämä on tarpeen vain jos julkaiset oman version tai haluat oman App keysi.
Asetuskentän täyttäminen ohittaa sisäänrakennetun tunnuksen.

1. Kirjaudu <https://www.dropbox.com/developers/apps> ja valitse **Create app**.
2. **Choose an API**: Scoped access. **Type of access**: **App folder** – tällöin
   sovellus näkee vain oman kansionsa, ei muuta Dropboxia.
3. Anna sovellukselle nimi (näkyy käyttäjälle kansion nimenä `Apps/<nimi>/`).
4. **Permissions**-välilehti: rastita `files.content.write` ja
   `files.content.read`, ja **paina Submit**. Ilman Submitia oikeudet eivät tallennu
   ja vienti kaatuu `missing_scope`-virheeseen.
5. **Settings**-välilehti → **Redirect URIs**: lisää äpin osoite *täsmälleen*
   sellaisena kuin se on osoiterivillä, päättävä kauttaviiva mukaan lukien:
   `https://glasscube0987.github.io/sanoittaja/`. Sovellus lähettää
   `window.location.origin + window.location.pathname`, ja Dropbox vaatii
   merkintarkan osuman.
6. Kopioi **App key** ja syötä se äpin pilviasetuksiin.

App key ei ole salaisuus: PKCE-kulussa se on tarkoitettu julkiseksi eikä
*App secret* -kenttää käytetä lainkaan. Siksi sovelluksen oma App key on
lähdekoodissa (`src/lib/sync/dropbox.ts`). Data menee **kunkin käyttäjän omalle**
Dropbox-tilille kansioon `Apps/<nimi>/`, ei kehittäjän tilille; kehittäjä näkee
App Consolessa vain liitettyjen tilien lukumäärän. Kehitystilan sovellus sallii
rajallisen määrän tilejä ennen tuotantostatuksen hakemista.

*iOS-huomio:* kotivalikkoon asennetulla äpillä on eri tallennustila kuin
Safarilla, joten OAuth-paluu voi päätyä Safariin ja jättää asennetun äpin
kirjautumatta. Testaa ensin Safarissa ja sen jälkeen asennetussa äpissä.

#### Google Drive

Luo OAuth client id (Web application) Google Cloud Consolessa, ota *Drive API*
käyttöön ja lisää äpin osoite sallittuihin JavaScript-lähteisiin. Oikeus on
`drive.file`, joten sovellus näkee vain itse luomansa tiedostot; varmuuskopiot
menevät kansioon `Sanoittaja`.

## Arkkitehtuuri

```
src/
  lib/
    types.ts        Tietomalli: Song, LyricLine, ChordAnchor, SectionMark, Recording
    chords.ts       Sointusymbolien jäsennys ja transponointi
    anchors.ts      Sointuankkurien siirto tekstimuutoksissa
    annotate.ts     Omien merkintöjen koordinaatisto, yksinkertaistus ja
                    pyyhekumin osumatesti (puhtaita funktioita)
    bars.ts         Sointurivin tahdit ja tahtilajit; tahtien muokkausoperaatiot
    history.ts      Peruutuspino ja kirjoitusmuutosten yhdistäminen
    i18n.ts         Käännökset (en/fi), kielen tunnistus ja React-konteksti
    importText.ts   Tekstin tulkinta laulun riveiksi (sointu-, sanoitus- ja
                    osiorivien tunnistus)
    live.ts         Live-tilan vieritysaskel ja asetukset
    print.ts        Nuottilehden tulostus (oma moduulinsa natiiviporttia varten)
    render.ts       Sointumerkkien ja sointurivien ladonta tekstiksi (tulostus, live)
    sections.ts     Osiorakenteen johtaminen riveistä ja osioiden nimeäminen
    setlists.ts     Settilistojen sisältö ja järjestys (puhtaita funktioita)
    songOps.ts      Laulun muokkausoperaatiot (puhtaita funktioita)
    useAnnotations.ts  Laulun merkinnät kannasta; live-tila ja tulostuslehti
                    pysyvät synkassa kannan tapahtuman kautta
    db.ts           Paikallinen tallennus (IndexedDB)
    recorder.ts     Ääninauhoitus (MediaRecorder)
    sync/           Pilvikerros: provider-rajapinta, Dropbox, Google Drive,
                    varmuuskopiotiedosto, automaattinen taustakopio
  components/       React-käyttöliittymä (lista, editori, sointuvalitsin,
                    nauhoitteet, pilvivalikko, asetukset)
e2e/                Selaintestit (Playwright): asettelu, osiot, soinnut, zoom,
                    tabletti
```

Ydinlogiikka (soinnut, ankkurit, muokkausoperaatiot) on erotettu käyttöliittymästä ja
katettu yksikkötestein (`npm test`). Asettelu ja käyttöliittymä katetaan erikseen
selaintestein puhelimen kokoisella näytöllä (`npm run test:e2e`), koska osa vioista
– sointujen kohdistus, sivun leveys – näkyy vasta oikeassa selaimessa ja voi erota
moottorien välillä. Siksi mukana on Chromiumin lisäksi WebKit, sama moottoriperhe
kuin Safarissa. Testit ajetaan puhelimen koolla; `tabletti.spec.ts` vaihtaa
näytön koon itse, jotta leveä asettelu ei jää katteen ulkopuolelle.

Selain-API:t on eristetty omiin moduuleihinsa (`db`, `recorder`, `print`,
`sync/`), koska ne ovat ne kohdat, jotka natiivikuoressa vaihtuvat: WebViewissä
ei ole tulostusvalintaikkunaa, jakovalikkoa eikä Wake Lockia, ja OAuthin
paluuosoite on eri. Logiikkakerros (soinnut, ankkurit, tahdit, tuonti,
muokkausoperaatiot) ei koske selain-API:hin lainkaan ja siirtyy sellaisenaan. Sama logiikka on siirrettävissä sellaisenaan
React Native / Capacitor -natiivikuoreen, jos sovellus halutaan myöhemmin
sovelluskauppoihin.

## Jatkokehitysideoita

- Kaksisuuntainen synkronointi (muutosten tuonti pilvestä, versiohistoria)
- Laulun vienti ChordPro-muodossa
- Osion monistus ja raahaamalla järjestäminen
- Capo-asetus ja soinnun tarttumaotteet
- Natiivipaketointi Capacitorilla (App Store / Play)
