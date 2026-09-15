import { expect, test } from '@playwright/test';
import { avaaLista, DB_VERSION } from './apu';

/**
 * Ottaako selaimen IndexedDB vastaan Blobin.
 *
 * Nauhoite on ainoa tietue jossa on Blob, eikä sitä ollut katettu
 * selaintestillä ennen idean talteenottoa. Kate paljasti heti eron
 * moottorien välillä, ja tämä testi pitää sen eron näkyvissä.
 *
 * Playwrightin WebKit ajaa kannan väliaikaisessa istunnossa ilman
 * levytallennusta, ja blobi tallentuu WebKitissä **tiedostona**. Siksi
 * kirjoitus katkeaa virheeseen «Error preparing Blob/File data». Rajoite on
 * testiympäristön, ei sovelluksen: sama tietue ilman blobia menee läpi.
 *
 * Tämä on tarkoituksella *väite* eikä ohitus. Jos WebKit alkaa jonain päivänä
 * ottaa blobin vastaan, testi kaatuu ja silloin `idea.spec.ts`:n
 * kantatarkistukset kuuluu ottaa käyttöön myös siellä.
 */
test('kanta ottaa vastaan blobin', async ({ page, browserName }) => {
  await avaaLista(page);

  const tulos = await page.evaluate(
    (versio) =>
      new Promise<Record<string, string>>((resolve) => {
        const raportti: Record<string, string> = {};
        const virheeksi = (e: unknown) => (e instanceof Error ? `${e.name}: ${e.message}` : String(e));

        const req = indexedDB.open('sanoittaja', versio);
        req.onerror = () => resolve({ avaus: virheeksi(req.error) });
        req.onsuccess = () => {
          const db = req.result;

          const kirjoita = (id: string, rec: Record<string, unknown>, nimi: string) =>
            new Promise<void>((valmis) => {
              let tx: IDBTransaction;
              try {
                tx = db.transaction('recordings', 'readwrite');
                tx.objectStore('recordings').put({ id, songId: 'testi', name: id, createdAt: 1, ...rec });
              } catch (e) {
                raportti[nimi] = `heitti: ${virheeksi(e)}`;
                valmis();
                return;
              }
              tx.oncomplete = () => {
                raportti[nimi] = 'ok';
                valmis();
              };
              tx.onerror = () => {
                raportti[nimi] = `tx: ${virheeksi(tx.error)}`;
                valmis();
              };
              tx.onabort = () => {
                raportti[nimi] = `abort: ${virheeksi(tx.error)}`;
                valmis();
              };
            });

          kirjoita('ilman', { durationMs: 1 }, 'ilmanBlobia')
            .then(() =>
              kirjoita('blobilla', { blob: new Blob(['aani'], { type: 'audio/mp4' }) }, 'blobilla'),
            )
            .then(
              () =>
                new Promise<void>((valmis) => {
                  const haku = db.transaction('recordings').objectStore('recordings').getAll();
                  haku.onsuccess = () => {
                    const rivit = haku.result as { id: string; blob?: Blob }[];
                    const blobi = rivit.find((r) => r.id === 'blobilla');
                    raportti.luettu = rivit.map((r) => r.id).sort().join(',');
                    raportti.blobKoko = blobi?.blob ? String(blobi.blob.size) : 'ei blobia';
                    valmis();
                  };
                  haku.onerror = () => {
                    raportti.luettu = `virhe: ${virheeksi(haku.error)}`;
                    valmis();
                  };
                }),
            )
            .then(() => resolve(raportti));
        };
      }),
    DB_VERSION,
  );

  if (browserName === 'webkit') {
    // Blobiton tietue menee läpi samassa transaktiossa – ero on vain blobissa.
    expect(tulos.ilmanBlobia).toBe('ok');
    expect(tulos.blobilla).toContain('Error preparing Blob/File data');
    expect(tulos.luettu).toBe('ilman');
    return;
  }

  expect(tulos).toEqual({
    ilmanBlobia: 'ok',
    blobilla: 'ok',
    luettu: 'blobilla,ilman',
    blobKoko: '4',
  });
});
