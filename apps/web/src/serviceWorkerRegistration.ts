/**
 * PWA Update Handler
 *
 * vite-plugin-pwa (registerType: 'autoUpdate') auto-injects SW registration
 * and the workbox config uses skipWaiting + clientsClaim so new SWs activate
 * immediately.  However the *page* still serves stale JS chunks until it
 * reloads.  This module listens for the controllerchange event (fired when
 * a new SW takes over) and auto-reloads so users always see the latest build
 * without needing to hard-refresh or clear cache.
 */
import { logger } from './utils/logger';

const SW_RELOAD_KEY = 'sw-reloading';

/**
 * Call once at app startup. Safe to call in dev (no-ops when no SW support).
 */
export function registerUpdateHandler(): void {
  if (!('serviceWorker' in navigator)) return;

  // Clear any leftover reload guard from a previous cycle
  sessionStorage.removeItem(SW_RELOAD_KEY);

  // Was there already a controlling SW when this page loaded?
  const hadController = !!navigator.serviceWorker.controller;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Only auto-reload on *updates* (not first install)
    // sessionStorage guard prevents infinite reload loops
    if (hadController && !sessionStorage.getItem(SW_RELOAD_KEY)) {
      sessionStorage.setItem(SW_RELOAD_KEY, '1');
      logger.log('New app version detected — reloading…');
      window.location.reload();
    }
  });
}
