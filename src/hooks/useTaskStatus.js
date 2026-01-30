
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';

export const useTaskStatus = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { toast } = useToast();

  const updateTaskStatus = async (taskId, newStatus, currentTask = {}) => {
    if (!supabase) {
      toast({
        title: "Configuration Error",
        description: "Supabase is not configured",
        variant: "destructive"
      });
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const updates = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      // Handle timestamp updates based on status change
      if (newStatus === 'in_progress' && !currentTask.started_at) {
        updates.started_at = new Date().toISOString();
      } else if (newStatus === 'completed') {
        updates.completed_at = new Date().toISOString();
        // If it was never marked as started, mark it started now too
        if (!currentTask.started_at) {
           updates.started_at = new Date().toISOString(); 
        }
      } else if (newStatus === 'pending') {
        // Reset timestamps if moving back to pending? 
        // Usually safer to keep history, but for strict state management:
        updates.completed_at = null;
        updates.started_at = null;
      }

      const { data, error: updateError } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId)
        .select()
        .single();

      if (updateError) throw updateError;

      toast({
        title: "Status Updated",
        description: `Task moved to ${newStatus.replace('_', ' ')}`,
      });

      return data;
    } catch (err) {
      console.error('Error updating task status:', err);
      setError(err.message);
      toast({
        title: "Update Failed",
        description: err.message,
        variant: "destructive"
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    updateTaskStatus,
    loading,
    error
  };
};
