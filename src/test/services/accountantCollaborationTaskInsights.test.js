import { describe, expect, it } from 'vitest';
import { buildAccountantCollaborationTaskInsights } from '@/services/accountantCollaborationTaskInsights';

describe('buildAccountantCollaborationTaskInsights', () => {
  it('returns empty-safe defaults', () => {
    const result = buildAccountantCollaborationTaskInsights([]);
    expect(result.totalCount).toBe(0);
    expect(result.overdueCount).toBe(0);
    expect(result.status).toBe('ready');
  });

  it('computes status counters and overdue tasks', () => {
    const result = buildAccountantCollaborationTaskInsights(
      [
        { status: 'todo', due_date: '2026-03-20' },
        { status: 'in_review', due_date: '2026-03-30' },
        { status: 'done', due_date: '2026-03-15' },
      ],
      new Date('2026-03-28T10:00:00Z')
    );

    expect(result.totalCount).toBe(3);
    expect(result.todoCount).toBe(1);
    expect(result.inReviewCount).toBe(1);
    expect(result.doneCount).toBe(1);
    expect(result.overdueCount).toBe(1);
    expect(result.status).toBe('attention');
  });

  it('returns critical when blocked tasks exist', () => {
    const result = buildAccountantCollaborationTaskInsights(
      [{ status: 'blocked', due_date: '2026-03-25' }],
      new Date('2026-03-28T10:00:00Z')
    );
    expect(result.blockedCount).toBe(1);
    expect(result.status).toBe('critical');
  });
});
