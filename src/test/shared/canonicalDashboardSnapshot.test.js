import { describe, expect, it } from 'vitest';
import {
  buildCanonicalRevenueCollectionSnapshot,
  getCanonicalInvoiceBalanceDue,
  isCanonicalInvoiceBooked,
  isCanonicalInvoiceCollected,
  isCanonicalInvoiceOverdue,
} from '@/shared/canonicalDashboardSnapshot';

describe('canonicalDashboardSnapshot revenue collection', () => {
  it('normalizes booked, collected, outstanding and overdue metrics from a single source', () => {
    const invoices = [
      {
        id: 'inv-1',
        status: 'draft',
        total_ttc: 100,
        due_date: '2026-01-10',
      },
      {
        id: 'inv-2',
        status: 'sent',
        total_ttc: 200,
        due_date: '2026-01-15',
      },
      {
        id: 'inv-3',
        status: 'paid',
        total_ttc: 300,
        due_date: '2026-01-01',
      },
      {
        id: 'inv-4',
        status: 'sent',
        payment_status: 'partial',
        total_ttc: 400,
        balance_due: 150,
        due_date: '2026-01-05',
      },
      {
        id: 'inv-5',
        status: 'cancelled',
        total_ttc: 999,
        due_date: '2026-01-20',
      },
      {
        id: 'inv-6',
        status: 'sent',
        payment_status: 'overpaid',
        total_ttc: 500,
        due_date: '2026-02-20',
      },
    ];

    const expenses = [
      { amount: 100 },
      { amount: 80 },
    ];

    const payments = [
      { amount: 70 },
      { amount: 30 },
    ];

    const snapshot = buildCanonicalRevenueCollectionSnapshot({
      invoices,
      expenses,
      payments,
      referenceDate: new Date('2026-02-01T12:00:00.000Z'),
    });

    expect(snapshot.bookedRevenue).toBe(1400);
    expect(snapshot.collectedRevenue).toBe(800);
    expect(snapshot.outstandingReceivables).toBe(350);
    expect(snapshot.overdueReceivables).toBe(350);
    expect(snapshot.totalExpenses).toBe(180);
    expect(snapshot.grossMargin).toBe(620);
    expect(snapshot.grossMarginPct).toBe(77.5);
    expect(snapshot.collectionRate).toBe(57.1);
    expect(snapshot.paymentsRecorded).toBe(100);
    expect(snapshot.invoicesBookedCount).toBe(4);
    expect(snapshot.invoicesCollectedCount).toBe(2);
    expect(snapshot.invoicesOutstandingCount).toBe(2);
    expect(snapshot.invoicesOverdueCount).toBe(2);
  });

  it('reuses canonical invoice helpers consistently', () => {
    const unpaidInvoice = {
      status: 'sent',
      total_ttc: 120,
      due_date: '2026-01-01',
    };
    const paidInvoice = {
      status: 'sent',
      payment_status: 'paid',
      total_ttc: 120,
      due_date: '2026-01-01',
    };

    expect(isCanonicalInvoiceBooked(unpaidInvoice)).toBe(true);
    expect(isCanonicalInvoiceCollected(unpaidInvoice)).toBe(false);
    expect(getCanonicalInvoiceBalanceDue(unpaidInvoice)).toBe(120);
    expect(isCanonicalInvoiceOverdue(unpaidInvoice, new Date('2026-01-10'))).toBe(true);

    expect(isCanonicalInvoiceCollected(paidInvoice)).toBe(true);
    expect(getCanonicalInvoiceBalanceDue(paidInvoice)).toBe(0);
    expect(isCanonicalInvoiceOverdue(paidInvoice, new Date('2026-01-10'))).toBe(false);
  });
});
