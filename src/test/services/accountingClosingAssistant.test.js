import { describe, expect, it } from 'vitest';

import {
  buildClosingChecklist,
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
      depreciationEntriesGenerated: 2,
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
    expect(checklist.depreciationEntriesGenerated).toBe(2);
    expect(checklist.journal.balanced).toBe(true);
  });
});
