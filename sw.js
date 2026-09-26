/* Offline support.

   - App files (this site): network first, so an update you upload shows up
     right away; the saved copy is used when there's no connection.
   - Firebase SDK (gstatic): saved copy first -- those URLs never change.
   - Photos: saved copy first (a photo's address never changes once uploaded),
     so the timeline scrolls fast and works with no signal. Cleared on sign-out.
   - Everything else (database, login) goes straight to the network.
     Firestore keeps its own offline copy of the timeline. */
const APP_CACHE = 'aw-app-v10';
const PHOTO_CACHE = 'aw-photos-v2'; // v1 could hold failed downloads; it's cleared on update
const APP_FILES = [
  './', 'index.html', 'styles.css', 'app.js', 'store.js', 'demo.js', 'dates.js', 'photos.js', 'todo.js', 'books.js', 'now.js', 'words.js', 'letters.js', 'seasons.js',
  'firebase-config.js', 'manifest.json', 'icon-192.png', 'apple-touch-icon.png',
];
const SDK = ['app', 'auth', 'firestore', 'storage', 'functions']
  .map(name => `https://www.gstatic.com/firebasejs/10.14.1/firebase-${name}-compat.js`);
const HOME = new URL('./', self.location).href;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(APP_CACHE)
      .then(cache => Promise.allSettled([...APP_FILES, ...SDK].map(url => cache.add(url))))
      .then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== APP_CACHE && k !== PHOTO_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()));
});

// On a weak signal, don't wait forever for the network: after 3 seconds the
// saved copy is used (airplane mode fails right away anyway).
function fetchWithin(request, ms) {
  return Promise.race([
    fetch(request),
    new Promise((_, reject) => setTimeout(() => reject(new Error('slow network')), ms)),
  ]);
}

async function networkFirst(request, key = request) {
  const cache = await caches.open(APP_CACHE);
  try {
    const response = await fetchWithin(request, 3000);
    if (response.ok) cache.put(key, response.clone());
    return response;
  } catch (err) {
    const saved = await cache.match(key);
    if (saved) return saved;
    throw err;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const saved = await cache.match(request);
  if (saved) return saved;
  const response = await fetch(request);
  // Opaque = an <img> from another site; it can't be inspected but can be saved.
  if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
  return response;
}

// Photos: saved copy first. The download is made in a way that shows whether
// it really worked (the bucket allows this site), and only good ones are saved,
// so a hiccup while loading many photos can't get stuck as a broken picture.
async function photo(request) {
  const cache = await caches.open(PHOTO_CACHE);
  const saved = await cache.match(request.url);
  if (saved) return saved;
  try {
    const response = await fetch(request.url, { mode: 'cors', credentials: 'omit' });
    if (response.ok) cache.put(request.url, response.clone());
    return response;
  } catch (err) {
    return fetch(request); // plain load as a fallback; not saved
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    event.respondWith(request.mode === 'navigate' ? networkFirst(request, HOME) : networkFirst(request));
  } else if (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) {
    event.respondWith(cacheFirst(request, APP_CACHE));
  } else if (url.hostname === 'firebasestorage.googleapis.com') {
    event.respondWith(photo(request));
  }
});
