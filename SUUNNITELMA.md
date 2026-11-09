# Sanoittajan kehityssuunnitelma

Tämä tiedosto kertoo **mitä tehdään seuraavaksi ja miksi siinä järjestyksessä**.
Arkkitehtuurin säännöt ja niiden perustelut ovat `CLAUDE.md`:ssä; tänne kuuluu
järjestys, avoimet päätökset ja tiedossa oleva velka.

Tavoite on oikea tuote keikkailevalle muusikolle ja lauluntekijälle: sointu- ja
sanoituslaput, jotka toimivat lavalla, ja omat laulut, jotka pysyvät tallessa.

Päivitetty 9.11.2026 koko sovelluksen arvion jälkeen.

## Järjestys

| # | Erä | Tila |
|---|-----|------|
| 1 | Laatuerä | tehty |
| 2 | Live-tila keikkakuntoon | seuraava |
| 3 | Käyttöliittymän suunnittelukierros | |
| 4 | Tabulatuuri, sitten nuotit | |
| 5 | Beta oikeilla muusikoilla | |
| 6 | Natiivikuori ja sovelluskauppa | |

Järjestyksen logiikka: ensin se mikä voi hävittää työtä tai pettää lavalla,
sitten ulkoasu kokonaisuutena, ja vasta sen päälle uudet ominaisuudet. Jokainen
ominaisuus on tähän asti lisännyt oman rivinsä tai lakanansa, joten
suunnittelukierros kannattaa tehdä **ennen** nuotteja eikä niiden jälkeen.

## 1. Laatuerä — tehty

Arviossa löytyneet viat ja työkaluvelka.

- **Live-tilan nopeus** näkyi puhelimessa muodossa «S.». Nyt yksi säädin
  (− luku +), ja ohjainrivi mahtuu 375 pikseliin yhdelle riville.
- **Editorin sivuvieritys** vei osioiden otsikot ja rivien asetuspainikkeet
  näkyvistä. Ne pysyvät nyt paikallaan.
- **Rivilakanan valinnat** olivat sointujen tasalevyisellä fontilla.
  Tasalevyinen on nyt vain nuottikuvalla (`.chip-row.notation`).
- **Kantavirheet näkyvät.** Parikymmentä kohtaa kirjasi epäonnistuneen
  tallennuksen vain konsoliin. Nyt ne kulkevat yhden kanavan kautta
  (`lib/failures.ts`) ja näkyvät punaisena ilmoituksena. Nauhoite, jonka
  tallennus epäonnistui, ei enää katoa sanomatta.
- **Virheraja.** Renderöintivirhe ei jätä ruutua valkoiseksi, vaan näyttää
  näkymän josta saa varmuuskopion.
- **Kotiruutukuvakkeet** PNG:nä (iOS ei käytä SVG:tä).
- **Playwright 1.63**, Vite ja Vitest päivitetty; `npm audit` on puhdas.
- **CI ajaa testit myös kehityshaaroissa**, julkaisu vain `main`ista. WebKit-kate
  saadaan nyt ennen julkaisua eikä sen hetkellä.

Tarkoituksella siirretty eteenpäin: pitkän rivin rivitys live-tilassa (erä 2,
vaatii päätöksen – ks. alla) ja linteri (velkalistalla).

## 2. Live-tila keikkakuntoon — seuraava

Live-tila on se näkymä jonka varassa keikka on, joten sen viat painavat eniten.

**Pitkän rivin rivitys.** Nyt pitkä rivi valuu oikean reunan yli ja näkymä
vierittyy sivulle – soittaessa sitä ei voi tehdä. Rivin on rivityttävä
sanarajasta niin, että soinnut seuraavat sanojaan.

