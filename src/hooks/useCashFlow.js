import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export const useCashFlow = (periodMonths = 6) => {
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

      // Fetch income (paid invoices)
      const { data: invoices } = await supabase
        .from('invoices')
        .select('total_ttc, invoice_date, status')
        .eq('user_id', user.id)
        .in('status', ['paid', 'sent'])
        .gte('invoice_date', startDate.toISOString().split('T')[0])
        .order('invoice_date', { ascending: true });

      // Fetch expenses
      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount, date, category')
        .eq('user_id', user.id)
        .gte('date', startDate.toISOString().split('T')[0])
        .order('date', { ascending: true });

      // Group by month
      const monthlyData = {};
      const now = new Date();
      for (let i = periodMonths; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthlyData[key] = { month: key, income: 0, expenses: 0, net: 0 };
      }

      (invoices || []).forEach(inv => {
        const key = inv.invoice_date?.substring(0, 7);
        if (key && monthlyData[key]) {
          monthlyData[key].income += parseFloat(inv.total_ttc || 0);
        }
      });

      (expenses || []).forEach(exp => {
        const key = exp.date?.substring(0, 7);
        if (key && monthlyData[key]) {
          monthlyData[key].expenses += parseFloat(exp.amount || 0);
        }
      });

      const data = Object.values(monthlyData).map(m => ({
        ...m,
        net: m.income - m.expenses,
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
  }, [user, periodMonths]);

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
        month: key,
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
