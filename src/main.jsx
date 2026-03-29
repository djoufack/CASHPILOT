
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';
import '@/styles/light-theme.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { ReferenceDataProvider } from '@/contexts/ReferenceDataContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import OnboardingTour from '@/components/OnboardingTour';
import { initializeErrorTracking } from '@/services/errorTracking';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';

const ACTIVE_SERVICE_WORKER_PATH = '/sw.js';
const CHUNK_RECOVERY_KEY = 'cashpilot.chunk-recovery-attempts';
const MAX_CHUNK_RECOVERY_ATTEMPTS = 2;
const CHUNK_ERROR_PATTERNS = [
  'Failed to fetch dynamically imported module',
  'Failed to load dynamically imported module',
];

const getRegistrationScriptUrl = (registration) => (
  registration?.active?.scriptURL
  || registration?.waiting?.scriptURL
  || registration?.installing?.scriptURL
  || ''
);

const isChunkLoadError = (value) => CHUNK_ERROR_PATTERNS.some((pattern) => String(value || '').includes(pattern));

async function unregisterLegacyServiceWorkers() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    registrations
      .filter((registration) => !getRegistrationScriptUrl(registration).endsWith(ACTIVE_SERVICE_WORKER_PATH))
      .map((registration) => registration.unregister())
  );
}

async function purgeRuntimeCaches() {
  if (typeof window === 'undefined' || !('caches' in window)) return;

  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
}

async function recoverFromChunkLoadFailure() {
  if (typeof window === 'undefined') return;

  const attempts = Number.parseInt(sessionStorage.getItem(CHUNK_RECOVERY_KEY) || '0', 10);
  if (attempts >= MAX_CHUNK_RECOVERY_ATTEMPTS) {
    return;
  }

  sessionStorage.setItem(CHUNK_RECOVERY_KEY, String(attempts + 1));

  try {
    await unregisterLegacyServiceWorkers();
    await purgeRuntimeCaches();
  } catch (error) {
    console.warn('Chunk recovery cleanup failed:', error);
  }

  const url = new URL(window.location.href);
  url.searchParams.set('cache-bust', Date.now().toString());
  window.location.replace(url.toString());
}

if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault?.();
    void recoverFromChunkLoadFailure();
  });

  window.addEventListener('error', (event) => {
    if (isChunkLoadError(event?.message) || isChunkLoadError(event?.error?.message)) {
      void recoverFromChunkLoadFailure();
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    if (isChunkLoadError(event?.reason?.message)) {
      event.preventDefault?.();
      void recoverFromChunkLoadFailure();
    }
  });
}

initializeErrorTracking();

ReactDOM.createRoot(document.getElementById('root')).render(
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ReferenceDataProvider>
        <ThemeProvider>
          <App />
          <OnboardingTour />
        </ThemeProvider>
      </ReferenceDataProvider>
    </AuthProvider>
  </QueryClientProvider>
);

// Register Service Worker only in production
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    if (import.meta.env.MODE === 'production') {
      try {
        await unregisterLegacyServiceWorkers();
        await navigator.serviceWorker.register(ACTIVE_SERVICE_WORKER_PATH);
      } catch (err) {
        console.error('SW registration failed:', err);
      }
    } else {
      // Unregister in development to prevent caching issues
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
      });
    }
  });
}
