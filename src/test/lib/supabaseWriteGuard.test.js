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

  it('guards arrays and preserves array payload shape', () => {
    const payload = [
      { amount: '100', currency: 'eur' },
      { amount: '200', currency: 'usd' },
    ];
    const result = guardTableWritePayload('payables', 'update', payload);
    expect(Array.isArray(result.guardedValues)).toBe(true);
    expect(result.guardedValues).toHaveLength(2);
    expect(result.guardedValues[0].amount).toBe(100);
    expect(result.guardedValues[1].currency).toBe('USD');
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

  it('returns null when summary is missing or empty', () => {
    expect(
      buildGuardEventDetail({
        table: 'payables',
        operation: 'create',
        summary: null,
        reports: [],
      })
    ).toBeNull();

    expect(
      buildGuardEventDetail({
        table: 'payables',
        operation: 'create',
        summary: { warnings: 0, corrections: 0, blocking: 0 },
        reports: [],
      })
    ).toBeNull();
  });

  it('prioritizes correction and warning messages and computes error level', () => {
    const detail = buildGuardEventDetail({
      table: 'invoices',
      operation: 'update',
      summary: { warnings: 1, corrections: 1, blocking: 1 },
      reports: [
        {
          warnings: [{ message: 'warning message' }],
          corrections: [{ message: 'correction message' }],
        },
      ],
    });

    expect(detail.level).toBe('error');
    expect(detail.message).toContain('correction message');
    expect(detail.message).toContain('warning message');
  });

  it('uses fallback message when no warning/correction message exists', () => {
    const detail = buildGuardEventDetail({
      table: 'expenses',
      operation: 'create',
      summary: { warnings: 1, corrections: 0, blocking: 0 },
      reports: [{ warnings: [{}], corrections: [] }],
    });

    expect(detail.level).toBe('warning');
    expect(detail.message).toBe('Controle de saisie applique.');
  });
});
