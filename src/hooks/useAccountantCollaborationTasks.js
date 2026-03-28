import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { useToast } from '@/components/ui/use-toast';

export function useAccountantCollaborationTasks() {
  const { user } = useAuth();
  const { applyCompanyScope, withCompanyScope } = useCompanyScope();
  const { toast } = useToast();
  const [actionLoading, setActionLoading] = useState(false);

  const {
    data: tasks,
    setData: setTasks,
    loading: tasksLoading,
    error: tasksError,
    refetch: refetchTasks,
  } = useSupabaseQuery(
    async () => {
      if (!user || !supabase) return [];
      let query = supabase
        .from('accountant_collaboration_tasks')
        .select('*')
        .order('status', { ascending: true })
        .order('priority', { ascending: false })
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });
      query = applyCompanyScope(query);
      const { data, error } = await query;
      if (error) {
        if (error.code === '42P01' || error.code === '42P17' || error.code === '42501') {
          return [];
        }
        throw error;
      }
      return data || [];
    },
    { deps: [user, applyCompanyScope], defaultData: [], enabled: !!user }
  );

  const createTask = useCallback(
    async ({ title, description, priority = 'medium', dueDate = null, accountantUserId = null }) => {
      if (!user || !supabase) return null;
      setActionLoading(true);
      try {
        const payload = withCompanyScope({
          user_id: user.id,
          accountant_user_id: accountantUserId || null,
          title: String(title || '').trim(),
          description: description || null,
          priority,
          due_date: dueDate || null,
          status: 'todo',
        });
        const { data, error } = await supabase.from('accountant_collaboration_tasks').insert(payload).select().single();
        if (error) throw error;
        setTasks((previous) => [data, ...previous]);
        toast({
          title: 'Tache creee',
          description: 'La tache a ete ajoutee a l espace collaboratif.',
        });
        return data;
      } catch (err) {
        toast({
          title: 'Erreur creation tache',
          description: err.message,
          variant: 'destructive',
        });
        throw err;
      } finally {
        setActionLoading(false);
      }
    },
    [setTasks, toast, user, withCompanyScope]
  );

  const updateTaskStatus = useCallback(
    async (taskId, status) => {
      if (!supabase || !taskId) return null;
      setActionLoading(true);
      try {
        const updates = {
          status,
          completed_at: status === 'done' ? new Date().toISOString() : null,
        };
        const { data, error } = await supabase
          .from('accountant_collaboration_tasks')
          .update(updates)
          .eq('id', taskId)
          .select()
          .single();
        if (error) throw error;
        setTasks((previous) => previous.map((task) => (task.id === taskId ? { ...task, ...data } : task)));
        return data;
      } catch (err) {
        toast({
          title: 'Erreur mise a jour tache',
          description: err.message,
          variant: 'destructive',
        });
        throw err;
      } finally {
        setActionLoading(false);
      }
    },
    [setTasks, toast]
  );

  const deleteTask = useCallback(
    async (taskId) => {
      if (!supabase || !taskId) return;
      setActionLoading(true);
      try {
        const { error } = await supabase.from('accountant_collaboration_tasks').delete().eq('id', taskId);
        if (error) throw error;
        setTasks((previous) => previous.filter((task) => task.id !== taskId));
      } catch (err) {
        toast({
          title: 'Erreur suppression tache',
          description: err.message,
          variant: 'destructive',
        });
        throw err;
      } finally {
        setActionLoading(false);
      }
    },
    [setTasks, toast]
  );

  return {
    tasks,
    tasksLoading,
    tasksError,
    actionLoading,
    createTask,
    updateTaskStatus,
    deleteTask,
    refetchTasks,
    loading: tasksLoading || actionLoading,
    error: tasksError,
  };
}

export default useAccountantCollaborationTasks;
