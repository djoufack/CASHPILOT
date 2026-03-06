const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN?.trim();
const SENTRY_TRACES_SAMPLE_RATE = Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 0);
const APP_ENVIRONMENT = import.meta.env.VITE_APP_ENV || import.meta.env.MODE || 'development';
const APP_RELEASE = import.meta.env.VITE_APP_RELEASE || undefined;

let isInitialized = false;
let hasWarnedSdkMissing = false;

const getSentrySdk = () => {
  if (typeof window === 'undefined') return null;
  return window.Sentry && typeof window.Sentry === 'object' ? window.Sentry : null;
};

const normalizeError = (error) => {
  if (error instanceof Error) return error;
  if (typeof error === 'string') return new Error(error);
  try {
    return new Error(JSON.stringify(error));
  } catch {
    return new Error('Unknown error');
  }
};

const buildContext = (context = {}) => ({
  tags: context.tags || undefined,
  extra: context.extra || undefined,
  contexts: context.contexts || undefined,
  level: context.level || undefined,
});

export const initializeErrorTracking = () => {
  if (isInitialized) return;
  isInitialized = true;

  if (!SENTRY_DSN) return;

  const sentry = getSentrySdk();
  if (!sentry || typeof sentry.init !== 'function') {
    if (import.meta.env.DEV && !hasWarnedSdkMissing) {
      hasWarnedSdkMissing = true;
      console.warn('VITE_SENTRY_DSN is defined but Sentry SDK is not loaded in the browser runtime.');
    }
    return;
  }

  sentry.init({
    dsn: SENTRY_DSN,
    environment: APP_ENVIRONMENT,
    release: APP_RELEASE,
    tracesSampleRate: Number.isFinite(SENTRY_TRACES_SAMPLE_RATE) ? SENTRY_TRACES_SAMPLE_RATE : 0,
  });
};

export const captureError = (error, context = {}) => {
  const normalizedError = normalizeError(error);
  const sentry = getSentrySdk();

  if (sentry && typeof sentry.captureException === 'function') {
    sentry.captureException(normalizedError, buildContext(context));
    return;
  }

  console.error('Captured error:', normalizedError, context);
};

export const captureMessage = (message, context = {}) => {
  const sentry = getSentrySdk();

  if (sentry && typeof sentry.captureMessage === 'function') {
    sentry.captureMessage(message, buildContext(context));
    return;
  }

  console.warn('Captured message:', message, context);
};
