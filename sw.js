const CACHE_NAME = "sessao-cache-v6";

const FILES_TO_CACHE = [
  "/",
  "/index.html",
  "/login.html",
  "/player.html",
  "/manifest.json",
  "/logo1.png"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE))
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(k => k !== CACHE_NAME && caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  // 🚫 NÃO CACHEAR AVATAR
  if (
    url.pathname.includes("/storage/v1/object/public/avatars")
  ) {
    return; // sempre da rede
  }

  event.respondWith(
    caches.match(event.request).then(res => {
      return res || fetch(event.request);
    })
  );
});
