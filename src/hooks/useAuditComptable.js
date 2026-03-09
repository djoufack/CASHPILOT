import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { supabaseUrl, supabaseAnonKey } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateInput, formatStartOfYearInput } from '@/utils/dateFormatting';

const CACHE_KEY = 'cashpilot_audit_cache';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h
export const AUTO_FIXABLE_AUDIT_CHECK_IDS = ['zero_entries', 'chart_coherence', 'fec_conformity'];

function toNumber(value) {
  const n = Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

function chunkArray(items, size = 200) {
  const output = [];
  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size));
  }
  return output;
}

function inferAccountType(accountCode) {
  const code = String(accountCode || '').trim();
  if (!code) return 'expense';

  const firstDigit = code[0];
  if (firstDigit === '1') return 'equity';
  if (firstDigit === '2' || firstDigit === '3' || firstDigit === '5') return 'asset';
  if (firstDigit === '4') return 'liability';
  if (firstDigit === '6') return 'expense';
  if (firstDigit === '7') return 'revenue';
  return 'expense';
}

function inferAccountCategory(accountCode, accountType) {
  const code = String(accountCode || '').trim();
  if (!code) return 'other';

  if (accountType === 'asset') return 'asset';
  if (accountType === 'liability') return 'liability';
  if (accountType === 'equity') return 'equity';
  if (accountType === 'revenue') return 'revenue';
  if (accountType === 'expense') return 'expense';
  return 'other';
}

function resolveOptions(options) {
  if (typeof options === 'object' && options !== null) {
    return {
      autoLoad: Boolean(options.autoLoad),
      defaultPeriodStart: options.defaultPeriodStart || null,
      defaultPeriodEnd: options.defaultPeriodEnd || null,
      cacheKey: options.cacheKey || CACHE_KEY,
    };
  }

  return {
    autoLoad: Boolean(options),
    defaultPeriodStart: null,
    defaultPeriodEnd: null,
    cacheKey: CACHE_KEY,
  };
}

async function getFreshAccessToken() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;

  if (session?.access_token) {
    return session.access_token;
  }

  const { data, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) throw refreshError;

  return data?.session?.access_token || null;
}

async function callAuditComptable(body, accessToken) {
  return fetch(`${supabaseUrl}/functions/v1/audit-comptable`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify(body),
  });
}

