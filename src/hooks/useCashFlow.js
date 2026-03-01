import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aou', 'Sep', 'Oct', 'Nov', 'Dec'];

function toIsoDate(date) {
  return date.toISOString().split('T')[0];
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

      // Fetch income (paid invoices) — column is "date" not "invoice_date"
      const { data: invoices } = await supabase
        .from('invoices')
        .select('total_ttc, date, status')
        .eq('user_id', user.id)
        .in('status', ['paid', 'sent'])
        .gte('date', resolvedStartDate)
        .lte('date', resolvedEndDate)
        .order('date', { ascending: true });

      // Fetch expenses — column is "expense_date" not "date"
      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount, expense_date, category')
        .eq('user_id', user.id)
        .gte('expense_date', resolvedStartDate)
        .lte('expense_date', resolvedEndDate)
        .order('expense_date', { ascending: true });

      // Build empty buckets based on granularity
      const buckets = buildEmptyBuckets({
        periodMonths,
        granularity,
        startDate: resolvedStartDate,
        endDate: resolvedEndDate,
      });

      (invoices || []).forEach(inv => {
        const g = getGroupKey(inv.date, granularity);
        if (g && buckets[g.key]) {
          buckets[g.key].income += parseFloat(inv.total_ttc || 0);
        }
      });

      (expenses || []).forEach(exp => {
        const g = getGroupKey(exp.expense_date, granularity);
        if (g && buckets[g.key]) {
          buckets[g.key].expenses += parseFloat(exp.amount || 0);
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
  }, [user, periodMonths, granularity, startDate, endDate]);

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
