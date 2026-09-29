const CACHE_NAME = 'eco-plus-shell-v5';
const APP_SHELL = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'manifest.json',
  'icons/icon.svg',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png'
].map(path => new URL(path, self.registration.scope).href);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL.map(url => new Request(url, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => (key.startsWith('eco-plus-shell-') || key === 'meu-dinheiro-shell-v1') && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);
  const scopeUrl = new URL(self.registration.scope);
  if (requestUrl.origin !== scopeUrl.origin || !requestUrl.pathname.startsWith(scopeUrl.pathname)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const request = new Request(event.request, { cache: 'no-cache' });
      const response = await fetch(request);
      if (response.ok) await cache.put(event.request, response.clone());
      return response;
    } catch {
      const cached = await cache.match(event.request, { ignoreSearch: event.request.mode === 'navigate' });
      if (cached) return cached;
      if (event.request.mode === 'navigate') {
        const appEntry = await cache.match(new URL('index.html', scopeUrl).href);
        if (appEntry) return appEntry;
      }
      throw new Error('Recurso indisponível offline');
    }
  })());
});