export const useAuditComptable = (options = false) => {
  const { user } = useAuth();
  const { autoLoad, defaultPeriodStart, defaultPeriodEnd, cacheKey } = resolveOptions(options);
  const [auditResult, setAuditResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fixing, setFixing] = useState(false);
  const [fixReport, setFixReport] = useState(null);

  const runAudit = useCallback(async (periodStart, periodEnd, categories = null) => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      let accessToken = await getFreshAccessToken();
      if (!accessToken) throw new Error('Session expiree. Veuillez vous reconnecter.');

      const body = { period_start: periodStart, period_end: periodEnd };
      if (categories) body.categories = categories;

      let response = await callAuditComptable(body, accessToken);

      // Edge Functions can reject an expired JWT before our function code runs.
      // Refresh once and retry so long-lived demo sessions recover automatically.
      if (response.status === 401) {
        accessToken = await getFreshAccessToken();
        if (!accessToken) {
          throw new Error('Session expiree. Veuillez vous reconnecter.');
        }
        response = await callAuditComptable(body, accessToken);
      }

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        if (response.status === 401) {
          throw new Error('Session expiree. Veuillez vous reconnecter.');
        }
        throw new Error(err.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      setAuditResult(result);

      // Cache the result
      localStorage.setItem(cacheKey, JSON.stringify({ data: result, timestamp: Date.now() }));

      return result;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [cacheKey, user]);

  const applyAutoFixes = useCallback(async (params = {}) => {
    if (!user) return null;

    const snapshot = params.auditSnapshot || auditResult;
    const periodStart = params.periodStart || snapshot?.period?.start || formatStartOfYearInput();
    const periodEnd = params.periodEnd || snapshot?.period?.end || formatDateInput();

    setFixing(true);
    setError(null);

    const report = {
      generated_at: new Date().toISOString(),
      period: { start: periodStart, end: periodEnd },
      steps: [],
      totals: {
        applied_checks: 0,
        affected_records: 0,
        failed_steps: 0,
      },
    };

    try {
      let entriesQuery = supabase
        .from('accounting_entries')
        .select('id, account_code, debit, credit, description, transaction_date')
        .eq('user_id', user.id)
        .gte('transaction_date', periodStart)
        .lte('transaction_date', periodEnd);

      const [entriesRes, accountsRes] = await Promise.all([
        entriesQuery,
        supabase
          .from('accounting_chart_of_accounts')
          .select('id, account_code, account_name, account_type, account_category, is_active')
          .eq('user_id', user.id),
      ]);

      if (entriesRes.error) throw entriesRes.error;
      if (accountsRes.error) throw accountsRes.error;

      const entries = entriesRes.data || [];
      const accounts = accountsRes.data || [];
      const existingCodes = new Set(accounts.map((account) => String(account.account_code || '').trim()));

      // 1) Remove entries with debit=0 and credit=0
      const zeroEntryIds = entries
        .filter((entry) => toNumber(entry.debit) === 0 && toNumber(entry.credit) === 0)
        .map((entry) => entry.id);

      if (zeroEntryIds.length > 0) {
        for (const idsChunk of chunkArray(zeroEntryIds)) {
          const { error: deleteError } = await supabase
            .from('accounting_entries')
            .delete()
            .eq('user_id', user.id)
            .in('id', idsChunk);
          if (deleteError) throw deleteError;
        }
        report.steps.push({
          check_id: 'zero_entries',
          label: 'Ecritures a Zero',
          status: 'applied',
          affected_records: zeroEntryIds.length,
          message: `${zeroEntryIds.length} ecriture(s) vide(s) supprimee(s).`,
        });
      } else {
        report.steps.push({
          check_id: 'zero_entries',
          label: 'Ecritures a Zero',
          status: 'skipped',
          affected_records: 0,
          message: 'Aucune ecriture vide a corriger.',
        });
      }

      // 2) Create missing chart accounts referenced by entries
      const missingAccountCodes = Array.from(new Set(
        entries
          .map((entry) => String(entry.account_code || '').trim())
          .filter((code) => code && !existingCodes.has(code)),
      ));

      if (missingAccountCodes.length > 0) {
        const accountsToCreate = missingAccountCodes.map((accountCode) => {
          const accountType = inferAccountType(accountCode);
          return {
            user_id: user.id,
            account_code: accountCode,
            account_name: `Compte ${accountCode} (auto)`,
            account_type: accountType,
            account_category: inferAccountCategory(accountCode, accountType),
            is_active: true,
          };
        });

        const { error: upsertError } = await supabase
          .from('accounting_chart_of_accounts')
          .upsert(accountsToCreate, { onConflict: 'user_id,account_code', ignoreDuplicates: true });

        if (upsertError) throw upsertError;

        report.steps.push({
          check_id: 'chart_coherence',
          label: 'Coherence Plan Comptable',
          status: 'applied',
          affected_records: missingAccountCodes.length,
          message: `${missingAccountCodes.length} compte(s) manquant(s) ajoute(s) au plan comptable.`,
        });
      } else {
        report.steps.push({
          check_id: 'chart_coherence',
          label: 'Coherence Plan Comptable',
          status: 'skipped',
          affected_records: 0,
          message: 'Aucun compte manquant a ajouter.',
        });
      }

      // 3) Fill missing descriptions for FEC completeness
      const missingDescriptionIds = entries
        .filter((entry) => !String(entry.description || '').trim())
        .map((entry) => entry.id);

      if (missingDescriptionIds.length > 0) {
        for (const idsChunk of chunkArray(missingDescriptionIds)) {
          const { error: updateError } = await supabase
            .from('accounting_entries')
            .update({ description: 'Ecriture auto completee via audit comptable' })
            .eq('user_id', user.id)
            .in('id', idsChunk);
          if (updateError) throw updateError;
        }

        report.steps.push({
          check_id: 'fec_conformity',
          label: 'Conformite FEC',
          status: 'applied',
          affected_records: missingDescriptionIds.length,
          message: `${missingDescriptionIds.length} ecriture(s) completee(s) avec une description par defaut.`,
        });
      } else {
        report.steps.push({
          check_id: 'fec_conformity',
          label: 'Conformite FEC',
          status: 'skipped',
          affected_records: 0,
          message: 'Aucune description manquante a completer.',
        });
      }

      report.totals.applied_checks = report.steps.filter((step) => step.status === 'applied').length;
      report.totals.affected_records = report.steps.reduce((sum, step) => sum + (step.affected_records || 0), 0);
      report.totals.failed_steps = report.steps.filter((step) => step.status === 'failed').length;

      setFixReport(report);
      localStorage.removeItem(cacheKey);
      const refreshedAudit = await runAudit(periodStart, periodEnd);
      return { report, refreshedAudit };
    } catch (err) {
      setError(err.message);
      report.steps.push({
        check_id: 'auto_fix',
        label: 'Correction automatique',
        status: 'failed',
        affected_records: 0,
        message: err.message,
      });
      report.totals.failed_steps = report.steps.filter((step) => step.status === 'failed').length;
      setFixReport(report);
      return { report, refreshedAudit: null };
    } finally {
      setFixing(false);
    }
  }, [auditResult, cacheKey, runAudit, user]);

  const clearCache = useCallback(() => {
    localStorage.removeItem(cacheKey);
    setAuditResult(null);
    setFixReport(null);
  }, [cacheKey]);

  // Load from cache on mount (if autoLoad)
  useEffect(() => {
    if (!autoLoad || !user) return;
    const today = formatDateInput();
    const periodStart = defaultPeriodStart || formatStartOfYearInput();
    const periodEnd = defaultPeriodEnd || today;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL) {
          setAuditResult(data);
          return;
        }
      } catch { /* ignore invalid cache */ }
    }
    runAudit(periodStart, periodEnd);
  }, [autoLoad, cacheKey, defaultPeriodEnd, defaultPeriodStart, runAudit, user]);

  return { auditResult, loading, error, runAudit, clearCache, applyAutoFixes, fixing, fixReport };
};

