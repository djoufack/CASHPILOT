import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  supabaseFrom: vi.fn(),
  getAccountingMappingTemplates: vi.fn(),
  getAccountingTaxRateTemplates: vi.fn(),
  getGlobalAccountingPlanAccounts: vi.fn(),
  validateChartOfAccountsImport: vi.fn(),
  isMissingColumnError: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mocks.supabaseFrom,
  },
}));

vi.mock('@/services/referenceDataService', () => ({
  getAccountingMappingTemplates: mocks.getAccountingMappingTemplates,
  getAccountingTaxRateTemplates: mocks.getAccountingTaxRateTemplates,
  getGlobalAccountingPlanAccounts: mocks.getGlobalAccountingPlanAccounts,
}));

vi.mock('@/utils/accountingQualityChecks', () => ({
  validateChartOfAccountsImport: mocks.validateChartOfAccountsImport,
}));

vi.mock('@/lib/supabaseCompatibility', () => ({
  isMissingColumnError: mocks.isMissingColumnError,
}));

import {
  copyPlanAccounts,
  initializeAccounting,
  initializeAccountingFromPlan,
  refreshAllUsersMappings,
  refreshUserMappings,
} from '@/services/accountingInitService';

const makeChain = ({
  thenResult = { data: [], error: null },
  singleResult = { data: null, error: null },
  maybeSingleResult = { data: null, error: null },
  upsertResult = { error: null },
  insertResult = { data: null, error: null },
  insertReturnsChain = false,
} = {}) => {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: vi.fn(() => Promise.resolve(maybeSingleResult)),
    single: vi.fn(() => Promise.resolve(singleResult)),
    upsert: vi.fn(() => Promise.resolve(upsertResult)),
    update: vi.fn(() => chain),
    insert: vi.fn(() => (insertReturnsChain ? chain : Promise.resolve(insertResult))),
    then: (resolve, reject) => Promise.resolve(thenResult).then(resolve, reject),
  };

  return chain;
};

