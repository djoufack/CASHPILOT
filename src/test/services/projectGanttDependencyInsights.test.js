import { describe, expect, it } from 'vitest';
import { buildProjectGanttDependencyInsights } from '@/services/projectGanttDependencyInsights';

describe('projectGanttDependencyInsights', () => {
  it('computes dependency metrics and blocked tasks from project task graph', () => {
    const tasks = [
      {
        id: 'task-1',
        title: 'Cadrage',
        status: 'completed',
        start_date: '2026-03-01',
        end_date: '2026-03-03',
        depends_on: [],
      },
      {
        id: 'task-2',
        title: 'Développement',
        status: 'in_progress',
        start_date: '2026-03-04',
        end_date: '2026-03-12',
        depends_on: ['task-1'],
        dependency_titles: ['Cadrage'],
      },
      {
        id: 'task-3',
        title: 'Recette',
        status: 'todo',
        depends_on: ['task-2'],
        dependency_titles: ['Développement'],
      },
    ];

    const insights = buildProjectGanttDependencyInsights(tasks);
    expect(insights.summary.totalTasks).toBe(3);
    expect(insights.summary.tasksWithSchedule).toBe(2);
    expect(insights.summary.dependencyLinks).toBe(2);
    expect(insights.summary.blockedTasks).toBe(1);
    expect(insights.rows[0].taskId).toBe('task-3');
    expect(insights.rows[0].dependencyCount).toBe(1);
    expect(insights.rows[0].isBlocked).toBe(true);
  });

  it('returns empty structures when no tasks are provided', () => {
    const insights = buildProjectGanttDependencyInsights([]);
    expect(insights.summary.totalTasks).toBe(0);
    expect(insights.summary.tasksWithSchedule).toBe(0);
    expect(insights.summary.dependencyLinks).toBe(0);
    expect(insights.rows).toHaveLength(0);
  });
});
