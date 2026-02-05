import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

const DEFAULT_THRESHOLDS = {
  low_balance: 1000,      // Alert when balance below this
  large_expense: 5000,    // Alert for expenses above this
  unusual_pattern: true,   // Alert for unusual spending patterns
};

export const useBankAlerts = () => {
  const { user } = useAuth();
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
      const { data: connections } = await supabase
        .from('bank_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active');

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
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const { data: recentExpenses } = await supabase
        .from('expenses')
        .select('description, amount, date')
        .eq('user_id', user.id)
        .gte('date', weekAgo)
        .gt('amount', thresholds.large_expense);

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
      const today = new Date().toISOString().split('T')[0];
      const { data: overdue } = await supabase
        .from('invoices')
        .select('invoice_number, total_ttc, due_date, client:clients(name)')
        .eq('user_id', user.id)
        .in('status', ['sent', 'overdue'])
        .lt('due_date', today);

      (overdue || []).forEach(inv => {
        const daysOverdue = Math.floor((Date.now() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24));
        newAlerts.push({
          type: 'overdue_invoice',
          severity: daysOverdue > 30 ? 'critical' : daysOverdue > 14 ? 'warning' : 'info',
          title: `Facture impay\u00E9e: ${inv.invoice_number}`,
          description: `${inv.client?.name} - ${inv.total_ttc?.toFixed(2)}\u20AC - ${daysOverdue} jours de retard`,
          amount: inv.total_ttc,
        });
      });

      setAlerts(newAlerts);
    } catch (err) {
      console.error('checkAlerts error:', err);
    }
  }, [user, thresholds]);

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
