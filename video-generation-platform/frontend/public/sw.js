// Service Worker for Video Generation Platform
// Advanced caching with offline support and background sync

const CACHE_VERSION = 'v2.1.0';
const CACHE_NAMES = {
  STATIC: `vgp-static-${CACHE_VERSION}`,
  DYNAMIC: `vgp-dynamic-${CACHE_VERSION}`,
  API: `vgp-api-${CACHE_VERSION}`,
  IMAGES: `vgp-images-${CACHE_VERSION}`,
  VIDEOS: `vgp-videos-${CACHE_VERSION}`,
  OFFLINE: `vgp-offline-${CACHE_VERSION}`
};

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/offline.html',
  '/static/js/main.js',
  '/static/css/main.css'
];

const API_CACHE_STRATEGIES = {
  // Cache first - for static data that rarely changes
  CACHE_FIRST: [
    '/api/v1/health',
    '/api/v1/video/templates',
    '/api/v1/system/config'
  ],

  // Network first - for dynamic data
  NETWORK_FIRST: [
    '/api/v1/video/status',
    '/api/v1/user/profile',
    '/api/v1/jobs'
  ],

  // Stale while revalidate - for data that can be slightly outdated
  STALE_WHILE_REVALIDATE: [
    '/api/v1/video/metadata',
    '/api/v1/system/stats',
    '/api/v1/user/preferences'
  ]
};

const CACHE_EXPIRY_TIMES = {
  STATIC: 7 * 24 * 60 * 60 * 1000, // 7 days
  API: 1 * 60 * 60 * 1000, // 1 hour
  IMAGES: 3 * 24 * 60 * 60 * 1000, // 3 days
  VIDEOS: 1 * 24 * 60 * 60 * 1000, // 1 day
  DYNAMIC: 1 * 60 * 60 * 1000 // 1 hour
};

// Performance monitoring
const performance = {
  cacheHits: 0,
  cacheMisses: 0,
  networkRequests: 0,
  backgroundSyncs: 0,
  errors: 0,

  incrementCounter(metric) {
    this[metric]++;
    this.reportMetrics();
  },

  reportMetrics() {
    // Report every 100 operations
    const total = this.cacheHits + this.cacheMisses + this.networkRequests;
    if (total % 100 === 0) {
      console.log('SW Performance:', {
        cacheHitRate: (this.cacheHits / total * 100).toFixed(2) + '%',
        totalOperations: total,
        backgroundSyncs: this.backgroundSyncs,
        errors: this.errors
      });
    }
  }
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');

  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(CACHE_NAMES.STATIC).then((cache) => {
        return cache.addAll(STATIC_ASSETS);
      }),

      // Cache offline page
      caches.open(CACHE_NAMES.OFFLINE).then((cache) => {
        return cache.add('/offline.html');
      })
    ]).then(() => {
      console.log('Service Worker installed successfully');
      self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');

  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (!Object.values(CACHE_NAMES).includes(cacheName)) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),

      // Take control of all clients immediately
      self.clients.claim()
    ]).then(() => {
      console.log('Service Worker activated successfully');

      // Initialize background sync
      initializeBackgroundSync();

      // Start cache cleanup routine
      schedulePeriodicCleanup();
    })
  );
});

// Fetch event - handle all network requests
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests and chrome-extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }

  // Route to appropriate caching strategy
  if (isStaticAsset(url)) {
    event.respondWith(handleStaticAsset(request));
  } else if (isAPIRequest(url)) {
    event.respondWith(handleAPIRequest(request));
  } else if (isImageRequest(url)) {
    event.respondWith(handleImageRequest(request));
  } else if (isVideoRequest(url)) {
    event.respondWith(handleVideoRequest(request));
  } else {
    event.respondWith(handleDynamicRequest(request));
  }
});

// Background sync for failed requests
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync-failed-requests') {
    event.waitUntil(replayFailedRequests());
  }

  if (event.tag === 'background-sync-analytics') {
    event.waitUntil(syncAnalytics());
  }

  if (event.tag === 'background-sync-cache-cleanup') {
    event.waitUntil(performCacheCleanup());
  }
});

