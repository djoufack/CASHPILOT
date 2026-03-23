import { describe, expect, it } from 'vitest';
import {
  buildClientFinancialBreakdown,
  normalizeInvoiceClientView,
} from '../../../supabase/functions/cfo-agent/financialContext.ts';

describe('cfo-agent financial context helpers', () => {
  it('maps invoices to clients and computes top clients by revenue', () => {
    const invoices = [
      {
        id: 'i-1',
        client_id: 'c-1',
        invoice_number: 'INV-001',
        total_ttc: 1000,
        balance_due: 100,
        payment_status: 'partial',
        due_date: '2026-03-01',
      },
      {
        id: 'i-2',
        client_id: 'c-1',
        invoice_number: 'INV-002',
        total_ttc: 500,
        balance_due: 0,
        payment_status: 'paid',
        due_date: '2026-03-20',
      },
      {
        id: 'i-3',
        client_id: 'c-2',
        invoice_number: 'INV-003',
        total_ttc: 800,
        balance_due: 800,
        payment_status: 'unpaid',
        due_date: '2026-03-10',
      },
    ];

    const clients = [
      { id: 'c-1', company_name: 'Client Alpha' },
      { id: 'c-2', company_name: 'Client Beta' },
    ];

    const rows = normalizeInvoiceClientView(invoices, clients);
    const result = buildClientFinancialBreakdown(rows, new Date('2026-03-23T00:00:00.000Z'));

    expect(result.unassignedInvoicesCount).toBe(0);
    expect(result.topClientsByRevenue[0]).toEqual(
      expect.objectContaining({
        client_id: 'c-1',
        client_name: 'Client Alpha',
        invoice_count: 2,
        revenue_ttc: 1500,
        unpaid_ttc: 100,
      })
    );
    expect(result.topClientsByRevenue[1]).toEqual(
      expect.objectContaining({
        client_id: 'c-2',
        client_name: 'Client Beta',
        invoice_count: 1,
        revenue_ttc: 800,
        unpaid_ttc: 800,
        overdue_count: 1,
      })
    );
  });

  it('counts invoices without client association', () => {
    const invoices = [
      {
        id: 'i-9',
        client_id: null,
        invoice_number: 'INV-009',
        total_ttc: 250,
        balance_due: 250,
        payment_status: 'unpaid',
        due_date: '2026-03-05',
      },
    ];

    const result = buildClientFinancialBreakdown(normalizeInvoiceClientView(invoices, []), new Date('2026-03-23'));

    expect(result.unassignedInvoicesCount).toBe(1);
    expect(result.topClientsByRevenue).toHaveLength(0);
  });
});
