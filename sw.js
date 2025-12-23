const CACHE_NAME = "clena-cache-v12";

self.addEventListener("install", e => {
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k=>{
        if(k !== CACHE_NAME) return caches.delete(k);
      }))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  // ❌ NÃO cache API
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  e.respondWith(fetch(e.request));
});