// Push notifications (for job status updates)
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);

  const options = {
    body: 'Your video processing job has been completed!',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    data: {
      url: '/jobs'
    },
    actions: [
      {
        action: 'view',
        title: 'View Result',
        icon: '/icons/view.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/icons/dismiss.png'
      }
    ],
    requireInteraction: true,
    silent: false
  };

  if (event.data) {
    try {
      const data = event.data.json();
      options.body = data.message || options.body;
      options.data = { ...options.data, ...data };
    } catch (error) {
      console.warn('Failed to parse push data:', error);
    }
  }

  event.waitUntil(
    self.registration.showNotification('Video Generation Platform', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);

  event.notification.close();

  const action = event.action;
  const data = event.notification.data;

  if (action === 'view' || !action) {
    const urlToOpen = data.url || '/';

    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        // Check if there's already a window/tab open with the target URL
        for (const client of clients) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }

        // If no existing window, open a new one
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      })
    );
  }
});

// Message handling from main thread
self.addEventListener('message', (event) => {
  const { type, data } = event.data;

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'GET_CACHE_STATS':
      event.ports[0].postMessage({
        stats: performance,
        cacheNames: CACHE_NAMES
      });
      break;

    case 'CLEAR_CACHE':
      clearSpecificCache(data.cacheName).then(() => {
        event.ports[0].postMessage({ success: true });
      });
      break;

    case 'PREFETCH_RESOURCES':
      prefetchResources(data.urls).then(() => {
        event.ports[0].postMessage({ success: true });
      });
      break;
  }
});

// Caching strategies implementation

async function handleStaticAsset(request) {
  try {
    const cache = await caches.open(CACHE_NAMES.STATIC);
    const cachedResponse = await cache.match(request);

    if (cachedResponse && !isExpired(cachedResponse, CACHE_EXPIRY_TIMES.STATIC)) {
      performance.incrementCounter('cacheHits');
      return cachedResponse;
    }

    // Network request
    try {
      const networkResponse = await fetch(request);
      if (networkResponse.ok) {
        const responseClone = networkResponse.clone();
        await cache.put(request, responseClone);
        performance.incrementCounter('networkRequests');
        return networkResponse;
      }
    } catch (error) {
      // Network failed, return cached version if available
      if (cachedResponse) {
        performance.incrementCounter('cacheHits');
        return cachedResponse;
      }
    }

    performance.incrementCounter('cacheMisses');
    return new Response('Asset not found', { status: 404 });

  } catch (error) {
    performance.incrementCounter('errors');
    console.error('Error handling static asset:', error);
    return new Response('Service Worker Error', { status: 500 });
  }
}

async function handleAPIRequest(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Determine caching strategy
  let strategy = 'NETWORK_FIRST'; // default

  for (const [strategyName, patterns] of Object.entries(API_CACHE_STRATEGIES)) {
    if (patterns.some(pattern => pathname.includes(pattern))) {
      strategy = strategyName;
      break;
    }
  }

  switch (strategy) {
    case 'CACHE_FIRST':
      return cacheFirstStrategy(request, CACHE_NAMES.API);

    case 'NETWORK_FIRST':
      return networkFirstStrategy(request, CACHE_NAMES.API);

    case 'STALE_WHILE_REVALIDATE':
      return staleWhileRevalidateStrategy(request, CACHE_NAMES.API);

    default:
      return networkFirstStrategy(request, CACHE_NAMES.API);
  }
}

async function handleImageRequest(request) {
  return cacheFirstStrategy(request, CACHE_NAMES.IMAGES, CACHE_EXPIRY_TIMES.IMAGES);
}

async function handleVideoRequest(request) {
  // Videos are large, use network first but cache for future use
  return networkFirstStrategy(request, CACHE_NAMES.VIDEOS, CACHE_EXPIRY_TIMES.VIDEOS);
}

async function handleDynamicRequest(request) {
  return staleWhileRevalidateStrategy(request, CACHE_NAMES.DYNAMIC);
}

// Caching strategy implementations

