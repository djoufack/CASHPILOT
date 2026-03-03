import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { formatDateInput } from '@/utils/dateFormatting';
import { useCompanyScope } from '@/hooks/useCompanyScope';

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aou', 'Sep', 'Oct', 'Nov', 'Dec'];
const CASH_ACCOUNT_REGEX = /(banque|bank|cash|caisse|tre?sorerie)/i;
const OPENING_ENTRY_REGEX = /^(open|opening|ouverture|solde[-_\s]?initial)/i;

function toIsoDate(date) {
  return formatDateInput(date);
}

function resolveParams(optionsOrPeriod, granularityArg) {
  if (typeof optionsOrPeriod === 'object' && optionsOrPeriod !== null) {
    const options = optionsOrPeriod;
    return {
      periodMonths: options.periodMonths ?? 6,
      granularity: options.granularity ?? 'month',
      startDate: options.startDate ?? null,
      endDate: options.endDate ?? null,
    };
  }

  return {
    periodMonths: optionsOrPeriod ?? 6,
    granularity: granularityArg ?? 'month',
    startDate: null,
    endDate: null,
  };
}

/** Get grouping key + display label from a date string */
function getGroupKey(dateStr, granularity) {
  if (!dateStr) return null;
  const ym = dateStr.substring(0, 7); // "2025-10"
  const month = parseInt(ym.substring(5, 7), 10);
  const monthLabel = MONTH_NAMES[month - 1] || ym;

  if (granularity === 'week') {
    const day = parseInt(dateStr.substring(8, 10), 10);
    const week = Math.min(Math.ceil(day / 7), 4);
    return { key: `${ym}-S${week}`, label: `${monthLabel} S${week}` };
  }
  return { key: ym, label: ym };
}

function isCashAccount(account) {
  const code = String(account?.account_code || '').trim();
  const accountType = account?.account_type;
  const accountText = `${account?.account_name || ''} ${account?.account_category || ''}`;

  return (
    accountType === 'asset' &&
    (code.startsWith('5') || CASH_ACCOUNT_REGEX.test(accountText))
  );
}

function isOpeningBalanceEntry(group) {
  const ref = String(group?.entry_ref || '').trim();
  if (OPENING_ENTRY_REGEX.test(ref)) return true;

  return (group?.lines || []).every((line) =>
    OPENING_ENTRY_REGEX.test(String(line?.description || '').trim())
  );
}

function aggregateCashEntryGroups(entries = [], accountMap = new Map()) {
  const groups = new Map();

  (entries || []).forEach((entry) => {
    const key = entry.entry_ref || entry.id;
    const existing = groups.get(key) || {
      key,
      date: entry.transaction_date,
      entry_ref: entry.entry_ref || '',
      lines: [],
    };

    existing.lines.push(entry);
    groups.set(key, existing);
  });

  return Array.from(groups.values()).flatMap((group) => {
    if (isOpeningBalanceEntry(group)) {
      return [];
    }

    const cashDelta = group.lines.reduce((sum, line) => {
      const account = accountMap.get(line.account_code);
      if (!isCashAccount(account)) return sum;

      return sum + (parseFloat(line.debit) || 0) - (parseFloat(line.credit) || 0);
    }, 0);

    if (Math.abs(cashDelta) < 0.01) {
      return [];
    }

    return [{
      date: group.date,
      delta: Math.round(cashDelta * 100) / 100,
    }];
  });
}

/** Build empty buckets for the time range */
function buildEmptyBuckets({ periodMonths, granularity, startDate, endDate }) {
  const buckets = {};
  let rangeStart = null;
  let rangeEnd = null;

  if (startDate && endDate) {
    rangeStart = new Date(`${startDate}T00:00:00`);
    rangeEnd = new Date(`${endDate}T00:00:00`);
  } else {
    rangeEnd = new Date();
    rangeStart = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth() - periodMonths, 1);
  }

  const cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
  const lastMonth = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1);

  while (cursor <= lastMonth) {
    const ym = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = MONTH_NAMES[cursor.getMonth()];

    if (granularity === 'week') {
      for (let w = 1; w <= 4; w++) {
        const key = `${ym}-S${w}`;
        const label = `${monthLabel} S${w}`;
        buckets[key] = { key, month: key, label, income: 0, expenses: 0, net: 0 };
      }
    } else {
      buckets[ym] = { key: ym, month: ym, label: monthLabel, income: 0, expenses: 0, net: 0 };
    }

    cursor.setMonth(cursor.getMonth() + 1);
  }

  return buckets;
}

