
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';

export const useExpenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { logAction } = useAuditLog();

  const [totalCount, setTotalCount] = useState(0);

  const fetchExpenses = async ({ page, pageSize } = {}) => {
    if (!user) return;
    if (!supabase) {
      console.warn("Supabase not configured");
      return;
    }
    setLoading(true);
    try {
      // Fetch expenses ordered by date (newest first)
      const usePagination = page != null && pageSize != null;
      let query = supabase
        .from('expenses')
        .select('*', usePagination ? { count: 'exact' } : undefined)
        .order('date', { ascending: false });

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
  };

  const createExpense = async (expenseData) => {
    if (!user) return;
    if (!supabase) throw new Error("Supabase not configured");
    setLoading(true);
    try {
      // Ensure date is present, default to now if not provided
      // Also set expense_date (DATE type) for accounting trigger
      const payload = {
        ...expenseData,
        user_id: user.id,
        date: expenseData.date || new Date().toISOString(),
        expense_date: expenseData.expense_date || expenseData.date || new Date().toISOString().split('T')[0]
      };

      const { data, error } = await supabase
        .from('expenses')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      logAction('create', 'expense', null, data);

      setExpenses([data, ...expenses]);
      return data;
    } catch (err) {
      setError(err.message);
      toast({
        title: "Error creating expense",
        description: err.message,
        variant: "destructive"
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [user]);

  return {
    expenses,
    loading,
    error,
    totalCount,
    fetchExpenses,
    createExpense
  };
};
