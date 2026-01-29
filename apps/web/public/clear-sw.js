// Clear service worker caches
if ('caches' in window) {
  caches.keys().then(cacheNames => {
    return Promise.all(
      cacheNames.map(cacheName => {
        console.log('Deleting cache:', cacheName);
        return caches.delete(cacheName);
      })
    );
  }).then(() => {
    console.log('All caches cleared');
    // Reload to get fresh service worker
    window.location.reload();
  });
}

// Unregister service workers
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    return Promise.all(
      registrations.map(registration => {
        console.log('Unregistering service worker:', registration.scope);
        return registration.unregister();
      })
    );
  }).then(() => {
    console.log('All service workers unregistered');
  });
}
