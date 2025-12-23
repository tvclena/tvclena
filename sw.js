const CACHE_NAME = "clena-cache-v20";

self.addEventListener("install", e => {
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const url = event.request.url;

  // 🚫 nunca cachear storage ou cdn
  if (
    url.includes("supabase.co/storage") ||
    url.includes("avatars") ||
    url.includes("b-cdn") ||
    url.includes("bunnycdn")
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
