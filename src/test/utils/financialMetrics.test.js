import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({ supabase: {} }));

import {
  getAllBalanceSheetAccounts,
  extractFinancialPosition,
  calculatePreTaxIncome,
} from '@/utils/financialMetrics';

describe('getAllBalanceSheetAccounts', () => {
  it('returns empty array for null input', () => {
    expect(getAllBalanceSheetAccounts(null)).toEqual([]);
  });

  it('returns empty array for empty balance sheet', () => {
    expect(getAllBalanceSheetAccounts({})).toEqual([]);
  });

  it('merges assets, liabilities and equity', () => {
    const bs = {
      assets: [{ account_code: '2183', balance: 18000 }],
      liabilities: [{ account_code: '401', balance: 5000 }],
      equity: [{ account_code: '101', balance: 25000 }],
    };
    const all = getAllBalanceSheetAccounts(bs);
    expect(all).toHaveLength(3);
    expect(all.map(a => a.account_code)).toEqual(['2183', '401', '101']);
  });

  it('handles partial balance sheet (missing sections)', () => {
    const bs = { assets: [{ account_code: '512', balance: 10000 }] };
    const all = getAllBalanceSheetAccounts(bs);
    expect(all).toHaveLength(1);
  });
});

describe('extractFinancialPosition', () => {
  it('returns zeroed position for null input', () => {
    const pos = extractFinancialPosition(null);
    expect(pos.equity).toBe(0);
    expect(pos.cash).toBe(0);
    expect(pos.totalAssets).toBe(0);
    expect(pos.fixedAssets).toBe(0);
    expect(pos.receivables).toBe(0);
    expect(pos.tradePayables).toBe(0);
  });

  it('computes equity from equity accounts', () => {
    const bs = {
      assets: [],
      liabilities: [],
      equity: [
        { account_code: '101', account_type: 'equity', balance: 25000 },
        { account_code: '1068', account_type: 'equity', balance: 20000 },
      ],
    };
    const pos = extractFinancialPosition(bs, 'france');
    expect(pos.equity).toBe(45000);
  });

  it('computes totalAssets from totalAssets field when available', () => {
    const bs = {
      assets: [{ account_code: '512', account_type: 'asset', balance: 50000 }],
      liabilities: [],
      equity: [],
      totalAssets: 100000,
    };
    const pos = extractFinancialPosition(bs);
    expect(pos.totalAssets).toBe(100000);
  });

  it('falls back to summing assets when totalAssets not present', () => {
    const bs = {
      assets: [
        { account_code: '2183', account_type: 'asset', balance: 18000 },
        { account_code: '512', account_type: 'asset', balance: 50000 },
      ],
      liabilities: [],
      equity: [],
    };
    const pos = extractFinancialPosition(bs);
    expect(pos.totalAssets).toBe(68000);
  });
});

describe('calculatePreTaxIncome', () => {
  it('returns net income when no tax entries', () => {
    expect(calculatePreTaxIncome(100000, [], [], null, null)).toBe(100000);
  });

  it('returns 0 for NaN net income', () => {
    expect(calculatePreTaxIncome(NaN, [], [], null, null)).toBe(0);
  });

  it('returns 0 for null entries', () => {
    expect(calculatePreTaxIncome(50000, null, null, null, null)).toBe(50000);
  });
});
