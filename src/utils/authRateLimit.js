const STORAGE_KEY = 'cashpilot.authRateLimit.v1';
const ENTRY_TTL_MS = 24 * 60 * 60 * 1000;
const HARD_LOCK_THRESHOLD = 5;
const HARD_LOCK_MS = 60 * 60 * 1000;
const SOFT_BACKOFF_BASE_MS = 2000;
const SOFT_BACKOFF_MAX_MS = 60 * 1000;

const hasStorage = () => (
  typeof window !== 'undefined'
  && typeof window.localStorage !== 'undefined'
);

const nowMs = () => Date.now();

const normalizeIdentifier = (value) => String(value || 'global').trim().toLowerCase();

const toScopeKey = (scope, identifier) => `${scope}:${normalizeIdentifier(identifier)}`;

const readStore = () => {
  if (!hasStorage()) return {};

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writeStore = (value) => {
  if (!hasStorage()) return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Ignore storage write errors.
  }
};

const pruneExpired = (store, currentNow) => Object.fromEntries(
  Object.entries(store).filter(([, entry]) => {
    if (!entry || typeof entry !== 'object') return false;
    const lastFailureAt = Number(entry.lastFailureAt || 0);
    const lockedUntil = Number(entry.lockedUntil || 0);
    return (currentNow - lastFailureAt) <= ENTRY_TTL_MS || lockedUntil > currentNow;
  }),
);

const formatSeconds = (durationMs) => Math.max(1, Math.ceil(durationMs / 1000));

const buildLockError = (retryAfterMs) => {
  const seconds = formatSeconds(retryAfterMs);
  const error = new Error(`Too many attempts. Try again in ${seconds} seconds.`);
  error.code = 'AUTH_RATE_LIMITED';
  error.retryAfterSeconds = seconds;
  return error;
};

const getEntry = (scope, identifier) => {
  const currentNow = nowMs();
  const store = pruneExpired(readStore(), currentNow);
  writeStore(store);

  const key = toScopeKey(scope, identifier);
  const entry = store[key] && typeof store[key] === 'object'
    ? store[key]
    : { failedAttempts: 0, lockedUntil: 0, lastFailureAt: 0 };

  return { key, store, entry, currentNow };
};

export const assertRateLimitAllowed = (scope, identifier) => {
  const { entry, currentNow } = getEntry(scope, identifier);
  const lockedUntil = Number(entry.lockedUntil || 0);

  if (lockedUntil > currentNow) {
    throw buildLockError(lockedUntil - currentNow);
  }
};

export const recordRateLimitFailure = (scope, identifier) => {
  const { key, store, entry, currentNow } = getEntry(scope, identifier);
  const failedAttempts = Number(entry.failedAttempts || 0) + 1;

  const softBackoffMs = Math.min(
    SOFT_BACKOFF_BASE_MS * (2 ** Math.max(0, failedAttempts - 1)),
    SOFT_BACKOFF_MAX_MS,
  );
  const hardLockApplies = failedAttempts >= HARD_LOCK_THRESHOLD;
  const lockDuration = hardLockApplies ? HARD_LOCK_MS : softBackoffMs;

  store[key] = {
    failedAttempts,
    lockedUntil: currentNow + lockDuration,
    lastFailureAt: currentNow,
  };
  writeStore(store);
};

export const recordRateLimitSuccess = (scope, identifier) => {
  const { key, store } = getEntry(scope, identifier);
  if (Object.prototype.hasOwnProperty.call(store, key)) {
    delete store[key];
    writeStore(store);
  }
};

export const getRateLimitSnapshot = (scope, identifier) => {
  const { entry, currentNow } = getEntry(scope, identifier);
  const lockedUntil = Number(entry.lockedUntil || 0);
  const retryAfterMs = Math.max(0, lockedUntil - currentNow);

  return {
    failedAttempts: Number(entry.failedAttempts || 0),
    lockedUntil,
    retryAfterSeconds: formatSeconds(retryAfterMs),
    isLocked: retryAfterMs > 0,
  };
};
