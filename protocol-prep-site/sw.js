// Offline cache for Garrard Protocol Prep. Bump VERSION when index.html changes.
const VERSION = 'gcpp-8b15f0cb';
const CORE = ['./', './index.html', './data.enc', './manifest.webmanifest', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'];
const FONT_CSS = "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Public+Sans:wght@400;500;600;700&display=swap";
const FONT_HOST = /(^|\.)fonts\.(googleapis|gstatic)\.com$/;

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(CORE);
    try { // fonts are optional: the app falls back to system fonts
      const r = await fetch(FONT_CSS, { mode: 'cors' });
      if (r.ok) {
        await c.put(FONT_CSS, r.clone());
        const css = await r.text();
        const urls = [...css.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1]);
        await Promise.all(urls.map((u) => fetch(u, { mode: 'cors' }).then((res) => res.ok && c.put(u, res)).catch(() => {})));
      }
    } catch (_) {}
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate') {
    // App shell: serve the cached copy instantly, refresh it in the background for next launch.
    const net = fetch(req).then(async (r) => { if (r.ok) { const c = await caches.open(VERSION); await c.put('./index.html', r.clone()); } return r; }).catch(() => null);
    e.waitUntil(net);
    e.respondWith((async () => {
      const c = await caches.open(VERSION);
      return (await c.match('./index.html')) || (await c.match('./')) || (await net) || new Response('Offline and not cached yet. Open once with a connection.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
    })());
    return;
  }
  if (url.origin !== location.origin && !FONT_HOST.test(url.hostname)) return;
  e.respondWith((async () => {
    const c = await caches.open(VERSION);
    const hit = await c.match(req);
    if (hit) return hit;
    try {
      const r = await fetch(req);
      if (r.ok || r.type === 'opaque') c.put(req, r.clone());
      return r;
    } catch (_) {
      return Response.error();
    }
  })());
});
