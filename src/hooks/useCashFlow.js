import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aou', 'Sep', 'Oct', 'Nov', 'Dec'];

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
function buildEmptyBuckets(periodMonths, granularity) {
  const buckets = {};
  const now = new Date();
  for (let i = periodMonths; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = MONTH_NAMES[d.getMonth()];

    if (granularity === 'week') {
      for (let w = 1; w <= 4; w++) {
        const key = `${ym}-S${w}`;
        const label = `${monthLabel} S${w}`;
        buckets[key] = { key, label, income: 0, expenses: 0, net: 0 };
      }
    } else {
      buckets[ym] = { key: ym, label: ym, income: 0, expenses: 0, net: 0 };
    }
  }
  return buckets;
}

export const useCashFlow = (periodMonths = 6, granularity = 'month') => {
  const { user } = useAuth();
  const [cashFlowData, setCashFlowData] = useState([]);
  const [summary, setSummary] = useState({ totalIn: 0, totalOut: 0, net: 0 });
  const [loading, setLoading] = useState(true);

  const fetchCashFlow = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - periodMonths);

      // Fetch income (paid invoices) — column is "date" not "invoice_date"
      const { data: invoices } = await supabase
        .from('invoices')
        .select('total_ttc, date, status')
        .eq('user_id', user.id)
        .in('status', ['paid', 'sent'])
        .gte('date', startDate.toISOString().split('T')[0])
        .order('date', { ascending: true });

      // Fetch expenses — column is "expense_date" not "date"
      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount, expense_date, category')
        .eq('user_id', user.id)
        .gte('expense_date', startDate.toISOString().split('T')[0])
        .order('expense_date', { ascending: true });

      // Build empty buckets based on granularity
      const buckets = buildEmptyBuckets(periodMonths, granularity);

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
    } finally {
      setLoading(false);
    }
  }, [user, periodMonths, granularity]);

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

  return { cashFlowData, summary, loading, forecast, refresh: fetchCashFlow };
};
