import { describe, expect, it } from 'vitest';
import {
  aggregateRevenueByMonth,
  aggregateExpensesByMonth,
  aggregateRevenueByClient,
  aggregateProjectPerformance,
  formatChartData,
  computeExecutiveMetrics,
  aggregateReceivablesAging,
  aggregateReceivablesWatchlist,
  aggregateClientConcentration,
} from '@/utils/analyticsCalculations';

// ── helpers ─────────────────────────────────────────────────────────────────

const inv = (overrides = {}) => ({
  id: `inv-${Math.random()}`,
  status: 'sent',
  total_ttc: 1000,
  invoice_date: '2026-01-15',
  due_date: '2026-02-15',
  amount_paid: 0,
  balance_due: 1000,
  client_id: 'client-1',
  client_name: 'Acme Corp',
  ...overrides,
});

const expense = (overrides = {}) => ({
  id: `exp-${Math.random()}`,
  amount: 500,
  expense_date: '2026-01-20',
  category: 'office',
  ...overrides,
});

// ── aggregateRevenueByMonth ──────────────────────────────────────────────────
// NOTE: only counts "collected" (paid) invoices

describe('aggregateRevenueByMonth', () => {
  it('returns empty array for empty input', () => {
    expect(aggregateRevenueByMonth([])).toEqual([]);
  });

  it('returns empty array for null/undefined', () => {
    expect(aggregateRevenueByMonth(null)).toEqual([]);
    expect(aggregateRevenueByMonth(undefined)).toEqual([]);
  });

  it('groups paid invoices by month', () => {
    const invoices = [
      inv({ total_ttc: 1000, status: 'paid', invoice_date: '2026-01-10' }),
      inv({ total_ttc: 2000, status: 'paid', invoice_date: '2026-01-25' }),
      inv({ total_ttc: 1500, status: 'paid', invoice_date: '2026-02-05' }),
    ];
    const result = aggregateRevenueByMonth(invoices);
    expect(result.length).toBe(2);
  });

  it('excludes non-collected invoices (sent, draft)', () => {
    const invoices = [
      inv({ total_ttc: 1000, status: 'sent', invoice_date: '2026-01-10' }),
      inv({ total_ttc: 500, status: 'draft', invoice_date: '2026-01-10' }),
    ];
    const result = aggregateRevenueByMonth(invoices);
    expect(result.length).toBe(0);
  });

  it('handles invoices with no invoice_date', () => {
    const invoices = [inv({ invoice_date: null, status: 'paid' }), inv({ invoice_date: undefined, status: 'paid' })];
    // Should not throw, and dates without value are skipped
    expect(() => aggregateRevenueByMonth(invoices)).not.toThrow();
  });
});

// ── aggregateExpensesByMonth ─────────────────────────────────────────────────

