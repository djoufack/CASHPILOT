import { describe, expect, it } from 'vitest';
import { buildGuardEventDetail, guardTableWritePayload } from '@/lib/supabaseWriteGuard';

describe('guardTableWritePayload', () => {
  it('applies generic guard for unmanaged tables', () => {
    const payload = { name: 'demo', amount: '10' };
    const result = guardTableWritePayload('profiles', 'create', payload);
    expect(result.guardedValues.amount).toBe(10);
    expect(result.reports).toHaveLength(1);
  });

  it('normalizes managed table payload', () => {
    const payload = {
      amount: '125,50',
      currency: 'eur',
      due_date: '2026-03-10',
    };
    const result = guardTableWritePayload('payables', 'create', payload);
    expect(result.guardedValues.amount).toBe(125.5);
    expect(result.guardedValues.currency).toBe('EUR');
    expect(result.summary.corrections).toBeGreaterThan(0);
  });

  it('throws DATA_ENTRY_GUARD for blocking issues', () => {
    expect(() =>
      guardTableWritePayload('receivables', 'create', {
        amount: -5,
      })
    ).toThrowError(/\[receivables\.create\]/);

    try {
      guardTableWritePayload('receivables', 'create', { amount: -5 });
    } catch (error) {
      expect(error.code).toBe('DATA_ENTRY_GUARD');
      expect(error.guard.table).toBe('receivables');
    }
  });
});

describe('buildGuardEventDetail', () => {
  it('builds warning/info message detail', () => {
    const guardResult = guardTableWritePayload('payables', 'create', {
      amount: 100,
      currency: 'eur',
    });

    const detail = buildGuardEventDetail({
      table: 'payables',
      operation: 'create',
      summary: guardResult.summary,
      reports: guardResult.reports,
    });

    expect(detail).not.toBeNull();
    expect(detail.table).toBe('payables');
    expect(['warning', 'info']).toContain(detail.level);
    expect(typeof detail.message).toBe('string');
  });
});
