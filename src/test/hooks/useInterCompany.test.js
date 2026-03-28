import { describe, expect, it } from 'vitest';
import { buildEliminationPeriods } from '@/hooks/useInterCompany';

describe('buildEliminationPeriods', () => {
  it('groups synced transactions by month and returns sorted periods', () => {
    const periods = buildEliminationPeriods([
      { id: 'tx-1', status: 'synced', created_at: '2026-02-20T08:00:00.000Z' },
      { id: 'tx-2', status: 'synced', created_at: '2026-02-24T08:00:00.000Z' },
      { id: 'tx-3', status: 'synced', created_at: '2026-03-02T08:00:00.000Z' },
      { id: 'tx-4', status: 'eliminated', created_at: '2026-03-10T08:00:00.000Z' },
    ]);

    expect(periods).toEqual([
      { key: '2026-02', periodStart: '2026-02-01', periodEnd: '2026-02-28' },
      { key: '2026-03', periodStart: '2026-03-01', periodEnd: '2026-03-31' },
    ]);
  });
});
