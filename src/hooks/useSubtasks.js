import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { useCompanyScope } from '@/hooks/useCompanyScope';

export const useSubtasks = (taskId) => {
  const [subtasks, setSubtasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { toast } = useToast();
  const { activeCompanyId, applyCompanyScope, withCompanyScope } = useCompanyScope();

  const fetchSubtasks = useCallback(async () => {
    if (!taskId || !activeCompanyId) return;
    if (!supabase) {
      console.warn('Supabase not configured');
      return;
    }

    setLoading(true);
    try {
      let query = supabase.from('subtasks').select('*').eq('task_id', taskId).order('created_at', { ascending: true });
      query = applyCompanyScope(query);
      const { data, error } = await query;

      if (error) throw error;
      setSubtasks(data || []);
    } catch (err) {
      console.error('Error fetching subtasks:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [taskId, activeCompanyId, applyCompanyScope]);

  const createSubtask = async (subtaskData) => {
    if (!supabase) throw new Error('Supabase not configured');
    if (!activeCompanyId) throw new Error('No active company selected');
    try {
      const { data, error } = await supabase
        .from('subtasks')
        .insert([{ ...withCompanyScope(subtaskData), task_id: taskId }])
        .select()
        .single();

      if (error) throw error;

      setSubtasks([...subtasks, data]);
      toast({
        title: 'Success',
        description: 'Subtask added',
      });
      return data;
    } catch (err) {
      toast({
        title: 'Error creating subtask',
        description: err.message,
        variant: 'destructive',
      });
      throw err;
    }
  };

  const updateSubtask = async (subtaskId, updates) => {
    if (!supabase) throw new Error('Supabase not configured');
    if (!activeCompanyId) throw new Error('No active company selected');
    try {
      let query = supabase
        .from('subtasks')
        .update(withCompanyScope({ ...updates, updated_at: new Date().toISOString() }))
        .eq('id', subtaskId)
        .select();
      query = applyCompanyScope(query);
      const { data, error } = await query.single();

      if (error) throw error;

      setSubtasks(subtasks.map((s) => (s.id === subtaskId ? data : s)));
      return data;
    } catch (err) {
      toast({
        title: 'Error updating subtask',
        description: err.message,
        variant: 'destructive',
      });
      throw err;
    }
  };

  const deleteSubtask = async (subtaskId) => {
    if (!supabase) throw new Error('Supabase not configured');
    if (!activeCompanyId) throw new Error('No active company selected');
    try {
      let query = supabase.from('subtasks').delete().eq('id', subtaskId);
      query = applyCompanyScope(query);
      const { error } = await query;

      if (error) throw error;

      setSubtasks(subtasks.filter((s) => s.id !== subtaskId));
      toast({
        title: 'Success',
        description: 'Subtask deleted',
      });
    } catch (err) {
      toast({
        title: 'Error deleting subtask',
        description: err.message,
        variant: 'destructive',
      });
      throw err;
    }
  };

  useEffect(() => {
    if (!taskId || !activeCompanyId || !supabase) return;

    fetchSubtasks();

    const channel = supabase
      .channel(`subtasks:task_id=eq.${taskId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subtasks',
          filter: `task_id=eq.${taskId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setSubtasks((prev) => [...prev, payload.new]);
          } else if (payload.eventType === 'UPDATE') {
            setSubtasks((prev) => prev.map((st) => (st.id === payload.new.id ? payload.new : st)));
          } else if (payload.eventType === 'DELETE') {
            setSubtasks((prev) => prev.filter((st) => st.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, activeCompanyId]);

  return {
    subtasks,
    loading,
    error,
    createSubtask,
    updateSubtask,
    deleteSubtask,
  };
};
