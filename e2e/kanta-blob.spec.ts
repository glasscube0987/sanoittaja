import { expect, test } from '@playwright/test';
import { avaaLista, DB_VERSION } from './apu';

/**
 * Koetesti: ottaako selaimen IndexedDB vastaan Blobin.
 *
 * Nauhoite on ainoa tietue jossa on Blob, eikä sitä ollut ennen katettu
 * selaintestillä. Tämä erottaa kaksi mahdollisuutta toisistaan: vika on joko
 * testiympäristön kannassa tai oikeasti WebKitissä – ja jälkimmäinen
 * tarkoittaisi, etteivät nauhoitteet tallennu Safarissa lainkaan.
 */
test('kanta ottaa vastaan blobin', async ({ page }) => {
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

  expect(tulos).toEqual({
    ilmanBlobia: 'ok',
    blobilla: 'ok',
    luettu: 'blobilla,ilman',
    blobKoko: '4',
  });
});