describe('accountingInitService extra coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getGlobalAccountingPlanAccounts.mockResolvedValue([
      {
        account_code: '101',
        account_name: 'Capital',
        account_type: 'equity',
      },
      {
        account_code: '707',
        account_name: 'Ventes',
        account_type: 'revenue',
      },
    ]);
    mocks.getAccountingMappingTemplates.mockResolvedValue([
      {
        source_type: 'sale',
        source_category: 'default',
        debit_account_code: '411',
        credit_account_code: '707',
        description: 'Sale mapping',
      },
    ]);
    mocks.getAccountingTaxRateTemplates.mockResolvedValue([
      {
        name: 'TVA 20%',
        rate: 20,
        tax_type: 'vat',
        account_code: '4457',
        is_default: true,
      },
    ]);
    mocks.validateChartOfAccountsImport.mockReturnValue({ canImport: true, blockingIssues: [] });
    mocks.isMissingColumnError.mockReturnValue(false);
  });

  it('initializes accounting end-to-end for a scoped company', async () => {
    mocks.supabaseFrom.mockImplementation((table) => {
      if (table === 'user_accounting_settings') {
        return makeChain();
      }
      if (table === 'accounting_chart_of_accounts') {
        return makeChain();
      }
      if (table === 'accounting_mappings') {
        return makeChain();
      }
      if (table === 'accounting_tax_rates') {
        return makeChain();
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const result = await initializeAccounting('user-1', 'FR', 'company-1');

    expect(result).toMatchObject({
      success: true,
      accountsCount: 2,
      mappingsCount: 1,
      taxRatesCount: 1,
    });
  });

  it('returns a blocking error when reference chart validation fails', async () => {
    mocks.validateChartOfAccountsImport.mockReturnValue({
      canImport: false,
      blockingIssues: [{ message: 'Plan invalide' }],
    });

    mocks.supabaseFrom.mockImplementation((table) => {
      if (table === 'user_accounting_settings') {
        return makeChain();
      }
      if (table === 'accounting_chart_of_accounts') {
        return makeChain();
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const result = await initializeAccounting('user-1', 'BE', 'company-1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Plan invalide');
  });

  it('copies a source accounting plan and its accounts to a personal plan', async () => {
    let accountingPlansCalls = 0;
    let accountingPlanAccountsCalls = 0;

    mocks.supabaseFrom.mockImplementation((table) => {
      if (table === 'accounting_plans') {
        accountingPlansCalls += 1;

        if (accountingPlansCalls === 1) {
          return makeChain({
            singleResult: {
              data: { id: 'plan_source', name: 'Plan Source', country_code: 'FR' },
              error: null,
            },
          });
        }

        return makeChain({
          insertReturnsChain: true,
          singleResult: {
            data: { id: 'plan_new' },
            error: null,
          },
        });
      }

      if (table === 'accounting_plan_accounts') {
        accountingPlanAccountsCalls += 1;

        if (accountingPlanAccountsCalls === 1) {
          return makeChain({
            thenResult: {
              data: [
                { account_code: '101', account_name: 'Capital', account_type: 'equity', sort_order: 1 },
                { account_code: '707', account_name: 'Ventes', account_type: 'revenue', sort_order: 2 },
              ],
              error: null,
            },
          });
        }

        return makeChain({
          insertResult: { error: null },
        });
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const result = await copyPlanAccounts('plan_source', 'user-1');

    expect(result).toEqual({
      success: true,
      planId: 'plan_new',
      accountsCopied: 2,
    });
  });

  it('returns a source-not-found error when plan cannot be loaded', async () => {
    mocks.supabaseFrom.mockImplementation((table) => {
      if (table === 'accounting_plans') {
        return makeChain({
          singleResult: {
            data: null,
            error: { message: 'not found' },
          },
        });
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const result = await copyPlanAccounts('missing', 'user-1');
    expect(result.success).toBe(false);
    expect(result.error).toBe('not found');
  });

  it('refreshes mappings for all initialized users and reports per-user failures', async () => {
    mocks.getAccountingMappingTemplates
      .mockRejectedValueOnce(new Error('templates unavailable'))
      .mockResolvedValueOnce([
        {
          source_type: 'expense',
          source_category: 'default',
          debit_account_code: '601',
          credit_account_code: '401',
          description: 'Expense mapping',
        },
      ]);

    mocks.supabaseFrom.mockImplementation((table) => {
      if (table === 'user_accounting_settings') {
        return makeChain({
          thenResult: {
            data: [
              { user_id: 'u-1', country: 'FR' },
              { user_id: 'u-2', country: 'BE' },
            ],
            error: null,
          },
        });
      }

      if (table === 'accounting_mappings') {
        return makeChain({
          upsertResult: { error: null },
        });
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const result = await refreshAllUsersMappings();
    expect(result.usersUpdated).toBe(1);
    expect(result.totalMappings).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('u-1');
  });

  it('initializes accounting from a plan fallback when plan has no accounts', async () => {
    let planAccountsCalls = 0;

    mocks.supabaseFrom.mockImplementation((table) => {
      if (table === 'user_accounting_settings') {
        return makeChain();
      }
      if (table === 'accounting_plan_accounts') {
        planAccountsCalls += 1;
        if (planAccountsCalls === 1) {
          return makeChain({
            thenResult: { data: [], error: null },
          });
        }
        return makeChain({
          thenResult: {
            data: [
              { account_code: '101', account_name: 'Capital', account_type: 'equity' },
              { account_code: '707', account_name: 'Ventes', account_type: 'revenue' },
            ],
            error: null,
          },
        });
      }
      if (table === 'accounting_chart_of_accounts') {
        return makeChain();
      }
      if (table === 'accounting_mappings') {
        return makeChain();
      }
      if (table === 'accounting_tax_rates') {
        return makeChain();
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const result = await initializeAccountingFromPlan('user-1', 'plan-legacy', 'FR', 'company-1');
    expect(result.success).toBe(true);
    expect(result.accountsCount).toBe(2);
  });

  it('refreshUserMappings returns success when settings are present', async () => {
    let settingsCallCount = 0;

    mocks.supabaseFrom.mockImplementation((table) => {
      if (table === 'user_accounting_settings') {
        settingsCallCount += 1;
        if (settingsCallCount === 1) {
          return makeChain({
            maybeSingleResult: { data: { country: 'FR' }, error: null },
          });
        }
        return makeChain({
          thenResult: {
            data: [{ user_id: 'user-1', country: 'FR' }],
            error: null,
          },
        });
      }
      if (table === 'accounting_mappings') {
        return makeChain({ upsertResult: { error: null } });
      }
      if (table === 'intercompany_links') {
        return makeChain({ thenResult: { data: [], error: null } });
      }
      if (table === 'intercompany_transactions') {
        return makeChain({ thenResult: { data: [], error: null } });
      }
      if (table === 'transfer_pricing_rules') {
        return makeChain({ thenResult: { data: [], error: null } });
      }
      if (table === 'intercompany_eliminations') {
        return makeChain({ thenResult: { data: [], error: null } });
      }
      if (table === 'company') {
        return makeChain({ thenResult: { data: [], error: null } });
      }
      return makeChain();
    });

    const result = await refreshUserMappings('user-1');
    expect(result).toMatchObject({
      success: true,
      mappingsCount: 1,
      country: 'FR',
    });
  });

  it('copyPlanAccounts fails when source accounts query returns an error', async () => {
    let plansCall = 0;
    mocks.supabaseFrom.mockImplementation((table) => {
      if (table === 'accounting_plans') {
        plansCall += 1;
        if (plansCall === 1) {
          return makeChain({
            singleResult: { data: { id: 'plan-source', name: 'Source' }, error: null },
          });
        }
        return makeChain({
          insertReturnsChain: true,
          singleResult: { data: { id: 'plan-new' }, error: null },
        });
      }
      if (table === 'accounting_plan_accounts') {
        return makeChain({
          thenResult: { data: null, error: { message: 'accounts query failed' } },
        });
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const result = await copyPlanAccounts('plan-source', 'user-1');
    expect(result.success).toBe(false);
    expect(result.error).toBe('accounts query failed');
  });

  it('copyPlanAccounts fails when source plan has no accounts', async () => {
    mocks.supabaseFrom.mockImplementation((table) => {
      if (table === 'accounting_plans') {
        return makeChain({
          singleResult: { data: { id: 'plan-source', name: 'Source' }, error: null },
        });
      }
      if (table === 'accounting_plan_accounts') {
        return makeChain({
          thenResult: { data: [], error: null },
        });
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const result = await copyPlanAccounts('plan-source', 'user-1');
    expect(result.success).toBe(false);
    expect(result.error).toBe('No accounts found in source plan');
  });

  it('copyPlanAccounts fails when personal plan creation fails', async () => {
    let plansCall = 0;
    mocks.supabaseFrom.mockImplementation((table) => {
      if (table === 'accounting_plans') {
        plansCall += 1;
        if (plansCall === 1) {
          return makeChain({
            singleResult: { data: { id: 'plan-source', name: 'Source' }, error: null },
          });
        }
        return makeChain({
          insertReturnsChain: true,
          singleResult: { data: null, error: { message: 'plan create failed' } },
        });
      }
      if (table === 'accounting_plan_accounts') {
        return makeChain({
          thenResult: {
            data: [{ account_code: '101', account_name: 'Capital', account_type: 'equity' }],
            error: null,
          },
        });
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const result = await copyPlanAccounts('plan-source', 'user-1');
    expect(result.success).toBe(false);
    expect(result.error).toBe('plan create failed');
  });

  it('initializeAccountingFromPlan fails fast when company is missing', async () => {
    const result = await initializeAccountingFromPlan('user-1', 'plan-1', 'FR', null);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Aucune societe active');
  });

  it('refreshUserMappings fails when settings cannot be loaded', async () => {
    mocks.supabaseFrom.mockImplementation((table) => {
      if (table === 'user_accounting_settings') {
        return makeChain({
          maybeSingleResult: { data: null, error: { message: 'settings missing' } },
        });
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const result = await refreshUserMappings('user-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('settings missing');
  });
});
