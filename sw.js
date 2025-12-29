const CACHE_NAME = "clena-cache-v21";

/* =============================
   🔧 INSTALL
============================= */
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

/* =============================
   🚀 ACTIVATE
============================= */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* =============================
   🌐 FETCH
============================= */
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  /* =============================
     🚫 NUNCA INTERCEPTAR APIs
     (PAGAMENTOS, WEBHOOKS, RPCs)
  ============================= */
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  /* =============================
     🚫 NÃO CACHEAR STORAGE / CDN
  ============================= */
  if (
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("supabase.in") ||
    url.hostname.includes("bunnycdn") ||
    url.hostname.includes("b-cdn.net") ||
    url.pathname.includes("/avatars/")
  ) {
    return;
  }

  /* =============================
     ✅ NETWORK FIRST (SEGURO)
  ============================= */
  event.respondWith(
    fetch(request)
      .then((response) => {
        // cache apenas GET válidos
        if (
          request.method === "GET" &&
          response.status === 200 &&
          response.type === "basic"
        ) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