async function cacheFirstStrategy(request, cacheName, expiry = CACHE_EXPIRY_TIMES.API) {
  try {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);

    if (cachedResponse && !isExpired(cachedResponse, expiry)) {
      performance.incrementCounter('cacheHits');
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const responseClone = networkResponse.clone();
      await cache.put(request, responseClone);
      performance.incrementCounter('networkRequests');
      return networkResponse;
    }

    // If network fails and we have cached version (even expired), return it
    if (cachedResponse) {
      performance.incrementCounter('cacheHits');
      return cachedResponse;
    }

    performance.incrementCounter('cacheMisses');
    return networkResponse;

  } catch (error) {
    performance.incrementCounter('errors');
    console.error('Cache first strategy error:', error);

    // Try to get from cache as fallback
    try {
      const cache = await caches.open(cacheName);
      const cachedResponse = await cache.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }
    } catch (cacheError) {
      console.error('Cache fallback error:', cacheError);
    }

    return getOfflinePage();
  }
}

async function networkFirstStrategy(request, cacheName, expiry = CACHE_EXPIRY_TIMES.API) {
  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      const responseClone = networkResponse.clone();
      await cache.put(request, responseClone);
      performance.incrementCounter('networkRequests');
      return networkResponse;
    }

    // Network failed or returned error, try cache
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      performance.incrementCounter('cacheHits');
      return cachedResponse;
    }

    performance.incrementCounter('cacheMisses');
    return networkResponse;

  } catch (error) {
    performance.incrementCounter('errors');
    console.error('Network first strategy error:', error);

    // Network failed, try cache
    try {
      const cache = await caches.open(cacheName);
      const cachedResponse = await cache.match(request);

      if (cachedResponse) {
        performance.incrementCounter('cacheHits');
        return cachedResponse;
      }
    } catch (cacheError) {
      console.error('Cache fallback error:', cacheError);
    }

    // Store failed request for background sync
    storeFailedRequest(request);

    return getOfflinePage();
  }
}

async function staleWhileRevalidateStrategy(request, cacheName) {
  try {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);

    // Start network request (don't await)
    const networkPromise = fetch(request).then(async (networkResponse) => {
      if (networkResponse.ok) {
        const responseClone = networkResponse.clone();
        await cache.put(request, responseClone);
      }
      return networkResponse;
    }).catch(error => {
      console.warn('Background fetch failed:', error);
    });

    // Return cached response immediately if available
    if (cachedResponse) {
      performance.incrementCounter('cacheHits');
      // Don't wait for network request
      networkPromise;
      return cachedResponse;
    }

    // No cached response, wait for network
    performance.incrementCounter('networkRequests');
    return await networkPromise;

  } catch (error) {
    performance.incrementCounter('errors');
    console.error('Stale while revalidate strategy error:', error);
    return getOfflinePage();
  }
}

// Helper functions

function isStaticAsset(url) {
  const pathname = url.pathname;
  return pathname.includes('/static/') ||
         pathname.includes('/assets/') ||
         pathname.endsWith('.js') ||
         pathname.endsWith('.css') ||
         pathname.endsWith('.woff') ||
         pathname.endsWith('.woff2') ||
         pathname === '/' ||
         pathname === '/index.html' ||
         pathname === '/manifest.json';
}

function isAPIRequest(url) {
  return url.pathname.startsWith('/api/');
}

function isImageRequest(url) {
  const pathname = url.pathname.toLowerCase();
  return pathname.includes('/images/') ||
         pathname.endsWith('.jpg') ||
         pathname.endsWith('.jpeg') ||
         pathname.endsWith('.png') ||
         pathname.endsWith('.gif') ||
         pathname.endsWith('.webp') ||
         pathname.endsWith('.svg') ||
         pathname.endsWith('.avif');
}

function isVideoRequest(url) {
  const pathname = url.pathname.toLowerCase();
  return pathname.includes('/videos/') ||
         pathname.endsWith('.mp4') ||
         pathname.endsWith('.webm') ||
         pathname.endsWith('.mov') ||
         pathname.endsWith('.avi');
}

function isExpired(response, maxAge) {
  const dateHeader = response.headers.get('date');
  if (!dateHeader) return false;

  const responseDate = new Date(dateHeader);
  const now = new Date();

  return (now.getTime() - responseDate.getTime()) > maxAge;
}

async function getOfflinePage() {
  try {
    const cache = await caches.open(CACHE_NAMES.OFFLINE);
    const offlineResponse = await cache.match('/offline.html');
    return offlineResponse || new Response('Offline', { status: 503 });
  } catch (error) {
    return new Response('Service Unavailable', { status: 503 });
  }
}

