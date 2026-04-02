import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { formatDateInput } from '@/utils/dateFormatting';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { triggerWebhook } from '@/utils/webhookTrigger';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { useDataEntryGuard } from '@/hooks/useDataEntryGuard';

export const useExpenses = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { logAction } = useAuditLog();
  const { activeCompanyId, applyCompanyScope, withCompanyScope } = useCompanyScope();
  const { guardInput } = useDataEntryGuard();

  const [totalCount, setTotalCount] = useState(0);

  const {
    data: expenses,
    setData: setExpenses,
    loading,
    setLoading,
    error,
    setError,
  } = useSupabaseQuery(
    async () => {
      if (!user) return [];
      if (!supabase) {
        console.warn('Supabase not configured');
        return [];
      }
      let query = supabase
        .from('expenses')
        .select(
          '*, supplier:suppliers(id, company_name), approval_steps:expense_approval_steps(id, level, required_role, status, approver_id, decided_at, comment)'
        )
        .order('expense_date', { ascending: false });

      query = applyCompanyScope(query);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    { deps: [user, applyCompanyScope], defaultData: [], enabled: !!user }
  );

  const fetchExpenses = useCallback(
    async ({ page, pageSize } = {}) => {
      if (!user) return;
      if (!supabase) {
        console.warn('Supabase not configured');
        return;
      }
      setLoading(true);
      try {
        const usePagination = page != null && pageSize != null;
        let query = supabase
          .from('expenses')
          .select(
            '*, supplier:suppliers(id, company_name), approval_steps:expense_approval_steps(id, level, required_role, status, approver_id, decided_at, comment)',
            usePagination ? { count: 'exact' } : undefined
          )
          .order('expense_date', { ascending: false });

        query = applyCompanyScope(query);
        if (usePagination) {
          const from = (page - 1) * pageSize;
          const to = from + pageSize - 1;
          query = query.range(from, to);
        }

        const { data, error, count } = await query;

        if (error) throw error;
        setExpenses(data || []);
        if (usePagination && count != null) {
          setTotalCount(count);
        }
      } catch (err) {
        console.warn('Error fetching expenses:', err.message);
        setExpenses([]);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [applyCompanyScope, user, setLoading, setExpenses, setError]
  );

  const createExpense = async (expenseData) => {
    if (!user) return;
    if (!supabase) throw new Error('Supabase not configured');
    if (!activeCompanyId) {
      toast({ title: t('common.error'), description: t('hooks.expenses.noCompany'), variant: 'destructive' });
      return null;
    }
    setLoading(true);
    try {
      const guardedInput = guardInput({
        entity: 'expense',
        operation: 'create',
        payload: expenseData,
      });
      const guardedPayload = guardedInput.payload;
      const normalizedExpenseDate = guardedPayload.expense_date || guardedPayload.date || formatDateInput();
      const payload = withCompanyScope({
        ...guardedPayload,
        user_id: user.id,
        expense_date: normalizedExpenseDate,
      });
      delete payload.date;

      const { data, error } = await supabase.from('expenses').insert([payload]).select().single();

      if (error) throw error;

      logAction('create', 'expense', null, data);

      setExpenses([data, ...expenses]);
      void triggerWebhook('expense.created', {
        id: data.id,
        company_id: data.company_id,
        client_id: data.client_id,
        amount: data.amount,
        expense_date: data.expense_date,
      });
      return data;
    } catch (err) {
      setError(err.message);
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateExpense = async (id, updates) => {
    if (!user) return;
    if (!supabase) throw new Error('Supabase not configured');
    setLoading(true);
    try {
      const normalizedUpdates = { ...updates };
      if (updates.expense_date || updates.date) {
        normalizedUpdates.expense_date = updates.expense_date || updates.date;
      }
      delete normalizedUpdates.date;

      const existingExpense = expenses.find((entry) => entry.id === id) || null;
      const guardedInput = guardInput({
        entity: 'expense',
        operation: 'update',
        payload: normalizedUpdates,
        referencePayload: existingExpense,
      });

      const { data, error } = await supabase
        .from('expenses')
        .update(withCompanyScope(guardedInput.payload))
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      logAction('update', 'expense', null, data);
      setExpenses((prev) => prev.map((e) => (e.id === id ? data : e)));
      void triggerWebhook('expense.updated', {
        id: data.id,
        company_id: data.company_id,
        amount: data.amount,
        expense_date: data.expense_date,
      });
      toast({ title: t('hooks.accounting.success'), description: t('hooks.expenses.updated') });
      return data;
    } catch (err) {
      setError(err.message);
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteExpense = async (id) => {
    if (!user) return;
    if (!supabase) throw new Error('Supabase not configured');
    setLoading(true);
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
      logAction('delete', 'expense', { id }, null);
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      void triggerWebhook('expense.deleted', { id });
      toast({ title: t('hooks.accounting.success'), description: t('hooks.expenses.deleted') });
    } catch (err) {
      setError(err.message);
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const advanceApproval = useCallback(
    async (id, comment = null) => {
      if (!user) return null;
      if (!supabase) throw new Error('Supabase not configured');
      setLoading(true);
      try {
        const { error } = await supabase.rpc('expense_approve_step', {
          p_expense_id: id,
          p_comment: comment || null,
        });
        if (error) throw error;
        await fetchExpenses();
        toast({
          title: t('hooks.expenses.approvalUpdatedTitle', 'Approbation mise a jour'),
          description: t('hooks.expenses.approvalUpdatedDesc', 'La depense a ete validee sur le niveau courant.'),
        });
        return true;
      } catch (err) {
        setError(err.message);
        toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchExpenses, setError, setLoading, t, toast, user]
  );

  const rejectApproval = useCallback(
    async (id, reason = null) => {
      if (!user) return null;
      if (!supabase) throw new Error('Supabase not configured');
      setLoading(true);
      try {
        const { error } = await supabase.rpc('expense_reject_step', {
          p_expense_id: id,
          p_reason: reason || null,
        });
        if (error) throw error;
        await fetchExpenses();
        toast({
          title: t('hooks.expenses.approvalUpdatedTitle', 'Approbation mise a jour'),
          description: t('hooks.expenses.approvalRejectedDesc', 'La depense a ete rejetee.'),
        });
        return true;
      } catch (err) {
        setError(err.message);
        toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchExpenses, setError, setLoading, t, toast, user]
  );

  const resetApproval = useCallback(
    async (id) => {
      if (!user) return null;
      if (!supabase) throw new Error('Supabase not configured');
      setLoading(true);
      try {
        const { error } = await supabase.rpc('expense_reset_approval_workflow', {
          p_expense_id: id,
        });
        if (error) throw error;
        await fetchExpenses();
        toast({
          title: t('hooks.expenses.approvalUpdatedTitle', 'Approbation mise a jour'),
          description: t('hooks.expenses.approvalResetDesc', "Le workflow d'approbation a ete reinitialise."),
        });
        return true;
      } catch (err) {
        setError(err.message);
        toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchExpenses, setError, setLoading, t, toast, user]
  );

  return {
    expenses,
    loading,
    error,
    totalCount,
    fetchExpenses,
    createExpense,
    updateExpense,
    deleteExpense,
    advanceApproval,
    rejectApproval,
    resetApproval,
  };
};
