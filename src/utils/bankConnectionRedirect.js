const STORAGE_KEY = 'cashpilot.pendingBankConnection';

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

export function storePendingBankConnection(payload) {
  if (!isBrowser()) {
    return;
  }

  const nextPayload = {
    ...payload,
    createdAt: new Date().toISOString(),
  };

  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nextPayload));
}

export function getPendingBankConnection() {
  if (!isBrowser()) {
    return null;
  }

  const rawValue = window.sessionStorage.getItem(STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    window.sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function clearPendingBankConnection() {
  if (!isBrowser()) {
    return;
  }

  window.sessionStorage.removeItem(STORAGE_KEY);
}
