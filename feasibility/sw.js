// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// T2b (feasibility/README.md): the service worker of the Pages test page. Caches the page, the manifest and the
// pixel on install and answers every request from the cache, so the page loads with the server stopped.
/* global self, caches, fetch */

const CACHE = "feasibility-pages-v1";
const FILES = ["./", "index.html", "manifest.webmanifest", "pixel.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(caches.match(event.request, { ignoreSearch: true }).then((cached) => cached ?? fetch(event.request)));
});