export const useCashFlow = (optionsOrPeriod = 6, granularityArg = 'month') => {
  const { user } = useAuth();
  const { applyCompanyScope } = useCompanyScope();
  const { periodMonths, granularity, startDate, endDate } = resolveParams(optionsOrPeriod, granularityArg);
  const [cashFlowData, setCashFlowData] = useState([]);
  const [summary, setSummary] = useState({ totalIn: 0, totalOut: 0, net: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCashFlow = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const resolvedEndDate = endDate || toIsoDate(new Date());
      const resolvedStartDate = startDate || (() => {
        const value = new Date();
        value.setMonth(value.getMonth() - periodMonths);
        return toIsoDate(value);
      })();

      let entriesQuery = supabase
        .from('accounting_entries')
        .select('id, entry_ref, transaction_date, account_code, debit, credit, description')
        .eq('user_id', user.id)
        .gte('transaction_date', resolvedStartDate)
        .lte('transaction_date', resolvedEndDate)
        .order('transaction_date', { ascending: true });

      entriesQuery = applyCompanyScope(entriesQuery, { includeUnassigned: false });

      const [{ data: entries, error: entriesError }, { data: accounts, error: accountsError }] = await Promise.all([
        entriesQuery,
        supabase
          .from('accounting_chart_of_accounts')
          .select('account_code, account_name, account_category, account_type')
          .eq('user_id', user.id),
      ]);

      if (entriesError) throw entriesError;
      if (accountsError) throw accountsError;

      // Build empty buckets based on granularity
      const buckets = buildEmptyBuckets({
        periodMonths,
        granularity,
        startDate: resolvedStartDate,
        endDate: resolvedEndDate,
      });

      const accountMap = new Map((accounts || []).map((account) => [account.account_code, account]));
      const cashMovements = aggregateCashEntryGroups(entries, accountMap);

      cashMovements.forEach((movement) => {
        const g = getGroupKey(movement.date, granularity);
        if (g && buckets[g.key]) {
          if (movement.delta >= 0) {
            buckets[g.key].income += movement.delta;
          } else {
            buckets[g.key].expenses += Math.abs(movement.delta);
          }
        }
      });

      const data = Object.values(buckets).map(m => ({
        ...m,
        net: Math.round((m.income - m.expenses) * 100) / 100,
        income: Math.round(m.income * 100) / 100,
        expenses: Math.round(m.expenses * 100) / 100,
      }));

      const totalIn = data.reduce((s, m) => s + m.income, 0);
      const totalOut = data.reduce((s, m) => s + m.expenses, 0);

      setCashFlowData(data);
      setSummary({ totalIn, totalOut, net: totalIn - totalOut });
    } catch (err) {
      console.error('fetchCashFlow error:', err);
      setError(err.message || 'Unable to fetch cash flow');
    } finally {
      setLoading(false);
    }
  }, [applyCompanyScope, user, periodMonths, granularity, startDate, endDate]);

  useEffect(() => {
    fetchCashFlow();
  }, [fetchCashFlow]);

  // Simple forecast: average of last 3 months projected forward
  const forecast = useCallback((months = 3) => {
    if (cashFlowData.length < 3) return [];
    const recent = cashFlowData.slice(-3);
    const avgIncome = recent.reduce((s, m) => s + m.income, 0) / 3;
    const avgExpenses = recent.reduce((s, m) => s + m.expenses, 0) / 3;

    const projections = [];
    const now = new Date();
    for (let i = 1; i <= months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      projections.push({
        key,
        label: key,
        income: Math.round(avgIncome * 100) / 100,
        expenses: Math.round(avgExpenses * 100) / 100,
        net: Math.round((avgIncome - avgExpenses) * 100) / 100,
        isForecast: true,
      });
    }
    return projections;
  }, [cashFlowData]);

  return { cashFlowData, summary, loading, error, forecast, refresh: fetchCashFlow };
};
