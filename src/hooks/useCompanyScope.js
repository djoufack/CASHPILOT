import { useCallback } from 'react';
import { useActiveCompanyId } from '@/hooks/useActiveCompanyId';

export function useCompanyScope() {
  const activeCompanyId = useActiveCompanyId();

  const applyCompanyScope = useCallback(
    (query, options = {}) => {
      const { column = 'company_id', includeUnassigned = false } = options;

      if (!activeCompanyId) {
        return query;
      }

      if (includeUnassigned) {
        return query.or(`${column}.is.null,${column}.eq.${activeCompanyId}`);
      }

      return query.eq(column, activeCompanyId);
    },
    [activeCompanyId]
  );

  const withCompanyScope = useCallback(
    (payload = {}, options = {}) => {
      const { column = 'company_id' } = options;

      if (!activeCompanyId || payload[column]) {
        return payload;
      }

      return {
        ...payload,
        [column]: activeCompanyId,
      };
    },
    [activeCompanyId]
  );

  return {
    activeCompanyId,
    applyCompanyScope,
    withCompanyScope,
  };
}
