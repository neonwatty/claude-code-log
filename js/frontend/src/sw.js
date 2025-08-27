/**
 * Claude Code Log Service Worker
 * Provides offline functionality and performance optimization
 */

const CACHE_NAME = 'claude-code-log-v1';
const RUNTIME_CACHE_NAME = 'claude-code-log-runtime';
const OFFLINE_PAGE_URL = '/offline.html';

// Resources to cache during service worker installation
const STATIC_CACHE_URLS = [
  '/',
  '/index.html',
  '/src/app.ts',
  '/src/styles/shared/global.css',
  '/src/styles/shared/variables.css',
  // Add more static assets as needed
];

// Routes that should be cached with a network-first strategy
const NETWORK_FIRST_ROUTES = [
  '/api/',
  '/sessions/',
  '/projects/',
];

// Routes that should be cached with a cache-first strategy (static assets)
const CACHE_FIRST_ROUTES = [
  '/assets/',
  '/static/',
  '.css',
  '.js',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.svg',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.ico',
];

/**
 * Service Worker Installation
 */
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => {
        // Force activation of this service worker
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker installation failed:', error);
      })
  );
});

/**
 * Service Worker Activation
 */
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE_NAME;
            })
            .map((cacheName) => {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      }),
      // Take control of all pages immediately
      self.clients.claim()
    ])
  );
});

/**
 * Fetch Event Handler - Main caching strategy
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests and non-GET requests
  if (url.origin !== location.origin || request.method !== 'GET') {
    return;
  }

  // Determine caching strategy based on request URL
  if (shouldUseNetworkFirst(request.url)) {
    event.respondWith(networkFirstStrategy(request));
  } else if (shouldUseCacheFirst(request.url)) {
    event.respondWith(cacheFirstStrategy(request));
  } else {
    event.respondWith(staleWhileRevalidateStrategy(request));
  }
});

/**
 * Background Sync for offline data
 */
self.addEventListener('sync', (event) => {
  console.log('Background sync triggered:', event.tag);
  
  if (event.tag === 'offline-data-sync') {
    event.waitUntil(syncOfflineData());
  }
});

/**
 * Message handling from main thread
 */
self.addEventListener('message', (event) => {
  const { type, payload } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CACHE_SESSION_DATA':
      event.waitUntil(cacheSessionData(payload));
      break;
      
    case 'GET_CACHE_STATUS':
      event.waitUntil(getCacheStatus().then((status) => {
        event.ports[0].postMessage(status);
      }));
      break;
      
    case 'CLEAR_CACHE':
      event.waitUntil(clearCache().then(() => {
        event.ports[0].postMessage({ success: true });
      }));
      break;
      
    default:
      console.log('Unknown message type:', type);
  }
});

/**
 * Network-First Strategy
 * Try network first, fall back to cache
 */
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.status === 200) {
      const cache = await caches.open(RUNTIME_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Network failed, trying cache:', request.url);
    
    // Try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // If it's a navigation request and we have an offline page, serve it
    if (request.mode === 'navigate') {
      const offlinePage = await caches.match(OFFLINE_PAGE_URL);
      if (offlinePage) {
        return offlinePage;
      }
    }
    
    // Return a basic offline response
    return new Response(
      JSON.stringify({
        error: 'Offline',
        message: 'No network connection and no cached response available'
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * Cache-First Strategy
 * Try cache first, fall back to network
 */
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('Failed to fetch resource:', request.url, error);
    throw error;
  }
}

/**
 * Stale-While-Revalidate Strategy
 * Serve from cache immediately, update cache in background
 */
async function staleWhileRevalidateStrategy(request) {
  const cache = await caches.open(RUNTIME_CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  // Fetch from network in background
  const networkResponsePromise = fetch(request).then((response) => {
    if (response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch((error) => {
    console.log('Background fetch failed:', request.url, error);
  });
  
  // Return cached response immediately or wait for network
  return cachedResponse || networkResponsePromise;
}

/**
 * Cache session data for offline access
 */
async function cacheSessionData(sessionData) {
  try {
    const cache = await caches.open(RUNTIME_CACHE_NAME);
    const response = new Response(JSON.stringify(sessionData), {
      headers: { 'Content-Type': 'application/json' }
    });
    
    await cache.put(`/offline-session/${sessionData.id}`, response);
    console.log('Cached session data:', sessionData.id);
  } catch (error) {
    console.error('Failed to cache session data:', error);
  }
}

/**
 * Sync offline data when connection is restored
 */
async function syncOfflineData() {
  try {
    // Get offline data from IndexedDB (would integrate with OfflineService)
    const response = await fetch('/api/sync-offline-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sync' })
    });
    
    if (response.ok) {
      console.log('Offline data synced successfully');
    } else {
      console.error('Failed to sync offline data:', response.status);
    }
  } catch (error) {
    console.error('Sync operation failed:', error);
    throw error; // This will cause the sync to be retried
  }
}

/**
 * Get cache status information
 */
async function getCacheStatus() {
  try {
    const cacheNames = await caches.keys();
    const status = {};
    
    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      status[cacheName] = {
        entries: keys.length,
        urls: keys.map(req => req.url)
      };
    }
    
    return status;
  } catch (error) {
    console.error('Failed to get cache status:', error);
    return { error: error.message };
  }
}

/**
 * Clear all caches
 */
async function clearCache() {
  try {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    console.log('All caches cleared');
  } catch (error) {
    console.error('Failed to clear cache:', error);
    throw error;
  }
}

/**
 * Determine if URL should use network-first strategy
 */
function shouldUseNetworkFirst(url) {
  return NETWORK_FIRST_ROUTES.some(route => url.includes(route));
}

/**
 * Determine if URL should use cache-first strategy
 */
function shouldUseCacheFirst(url) {
  return CACHE_FIRST_ROUTES.some(route => url.includes(route));
}

/**
 * Request background sync when offline
 */
function requestBackgroundSync() {
  if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
    navigator.serviceWorker.ready.then((registration) => {
      return registration.sync.register('offline-data-sync');
    }).catch((error) => {
      console.error('Background sync registration failed:', error);
    });
  }
}

// Notify main thread when service worker is ready
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({
      version: CACHE_NAME,
      ready: true
    });
  }
});

console.log('Service Worker loaded:', CACHE_NAME);