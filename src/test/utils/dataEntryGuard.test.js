import { describe, expect, it } from 'vitest';
import { runDataEntryGuard } from '@/utils/dataEntryGuard';

describe('runDataEntryGuard', () => {
  it('auto-corrects tax rate and numeric strings for invoices', () => {
    const report = runDataEntryGuard({
      entity: 'invoice',
      operation: 'create',
      payload: {
        client_id: 'client-1',
        tax_rate: '0,21',
        total_ht: '100.00',
        total_ttc: '121.00',
      },
      items: [
        {
          description: '  Service audit  ',
          quantity: '2',
          unit_price: '50,5',
        },
      ],
    });

    expect(report.isValid).toBe(true);
    expect(report.sanitizedPayload.tax_rate).toBe(21);
    expect(report.sanitizedItems[0].quantity).toBe(2);
    expect(report.sanitizedItems[0].unit_price).toBe(50.5);
    expect(report.corrections.length).toBeGreaterThan(0);
  });

  it('blocks invalid payable with non-positive amount', () => {
    const report = runDataEntryGuard({
      entity: 'payable',
      operation: 'create',
      payload: {
        amount: 0,
      },
    });

    expect(report.isValid).toBe(false);
    expect(report.blockingIssues.some((entry) => entry.code === 'amount_must_be_positive')).toBe(true);
  });

  it('blocks debt payment above remaining balance', () => {
    const report = runDataEntryGuard({
      entity: 'debt_payment',
      operation: 'create',
      payload: {
        amount: 150,
        payment_method: 'bank_transfer',
      },
      options: {
        maxAmount: 100,
      },
    });

    expect(report.isValid).toBe(false);
    expect(report.blockingIssues.some((entry) => entry.code === 'payment_above_remaining')).toBe(true);
  });

  it('blocks invoice when due date is before issue date', () => {
    const report = runDataEntryGuard({
      entity: 'invoice',
      operation: 'create',
      payload: {
        client_id: 'client-1',
        issue_date: '2026-03-10',
        due_date: '2026-03-01',
        total_ttc: 100,
      },
      items: [],
    });

    expect(report.isValid).toBe(false);
    expect(report.blockingIssues.some((entry) => entry.code === 'date_range_invalid')).toBe(true);
  });
});