// Background sync functions

function initializeBackgroundSync() {
  // Register for background sync if supported
  if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
    console.log('Background sync supported');
  }
}

function storeFailedRequest(request) {
  try {
    const failedRequests = JSON.parse(localStorage.getItem('sw-failed-requests') || '[]');
    failedRequests.push({
      url: request.url,
      method: request.method,
      headers: [...request.headers.entries()],
      timestamp: Date.now()
    });

    // Keep only last 50 failed requests
    if (failedRequests.length > 50) {
      failedRequests.splice(0, failedRequests.length - 50);
    }

    localStorage.setItem('sw-failed-requests', JSON.stringify(failedRequests));
  } catch (error) {
    console.error('Failed to store failed request:', error);
  }
}

async function replayFailedRequests() {
  try {
    const failedRequests = JSON.parse(localStorage.getItem('sw-failed-requests') || '[]');
    const successfulRequests = [];

    for (const failedRequest of failedRequests) {
      try {
        const response = await fetch(failedRequest.url, {
          method: failedRequest.method,
          headers: new Headers(failedRequest.headers)
        });

        if (response.ok) {
          successfulRequests.push(failedRequest);
          performance.incrementCounter('backgroundSyncs');
        }
      } catch (error) {
        console.warn('Failed to replay request:', error);
      }
    }

    // Remove successful requests from storage
    if (successfulRequests.length > 0) {
      const remainingRequests = failedRequests.filter(
        req => !successfulRequests.includes(req)
      );
      localStorage.setItem('sw-failed-requests', JSON.stringify(remainingRequests));
    }

    console.log(`Background sync: ${successfulRequests.length}/${failedRequests.length} requests replayed`);

  } catch (error) {
    console.error('Background sync error:', error);
  }
}

async function syncAnalytics() {
  try {
    // Send performance metrics to analytics endpoint
    await fetch('/api/v1/analytics/sw-performance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(performance)
    });

    console.log('Analytics synced successfully');
  } catch (error) {
    console.error('Analytics sync error:', error);
  }
}

// Cache management functions

async function performCacheCleanup() {
  try {
    const cacheNames = await caches.keys();

    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const requests = await cache.keys();

      for (const request of requests) {
        const response = await cache.match(request);
        if (response && isExpired(response, getCacheExpiry(cacheName))) {
          await cache.delete(request);
        }
      }
    }

    console.log('Cache cleanup completed');
  } catch (error) {
    console.error('Cache cleanup error:', error);
  }
}

function getCacheExpiry(cacheName) {
  if (cacheName.includes('static')) return CACHE_EXPIRY_TIMES.STATIC;
  if (cacheName.includes('images')) return CACHE_EXPIRY_TIMES.IMAGES;
  if (cacheName.includes('videos')) return CACHE_EXPIRY_TIMES.VIDEOS;
  if (cacheName.includes('api')) return CACHE_EXPIRY_TIMES.API;
  return CACHE_EXPIRY_TIMES.DYNAMIC;
}

function schedulePeriodicCleanup() {
  // Schedule cache cleanup every 24 hours
  setInterval(async () => {
    try {
      await performCacheCleanup();
    } catch (error) {
      console.error('Scheduled cleanup error:', error);
    }
  }, 24 * 60 * 60 * 1000); // 24 hours
}

async function clearSpecificCache(cacheName) {
  try {
    await caches.delete(cacheName);
    console.log(`Cache ${cacheName} cleared successfully`);
  } catch (error) {
    console.error(`Failed to clear cache ${cacheName}:`, error);
  }
}

async function prefetchResources(urls) {
  try {
    const cache = await caches.open(CACHE_NAMES.DYNAMIC);

    const prefetchPromises = urls.map(async (url) => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response);
        }
      } catch (error) {
        console.warn(`Failed to prefetch ${url}:`, error);
      }
    });

    await Promise.all(prefetchPromises);
    console.log(`Prefetched ${urls.length} resources`);
  } catch (error) {
    console.error('Prefetch error:', error);
  }
}

// Debugging and development helpers
if (typeof importScripts === 'function') {
  console.log('Service Worker loaded successfully');
  console.log('Cache version:', CACHE_VERSION);
  console.log('Cache names:', CACHE_NAMES);
}
