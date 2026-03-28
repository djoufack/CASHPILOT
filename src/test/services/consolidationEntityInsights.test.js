import { describe, expect, it } from 'vitest';
import {
  buildConsolidatedEntityRows,
  filterConsolidatedEntityRows,
  summarizeConsolidatedEntities,
} from '@/services/consolidationEntityInsights';

describe('consolidationEntityInsights', () => {
  it('builds merged entity rows with pending elimination tracking', () => {
    const rows = buildConsolidatedEntityRows({
      pnlByCompany: [
        { company_id: 'c1', company_name: 'Alpha', revenue: 1200, expenses: 800, net_income: 400 },
        { company_id: 'c2', company_name: 'Beta', revenue: 0, expenses: 0, net_income: 0 },
      ],
      balanceByCompany: [
        { company_id: 'c1', company_name: 'Alpha', assets: 5000, liabilities: 3000, equity: 2000 },
        { company_id: 'c3', company_name: 'Gamma', assets: 1000, liabilities: 200, equity: 800 },
      ],
      cashByCompany: [
        { company_id: 'c1', company_name: 'Alpha', cash_balance: 900 },
        { company_id: 'c2', company_name: 'Beta', cash_balance: 0 },
      ],
      intercompanyTransactions: [
        { id: 't1', company_id: 'c1', linked_company_id: 'c2', amount: 120, status: 'pending' },
        { id: 't2', company_id: 'c1', linked_company_id: 'c2', amount: 80, status: 'eliminated' },
        { id: 't3', company_id: 'c3', linked_company_id: 'c1', amount: 40, status: 'pending' },
      ],
    });

    expect(rows.map((row) => row.companyId)).toEqual(['c1', 'c3', 'c2']);

    expect(rows[0]).toMatchObject({
      companyId: 'c1',
      companyName: 'Alpha',
      revenue: 1200,
      expenses: 800,
      netIncome: 400,
      cashBalance: 900,
      pendingEliminationCount: 2,
      pendingEliminationAmount: 160,
      status: 'attention',
    });

    expect(rows[1]).toMatchObject({
      companyId: 'c3',
      companyName: 'Gamma',
      assets: 1000,
      pendingEliminationCount: 1,
      pendingEliminationAmount: 40,
      status: 'attention',
    });
  });

  it('filters rows by scope and computes summary counters', () => {
    const rows = [
      { companyId: 'c1', status: 'active' },
      { companyId: 'c2', status: 'inactive' },
      { companyId: 'c3', status: 'attention' },
    ];

    expect(filterConsolidatedEntityRows(rows, 'all').map((row) => row.companyId)).toEqual(['c1', 'c2', 'c3']);
    expect(filterConsolidatedEntityRows(rows, 'active').map((row) => row.companyId)).toEqual(['c1', 'c3']);
    expect(filterConsolidatedEntityRows(rows, 'attention').map((row) => row.companyId)).toEqual(['c3']);

    expect(summarizeConsolidatedEntities(rows)).toEqual({
      total: 3,
      active: 2,
      attention: 1,
      inactive: 1,
    });
  });
});
