
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';

export const useSubtasks = (taskId) => {
  const [subtasks, setSubtasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { toast } = useToast();

  const fetchSubtasks = useCallback(async () => {
    if (!taskId) return;
    if (!supabase) {
      console.warn("Supabase not configured");
      return;
    }
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('subtasks')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setSubtasks(data || []);
    } catch (err) {
      console.error('Error fetching subtasks:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  const createSubtask = async (subtaskData) => {
    if (!supabase) throw new Error("Supabase not configured");
    try {
      const { data, error } = await supabase
        .from('subtasks')
        .insert([{ ...subtaskData, task_id: taskId }])
        .select()
        .single();

      if (error) throw error;

      setSubtasks([...subtasks, data]);
      toast({
        title: "Success",
        description: "Subtask added"
      });
      return data;
    } catch (err) {
      toast({
        title: "Error creating subtask",
        description: err.message,
        variant: "destructive"
      });
      throw err;
    }
  };

  const updateSubtask = async (subtaskId, updates) => {
    if (!supabase) throw new Error("Supabase not configured");
    try {
      const { data, error } = await supabase
        .from('subtasks')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', subtaskId)
        .select()
        .single();

      if (error) throw error;

      setSubtasks(subtasks.map(s => s.id === subtaskId ? data : s));
      return data;
    } catch (err) {
      toast({
        title: "Error updating subtask",
        description: err.message,
        variant: "destructive"
      });
      throw err;
    }
  };

  const deleteSubtask = async (subtaskId) => {
    if (!supabase) throw new Error("Supabase not configured");
    try {
      const { error } = await supabase
        .from('subtasks')
        .delete()
        .eq('id', subtaskId);

      if (error) throw error;

      setSubtasks(subtasks.filter(s => s.id !== subtaskId));
      toast({
        title: "Success",
        description: "Subtask deleted"
      });
    } catch (err) {
      toast({
        title: "Error deleting subtask",
        description: err.message,
        variant: "destructive"
      });
      throw err;
    }
  };

  useEffect(() => {
    fetchSubtasks();

    if (!taskId || !supabase) return;

    const subscription = supabase
      .channel(`subtasks:task_id=eq.${taskId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'subtasks', 
        filter: `task_id=eq.${taskId}` 
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setSubtasks(prev => [...prev, payload.new]);
        } else if (payload.eventType === 'UPDATE') {
          setSubtasks(prev => prev.map(st => st.id === payload.new.id ? payload.new : st));
        } else if (payload.eventType === 'DELETE') {
          setSubtasks(prev => prev.filter(st => st.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [taskId, fetchSubtasks]);

  return {
    subtasks,
    loading,
    error,
    createSubtask,
    updateSubtask,
    deleteSubtask
  };
};
