
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export const useProjectStatus = (projectId) => {
  const [status, setStatus] = useState('active');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    in_progress: 0,
    completed: 0,
    on_hold: 0,
    cancelled: 0,
    progress: 0
  });

  const calculateProjectStatus = useCallback(async () => {
    if (!projectId) return;
    if (!supabase) {
      console.warn("Supabase not configured");
      return;
    }

    setLoading(true);
    try {
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('status')
        .eq('project_id', projectId);

      if (error) throw error;

      if (!tasks || tasks.length === 0) {
        setStats({ total: 0, pending: 0, in_progress: 0, completed: 0, on_hold: 0, cancelled: 0, progress: 0 });
        return;
      }

      const counts = tasks.reduce((acc, task) => {
        acc[task.status] = (acc[task.status] || 0) + 1;
        return acc;
      }, { pending: 0, in_progress: 0, completed: 0, on_hold: 0, cancelled: 0 });

      const total = tasks.length;
      const progress = total > 0 ? Math.round((counts.completed / total) * 100) : 0;

      setStats({
        total,
        ...counts,
        progress
      });

      // Logic for project status based on tasks
      let newProjectStatus = 'active';
      if (counts.completed === total && total > 0) {
        newProjectStatus = 'completed';
      } else if (counts.cancelled === total && total > 0) {
        newProjectStatus = 'cancelled';
      } else if (counts.on_hold > 0 && counts.in_progress === 0 && counts.completed !== total) {
        newProjectStatus = 'on_hold';
      }

      // Optionally update project status in DB if it changed
      // Note: This might cause race conditions if multiple users view the page, 
      // but is often acceptable for simple implementations.
      // await supabase.from('projects').update({ status: newProjectStatus }).eq('id', projectId);
      
      setStatus(newProjectStatus);

    } catch (err) {
      console.error('Error calculating project status:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    calculateProjectStatus();
  }, [calculateProjectStatus]);

  return { status, stats, loading, refreshStatus: calculateProjectStatus };
};
