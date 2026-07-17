// Service worker for the static-hosted client (C2). Stamped per build by build-static.js
// (v7.52 → the visible version), so every deploy is a NEW worker that activates immediately.
//
// Strategy: NETWORK-FIRST for every same-origin GET, cache as fallback. This repo's hardest-won
// lesson is stale cache masking deploys (AGENTS rule 14) — so the worker is deliberately never
// allowed to serve stale content while online. Offline gets the last-seen shell; the app's own
// localStorage/IndexedDB layers already handle offline DATA.
// POSTs (the GAS API) and cross-origin requests (fonts, the /exec redirect chain) pass through
// untouched — the worker must never sit between the client and the API.
const CACHE = 'garden-log-v7.52';

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest'])));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req, { ignoreSearch: true })
          .then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined))
      )
  );
});
