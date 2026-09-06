// Kharchā service worker — makes the app shell (HTML/CSS/JS) load with no
// network connection at all, not just "fast to load". The app's actual
// data already works offline (everything is saved to localStorage first;
// Supabase sync and Google Sign-In are optional extras that already fail
// gracefully when there's no connection — see initAuth() in main.js) —
// this file is the missing piece that lets the *page itself* open at all
// with zero connectivity, which is what real PWA installability needs.
//
// Strategy: "network first, falling back to cache" for the shell files.
// That means anyone online always gets the latest deployed version (no
// stuck-on-old-version problem), and the most recently-fetched copy is
// what's served the moment they lose connection.
//
// Bump CACHE_VERSION whenever this file's precache list changes, so old
// caches get cleaned up on the next visit instead of accumulating forever.
const CACHE_VERSION = "v1";
const CACHE_NAME = `kharcha-shell-${CACHE_VERSION}`;

// Deliberately just the app shell — not manifest.json (its real deployed
// URL depends on Vite's asset hashing, isn't knowable here, and a single
// missing file would fail this whole precache step) and not any
// cross-origin script (Google/Supabase SDKs) or Google Fonts.
const SHELL_ASSETS = ["/", "/index.html", "/main.js", "/styles/main.css"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // Only handle same-origin GET requests — Supabase calls, the Google
  // Sign-In script, Google Fonts, and any POST/PUT always go straight to
  // the network untouched, exactly as if this service worker didn't exist.
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        return res;
      })
      .catch(() =>
        caches.match(req).then((cached) => cached || caches.match("/index.html"))
      )
  );
});