> **Avoin päätös ennen toteutusta.** Omat merkinnät (kynä, tekstikentät) on
> ankkuroitu rivin alkuun em-yksiköissä. Se toimii, koska rivin ladonta on sama
> kaikilla tekstikoilla ja laitteilla. Rivitys rikkoo tämän: puhelimella
> kahdelle riville taittuva säe on iPadilla yhdellä, ja sanan ympärille piirretty
> ympyrä jäisi väärään kohtaan. Vaihtoehdot: (a) merkintä ankkuroidaan sanaan
> eikä riviin, (b) rivitys vain lauluissa joissa ei ole merkintöjä, (c)
> rivitys on laitekohtainen valinta ja merkinnät näkyvät vain rivittämättä.
> Tämä on tietomallin päätös, ei tyylikysymys.

**Transponointi live-tilassa.** Laulaja vaihtuu tai kapo unohtui: sävellajin
pitää vaihtua lavalla ilman editoriin palaamista.

**Setin selaus.** Seuraavan laulun nimi näkyviin ennen vaihtoa, ja vaihto yhdellä
kädellä.

**Ohjainpalkin tila.** Piirtotilassa palkkeja on kolme päällekkäin ja ne vievät
viidenneksen puhelimen ruudusta.

## 3. Käyttöliittymän suunnittelukierros

Yksi kierros, jossa sovitaan välit, tekstikoot, painikkeiden tärkeysjärjestys ja
lakanoiden rakenne – ja sen jälkeen näkymät käydään läpi sitä vasten.

Arviossa löytyneet kohdat:

- **Laululistassa on neljä ohjainriviä** ennen ensimmäistä laulua (setit, haku,
  tagit, järjestys).
- **Soinnun lisääminen ei näy mistään.** Se tehdään napauttamalla tyhjää riviä
  tekstin yllä; vihje on vain hiiren työkaluvihjeenä. Ensikäytön opastus puuttuu.
- **Rivilakanassa on asetuksia ja toimintoja sekaisin.** Asetukset vaativat
  tallennuksen, toiminnot tapahtuvat heti.
- **Laulun nimi on editorissa kahdesti** (yläpalkki ja kenttä).
- **Selaimen omat kyselyikkunat** (`prompt`, `confirm`) setin nimeämisessä ja
  poistoissa näyttävät vierailta asennetussa sovelluksessa.
- **Lakanoilta puuttuvat dialogin perusominaisuudet**: Esc ei sulje, kohdistus
  ei pysy lakanassa, eikä ruudunlukija tiedä että kyse on dialogista.
- Rivin asetuskuvake on merkitykseltään arvoituksellinen.

## 4. Tabulatuuri ja nuotit lapun sisään

Tarve: sointulapun sisään lyhyt melodia – intro, riffi, välisoitto –
tabulatuurina tai nuottiviivastolla.

Molemmat ovat **uusi rivilaji**, samalla tavalla kuin sointutahtirivi. Säännöt
ovat samat kuin muillakin uusilla lajeilla: erotteleva kenttä, ja vanhalle
lukijalle vaaraton (`text: ''`, `chords: []` mukana).

**Tabulatuuri ensin.** Tabi on luonteeltaan tasalevyistä tekstiä, joten nykyinen
lehti latoo sen lähes sellaisenaan ja tuloste toimii ilman ladontaa. Työ on
syöttönäkymässä: kielet × kohdat, napautus ja nauhan numero.

**Nuottiviivasto toisena.**

- Tallennusmuodoksi ABC-notaatio: tekstiä, joten se kulkee varmuuskopiossa ja
  yhdistämisessä, ja melodia voidaan transponoida sointujen mukana.
- Rajataan lyhyisiin, 1–4 tahdin pätkiin. Kokonaista partituurieditoria ei
  tehdä.
- Syöttö puhelimella on vaikein osa: sävelkorkeus napauttamalla viivastoa,
  kesto painikeriviltä.

> **Avoin päätös.** Piirtämiseen joko valmis kirjasto (esim. abcjs) tai oma
> ladonta. Kirjasto rikkoo periaatteen «ei ajonaikaisia riippuvuuksia Reactin
> lisäksi» ja on todennäköisesti nykyistä sovellusta suurempi, joten se
> ladattaisiin vain lauluille joissa on nuotteja. Oma nuottiladonta
> (palkitus, välistys, etumerkit) on iso työ, jota ei suositella.

