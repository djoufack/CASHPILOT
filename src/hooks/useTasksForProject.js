
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { triggerWebhook } from '@/utils/webhookTrigger';

const syncLegacyTaskTitle = (payload) => {
  const nextPayload = { ...payload };
  const hasTitle = Object.prototype.hasOwnProperty.call(nextPayload, 'title');
  const hasName = Object.prototype.hasOwnProperty.call(nextPayload, 'name');

  if (hasTitle) {
    const normalizedTitle = String(nextPayload.title || '').trim();
    nextPayload.title = normalizedTitle;
    nextPayload.name = normalizedTitle;
    return nextPayload;
  }

  if (hasName) {
    const normalizedName = String(nextPayload.name || '').trim();
    nextPayload.name = normalizedName;
    nextPayload.title = normalizedName;
  }

  return nextPayload;
};

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
          subtasks (
            id,
            task_id,
            title,
            status,
            due_date,
            started_at,
            completed_at,
            created_at,
            updated_at
          ),
          service:services(id, service_name, hourly_rate, pricing_type),
          invoice:invoices(id, invoice_number, total_ttc),
          quote:quotes(id, quote_number, total_ttc),
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
      const insertPayload = syncLegacyTaskTitle(taskData);
      const { data, error } = await supabase
        .from('tasks')
        .insert([{ ...insertPayload, project_id: projectId }])
        .select()
        .single();

      if (error) throw error;

      setTasks([data, ...tasks]);
      void triggerWebhook('task.created', {
        id: data.id,
        project_id: data.project_id,
        title: data.title || data.name,
        status: data.status,
      });
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
      const previousTask = tasks.find(t => t.id === taskId);
      const updatePayload = syncLegacyTaskTitle(updates);
      const { data, error } = await supabase
        .from('tasks')
        .update({ ...updatePayload, updated_at: new Date().toISOString() })
        .eq('id', taskId)
        .select()
        .single();

      if (error) throw error;

      setTasks(tasks.map(t => t.id === taskId ? { ...t, ...data } : t));
      if (previousTask?.status !== 'completed' && data.status === 'completed') {
        void triggerWebhook('task.completed', {
          id: data.id,
          project_id: data.project_id,
          title: data.title || data.name,
          status: data.status,
        });
      }
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
