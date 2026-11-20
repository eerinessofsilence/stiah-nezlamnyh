const CACHE_NAME = "nezlamnyi-v48";
const APP_FILES = [
  "./",
  "./styles.css?v=33",
  "./catalog.js?v=25",
  "./mobile/src/search.js?v=6",
  "./app.js?v=25",
  "./assistant.js?v=27",
  "./assets/assistant-coast-wide.webp",
  "./manifest.webmanifest?v=23",
  "./assets/icon.svg?v=21",
  "./assets/icon-192.png?v=21",
  "./assets/icon-512.png?v=21",
  "./assets/apple-touch-icon.png?v=21",
  "./assets/brand-logo.svg",
  "./public/fonts/e-Ukraine-Regular.woff2",
  "./public/fonts/e-Ukraine-Medium.woff2",
  "./public/fonts/e-Ukraine-Bold.woff2"
];
const scope = self.registration.scope;
const shell = new URL("./", scope);
const indexPath = new URL("index.html", scope).pathname;
const assetUrls = new Set(APP_FILES.map(file => new URL(file, scope).href));

function fromCache(request) {
  return caches.open(CACHE_NAME).then(cache => cache.match(request));
}

async function navigate(request) {
  let response;
  try {
    response = await fetch(request, {cache: "no-cache"});
    if (response.status < 500) return response;
  } catch {
    // The guide can still open from its installed cache.
  }
  return (await fromCache(shell.href)) || response || Response.error();
}

self.addEventListener("install", function (event) {
  event.waitUntil(caches.open(CACHE_NAME).then(function (cache) {
    return cache.addAll(APP_FILES);
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (key) { return key.startsWith("nezlamnyi-") && key !== CACHE_NAME; }).map(function (key) { return caches.delete(key); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (event) {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    if (url.pathname === shell.pathname || url.pathname === indexPath) {
      event.respondWith(navigate(event.request));
    }
    return;
  }

  if (assetUrls.has(url.href)) {
    event.respondWith(fromCache(event.request).then(cached => cached || fetch(event.request)));
  }
});
