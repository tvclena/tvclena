// 🔴 MUDE A VERSÃO SEMPRE QUE ATUALIZAR
const CACHE_NAME = "sessao-cache-v6";

// ✅ SOMENTE ARQUIVOS ESTÁTICOS
const FILES_TO_CACHE = [
  "/",
  "/index.html",
  "/login.html",
  "/player.html",
  "/manifest.json",
  "/logo1.png",
  "/env.js"
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

  // ❌ NUNCA interceptar APIs
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // ❌ NÃO cachear Supabase
  if (url.hostname.includes("supabase.co")) {
    return;
  }

  // ❌ CDN / vídeos / imagens → sempre online
  if (url.hostname.includes("b-cdn.net")) {
    return;
  }

  // ❌ NÃO cachear POST / PUT / DELETE
  if (event.request.method !== "GET") {
    return;
  }

  // ✅ NETWORK FIRST para GET
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
