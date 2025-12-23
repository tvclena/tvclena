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
  const req = event.request;
  const url = new URL(req.url);

  // 🚫 NUNCA interceptar métodos que NÃO sejam GET
  if (req.method !== "GET") {
    return; // deixa o browser cuidar
  }

  /**
   * ❌ NUNCA CACHEAR:
   * - Supabase
   * - APIs
   * - Analytics
   */
  if (
    url.hostname.includes("supabase.co") ||
    url.pathname.startsWith("/api") ||
    url.pathname.includes("/analytics") ||
    url.pathname.includes("/metrics")
  ) {
    event.respondWith(fetch(req));
    return;
  }

  /**
   * 🎬 CDN / imagens / vídeos
   * (online-first, sem cache manual)
   */
  if (url.hostname.includes("b-cdn.net")) {
    event.respondWith(fetch(req));
    return;
  }

  /**
   * ✅ NETWORK FIRST (HTML, JS, CSS)
   */
  event.respondWith(
    fetch(req)
      .then(response => {
        // só cacheia resposta válida
        if (
          !response ||
          response.status !== 200 ||
          response.type !== "basic"
        ) {
          return response;
        }

        const responseClone = response.clone();

        caches.open(CACHE_NAME).then(cache => {
          cache.put(req, responseClone);
        });

        return response;
      })
      .catch(() => {
        return caches.match(req);
      })
  );
});

