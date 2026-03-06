import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateInput } from '@/utils/dateFormatting';
import { useCompanyScope } from '@/hooks/useCompanyScope';

const DEFAULT_THRESHOLDS = {
  low_balance: 1000,      // Alert when balance below this
  large_expense: 5000,    // Alert for expenses above this
  unusual_pattern: true,   // Alert for unusual spending patterns
};

export const useBankAlerts = () => {
  const { user } = useAuth();
  const { applyCompanyScope } = useCompanyScope();
  const [alerts, setAlerts] = useState([]);
  const [thresholds, setThresholds] = useState(() => {
    const saved = localStorage.getItem('cashpilot-bank-thresholds');
    return saved ? JSON.parse(saved) : DEFAULT_THRESHOLDS;
  });

  const checkAlerts = useCallback(async () => {
    if (!user) return;

    const newAlerts = [];

    try {
      // Check bank balances
      let connectionsQuery = supabase
        .from('bank_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active');
      connectionsQuery = applyCompanyScope(connectionsQuery, { includeUnassigned: false });
      const { data: connections } = await connectionsQuery;

      (connections || []).forEach(conn => {
        if (conn.account_balance !== null && conn.account_balance < thresholds.low_balance) {
          newAlerts.push({
            type: 'low_balance',
            severity: conn.account_balance < 0 ? 'critical' : 'warning',
            title: `Solde bas: ${conn.account_name || conn.account_iban}`,
            description: `Le solde est de ${conn.account_balance?.toFixed(2)}\u20AC (seuil: ${thresholds.low_balance}\u20AC)`,
            account: conn.account_name,
            amount: conn.account_balance,
          });
        }
      });

      // Check for large recent expenses
      const weekAgo = formatDateInput(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
      let recentExpensesQuery = supabase
        .from('expenses')
        .select('description, amount, date')
        .eq('user_id', user.id)
        .gte('date', weekAgo)
        .gt('amount', thresholds.large_expense);
      recentExpensesQuery = applyCompanyScope(recentExpensesQuery);
      const { data: recentExpenses } = await recentExpensesQuery;

      (recentExpenses || []).forEach(exp => {
        newAlerts.push({
          type: 'large_expense',
          severity: 'info',
          title: `D\u00E9pense importante: ${exp.amount?.toFixed(2)}\u20AC`,
          description: `${exp.description} le ${exp.date}`,
          amount: exp.amount,
        });
      });

      // Check overdue invoices
      const today = formatDateInput();
      let overdueInvoicesQuery = supabase
        .from('invoices')
        .select('invoice_number, total_ttc, due_date, client:clients(company_name, contact_name)')
        .eq('user_id', user.id)
        .in('status', ['sent', 'overdue'])
        .lt('due_date', today);
      overdueInvoicesQuery = applyCompanyScope(overdueInvoicesQuery);
      const { data: overdue } = await overdueInvoicesQuery;

      (overdue || []).forEach(inv => {
        const daysOverdue = Math.floor((Date.now() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24));
        newAlerts.push({
          type: 'overdue_invoice',
          severity: daysOverdue > 30 ? 'critical' : daysOverdue > 14 ? 'warning' : 'info',
          title: `Facture impay\u00E9e: ${inv.invoice_number}`,
          description: `${inv.client?.company_name || inv.client?.contact_name || 'Client'} - ${inv.total_ttc?.toFixed(2)}\u20AC - ${daysOverdue} jours de retard`,
          amount: inv.total_ttc,
        });
      });

      setAlerts(newAlerts);
    } catch (err) {
      console.error('checkAlerts error:', err);
    }
  }, [applyCompanyScope, user, thresholds]);

  useEffect(() => {
    checkAlerts();
  }, [checkAlerts]);

  const updateThresholds = useCallback((newThresholds) => {
    const updated = { ...thresholds, ...newThresholds };
    setThresholds(updated);
    localStorage.setItem('cashpilot-bank-thresholds', JSON.stringify(updated));
  }, [thresholds]);

  const dismissAlert = useCallback((index) => {
    setAlerts(prev => prev.filter((_, i) => i !== index));
  }, []);

  return { alerts, thresholds, updateThresholds, checkAlerts, dismissAlert };
};
