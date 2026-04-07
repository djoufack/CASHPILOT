import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useCompanyScope } from '@/hooks/useCompanyScope';

const DEFAULT_ERROR_MESSAGE = 'Unexpected error';

const normalizeErrorMessage = (err, fallback = DEFAULT_ERROR_MESSAGE) => {
  if (!err) return fallback;
  if (typeof err === 'string') return err || fallback;

  const parts = [err.message, err.details, err.hint].filter(Boolean);
  if (parts.length > 0) return parts.join(' ');

  return fallback;
};

const normalizeModuleKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase();

const toSortableTime = (value) => {
  if (!value) return null;

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;

  return parsed;
};

const sortWorkstreams = (items = []) =>
  [...items].sort((left, right) => {
    const leftDue = toSortableTime(left?.due_date);
    const rightDue = toSortableTime(right?.due_date);

    if (leftDue === null && rightDue !== null) return 1;
    if (leftDue !== null && rightDue === null) return -1;
    if (leftDue !== null && rightDue !== null && leftDue !== rightDue) {
      return leftDue - rightDue;
    }

    const leftCreated = toSortableTime(left?.created_at) ?? 0;
    const rightCreated = toSortableTime(right?.created_at) ?? 0;

    if (leftCreated !== rightCreated) {
      return rightCreated - leftCreated;
    }

    return String(right?.id || '').localeCompare(String(left?.id || ''));
  });

const replaceItem = (items, nextItem) =>
  sortWorkstreams(items.map((item) => (item.id === nextItem.id ? nextItem : item)));

const removeItemFromList = (items, id) => items.filter((item) => item.id !== id);

