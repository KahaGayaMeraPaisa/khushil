const CACHE_NAME = 'khushil-ultra-v2';
const SHARE_CACHE = 'khushil-share-cache';
const ASSETS = ['/', '/style.css', '/fx.js', '/app.js', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== SHARE_CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Intercept Android / WhatsApp Share -> Khushil
  if (e.request.method === 'POST' && url.pathname === '/share-target') {
    e.respondWith((async () => {
      try {
        const formData = await e.request.formData();
        const file = formData.get('media');
        const text = formData.get('text') || formData.get('title') || formData.get('url') || '';
        const cache = await caches.open(SHARE_CACHE);
        if (file && typeof file.arrayBuffer === 'function') {
          const buf = await file.arrayBuffer();
          await cache.put('/shared-media', new Response(buf, {
            headers: {
              'Content-Type': file.type || 'image/webp',
              'X-Shared-Name': encodeURIComponent(file.name || 'sticker.webp'),
              'X-Shared-Text': encodeURIComponent(String(text))
            }
          }));
          return Response.redirect('/?shared=media', 303);
        }
        if (text) {
          await cache.put('/shared-text', new Response(String(text)));
          return Response.redirect('/?shared=text', 303);
        }
      } catch (err) {
        console.error('Share target error:', err);
      }
      return Response.redirect('/', 303);
    })());
    return;
  }

  if (e.request.method !== 'GET' || url.pathname.startsWith('/socket.io/') || url.pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
