
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export const useTasksWithStatus = (projectId, initialFilters = {}) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  
  const [filters, setFilters] = useState({
    status: 'all',
    priority: 'all',
    assignee: 'all',
    ...initialFilters
  });

  const [sortBy, setSortBy] = useState('created_at'); // created_at, due_date, priority

  const fetchTasks = useCallback(async () => {
    if (!projectId || !user) return;
    if (!supabase) {
      console.warn("Supabase not configured");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let query = supabase
        .from('tasks')
        .select(`
          *,
          subtasks (count),
          invoice:invoices(id, invoice_number, total),
          quote:quotes(id, quote_number, total),
          purchase_order:purchase_orders(id, po_number, total)
        `)
        .eq('project_id', projectId);

      // Filters
      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters.priority && filters.priority !== 'all') {
        query = query.eq('priority', filters.priority);
      }
      if (filters.assignee && filters.assignee !== 'all') {
        query = query.ilike('assigned_to', `%${filters.assignee}%`);
      }

      // Sorting
      if (sortBy === 'due_date') {
        query = query.order('due_date', { ascending: true, nullsFirst: false });
      } else if (sortBy === 'priority') {
        // Sort explicitly not easily supported in simple queries without CASE
        // fallback to client side or simple order
        query = query.order('priority', { ascending: false }); 
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query;

      if (error) throw error;
      setTasks(data || []);
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId, user, filters, sortBy]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return {
    tasks,
    loading,
    error,
    filters,
    setFilters,
    sortBy,
    setSortBy,
    refreshTasks: fetchTasks,
    setTasks // Exposed for optimistic updates
  };
};
