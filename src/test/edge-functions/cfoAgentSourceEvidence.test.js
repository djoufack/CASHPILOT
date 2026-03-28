import { describe, expect, it } from 'vitest';
import { buildCfoSourceEvidence } from '../../../supabase/functions/cfo-agent/sourceEvidence.ts';

describe('cfo-agent source evidence builder', () => {
  it('exposes the tables and metrics used to answer the CFO question', () => {
    const evidence = buildCfoSourceEvidence(
      {
        companyId: 'company-1',
        companyName: 'Acme SARL',
        summary: {
          totalRevenue: 1500,
          totalExpenses: 425.75,
          netResult: 1074.25,
          totalPaid: 900,
          unpaidTotal: 600,
          overdueCount: 2,
          clientCount: 4,
          invoiceCount: 7,
        },
      },
      { score: 72, factors: { profitability: { value: 12.5, impact: 6, label: 'Marge nette (%)' } } },
      '2026-03-23T10:00:00.000Z'
    );

    expect(evidence).toEqual(
      expect.objectContaining({
        type: 'source_evidence',
        company_id: 'company-1',
        company_name: 'Acme SARL',
        tables_used: ['company', 'clients', 'expenses', 'invoices', 'payments'],
        metrics: expect.objectContaining({
          totalRevenue: 1500,
          totalExpenses: 425.75,
          netResult: 1074.25,
          totalPaid: 900,
          unpaidTotal: 600,
          overdueCount: 2,
          clientCount: 4,
          invoiceCount: 7,
          healthScore: 72,
        }),
        generated_at: '2026-03-23T10:00:00.000Z',
      })
    );

    expect(evidence.calculations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ metric: 'totalRevenue', source_tables: ['invoices'] }),
        expect.objectContaining({ metric: 'totalExpenses', source_tables: ['expenses'] }),
        expect.objectContaining({ metric: 'totalPaid', source_tables: ['payments'] }),
      ])
    );
  });
});
