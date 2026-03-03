import { useEffect, useState } from 'react';
import {
  ACTIVE_COMPANY_EVENT,
  ACTIVE_COMPANY_STORAGE_KEY,
  getStoredActiveCompanyId,
} from '@/utils/activeCompanyStorage';

export function useActiveCompanyId() {
  const [activeCompanyId, setActiveCompanyId] = useState(() => getStoredActiveCompanyId());

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleActiveCompanyChange = (event) => {
      setActiveCompanyId(event?.detail ?? getStoredActiveCompanyId());
    };

    const handleStorage = (event) => {
      if (event.key === ACTIVE_COMPANY_STORAGE_KEY) {
        setActiveCompanyId(event.newValue);
      }
    };

    window.addEventListener(ACTIVE_COMPANY_EVENT, handleActiveCompanyChange);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(ACTIVE_COMPANY_EVENT, handleActiveCompanyChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  return activeCompanyId;
}
