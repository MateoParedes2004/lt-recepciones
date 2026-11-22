// Service worker de la app del panel (panel.ltrecepciones.com.py).
//
// Hace solo dos cosas, a propósito:
//  1. Permite que el celular ofrezca "Instalar app" (Chrome lo pide).
//  2. Si no hay internet, en vez del error del navegador muestra /offline.html.
//
// NO guarda datos del negocio ni respuestas del servidor: precios, stock y
// presupuestos siempre se leen en vivo (un dato viejo en un presupuesto sería
// peor que no tenerlo). Las páginas también se piden siempre a internet, así
// cada vez que se abre la app ya está la última versión publicada.
const VERSION = "lt-panel-v1";
const OFFLINE_URL = "/offline.html";
// Lo único que se guarda: la pantalla "Sin conexión" y el ícono que muestra.
const OFFLINE_FILES = [OFFLINE_URL, "/panel-icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(OFFLINE_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== VERSION) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // La apertura de páginas: siempre de internet; si no hay, la pantalla propia.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) || Response.error()));
    return;
  }
  // El ícono de esa pantalla: de internet y, sin conexión, el guardado (si no, se vería roto).
  const url = new URL(request.url);
  if (url.origin === self.location.origin && OFFLINE_FILES.includes(url.pathname)) {
    event.respondWith(fetch(request).catch(async () => (await caches.match(url.pathname)) || Response.error()));
  }
  // Todo lo demás (datos del servidor, imágenes, código) sigue su camino normal.
});
