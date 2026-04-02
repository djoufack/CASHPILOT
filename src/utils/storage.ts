/**
 * Safe localStorage helpers — gracefully handles unavailable storage
 * (private browsing, quota exceeded, browser restrictions).
 */

export function safeGetItem(key: string, defaultValue: string | null = null): string | null {
  try {
    const item = localStorage.getItem(key);
    return item !== null ? item : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // localStorage unavailable (private browsing, quota exceeded)
  }
}

export function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // localStorage unavailable
  }
}