export function useSapRoadmap({ moduleKey } = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { activeCompanyId, applyCompanyScope, withCompanyScope } = useCompanyScope();

  const scopedModuleKey = useMemo(() => normalizeModuleKey(moduleKey), [moduleKey]);
  const hasModuleKeyFilter = scopedModuleKey.length > 0;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const savingCountRef = useRef(0);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const setSavingState = useCallback((nextValue) => {
    savingCountRef.current = Math.max(0, nextValue);
    if (mountedRef.current) {
      setSaving(savingCountRef.current > 0);
    }
  }, []);

  const reportError = useCallback(
    (action, err) => {
      const message = normalizeErrorMessage(err, t('common.error', DEFAULT_ERROR_MESSAGE));

      if (mountedRef.current) {
        setError(message);
      }

      toast({
        title: t('common.error', DEFAULT_ERROR_MESSAGE),
        description: message,
        variant: 'destructive',
      });

      console.error(`SAP roadmap ${action} failed:`, err);
      return message;
    },
    [t, toast]
  );

  const getContextErrorMessage = useCallback(
    (kind) => {
      if (kind === 'supabase') {
        return t('sap.roadmap.supabaseNotConfigured', 'Supabase not configured');
      }

      if (kind === 'company') {
        return t('sap.roadmap.noActiveCompany', 'No active company selected');
      }

      return t('sap.roadmap.noAuthenticatedUser', 'User not authenticated');
    },
    [t]
  );

  const buildBaseQuery = useCallback(() => {
    let query = supabase.from('sap_workstreams').select('*');
    query = applyCompanyScope(query);

    if (hasModuleKeyFilter) {
      query = query.eq('module_key', scopedModuleKey);
    }

    return query.order('due_date', { ascending: true, nullsFirst: false }).order('created_at', {
      ascending: false,
    });
  }, [applyCompanyScope, hasModuleKeyFilter, scopedModuleKey]);

  const refresh = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!supabase) {
      const message = getContextErrorMessage('supabase');
      reportError('fetch', new Error(message));
      if (mountedRef.current) {
        setItems([]);
        setError(message);
        setLoading(false);
      }
      return [];
    }

    if (!user?.id || !activeCompanyId) {
      if (mountedRef.current) {
        setItems([]);
        setError(null);
        setLoading(false);
      }
      return [];
    }

    if (mountedRef.current) {
      setLoading(true);
      setError(null);
    }

    try {
      const { data, error: queryError } = await buildBaseQuery();

      if (queryError) throw queryError;

      const nextItems = sortWorkstreams(data || []);

      if (mountedRef.current && requestIdRef.current === requestId) {
        setItems(nextItems);
      }

      return nextItems;
    } catch (err) {
      const message = reportError('fetch', err);
      if (mountedRef.current && requestIdRef.current === requestId) {
        setItems([]);
        setError(message);
      }
      throw err;
    } finally {
      if (mountedRef.current && requestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [activeCompanyId, buildBaseQuery, getContextErrorMessage, reportError, user?.id]);

  const createItem = useCallback(
    async (payload = {}) => {
      if (!supabase) {
        const message = getContextErrorMessage('supabase');
        reportError('create', new Error(message));
        throw new Error(message);
      }
      if (!user?.id || !activeCompanyId) {
        const message = getContextErrorMessage(!user?.id ? 'user' : 'company');
        reportError('create', new Error(message));
        throw new Error(message);
      }

      const normalizedPayload = {
        ...payload,
        ...(Object.prototype.hasOwnProperty.call(payload, 'moduleKey') &&
        !Object.prototype.hasOwnProperty.call(payload, 'module_key')
          ? { module_key: payload.moduleKey }
          : null),
      };

      const row = withCompanyScope({
        ...normalizedPayload,
        user_id: user.id,
        ...(hasModuleKeyFilter && normalizedPayload.module_key == null ? { module_key: scopedModuleKey } : null),
      });

      setSavingState(savingCountRef.current + 1);
      setError(null);

      try {
        const { data, error: insertError } = await supabase.from('sap_workstreams').insert([row]).select().single();
        if (insertError) throw insertError;

        if (mountedRef.current) {
          setItems((prev) => sortWorkstreams([...(prev || []), data]));
        }

        return data;
      } catch (err) {
        reportError('create', err);
        throw err;
      } finally {
        setSavingState(savingCountRef.current - 1);
      }
    },
    [
      activeCompanyId,
      getContextErrorMessage,
      hasModuleKeyFilter,
      reportError,
      scopedModuleKey,
      setSavingState,
      user?.id,
      withCompanyScope,
    ]
  );

  const updateItem = useCallback(
    async (id, payload = {}) => {
      if (!supabase) {
        const message = getContextErrorMessage('supabase');
        reportError('update', new Error(message));
        throw new Error(message);
      }
      if (!user?.id || !activeCompanyId) {
        const message = getContextErrorMessage(!user?.id ? 'user' : 'company');
        reportError('update', new Error(message));
        throw new Error(message);
      }

      setSavingState(savingCountRef.current + 1);
      setError(null);

      try {
        const normalizedPayload = {
          ...payload,
          ...(Object.prototype.hasOwnProperty.call(payload, 'moduleKey') &&
          !Object.prototype.hasOwnProperty.call(payload, 'module_key')
            ? { module_key: payload.moduleKey }
            : null),
        };

        let query = supabase
          .from('sap_workstreams')
          .update(withCompanyScope(normalizedPayload))
          .eq('id', id)
          .select('*');

        query = applyCompanyScope(query);
        if (hasModuleKeyFilter) {
          query = query.eq('module_key', scopedModuleKey);
        }

        const { data, error: updateError } = await query.single();
        if (updateError) throw updateError;

        if (mountedRef.current) {
          setItems((prev) => replaceItem(prev || [], data));
        }

        return data;
      } catch (err) {
        reportError('update', err);
        throw err;
      } finally {
        setSavingState(savingCountRef.current - 1);
      }
    },
    [
      activeCompanyId,
      applyCompanyScope,
      getContextErrorMessage,
      hasModuleKeyFilter,
      reportError,
      scopedModuleKey,
      setSavingState,
      user?.id,
      withCompanyScope,
    ]
  );

  const removeItem = useCallback(
    async (id) => {
      if (!supabase) {
        const message = getContextErrorMessage('supabase');
        reportError('delete', new Error(message));
        throw new Error(message);
      }
      if (!user?.id || !activeCompanyId) {
        const message = getContextErrorMessage(!user?.id ? 'user' : 'company');
        reportError('delete', new Error(message));
        throw new Error(message);
      }

      setSavingState(savingCountRef.current + 1);
      setError(null);

      try {
        let query = supabase.from('sap_workstreams').delete().eq('id', id).select('id');
        query = applyCompanyScope(query);
        if (hasModuleKeyFilter) {
          query = query.eq('module_key', scopedModuleKey);
        }

        const { data, error: deleteError } = await query;
        if (deleteError) throw deleteError;
        if (!data?.length) {
          throw new Error(t('sap.roadmap.workstreamNotFound', 'Workstream not found'));
        }

        if (mountedRef.current) {
          setItems((prev) => removeItemFromList(prev || [], id));
        }

        return true;
      } catch (err) {
        reportError('delete', err);
        throw err;
      } finally {
        setSavingState(savingCountRef.current - 1);
      }
    },
    [
      activeCompanyId,
      applyCompanyScope,
      getContextErrorMessage,
      hasModuleKeyFilter,
      reportError,
      scopedModuleKey,
      setSavingState,
      t,
      user?.id,
    ]
  );

  useEffect(() => {
    void refresh().catch(() => {
      // Error state is already handled inside refresh.
    });
  }, [refresh]);

  return {
    items,
    loading,
    saving,
    error,
    refresh,
    createItem,
    updateItem,
    removeItem,
  };
}

export default useSapRoadmap;
