# Katselmoijan muisti

Ei konfiguraatiota: pelkkä muistilista toistuvista kaavoista. Lue ennen
katselmointia, päivitä katselmoinnin jälkeen.

## Mikä vika johti mihinkin sääntöön

- **Ladonta tulosteessa.** `SongSheet` on editorissa `display: none`.
  `getBoundingClientRect()` palautti nollat ja tuloste rikkoutui julkaisuun
  asti. Siksi: ei mittauksia tulosteen polulla, `getComputedStyle().fontSize`
  kelpaa.
- **Merkintöjen em-koordinaatisto.** Lehti ladotaan uudelleen jokaisesta
  muokkauksesta; pikseli ja prosentti irrottivat merkinnät kirjaimista.
- **Osumatesti lehden tasolle.** Veto ulottuu rivin ulkopuolelle
  (`overflow: visible`), joten rivin sisäinen osumatesti ei kattanut sitä.
- **Tuonti yhdistää.** `importLibrary` ylikirjoitti ennen kaiken, ja kahdella
  laitteella uudempi työ palautui vanhaan asuunsa (`sync/merge.ts`).

## Toistuvat kaavat katselmoinneissa

- **Sama sääntö kahdessa paikassa on tämän repon tavallisin huomautus.**
  Toistui tagi-katselmoinnissa: `collator` vietiin oikein ulos
  `sortSongs.ts`:stä, mutta `.tag-bar`-CSS oli tavu tavulta `.sort-bar`in
  kopio, ja tagien samuusvertailu (`sameTag`) ohitettiin yhdessä paikassa
  raa'alla `!==`-vertailulla (`SongEditor`in poistochip).
- **Chipien päälle–pois-logiikka sekoittaa sulkeuman ja `prev`in.** Kaava:
  `setX((prev) => paalla(tag) ? ... )`, jossa `paalla` lukee render-ajan tilaa.
  Sama vaaraluokka kuin «yksi tapahtuma per kierros» piirtokerroksessa.
  Korjaus: päätös kokonaan updaterin sisällä.
- **Vertailumuoto ei saa riippua käyttöliittymän kielestä**, aakkostus saa.
  `toLocaleLowerCase('fi')` kiinteänä on oikein, mutta vaatii «miksi»-kommentin,
  koska se näyttää vieressä olevan `collator(lang)`in rinnalla virheeltä.
- **Valinnainen kenttä tunnetussa tietuelajissa ei nosta `BUNDLE_VERSION`ia.**
  Tarkistettu tageilla: `exportLibrary` kirjoittaa laulut sellaisinaan ja
  `saveSong(song)` tallettaa koko olion, `songOps` levittää `{...song}`, joten
  vanha versio sekä ohittaa että säilyttää tuntemattoman kentän. Uusi
  **tietuelaji** on eri asia ja nostaa version.
- **Listanäkymän hetkellinen suodatin pitää rajata olemassa olevaan dataan.**
  Pilvihaku tai tuonti voi viedä sen tagin/arvon jolla lista on suodatettu, ja
  valinta jäisi päälle ilman chippiä jolla sen purkaa. `SongList` unmounttaa
  editoriin siirryttäessä, joten vuoto tulee vain listassa tapahtuvasta
  kirjaston vaihtumisesta.
- **Rinnakkaisajo voi kaatua satunnaisesti** (sama origin, sama IndexedDB).
  Koko `test:e2e:chromium` on silti mennyt läpi rinnakkain toistuvasti, joten
  kyse on heilunnasta eikä varmasta kaatumisesta: ennen kuin raportoit
  rinnakkaisajon kaatumisen haaran vikana, toista se `--workers=1`:llä.
- **Työpuu voi muuttua kesken katselmoinnin.** Tagi-katselmoinnissa
  `filterByTags` oli hetken `.some()` (laajentava) kesken tekijän muokkausta ja
  palasi `.every()`:ksi. Tarkista tiedostojen tila uudelleen ennen raporttia.
