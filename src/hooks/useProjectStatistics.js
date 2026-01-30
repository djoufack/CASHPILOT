
import { useMemo } from 'react';
import { differenceInDays, parseISO } from 'date-fns';

export const useProjectStatistics = (tasks = []) => {
  return useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const pending = tasks.filter(t => t.status === 'pending').length;
    
    const overdue = tasks.filter(t => {
      if (!t.due_date || t.status === 'completed') return false;
      return new Date(t.due_date) < new Date();
    }).length;

    const completionPercentage = total === 0 ? 0 : Math.round((completed / total) * 100);

    // Distribution by Priority
    const byPriority = {
      high: tasks.filter(t => t.priority === 'high').length,
      medium: tasks.filter(t => t.priority === 'medium').length,
      low: tasks.filter(t => t.priority === 'low').length,
    };

    const chartData = [
      { name: 'Completed', value: completed, fill: '#10b981' },
      { name: 'In Progress', value: inProgress, fill: '#3b82f6' },
      { name: 'Pending', value: pending, fill: '#9ca3af' },
    ];

    return {
      total,
      completed,
      inProgress,
      pending,
      overdue,
      completionPercentage,
      byPriority,
      chartData
    };
  }, [tasks]);
};
