// 🔴 MUDE A VERSÃO SEMPRE QUE ATUALIZAR
const CACHE_NAME = "sessao-cache-v5";

// ✅ SOMENTE ARQUIVOS ESTÁTICOS
const FILES_TO_CACHE = [
  "/",
  "/index.html",
  "/login.html",
  "/player.html",
  "/manifest.json",
  "/logo1.png"
];

/* ================= INSTALL ================= */
self.addEventListener("install", event => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(FILES_TO_CACHE);
    })
  );
});

/* ================= ACTIVATE ================= */
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );

  self.clients.claim();
});

/* ================= FETCH ================= */
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  /**
   * ❌ NUNCA CACHEAR:
   * - Supabase
   * - Analytics / métricas
   * - APIs
   */
  if (
    url.hostname.includes("supabase.co") ||
    url.pathname.includes("/analytics") ||
    url.pathname.includes("/metrics")
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  /**
   * 🎬 CDN / imagens / vídeos
   * (sempre online-first)
   */
  if (url.hostname.includes("b-cdn.net")) {
    event.respondWith(fetch(event.request));
    return;
  }

  /**
   * ✅ NETWORK FIRST (app normal)
   */
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const responseClone = response.clone();

        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });

        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
