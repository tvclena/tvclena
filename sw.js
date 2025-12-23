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
  // 🚨 NUNCA INTERCEPTAR MÉTODOS QUE NÃO SEJAM GET
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);

  // ❌ NÃO CACHEAR API / SUPABASE
  if (
    url.pathname.startsWith("/api") ||
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("b-cdn.net")
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // ✅ NETWORK FIRST
  event.respondWith(
    fetch(event.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, clone);
        });
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
