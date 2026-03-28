import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useActiveCompanyId } from '@/hooks/useActiveCompanyId';

export const PILOTAGE_ALERT_TYPE_ORDER = [
  'negative_equity',
  'low_interest_coverage',
  'low_dscr',
  'bfr_drift',
  'negative_operating_cashflow',
  'high_gearing',
  'negative_net_income',
  'negative_working_capital',
];

export const PILOTAGE_ALERT_RULES = {
  negative_equity: {
    labelKey: 'pilotage.alertSubscriptions.types.negative_equity.label',
    descriptionKey: 'pilotage.alertSubscriptions.types.negative_equity.description',
    messageKey: 'pilotage.alertSubscriptions.messages.negative_equity',
    defaultThreshold: 0,
    severity: 'critical',
    compare: (value, threshold) => Number.isFinite(value) && value < threshold,
    value: (data) => toFiniteNumber(data?.balanceSheet?.totalEquity),
  },
  low_interest_coverage: {
    labelKey: 'pilotage.alertSubscriptions.types.low_interest_coverage.label',
    descriptionKey: 'pilotage.alertSubscriptions.types.low_interest_coverage.description',
    messageKey: 'pilotage.alertSubscriptions.messages.low_interest_coverage',
    defaultThreshold: 1,
    severity: 'critical',
    compare: (value, threshold) => Number.isFinite(value) && value < threshold,
    value: (data) => toFiniteNumber(data?.pilotageRatios?.coverage?.interestCoverage),
  },
  low_dscr: {
    labelKey: 'pilotage.alertSubscriptions.types.low_dscr.label',
    descriptionKey: 'pilotage.alertSubscriptions.types.low_dscr.description',
    messageKey: 'pilotage.alertSubscriptions.messages.low_dscr',
    defaultThreshold: 1.2,
    severity: 'warning',
    compare: (value, threshold) => Number.isFinite(value) && value < threshold,
    value: (data) => toFiniteNumber(data?.pilotageRatios?.coverage?.dscr),
  },
  bfr_drift: {
    labelKey: 'pilotage.alertSubscriptions.types.bfr_drift.label',
    descriptionKey: 'pilotage.alertSubscriptions.types.bfr_drift.description',
    messageKey: 'pilotage.alertSubscriptions.messages.bfr_drift',
    defaultThreshold: 30,
    severity: 'warning',
    compare: (value, threshold) => Number.isFinite(value) && value > threshold,
    value: (data) => toFiniteNumber(data?.pilotageRatios?.activity?.bfrToRevenue),
  },
  negative_operating_cashflow: {
    labelKey: 'pilotage.alertSubscriptions.types.negative_operating_cashflow.label',
    descriptionKey: 'pilotage.alertSubscriptions.types.negative_operating_cashflow.description',
    messageKey: 'pilotage.alertSubscriptions.messages.negative_operating_cashflow',
    defaultThreshold: 0,
    severity: 'critical',
    compare: (value, threshold) => Number.isFinite(value) && value < threshold,
    value: (data) => toFiniteNumber(data?.pilotageRatios?.cashFlow?.operatingCashFlow),
  },
  high_gearing: {
    labelKey: 'pilotage.alertSubscriptions.types.high_gearing.label',
    descriptionKey: 'pilotage.alertSubscriptions.types.high_gearing.description',
    messageKey: 'pilotage.alertSubscriptions.messages.high_gearing',
    defaultThreshold: 1,
    severity: 'warning',
    compare: (value, threshold) => Number.isFinite(value) && value > threshold,
    value: (data) => toFiniteNumber(data?.pilotageRatios?.structure?.gearing),
  },
  negative_net_income: {
    labelKey: 'pilotage.alertSubscriptions.types.negative_net_income.label',
    descriptionKey: 'pilotage.alertSubscriptions.types.negative_net_income.description',
    messageKey: 'pilotage.alertSubscriptions.messages.negative_net_income',
    defaultThreshold: 0,
    severity: 'warning',
    compare: (value, threshold) => Number.isFinite(value) && value < threshold,
    value: (data) => toFiniteNumber(data?.netIncome),
  },
  negative_working_capital: {
    labelKey: 'pilotage.alertSubscriptions.types.negative_working_capital.label',
    descriptionKey: 'pilotage.alertSubscriptions.types.negative_working_capital.description',
    messageKey: 'pilotage.alertSubscriptions.messages.negative_working_capital',
    defaultThreshold: 0,
    severity: 'warning',
    compare: (value, threshold) => Number.isFinite(value) && value < threshold,
    value: (data) => toFiniteNumber(data?.pilotageRatios?.structure?.workingCapital),
  },
};

export const PILOTAGE_ALERT_DEFAULT_SETTINGS = PILOTAGE_ALERT_TYPE_ORDER.reduce((acc, type) => {
  acc[type] = {
    enabled: true,
    threshold: PILOTAGE_ALERT_RULES[type].defaultThreshold,
  };
  return acc;
}, {});

const STORAGE_PREFIX = 'cashpilot.pilotage-alert-subscriptions';

const makeStorageKey = (userId, companyId) => `${STORAGE_PREFIX}.${userId || 'anon'}.${companyId || 'global'}`;

