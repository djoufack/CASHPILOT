
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';

export const useTasksForProject = (projectId, filters = {}) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { toast } = useToast();

  const fetchTasks = useCallback(async () => {
    if (!projectId) return;
    if (!supabase) {
      console.warn("Supabase not configured");
      return;
    }
    
    setLoading(true);
    try {
      let query = supabase
        .from('tasks')
        .select(`
          *,
          subtasks (count),
          service:services(id, service_name, hourly_rate, pricing_type),
          invoice:invoices(id, invoice_number, total),
          quote:quotes(id, quote_number, total),
          purchase_order:purchase_orders(id, po_number, total)
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters.priority && filters.priority !== 'all') {
        query = query.eq('priority', filters.priority);
      }
      if (filters.assigned_to) {
        query = query.ilike('assigned_to', `%${filters.assigned_to}%`);
      }
      if (filters.search) {
        query = query.ilike('title', `%${filters.search}%`);
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
  }, [projectId, filters.status, filters.priority, filters.assigned_to, filters.search]);

  const createTask = async (taskData) => {
    if (!supabase) throw new Error("Supabase not configured");
    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert([{ ...taskData, project_id: projectId }])
        .select()
        .single();

      if (error) throw error;

      setTasks([data, ...tasks]);
      toast({
        title: "Success",
        description: "Task created successfully"
      });
      return data;
    } catch (err) {
      toast({
        title: "Error creating task",
        description: err.message,
        variant: "destructive"
      });
      throw err;
    }
  };

  const updateTask = async (taskId, updates) => {
    if (!supabase) throw new Error("Supabase not configured");
    try {
      const { data, error } = await supabase
        .from('tasks')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', taskId)
        .select()
        .single();

      if (error) throw error;

      setTasks(tasks.map(t => t.id === taskId ? { ...t, ...data } : t));
      toast({
        title: "Success",
        description: "Task updated successfully"
      });
      return data;
    } catch (err) {
      toast({
        title: "Error updating task",
        description: err.message,
        variant: "destructive"
      });
      throw err;
    }
  };

  const deleteTask = async (taskId) => {
    if (!supabase) throw new Error("Supabase not configured");
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      setTasks(tasks.filter(t => t.id !== taskId));
      toast({
        title: "Success",
        description: "Task deleted successfully"
      });
    } catch (err) {
      toast({
        title: "Error deleting task",
        description: err.message,
        variant: "destructive"
      });
      throw err;
    }
  };

  useEffect(() => {
    fetchTasks();
    
    if (!projectId || !supabase) return;

    // Simplified subscription - in real app, might need more robust handling
    const subscription = supabase
      .channel(`tasks:project_id=eq.${projectId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'tasks', 
        filter: `project_id=eq.${projectId}` 
      }, () => {
        fetchTasks(); // Refetch to get relations properly
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [projectId, fetchTasks]);

  return {
    tasks,
    loading,
    error,
    createTask,
    updateTask,
    deleteTask,
    refreshTasks: fetchTasks
  };
};
