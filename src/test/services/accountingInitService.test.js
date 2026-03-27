import { describe, expect, it, vi, beforeEach } from 'vitest';

const {
  upsertSpy,
  accountingMappingsUpsertSpy,
  accountingTaxRatesUpsertSpy,
  setUserSettingsResponse,
  getUserSettingsResponse,
  setChartCountResponse,
  getChartCountResponse,
} = vi.hoisted(() => {
  let userSettingsResponse = { data: null, error: null };
  let chartCountResponse = { count: 0, error: null };

  return {
    upsertSpy: vi.fn(),
    accountingMappingsUpsertSpy: vi.fn(),
    accountingTaxRatesUpsertSpy: vi.fn(),
    setUserSettingsResponse: (value) => {
      userSettingsResponse = value;
    },
    getUserSettingsResponse: () => userSettingsResponse,
    setChartCountResponse: (value) => {
      chartCountResponse = value;
    },
    getChartCountResponse: () => chartCountResponse,
  };
});

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
  const makeChain = (table) => {
    const state = {
      selectOptions: null,
    };

    const chain = {
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
      select: vi.fn((_, options) => {
        state.selectOptions = options || null;
        return chain;
      }),
      eq: vi.fn(() => chain),
      maybeSingle: vi.fn(() => {
        if (table === 'user_accounting_settings') {
          return Promise.resolve(getUserSettingsResponse());
        }
        return Promise.resolve({ data: null, error: null });
      }),
      update: vi.fn(() => chain),
      insert: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      then: (resolve, reject) => {
        let response = { data: [], error: null };

        if (table === 'accounting_chart_of_accounts' && state.selectOptions?.head) {
          const { count, error } = getChartCountResponse();
          response = { count, error };
        }

        return Promise.resolve(response).then(resolve, reject);
      },
    };

    return chain;
  };

  return {
    supabase: {
      from: vi.fn((table) => makeChain(table)),
    },
  };
});

import { checkAccountingInitialized, initializeAccountingFromPlan } from '@/services/accountingInitService';

describe('accountingInitService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUserSettingsResponse({ data: null, error: null });
    setChartCountResponse({ count: 0, error: null });
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

  it('returns not initialized for active company when settings exist but no scoped accounts', async () => {
    setUserSettingsResponse({
      data: { user_id: 'user-1', country: 'BE', is_initialized: true },
      error: null,
    });
    setChartCountResponse({ count: 0, error: null });

    const result = await checkAccountingInitialized('user-1', 'company-1');

    expect(result.isInitialized).toBe(false);
    expect(result.companyHasAccounts).toBe(false);
    expect(result.country).toBe('BE');
  });

  it('returns initialized for active company when settings are missing but scoped accounts exist', async () => {
    setUserSettingsResponse({ data: null, error: null });
    setChartCountResponse({ count: 3, error: null });

    const result = await checkAccountingInitialized('user-1', 'company-1');

    expect(result.isInitialized).toBe(true);
    expect(result.companyHasAccounts).toBe(true);
    expect(result.settings).toBeNull();
  });
});
