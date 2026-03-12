import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';

export const usePaymentReminders = () => {
  const { user } = useAuth();
  const { applyCompanyScope, withCompanyScope } = useCompanyScope();
  const [rules, setRules] = useState([]);
  const [reminderLogs, setReminderLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRules = useCallback(async () => {
    if (!user) return;
    try {
      let query = supabase
        .from('payment_reminder_rules')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      query = applyCompanyScope(query, { includeUnassigned: false });

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setRules(data || []);
    } catch (err) {
      console.error('fetchRules error:', err);
      setError(err.message);
    }
  }, [applyCompanyScope, user]);

  const fetchReminderLogs = useCallback(async () => {
    if (!user) return;
    try {
      let query = supabase
        .from('payment_reminder_logs')
        .select(`
          *,
          invoice:invoices(
            id,
            invoice_number,
            total_ttc,
            client_id,
            client:clients!fk_invoices_client_scope(id, company_name, contact_name, email, preferred_currency)
          ),
          rule:payment_reminder_rules(id, name)
        `)
        .eq('user_id', user.id)
        .order('sent_at', { ascending: false })
        .limit(100);
      query = applyCompanyScope(query, { includeUnassigned: false });

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setReminderLogs(data || []);
    } catch (err) {
      console.error('fetchReminderLogs error:', err);
      setError(err.message);
    }
  }, [applyCompanyScope, user]);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    await Promise.all([fetchRules(), fetchReminderLogs()]);
    setLoading(false);
  }, [user, fetchRules, fetchReminderLogs]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const addRule = async (rule) => {
    if (!user) return;
    try {
      const { data, error: insertError } = await supabase
        .from('payment_reminder_rules')
        .insert({
          ...withCompanyScope(rule),
          user_id: user.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      await fetchRules();
      return data;
    } catch (err) {
      console.error('addRule error:', err);
      throw err;
    }
  };

  const updateRule = async (id, updates) => {
    if (!user) return;
    try {
      const { error: updateError } = await supabase
        .from('payment_reminder_rules')
        .update(withCompanyScope({ ...updates, updated_at: new Date().toISOString() }))
        .eq('id', id)
        .eq('user_id', user.id);

      if (updateError) throw updateError;
      await fetchRules();
    } catch (err) {
      console.error('updateRule error:', err);
      throw err;
    }
  };

  const deleteRule = async (id) => {
    if (!user) return;
    try {
      const { error: deleteError } = await supabase
        .from('payment_reminder_rules')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;
      await fetchRules();
    } catch (err) {
      console.error('deleteRule error:', err);
      throw err;
    }
  };

  const toggleRule = async (id, isActive) => {
    await updateRule(id, { is_active: isActive });
  };

  return {
    rules,
    reminderLogs,
    loading,
    error,
    addRule,
    updateRule,
    deleteRule,
    toggleRule,
    refresh: fetchAll,
  };
};