## 5. Beta

3–5 muusikkoa käyttää sovellusta oikeilla keikoilla ennen 1.0:aa. Ennen betaa:

- palautekanava (GitHub Issues tai lomake)
- versionumero ja muutosloki näkyviin sovellukseen
- avoimet tuotepäätökset (alla) lukittu

## 6. Natiivikuori ja sovelluskauppa

iOS:n PWA-rajoitukset tulevat vastaan oikeassa tuotteessa: selain saa häätää
tallennustilan, asennus kotiruudulle on monelle vieras, eikä taustatoimintoja
ole. Arkkitehtuuri on jo valmisteltu tähän – selain-API:t ovat omissa
moduuleissaan (`db.ts`, `recorder.ts`, `print.ts`, `reload.ts`, `sync/`).

## Työtapa

- **Yksi erä kerrallaan**: suunnitelma → toteutus → jokainen uusi testi
  sabotoidaan → kuvakaappaukset puhelimen koolla → CI vihreäksi haarassa →
  `main`.
- **Kuvakaappaus on osa tarkistusta, ei lisä.** Jokaisessa erässä se on
  löytänyt vian jota testit eivät nähneet.
- **Oikeat laitteet joka erän jälkeen.** CI:n WebKit ei ole iPhonen Safari, ja
  Apple Pencil -viat ovat löytyneet vain käsin.
- **Viat ja ideat GitHub Issuesiin**, ei keskusteluun.

Vielä tekemättä:

- **Erillinen testiosoite.** Nyt `main` julkaisee suoraan siihen sovellukseen,
  jossa oikeat laulut ovat. Haara-CI kaventaa riskiä, mutta ei korvaa paikkaa
  jossa muutosta voi kokeilla puhelimella ennen julkaisua.
- **Versionumero ja muutosloki.**
- **Linteri.**

## Avoimet tuotepäätökset

- **Nimi** ennen 1.0:aa.
- **Hinnoittelu** ja se, mikä on maksullista.
- **Synkronointi vai varmuuskopio.** Nyt laitteiden välillä on yhdistävä
  varmuuskopio, ei synkronointia. Joko se sanotaan suoraan, tai tehdään oikea
  synkronointi (hautakivet poistoille, kenttäkohtainen yhdistäminen).
- **Kohderyhmän painotus**: keikkaileva cover-muusikko vai lauluntekijä.
  Nuottiominaisuus ja live-tila palvelevat ensimmäistä, nauhoitteet ja ideat
  jälkimmäistä.

## Tiedossa oleva velka

- **Varmuuskopio pakkaa äänet base64:nä yhteen JSON-tiedostoon.** Kasvaa
  nopeasti; äänitiedostojen liittäminen pahentaa tilannetta.
- **Poistot eivät leviä laitteelta toiselle**: poistettu laulu palaa tuonnissa.
- **Tagin lisäys nostaa laulun muokkausaikaa**, joten se voi yhdistämisessä
  voittaa toisella laitteella tehdyn sanoitusmuokkauksen. Koko tietueen tason
  sääntö, sama kuin transponoinnissa.
- **`lib/sync`:n virheilmoitukset ovat kovakoodattua suomea** ja näkyvät
  sellaisinaan englanninkieliselle käyttäjälle.
- **`LiveView.tsx` on 750 riviä ja `styles.css` 1 800 riviä yhdessä
  tiedostossa.** Ei kiireellinen; pilkotaan kun niihin seuraavan kerran
  kosketaan (erä 2 ja 3).
- **iOS-Safarilla todentamatta**: blobin tallennus kantaan, näppäimistön
  käsittely ja Dropbox-luvat on testattu vain CI:n WebKitillä tai ei lainkaan.

Aiemmin sovittua, vielä tekemättä: äänitiedoston liittäminen lauluun, laulun
monistus, ohje kotiruudulle asentamiseen.
