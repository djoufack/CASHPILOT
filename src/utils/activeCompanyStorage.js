import { safeGetItem, safeSetItem, safeRemoveItem } from './storage';

export const ACTIVE_COMPANY_STORAGE_KEY = 'cashpilot.activeCompanyId';
export const ACTIVE_COMPANY_EVENT = 'cashpilot:active-company-changed';

export function getStoredActiveCompanyId() {
  if (typeof window === 'undefined') return null;
  return safeGetItem(ACTIVE_COMPANY_STORAGE_KEY);
}

export function setStoredActiveCompanyId(companyId) {
  if (typeof window === 'undefined') return;
  const normalizedCompanyId = companyId || null;
  const currentCompanyId = getStoredActiveCompanyId();

  if ((currentCompanyId || null) === normalizedCompanyId) {
    return;
  }

  if (normalizedCompanyId) {
    safeSetItem(ACTIVE_COMPANY_STORAGE_KEY, normalizedCompanyId);
  } else {
    safeRemoveItem(ACTIVE_COMPANY_STORAGE_KEY);
  }

  window.dispatchEvent(
    new CustomEvent(ACTIVE_COMPANY_EVENT, {
      detail: normalizedCompanyId,
    })
  );
}
