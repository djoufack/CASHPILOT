import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { triggerWebhook } from '@/utils/webhookTrigger';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { isMissingColumnError } from '@/lib/supabaseCompatibility';

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
  const { activeCompanyId, applyCompanyScope, withCompanyScope } = useCompanyScope();

  const fetchTasks = useCallback(async () => {
    if (!projectId || !activeCompanyId) return;
    if (!supabase) {
      console.warn('Supabase not configured');
      return;
    }

    setLoading(true);
    try {
      const buildTasksQuery = (mode = 'full') => {
        const subtaskColumnsByMode = {
          full: [
            'id',
            'task_id',
            'title',
            'status',
            'due_date',
            'started_at',
            'completed_at',
            'created_at',
            'updated_at',
          ],
          legacy: ['id', 'task_id', 'title', 'status', 'created_at', 'updated_at'],
        };
        const subtaskColumns = (subtaskColumnsByMode[mode] || subtaskColumnsByMode.legacy).join(',\n            ');

        let query = supabase
          .from('tasks')
          .select(
            `
          *,
          subtasks (
            ${subtaskColumns}
          ),
          service:services(id, service_name, hourly_rate, pricing_type),
          invoice:invoices(id, invoice_number, total_ttc),
          quote:quotes(id, quote_number, total_ttc),
          purchase_order:purchase_orders(id, po_number, total)
        `
          )
          .eq('project_id', projectId)
          .order('created_at', { ascending: false });

        query = applyCompanyScope(query);

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

        return query;
      };

      let { data, error } = await buildTasksQuery('full');

      if (error && isMissingColumnError(error) && String(error.message || '').includes('subtasks_1.')) {
        const fallbackResult = await buildTasksQuery('legacy');
        data = fallbackResult.data;
        error = fallbackResult.error;
      }

      if (error) throw error;
      setTasks(data || []);
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [
    projectId,
    activeCompanyId,
    applyCompanyScope,
    filters.status,
    filters.priority,
    filters.assigned_to,
    filters.search,
  ]);

  const createTask = async (taskData) => {
    if (!supabase) throw new Error('Supabase not configured');
    if (!activeCompanyId) throw new Error('No active company selected');
    try {
      const insertPayload = syncLegacyTaskTitle(taskData);
      const { data, error } = await supabase
        .from('tasks')
        .insert([{ ...withCompanyScope(insertPayload), project_id: projectId }])
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
        title: 'Success',
        description: 'Task created successfully',
      });
      return data;
    } catch (err) {
      toast({
        title: 'Error creating task',
        description: err.message,
        variant: 'destructive',
      });
      throw err;
    }
  };

  const updateTask = async (taskId, updates) => {
    if (!supabase) throw new Error('Supabase not configured');
    if (!activeCompanyId) throw new Error('No active company selected');
    try {
      const previousTask = tasks.find((t) => t.id === taskId);
      const updatePayload = syncLegacyTaskTitle(updates);
      let query = supabase
        .from('tasks')
        .update(withCompanyScope({ ...updatePayload, updated_at: new Date().toISOString() }))
        .eq('id', taskId)
        .select();
      query = applyCompanyScope(query);
      const { data, error } = await query.single();

      if (error) throw error;

      setTasks(tasks.map((t) => (t.id === taskId ? { ...t, ...data } : t)));
      if (previousTask?.status !== 'completed' && data.status === 'completed') {
        void triggerWebhook('task.completed', {
          id: data.id,
          project_id: data.project_id,
          title: data.title || data.name,
          status: data.status,
        });
      }
      toast({
        title: 'Success',
        description: 'Task updated successfully',
      });
      return data;
    } catch (err) {
      toast({
        title: 'Error updating task',
        description: err.message,
        variant: 'destructive',
      });
      throw err;
    }
  };

  const deleteTask = async (taskId) => {
    if (!supabase) throw new Error('Supabase not configured');
    if (!activeCompanyId) throw new Error('No active company selected');
    try {
      let query = supabase.from('tasks').delete().eq('id', taskId);
      query = applyCompanyScope(query);
      const { error } = await query;

      if (error) throw error;

      setTasks(tasks.filter((t) => t.id !== taskId));
      toast({
        title: 'Success',
        description: 'Task deleted successfully',
      });
    } catch (err) {
      toast({
        title: 'Error deleting task',
        description: err.message,
        variant: 'destructive',
      });
      throw err;
    }
  };

  useEffect(() => {
    fetchTasks();

    if (!projectId || !activeCompanyId || !supabase) return;

    // Simplified subscription - in real app, might need more robust handling
    const subscription = supabase
      .channel(`tasks:project_id=eq.${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          fetchTasks(); // Refetch to get relations properly
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [projectId, activeCompanyId, fetchTasks]);

  return {
    tasks,
    loading,
    error,
    createTask,
    updateTask,
    deleteTask,
    refreshTasks: fetchTasks,
  };
};
