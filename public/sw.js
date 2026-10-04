/* Nexoro PDV Service Worker — cache de shell + fallback offline
 * Estratégia:
 * - App shell (HTML/JS/CSS): Cache First com atualização em background
 * - /api/*: Network Only (nunca cachear dados transacionais)
 * - Demais GET estáticos: Stale-While-Revalidate
 */
const CACHE = 'nexoro-shell-v1';
const SHELL = ['/painel.html', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Nunca cachear API / métodos mutáveis
  if (req.method !== 'GET' || url.pathname.startsWith('/api/') || url.pathname.includes('/api/')) {
    return;
  }

  // Navegação: tenta rede, cai no shell em cache
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match('/painel.html').then((r) => r || caches.match(req)))
    );
    return;
  }

  // Estáticos: stale-while-revalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
