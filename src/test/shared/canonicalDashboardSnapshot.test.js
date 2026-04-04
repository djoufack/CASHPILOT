import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildCanonicalDashboardSnapshot,
  buildCanonicalRevenueCollectionSnapshot,
  getCanonicalInvoiceAmount,
  getCanonicalInvoiceBalanceDue,
  isCanonicalInvoiceBooked,
  isCanonicalInvoiceCollected,
  isCanonicalInvoiceOverdue,
} from '@/shared/canonicalDashboardSnapshot';

describe('canonicalDashboardSnapshot', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-20T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('normalizes invoice amount and booked/collected states', () => {
    expect(getCanonicalInvoiceAmount({ total_ttc: '150' })).toBe(150);
    expect(getCanonicalInvoiceAmount({ total_ttc: 0, total: '99.5' })).toBe(99.5);

    expect(isCanonicalInvoiceBooked({ status: 'sent' })).toBe(true);
    expect(isCanonicalInvoiceBooked({ status: 'draft' })).toBe(false);

    expect(isCanonicalInvoiceCollected({ status: 'paid' })).toBe(true);
    expect(isCanonicalInvoiceCollected({ status: 'sent', payment_status: 'overpaid' })).toBe(true);
    expect(isCanonicalInvoiceCollected({ status: 'sent', payment_status: 'pending' })).toBe(false);
  });

  it('computes balance due and overdue status', () => {
    expect(getCanonicalInvoiceBalanceDue({ balance_due: '45.2' })).toBe(45.2);
    expect(getCanonicalInvoiceBalanceDue({ status: 'paid', total_ttc: 400 })).toBe(0);
    expect(getCanonicalInvoiceBalanceDue({ status: 'sent', total_ttc: 400 })).toBe(400);

    expect(
      isCanonicalInvoiceOverdue(
        { due_date: '2026-04-01', status: 'sent', total_ttc: 100 },
        new Date('2026-04-20T10:00:00Z')
      )
    ).toBe(true);
    expect(isCanonicalInvoiceOverdue({ due_date: 'invalid-date' }, new Date('2026-04-20T10:00:00Z'))).toBe(false);
    expect(isCanonicalInvoiceOverdue({ status: 'sent' }, new Date('2026-04-20T10:00:00Z'))).toBe(false);
  });

  it('builds canonical revenue collection snapshot with rounded metrics', () => {
    const snapshot = buildCanonicalRevenueCollectionSnapshot({
      invoices: [
        { status: 'sent', total_ttc: 1000, balance_due: 300, due_date: '2026-04-05' },
        { status: 'paid', total_ttc: 500, due_date: '2026-03-15' },
        { status: 'draft', total_ttc: 700, due_date: '2026-04-10' },
      ],
      expenses: [{ amount: 250.4 }, { amount: 100 }],
      payments: [{ amount: 300 }, { amount: '50' }],
      referenceDate: new Date('2026-04-20T00:00:00Z'),
    });

    expect(snapshot).toMatchObject({
      bookedRevenue: 1500,
      collectedRevenue: 500,
      outstandingReceivables: 300,
      overdueReceivables: 300,
      totalExpenses: 350.4,
      grossMargin: 149.6,
      collectionRate: 33.3,
      invoicesBookedCount: 2,
      invoicesCollectedCount: 1,
      invoicesOutstandingCount: 1,
      invoicesOverdueCount: 1,
      paymentsRecorded: 350,
    });
  });

  it('builds full dashboard snapshot with trends and revenue breakdowns', () => {
    const snapshot = buildCanonicalDashboardSnapshot({
      invoices: [
        {
          status: 'sent',
          total_ttc: 1000,
          date: '2026-04-03',
          client: { company_name: 'Client A' },
          items: [
            { item_type: 'product', total: 400 },
            { item_type: 'service', total: 600 },
          ],
        },
        {
          status: 'paid',
          total_ttc: 800,
          date: '2026-03-15',
          client: { company_name: 'Client B' },
          items: [{ service_id: 'svc_1', quantity: 2, unit_price: 200 }],
        },
        {
          status: 'cancelled',
          total_ttc: 9999,
          date: '2026-04-10',
        },
        {
          status: 'sent',
          total_ttc: 500,
          date: '2026-04-18',
          client: { company_name: 'Client A' },
          items: [],
        },
      ],
      expenses: [
        { amount: 300, expense_date: '2026-04-06' },
        { amount: 200, expense_date: '2026-03-05' },
      ],
      timesheets: [
        { duration_minutes: 600, date: '2026-04-07' },
        { duration_minutes: 300, date: '2026-03-07' },
      ],
      projects: [{ budget_hours: 8 }, { budget_hours: 4 }],
    });

    expect(snapshot.metrics.revenue).toBe(2300);
    expect(snapshot.metrics.totalExpenses).toBe(500);
    expect(snapshot.metrics.netCashFlow).toBe(1800);
    expect(snapshot.metrics.profitMargin).toBeGreaterThan(0);
    expect(snapshot.metrics.occupancyRate).toBeGreaterThan(0);
    expect(snapshot.metrics.revenueTrend).toBeGreaterThan(0);

    expect(snapshot.revenueData.length).toBeGreaterThan(0);
    expect(snapshot.clientRevenueData[0].name).toBe('Client A');
    expect(snapshot.revenueByType.product).toBeGreaterThan(0);
    expect(snapshot.revenueByType.service).toBeGreaterThan(0);
    expect(snapshot.revenueByType.other).toBeGreaterThan(0);
    expect(snapshot.revenueBreakdownData.length).toBeGreaterThan(0);
  });

  it('handles occupancy fallback when projects have no budget', () => {
    const snapshot = buildCanonicalDashboardSnapshot({
      invoices: [],
      expenses: [],
      timesheets: [{ duration_minutes: 120, created_at: '2026-04-12' }],
      projects: [{}],
    });

    expect(snapshot.metrics.occupancyRate).toBe(100);
  });
});