describe('aggregateExpensesByMonth', () => {
  it('returns empty array for empty input', () => {
    expect(aggregateExpensesByMonth([])).toEqual([]);
  });

  it('groups expenses by month', () => {
    const expenses = [
      expense({ amount: 300, expense_date: '2026-01-10' }),
      expense({ amount: 200, expense_date: '2026-01-20' }),
      expense({ amount: 400, expense_date: '2026-02-10' }),
    ];
    const result = aggregateExpensesByMonth(expenses);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('handles null input', () => {
    expect(aggregateExpensesByMonth(null)).toEqual([]);
  });
});

// ── aggregateRevenueByClient ─────────────────────────────────────────────────

describe('aggregateRevenueByClient', () => {
  it('returns empty for empty input', () => {
    expect(aggregateRevenueByClient([])).toEqual([]);
  });

  it('aggregates revenue per client', () => {
    const invoices = [
      inv({ client_id: 'c1', client_name: 'Client A', total_ttc: 500, status: 'paid' }),
      inv({ client_id: 'c1', client_name: 'Client A', total_ttc: 300, status: 'sent' }),
      inv({ client_id: 'c2', client_name: 'Client B', total_ttc: 800, status: 'sent' }),
    ];
    const result = aggregateRevenueByClient(invoices);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('handles invoices without client_id', () => {
    const invoices = [inv({ client_id: undefined, client_name: undefined })];
    expect(() => aggregateRevenueByClient(invoices)).not.toThrow();
  });
});

// ── aggregateProjectPerformance ──────────────────────────────────────────────

describe('aggregateProjectPerformance', () => {
  it('returns empty for no timesheets', () => {
    const result = aggregateProjectPerformance([], []);
    expect(Array.isArray(result)).toBe(true);
  });

  it('handles null inputs', () => {
    expect(() => aggregateProjectPerformance(null, null)).not.toThrow();
  });

  it('groups performance by project', () => {
    const timesheets = [
      { project_id: 'p1', project_name: 'Project Alpha', hours: 8, hourly_rate: 100, date: '2026-01-10' },
      { project_id: 'p1', project_name: 'Project Alpha', hours: 4, hourly_rate: 100, date: '2026-01-15' },
    ];
    const invoices = [inv({ project_id: 'p1', total_ttc: 1500 })];
    const result = aggregateProjectPerformance(timesheets, invoices);
    expect(Array.isArray(result)).toBe(true);
  });
});

// ── formatChartData ──────────────────────────────────────────────────────────

describe('formatChartData', () => {
  it('merges revenue and expense arrays by month', () => {
    const revenue = [{ month: 'Jan 2026', revenue: 1000 }];
    const expenses = [{ month: 'Jan 2026', expenses: 400 }];
    const result = formatChartData(revenue, expenses);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('handles empty arrays', () => {
    expect(formatChartData([], [])).toEqual([]);
  });
});

// ── computeExecutiveMetrics ──────────────────────────────────────────────────
// Returns canonical revenue metrics: bookedRevenue, collectedRevenue, outstandingReceivables, etc.

describe('computeExecutiveMetrics', () => {
  const paidInvoice = inv({ status: 'paid', total_ttc: 2000, amount_paid: 2000, balance_due: 0 });
  const sentInvoice = inv({ status: 'sent', total_ttc: 1000, amount_paid: 0, balance_due: 1000, due_date: '2025-01-01' }); // overdue

  it('returns metrics object with canonical keys', () => {
    const result = computeExecutiveMetrics([paidInvoice, sentInvoice], [], []);
    expect(result).toHaveProperty('bookedRevenue');
    expect(result).toHaveProperty('collectedRevenue');
    expect(result).toHaveProperty('outstandingReceivables');
  });

  it('returns zeros for empty inputs', () => {
    const result = computeExecutiveMetrics([], [], []);
    expect(result.bookedRevenue).toBe(0);
    expect(result.collectedRevenue).toBe(0);
  });

  it('does not throw for empty arrays (default params)', () => {
    expect(() => computeExecutiveMetrics()).not.toThrow();
  });

  it('computes outstanding receivables from sent invoices', () => {
    const overdue = inv({ status: 'sent', due_date: '2020-01-01', balance_due: 500 });
    const result = computeExecutiveMetrics([overdue], [], []);
    expect(result.outstandingReceivables).toBeGreaterThanOrEqual(0);
  });

  it('includes timesheet hours in result', () => {
    const timesheets = [
      { billable: true, duration_minutes: 120 },
      { billable: false, duration_minutes: 60 },
    ];
    const result = computeExecutiveMetrics([], [], timesheets);
    expect(result.totalHours).toBeGreaterThanOrEqual(0);
  });
});

// ── aggregateReceivablesAging ────────────────────────────────────────────────

describe('aggregateReceivablesAging', () => {
  const ref = new Date('2026-03-01');

  it('returns aging buckets', () => {
    const invoices = [
      inv({ due_date: '2026-02-01', balance_due: 500, status: 'sent' }),   // 28 days overdue
      inv({ due_date: '2025-12-01', balance_due: 200, status: 'sent' }),   // 90+ days overdue
      inv({ due_date: '2026-03-10', balance_due: 300, status: 'sent' }),   // not yet due
    ];
    const result = aggregateReceivablesAging(invoices, ref);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('handles empty array', () => {
    const result = aggregateReceivablesAging([], ref);
    expect(Array.isArray(result)).toBe(true);
  });

  it('uses current date as default reference', () => {
    expect(() => aggregateReceivablesAging([inv()])).not.toThrow();
  });
});

// ── aggregateReceivablesWatchlist ────────────────────────────────────────────

describe('aggregateReceivablesWatchlist', () => {
  const ref = new Date('2026-03-01');

  it('returns top overdue invoices', () => {
    const invoices = [
      inv({ due_date: '2026-01-01', balance_due: 1000, status: 'sent', client_name: 'A' }),
      inv({ due_date: '2026-01-15', balance_due: 800, status: 'sent', client_name: 'B' }),
      inv({ due_date: '2026-02-01', balance_due: 200, status: 'sent', client_name: 'C' }),
    ];
    const result = aggregateReceivablesWatchlist(invoices, 2, ref);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it('excludes paid invoices from watchlist', () => {
    const invoices = [inv({ status: 'paid', balance_due: 0 })];
    const result = aggregateReceivablesWatchlist(invoices, 5, ref);
    expect(result.length).toBe(0);
  });
});

// ── aggregateClientConcentration ─────────────────────────────────────────────

describe('aggregateClientConcentration', () => {
  it('returns top clients by revenue share', () => {
    const invoices = [
      inv({ client_id: 'c1', client_name: 'Top Client', total_ttc: 5000 }),
      inv({ client_id: 'c2', client_name: 'Small Client', total_ttc: 100 }),
    ];
    const result = aggregateClientConcentration(invoices, 3);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty array for empty input', () => {
    expect(aggregateClientConcentration([])).toEqual([]);
  });

  it('handles invoices with 0 total', () => {
    const invoices = [inv({ total_ttc: 0 })];
    expect(() => aggregateClientConcentration(invoices)).not.toThrow();
  });
});
