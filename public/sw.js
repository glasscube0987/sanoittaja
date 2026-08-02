/*
 * Service worker: sovelluskuori välimuistiin, jotta äppi käynnistyy offline.
 * Navigointi verkosta ensin (tuoreet versiot), Viten hashatut assetit
 * välimuistista (nimi vaihtuu kun sisältö muuttuu), muut samasta originista
 * välimuistista mutta taustalla revalidoiden.
 */
const CACHE = 'sanoittaja-v2';
const KUORI = ['./', './manifest.webmanifest', './icon.svg'];

/*
 * Vite kirjoittaa buildatut assetit assets/-kansioon sisältöhashatulla nimellä,
 * joten tiedoston sisältö ei voi muuttua saman nimen alla. Ne kelpaavat
 * välimuistista sellaisenaan; kaikki muu voi muuttua nimeään vaihtamatta.
 */
const hashattuAssetti = (url) => url.pathname.includes('/assets/');

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(KUORI)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(verkostaEnsin(event));
    return;
  }

  event.respondWith(hashattuAssetti(url) ? valimuististaEnsin(event) : revalidoiTaustalla(event));
});

function verkostaEnsin(event) {
  return fetch(event.request)
    .then((res) => {
      if (res.ok) event.waitUntil(caches.open(CACHE).then((cache) => cache.put('./', res.clone())));
      return res;
    })
    .catch(() => caches.match('./'));
}

function valimuististaEnsin(event) {
  return caches.open(CACHE).then((cache) =>
    cache.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((res) => {
          if (res.ok) event.waitUntil(cache.put(event.request, res.clone()));
          return res;
        }),
    ),
  );
}

function revalidoiTaustalla(event) {
  return caches.open(CACHE).then((cache) =>
    cache.match(event.request).then((cached) => {
      const verkko = fetch(event.request).then((res) => {
        if (res.ok) return cache.put(event.request, res.clone()).then(() => res);
        return res;
      });
      /*
       * Revalidointi jatkuu vaikka vastaus tarjottiin välimuistista, joten
       * waitUntil pitää workerin hengissä kunnes uusi versio on tallennettu.
       * Offline-tilassa haku kaatuu odotetusti, eikä se saa kaataa waitUntilia.
       */
      event.waitUntil(verkko.catch(() => {}));
      return cached || verkko;
    }),
  );
}
