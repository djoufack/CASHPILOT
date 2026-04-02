/**
 * Safe localStorage helpers.
 * Falls back gracefully when localStorage is unavailable
 * (private browsing, storage quota exceeded, corrupted data).
 */

export function safeGetItem(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(key);
    return item !== null ? item : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // localStorage unavailable (private browsing, quota exceeded)
  }
}

export function safeRemoveItem(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // localStorage unavailable
  }
}
