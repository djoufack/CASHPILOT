import { describe, expect, it } from 'vitest';
import { buildHrManagerWorkflowInsights } from '@/services/hrManagerWorkflowInsights';

describe('buildHrManagerWorkflowInsights', () => {
  it('computes manager queue, overdue entries and workflow status', () => {
    const now = new Date();
    const oldDate = new Date(now);
    oldDate.setDate(now.getDate() - 22);
    const freshDate = new Date(now);
    freshDate.setDate(now.getDate() - 4);

    const reviews = [
      {
        id: 'rev-1',
        status: 'manager_review',
        employee_id: 'emp-1',
        reviewer_id: 'emp-10',
        created_at: oldDate.toISOString(),
      },
      {
        id: 'rev-2',
        status: 'manager_review',
        employee_id: 'emp-2',
        reviewer_id: 'emp-10',
        created_at: freshDate.toISOString(),
      },
      {
        id: 'rev-3',
        status: 'hr_review',
        employee_id: 'emp-3',
        reviewer_id: 'emp-11',
        created_at: freshDate.toISOString(),
      },
      {
        id: 'rev-4',
        status: 'completed',
        employee_id: 'emp-4',
        reviewer_id: 'emp-12',
        created_at: freshDate.toISOString(),
      },
    ];

    const employees = [
      { id: 'emp-1', full_name: 'Alice Martin' },
      { id: 'emp-2', full_name: 'Benoit Diallo' },
      { id: 'emp-3', full_name: 'Carla N.' },
      { id: 'emp-10', full_name: 'Manager One' },
      { id: 'emp-11', full_name: 'Manager Two' },
    ];

    const insights = buildHrManagerWorkflowInsights({ reviews, employees });

    expect(insights.totals.managerQueueCount).toBe(2);
    expect(insights.totals.overdueManagerCount).toBe(1);
    expect(insights.totals.hrQueueCount).toBe(1);
    expect(insights.totals.completedCount).toBe(1);
    expect(insights.priorityReviews[0].id).toBe('rev-1');
    expect(insights.priorityReviews[0].isOverdue).toBe(true);
    expect(insights.reviewerLoad[0].reviewerName).toBe('Manager One');
    expect(insights.workflowStatus).toBe('watch');
  });

  it('returns healthy when manager queue is under control with no overdue review', () => {
    const now = new Date();
    const reviews = [
      {
        id: 'rev-1',
        status: 'manager_review',
        employee_id: 'emp-1',
        reviewer_id: 'emp-10',
        created_at: now.toISOString(),
      },
      {
        id: 'rev-2',
        status: 'completed',
        employee_id: 'emp-2',
        reviewer_id: 'emp-10',
        created_at: now.toISOString(),
      },
    ];

    const insights = buildHrManagerWorkflowInsights({ reviews, employees: [] });
    expect(insights.workflowStatus).toBe('healthy');
    expect(insights.recommendations.length).toBeGreaterThan(0);
  });

  it('returns no_data when no review exists', () => {
    const insights = buildHrManagerWorkflowInsights({ reviews: [], employees: [] });
    expect(insights.workflowStatus).toBe('no_data');
    expect(insights.totals.allReviews).toBe(0);
  });
});
