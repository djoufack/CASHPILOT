import * as Sentry from '@sentry/react';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN?.trim();
const SENTRY_TRACES_SAMPLE_RATE = Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 0);
const APP_ENVIRONMENT = import.meta.env.VITE_APP_ENV || import.meta.env.MODE || 'development';
const APP_RELEASE = import.meta.env.VITE_APP_RELEASE || undefined;
const SENTRY_ENABLED_IN_DEV = import.meta.env.VITE_SENTRY_ENABLE_DEV === 'true';

let isInitialized = false;

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

  if (!SENTRY_DSN) return;

  // RGPD/GDPR: only initialize Sentry if the user has accepted cookies
  const hasConsent = localStorage.getItem('cookie-consent') === 'accepted';
  if (!hasConsent) return;

  isInitialized = true;

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: APP_ENVIRONMENT,
    release: APP_RELEASE,
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
    tracesSampleRate: Number.isFinite(SENTRY_TRACES_SAMPLE_RATE) ? SENTRY_TRACES_SAMPLE_RATE : 0,
    enabled: import.meta.env.PROD || SENTRY_ENABLED_IN_DEV,
  });
};

export const captureError = (error, context = {}) => {
  const normalizedError = normalizeError(error);

  if (SENTRY_DSN) {
    Sentry.withScope((scope) => {
      const formattedContext = buildContext(context);
      Object.entries(formattedContext.tags || {}).forEach(([key, value]) => scope.setTag(key, value));
      Object.entries(formattedContext.extra || {}).forEach(([key, value]) => scope.setExtra(key, value));
      Object.entries(formattedContext.contexts || {}).forEach(([key, value]) => scope.setContext(key, value));
      if (formattedContext.level) scope.setLevel(formattedContext.level);
      Sentry.captureException(normalizedError);
    });
    return;
  }

  console.error('Captured error:', normalizedError, context);
};

export const captureMessage = (message, context = {}) => {
  if (SENTRY_DSN) {
    Sentry.withScope((scope) => {
      const formattedContext = buildContext(context);
      Object.entries(formattedContext.tags || {}).forEach(([key, value]) => scope.setTag(key, value));
      Object.entries(formattedContext.extra || {}).forEach(([key, value]) => scope.setExtra(key, value));
      Object.entries(formattedContext.contexts || {}).forEach(([key, value]) => scope.setContext(key, value));
      if (formattedContext.level) scope.setLevel(formattedContext.level);
      Sentry.captureMessage(message);
    });
    return;
  }

  console.warn('Captured message:', message, context);
};
