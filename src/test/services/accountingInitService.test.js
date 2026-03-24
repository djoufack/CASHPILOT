import { describe, expect, it, vi, beforeEach } from 'vitest';

const { upsertSpy, accountingMappingsUpsertSpy, accountingTaxRatesUpsertSpy } = vi.hoisted(() => ({
  upsertSpy: vi.fn(),
  accountingMappingsUpsertSpy: vi.fn(),
  accountingTaxRatesUpsertSpy: vi.fn(),
}));

vi.mock('@/services/referenceDataService', () => ({
  getAccountingMappingTemplates: vi.fn().mockResolvedValue([
    {
      source_type: 'sale',
      source_category: 'default',
      debit_account_code: '411',
      credit_account_code: '707',
      description: 'Default sale mapping',
    },
  ]),
  getAccountingTaxRateTemplates: vi.fn().mockResolvedValue([
    {
      name: 'TVA 20%',
      rate: 20,
      tax_type: 'vat',
      account_code: '4457',
      is_default: true,
    },
  ]),
  getGlobalAccountingPlanAccounts: vi.fn().mockResolvedValue([
    {
      account_code: '101',
      account_name: 'Capital',
      account_type: 'equity',
      account_category: null,
      parent_code: null,
      description: null,
      is_header: false,
    },
  ]),
}));

vi.mock('@/utils/accountingQualityChecks', () => ({
  validateChartOfAccountsImport: vi.fn(() => ({ canImport: true, blockingIssues: [] })),
}));

vi.mock('@/lib/supabase', () => {
  const makeChain = (table) => ({
    upsert: vi.fn((payload, options) => {
      upsertSpy(table, payload, options);
      if (table === 'accounting_mappings') {
        accountingMappingsUpsertSpy(payload, options);
      }
      if (table === 'accounting_tax_rates') {
        accountingTaxRatesUpsertSpy(payload, options);
      }
      return Promise.resolve({ error: null });
    }),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
  });

  return {
    supabase: {
      from: vi.fn((table) => makeChain(table)),
    },
  };
});

import { initializeAccountingFromPlan } from '@/services/accountingInitService';

describe('accountingInitService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scopes default mappings and tax rates by company during plan initialization', async () => {
    const result = await initializeAccountingFromPlan('user-1', 'plan-1', 'FR', 'company-1');

    expect(result.success).toBe(true);
    expect(accountingMappingsUpsertSpy).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          user_id: 'user-1',
          company_id: 'company-1',
        }),
      ]),
      expect.objectContaining({ onConflict: 'company_id,user_id,source_type,source_category' })
    );
    expect(accountingTaxRatesUpsertSpy).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          user_id: 'user-1',
          company_id: 'company-1',
        }),
      ]),
      expect.objectContaining({ onConflict: 'company_id,user_id,name' })
    );
  });
});
