export const ACTIVE_COMPANY_STORAGE_KEY = 'cashpilot.activeCompanyId';
export const ACTIVE_COMPANY_EVENT = 'cashpilot:active-company-changed';

export function getStoredActiveCompanyId() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ACTIVE_COMPANY_STORAGE_KEY);
}

export function setStoredActiveCompanyId(companyId) {
  if (typeof window === 'undefined') return;
  const normalizedCompanyId = companyId || null;
  const currentCompanyId = getStoredActiveCompanyId();

  if ((currentCompanyId || null) === normalizedCompanyId) {
    return;
  }

  if (normalizedCompanyId) {
    window.localStorage.setItem(ACTIVE_COMPANY_STORAGE_KEY, normalizedCompanyId);
  } else {
    window.localStorage.removeItem(ACTIVE_COMPANY_STORAGE_KEY);
  }

  window.dispatchEvent(new CustomEvent(ACTIVE_COMPANY_EVENT, {
    detail: normalizedCompanyId,
  }));
}
