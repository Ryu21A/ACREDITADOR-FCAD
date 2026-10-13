const CACHE_NAME = "acreditador-fcad-v2";
const TIMEOUT_RED_MS = 3000;
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap",
  "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Pide a la red, pero si no responde en `ms` milisegundos, falla
// para que se use la copia guardada en caché.
function fetchConTimeout(req, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    fetch(req).then(
      (res) => { clearTimeout(t); resolve(res); },
      (err) => { clearTimeout(t); reject(err); }
    );
  });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const esPropio = new URL(req.url).origin === self.location.origin;

  if (esPropio) {
    // Archivos propios (index.html, manifest.json): network-first.
    // Con internet siempre toma la versión más nueva y la guarda;
    // sin internet (o con wifi sin salida) usa la copia en caché.
    event.respondWith(
      fetchConTimeout(req, TIMEOUT_RED_MS)
        .then((res) => {
          if (res && res.ok) {
            const copia = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copia));
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then((r) => r || caches.match("./index.html"))
        )
    );
  } else {
    // Librerías y fuentes externas: cache-first (no cambian).
    event.respondWith(
      caches.match(req).then((r) => r || fetch(req))
    );
  }
});
