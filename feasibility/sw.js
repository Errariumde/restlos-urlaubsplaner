// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// T2b (feasibility/README.md): the service worker of the Pages test page. Caches the page, the manifest and the
// pixel on install and answers every request from the cache, so the page loads with the server stopped.
/* global self, caches, fetch, URL */

const CACHE = "feasibility-pages-v1";
const FILES = ["./", "index.html", "manifest.webmanifest", "pixel.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Tells every open page when the manifest is requested (T2b P1-manifest-fetched): proof the browser fetched it.
function reportManifest(url) {
  return self.clients.matchAll().then((clients) => {
    for (const client of clients) client.postMessage({ type: "manifest-fetched", url, time: new Date().toISOString() });
  });
}

self.addEventListener("fetch", (event) => {
  if (new URL(event.request.url).pathname.endsWith("/manifest.webmanifest")) event.waitUntil(reportManifest(event.request.url));
  event.respondWith(caches.match(event.request, { ignoreSearch: true }).then((cached) => cached ?? fetch(event.request)));
});
