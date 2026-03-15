/**
 * Service Worker registration and update management for CashPilot PWA.
 */

const SW_PATH = '/sw.js';

let registration = null;

/**
 * Register the service worker. Call once at app startup.
 * @returns {Promise<ServiceWorkerRegistration|null>}
 */
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[SW] Service workers are not supported in this browser.');
    return null;
  }

  try {
    registration = await navigator.serviceWorker.register(SW_PATH, { scope: '/' });

    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New version available - tell it to activate immediately
          newWorker.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    });

    // When the new SW takes over, reload the page to get fresh assets
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

    // eslint-disable-next-line no-console
    console.info('[SW] Service worker registered successfully.');
    return registration;
  } catch (err) {
    console.error('[SW] Registration failed:', err);
    return null;
  }
}

/**
 * Check for service worker updates.
 * @returns {Promise<void>}
 */
export async function checkForUpdates() {
  if (!registration) return;

  try {
    await registration.update();
  } catch (err) {
    console.warn('[SW] Update check failed:', err);
  }
}
