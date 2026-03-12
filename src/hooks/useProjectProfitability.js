
import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';

const isMissingProjectIdOnInvoices = (error) => {
  const message = String(error?.message || '').toLowerCase();
  const details = String(error?.details || '').toLowerCase();
  return message.includes('invoices.project_id') || message.includes('column project_id') || details.includes('invoices.project_id');
};

export function useProjectProfitability(projectId) {
  const { user } = useAuth();
  const { applyCompanyScope } = useCompanyScope();
  const [timesheets, setTimesheets] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    if (!user || !projectId) return;
    setLoading(true);
    setError(null);
    try {
      let timesheetsQuery = supabase
        .from('timesheets')
        .select('duration_minutes, hourly_rate, billable, invoice_id')
        .eq('project_id', projectId)
        .eq('user_id', user.id);

      let invoicesQuery = supabase
        .from('invoices')
        .select('id, total_ttc, payment_status, status')
        .eq('project_id', projectId)
        .eq('user_id', user.id);

      timesheetsQuery = applyCompanyScope(timesheetsQuery);
      invoicesQuery = applyCompanyScope(invoicesQuery);

      let [tsResult, invResult] = await Promise.all([
        timesheetsQuery,
        invoicesQuery,
      ]);

      if (invResult?.error && isMissingProjectIdOnInvoices(invResult.error)) {
        const invoiceIds = [...new Set((tsResult?.data || []).map((row) => row?.invoice_id).filter(Boolean))];
        if (invoiceIds.length > 0) {
          let fallbackInvoicesQuery = supabase
            .from('invoices')
            .select('id, total_ttc, payment_status, status')
            .in('id', invoiceIds)
            .eq('user_id', user.id);
          fallbackInvoicesQuery = applyCompanyScope(fallbackInvoicesQuery);
          invResult = await fallbackInvoicesQuery;
        } else {
          invResult = { data: [], error: null };
        }
      }

      if (tsResult?.error) throw tsResult.error;
      if (invResult?.error) throw invResult.error;

      setTimesheets(tsResult.data || []);
      setInvoices(invResult.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [applyCompanyScope, user, projectId]);

  const profitability = useMemo(() => {
    const totalHours = timesheets.reduce((s, t) => s + (t.duration_minutes || 0) / 60, 0);
    const billableHours = timesheets.filter(t => t.billable).reduce((s, t) => s + (t.duration_minutes || 0) / 60, 0);
    const laborCost = timesheets.reduce((s, t) => s + ((t.duration_minutes || 0) / 60) * (parseFloat(t.hourly_rate) || 0), 0);
    const totalExpenses = 0;
    const totalRevenue = invoices
      .filter(i => i.payment_status === 'paid' || i.status === 'paid')
      .reduce((s, i) => s + (parseFloat(i.total_ttc) || 0), 0);
    const pendingRevenue = invoices
      .filter(i => i.payment_status !== 'paid' && i.status !== 'paid')
      .reduce((s, i) => s + (parseFloat(i.total_ttc) || 0), 0);
    const totalCost = laborCost + totalExpenses;
    const grossMargin = totalRevenue - totalCost;
    const grossMarginPct = totalRevenue > 0 ? (grossMargin / totalRevenue) * 100 : 0;
    const utilizationRate = totalHours > 0 ? (billableHours / totalHours) * 100 : 0;

    return {
      totalHours: Math.round(totalHours * 10) / 10,
      billableHours: Math.round(billableHours * 10) / 10,
      laborCost: Math.round(laborCost * 100) / 100,
      totalExpenses: 0,
      totalCost: Math.round(totalCost * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      pendingRevenue: Math.round(pendingRevenue * 100) / 100,
      grossMargin: Math.round(grossMargin * 100) / 100,
      grossMarginPct: Math.round(grossMarginPct * 10) / 10,
      utilizationRate: Math.round(utilizationRate * 10) / 10,
    };
  }, [timesheets, invoices]);

  return { profitability, loading, error, fetchData };
}