const toFiniteNumber = (value) => {
  if (value === null || value === undefined || value === '') return Number.NaN;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

export const normalizePilotageAlertSettings = (input = {}) => {
  return PILOTAGE_ALERT_TYPE_ORDER.reduce((acc, type) => {
    const defaults = PILOTAGE_ALERT_DEFAULT_SETTINGS[type];
    const raw = input?.[type] || {};
    const threshold = toFiniteNumber(raw.threshold);
    acc[type] = {
      enabled: raw.enabled !== false,
      threshold: Number.isFinite(threshold) ? threshold : defaults.threshold,
    };
    return acc;
  }, {});
};

const extractCompanyScopedSettings = (record, companyId) => {
  if (!record || typeof record !== 'object') return null;

  const persisted = record.pilotage_alert_settings;
  if (!persisted || typeof persisted !== 'object') return null;

  if (companyId && persisted[companyId]) {
    return persisted[companyId];
  }

  const keys = Object.keys(persisted);
  if (keys.length === 0) return null;

  const firstValue = persisted[keys[0]];
  if (firstValue && typeof firstValue === 'object' && !Array.isArray(firstValue)) {
    return firstValue;
  }

  return null;
};

const readCachedSettings = (userId, companyId) => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(makeStorageKey(userId, companyId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const writeCachedSettings = (userId, companyId, settings) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(makeStorageKey(userId, companyId), JSON.stringify(settings));
  } catch {
    // Ignore storage quota / privacy mode failures.
  }
};

export const buildPilotageAlertCandidates = (data = {}, settings = {}) => {
  const normalizedSettings = normalizePilotageAlertSettings(settings);

  return PILOTAGE_ALERT_TYPE_ORDER.reduce((acc, type) => {
    const rule = PILOTAGE_ALERT_RULES[type];
    const subscription = normalizedSettings[type] || PILOTAGE_ALERT_DEFAULT_SETTINGS[type];
    const value = rule.value(data);
    const threshold = toFiniteNumber(subscription.threshold);

    if (!subscription.enabled || !rule.compare(value, Number.isFinite(threshold) ? threshold : rule.defaultThreshold)) {
      return acc;
    }

    acc.push({
      type,
      severity: rule.severity,
      value,
      threshold: Number.isFinite(threshold) ? threshold : rule.defaultThreshold,
    });
    return acc;
  }, []);
};

export const usePilotageAlertSubscriptions = (companyIdOverride = null) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const activeCompanyId = useActiveCompanyId();
  const companyId = companyIdOverride || activeCompanyId || null;
  const [record, setRecord] = useState(null);
  const [settings, setSettings] = useState(PILOTAGE_ALERT_DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const storageKey = useMemo(() => makeStorageKey(user?.id, companyId), [companyId, user?.id]);

  const fetchSettings = useCallback(async () => {
    if (!user) {
      setSettings(PILOTAGE_ALERT_DEFAULT_SETTINGS);
      setRecord(null);
      setLoading(false);
      return;
    }

    if (!supabase) {
      const cached = readCachedSettings(user.id, companyId);
      setSettings(normalizePilotageAlertSettings(cached || {}));
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_company_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      const fromDatabase = normalizePilotageAlertSettings(extractCompanyScopedSettings(data, companyId) || {});
      const cached = normalizePilotageAlertSettings(readCachedSettings(user.id, companyId) || {});
      const nextSettings =
        Object.keys(extractCompanyScopedSettings(data, companyId) || {}).length > 0 ? fromDatabase : cached;

      setRecord(data || null);
      setSettings(nextSettings);
    } catch (error) {
      const cached = normalizePilotageAlertSettings(readCachedSettings(user.id, companyId) || {});
      setSettings(cached);
      console.warn('Error fetching pilotage alert subscriptions:', error?.message || error);
    } finally {
      setLoading(false);
    }
  }, [companyId, user]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveSettings = useCallback(
    async (nextSettings) => {
      const normalized = normalizePilotageAlertSettings(nextSettings);

      if (!user) {
        writeCachedSettings('anon', companyId, normalized);
        setSettings(normalized);
        return { saved: false, source: 'cache' };
      }

      const nextRecord = {
        user_id: user.id,
        active_company_id: companyId,
        pilotage_alert_settings: {
          ...(record?.pilotage_alert_settings || {}),
          ...(companyId ? { [companyId]: normalized } : {}),
        },
        updated_at: new Date().toISOString(),
      };

      setSaving(true);
      try {
        if (!supabase) {
          writeCachedSettings(user.id, companyId, normalized);
          setSettings(normalized);
          return { saved: false, source: 'cache' };
        }

        const { data, error } = await supabase
          .from('user_company_preferences')
          .upsert(nextRecord, { onConflict: 'user_id' })
          .select('*')
          .maybeSingle();

        if (error) {
          throw error;
        }

        setRecord(data || nextRecord);
        setSettings(normalized);
        writeCachedSettings(user.id, companyId, normalized);
        toast({
          title: 'Succès',
          description: 'Les seuils de pilotage ont été sauvegardés.',
        });

        return { saved: true, source: 'database' };
      } catch (error) {
        writeCachedSettings(user.id, companyId, normalized);
        setSettings(normalized);
        toast({
          title: 'Sauvegarde locale',
          description: error?.message || 'La sauvegarde en base a échoué; les seuils ont été conservés localement.',
          variant: 'destructive',
        });
        return { saved: false, source: 'cache', error };
      } finally {
        setSaving(false);
      }
    },
    [companyId, record?.pilotage_alert_settings, toast, user]
  );

  return {
    companyId,
    loading,
    saving,
    settings,
    fetchSettings,
    saveSettings,
    storageKey,
  };
};
