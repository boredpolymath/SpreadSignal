const CACHE = "spreadsignal-v45";
const ASSETS = ["./", "./index.html", "./styles.css", "./data-service.js", "./app.js", "./manifest.webmanifest", "./icon.svg", "./spreadsignal-lockup.svg"];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const isAppShell = event.request.mode === "navigate" || ASSETS.some(asset => new URL(asset, self.location).pathname === new URL(event.request.url).pathname);
  if (isAppShell) {
    event.respondWith(fetch(event.request).then(response => { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); return response; }).catch(() => caches.match(event.request).then(cached => cached || caches.match("./index.html"))));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
