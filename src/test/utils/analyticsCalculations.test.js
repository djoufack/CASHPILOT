import { describe, expect, it } from 'vitest';
import {
  aggregateProjectPerformance,
  aggregateRevenueByClient,
  aggregateRevenueByMonth,
} from '@/utils/analyticsCalculations';

describe('analyticsCalculations canonical coherence', () => {
  it('aggregates monthly collected revenue from canonical invoice amounts', () => {
    const invoices = [
      {
        id: 'inv-1',
        status: 'sent',
        payment_status: 'paid',
        total_ttc: 120,
        date: '2026-01-15',
        client: { company_name: 'Client A' },
      },
      {
        id: 'inv-2',
        status: 'paid',
        total_ttc: 300,
        invoice_date: '2026-02-10',
        client: { company_name: 'Client B' },
      },
      {
        id: 'inv-3',
        status: 'sent',
        total_ttc: 500,
        date: '2026-02-20',
        client: { company_name: 'Client A' },
      },
    ];

    expect(aggregateRevenueByMonth(invoices)).toEqual([
      { key: '2026-01', value: 120 },
      { key: '2026-02', value: 300 },
    ]);
  });

  it('aggregates collected revenue by client with canonical invoice status rules', () => {
    const invoices = [
      {
        id: 'inv-1',
        status: 'sent',
        payment_status: 'paid',
        total_ttc: 120,
        client: { company_name: 'Client A' },
      },
      {
        id: 'inv-2',
        status: 'paid',
        total_ttc: 300,
        client: { company_name: 'Client B' },
      },
      {
        id: 'inv-3',
        status: 'draft',
        total_ttc: 999,
        client: { company_name: 'Client A' },
      },
    ];

    expect(aggregateRevenueByClient(invoices)).toEqual([
      { name: 'Client A', value: 120 },
      { name: 'Client B', value: 300 },
    ]);
  });

  it('counts project revenue only from collected invoices', () => {
    const timesheets = [
      { id: 'ts-1', duration_minutes: 120, project: { name: 'Project Ops' } },
    ];
    const invoices = [
      {
        id: 'inv-1',
        project_id: 'project-1',
        project_name: 'Project Ops',
        status: 'paid',
        total_ttc: 500,
      },
      {
        id: 'inv-2',
        project_id: 'project-1',
        project_name: 'Project Ops',
        status: 'sent',
        total_ttc: 700,
      },
    ];

    expect(aggregateProjectPerformance(timesheets, invoices)).toEqual([
      { name: 'Project Ops', hours: 2, revenue: 500 },
    ]);
  });
});
