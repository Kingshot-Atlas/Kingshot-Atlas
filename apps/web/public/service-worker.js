// Kingshot Atlas Service Worker
// Caches static assets and API responses for offline use

// IMPORTANT: This version is auto-updated by the build process
// When deploying, update this to force cache invalidation
const CACHE_VERSION = '20260129-v2';
const CACHE_NAME = `kingshot-atlas-${CACHE_VERSION}`;
const STATIC_CACHE = `kingshot-static-${CACHE_VERSION}`;
const API_CACHE = `kingshot-api-${CACHE_VERSION}`;
const IMAGE_CACHE = `kingshot-images-${CACHE_VERSION}`;

// Cache expiration times (in seconds)
const CACHE_EXPIRY = {
  api: 5 * 60,        // 5 minutes for API data
  images: 7 * 24 * 60 * 60,  // 7 days for images
  static: 30 * 24 * 60 * 60, // 30 days for static assets
};

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/Atlas Favicon.png'
];

// API endpoints that should be cached
const CACHEABLE_API_PATTERNS = [
  /\/api\/kingdoms/,
  /\/api\/leaderboard/,
  /\/api\/compare/,
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  const currentCaches = [STATIC_CACHE, API_CACHE, IMAGE_CACHE];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => !currentCaches.includes(name))
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Helper: Check if response is expired
function isExpired(response, maxAgeSeconds) {
  const dateHeader = response.headers.get('date');
  if (!dateHeader) return false;
  
  const responseDate = new Date(dateHeader).getTime();
  const now = Date.now();
  return (now - responseDate) > (maxAgeSeconds * 1000);
}

// Helper: Check if URL matches cacheable API patterns
function isCacheableApi(url) {
  return CACHEABLE_API_PATTERNS.some(pattern => pattern.test(url.pathname));
}

// Helper: Is image request
function isImageRequest(url) {
  return /\.(jpg|jpeg|png|gif|webp|svg|ico)$/i.test(url.pathname);
}

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // HTML files (especially index.html) - ALWAYS network first
  // This ensures users get the latest version with correct JS/CSS references
  if (request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Skip external resources (avatars, fonts, etc.) - let browser handle them
  if (url.origin !== self.location.origin) {
    return;
  }

  // Images - Cache first with long expiry (stale-while-revalidate)
  if (isImageRequest(url)) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        
        // Return cached immediately, but revalidate in background
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // API requests - Stale-while-revalidate for cacheable endpoints
  // Only cache our own API, not external ones
  if (url.pathname.startsWith('/api/') && url.origin === self.location.origin && isCacheableApi(url)) {
    event.respondWith(
      caches.open(API_CACHE).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        
        // Always fetch fresh data
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {
          // Return stale cache on network failure
          return cachedResponse;
        });

        // Return cached if available and not too old, otherwise wait for network
        if (cachedResponse && !isExpired(cachedResponse, CACHE_EXPIRY.api)) {
          // Return stale, revalidate in background
          fetchPromise.catch(() => {}); // Suppress unhandled rejection
          return cachedResponse;
        }
        
        return fetchPromise;
      })
    );
    return;
  }

  // Non-cacheable API requests - network only
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request));
    return;
  }

  // JS/CSS files with hash - cache first (immutable)
  if ((url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) && 
      url.pathname.includes('/static/')) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        
        return fetch(request).then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Other JS/CSS - network first
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Other static assets - network first with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// Listen for messages to skip waiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
