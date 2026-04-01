import { describe, expect, it } from 'vitest';

import {
  buildClosingChecklist,
  buildClosingWorkflow,
  computeJournalGap,
  determineClosingStatus,
} from '@/services/accountingClosingAssistant';

describe('accountingClosingAssistant service', () => {
  it('computes a balanced journal gap summary', () => {
    const summary = computeJournalGap([
      { debit: 1000, credit: 0 },
      { debit: 0, credit: 1000 },
      { debit: 250.5, credit: 0 },
      { debit: 0, credit: 250.5 },
    ]);

    expect(summary.totalDebit).toBe(1250.5);
    expect(summary.totalCredit).toBe(1250.5);
    expect(summary.gap).toBe(0);
    expect(summary.balanced).toBe(true);
  });

  it('marks period as blocked when journal gap is not balanced', () => {
    const status = determineClosingStatus({
      unpostedDepreciationBefore: 0,
      journalGap: 12.37,
    });

    expect(status).toBe('blocked');
  });

  it('builds checklist payload for closure persistence', () => {
    const checklist = buildClosingChecklist({
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
      unpostedDepreciationBefore: 2,
      unpostedDepreciationAfter: 0,
      depreciationEntriesGenerated: 2,
      status: 'closed',
      journalSummary: {
        totalDebit: 3000,
        totalCredit: 3000,
        gap: 0,
        balanced: true,
      },
    });

    expect(checklist.periodStart).toBe('2026-03-01');
    expect(checklist.periodEnd).toBe('2026-03-31');
    expect(checklist.unpostedDepreciationBefore).toBe(2);
    expect(checklist.unpostedDepreciationAfter).toBe(0);
    expect(checklist.depreciationEntriesGenerated).toBe(2);
    expect(checklist.journal.balanced).toBe(true);
    expect(checklist.workflow.progress.percent).toBe(100);
  });

  it('builds guided milestones and next action for blocked closing state', () => {
    const workflow = buildClosingWorkflow({
      periodEnd: '2026-03-31',
      status: 'blocked',
      unpostedDepreciationAfter: 0,
      journalGap: 154.42,
    });

    expect(workflow.milestones).toHaveLength(3);
    expect(workflow.milestones[0]).toMatchObject({ key: 'j5', completed: true, targetDate: '2026-04-05' });
    expect(workflow.milestones[1]).toMatchObject({ key: 'j10', completed: false, targetDate: '2026-04-10' });
    expect(workflow.milestones[2]).toMatchObject({ key: 'j15', completed: false, targetDate: '2026-04-15' });
    expect(workflow.progress).toEqual({
      completed: 1,
      total: 3,
      percent: 33,
    });
    expect(workflow.nextAction.key).toBe('resolve_journal_gap');
  });
});
