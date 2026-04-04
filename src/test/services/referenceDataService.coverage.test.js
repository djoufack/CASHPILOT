import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '@/lib/supabase';
import {
  getAccountingMappingTemplates,
  getAccountingTaxRateTemplates,
  getCountryMetadata,
  getCurrencyMetadata,
  getGlobalAccountingPlanAccounts,
  getReferenceDataSnapshot,
  getRegionWaccMetadata,
  getSectorBenchmarksMetadata,
  getSectorMultiplesMetadata,
  getTaxJurisdictionMetadata,
  loadReferenceData,
} from '@/services/referenceDataService';

const createOrderedQuery = ({ data = [], error = null } = {}) => {
  const query = {
    order: vi.fn(() => query),
    then: (resolve, reject) => Promise.resolve({ data, error }).then(resolve, reject),
  };

  return {
    select: vi.fn(() => query),
  };
};

const createPlanQuery = ({ data = null, error = null } = {}) => {
  const chain = {
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => ({
      maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    })),
  };

  return {
    select: vi.fn(() => chain),
  };
};

const createPlanAccountsQuery = ({ data = [], error = null } = {}) => {
  const chain = {
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    then: (resolve, reject) => Promise.resolve({ data, error }).then(resolve, reject),
  };

  return {
    select: vi.fn(() => chain),
  };
};

describe('referenceDataService additional coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads and normalizes reference data, then resolves metadata fallbacks', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'reference_countries') {
        return createOrderedQuery({
          data: [
            { code: 'be', label: 'Belgique', sort_order: 2 },
            { code: 'fr', label: 'France', sort_order: 1 },
          ],
        });
      }
      if (table === 'reference_currencies') {
        return createOrderedQuery({
          data: [
            { code: 'eur', symbol: '€', name: 'Euro', sort_order: 1, region: 'europe' },
            { code: 'xaf', symbol: 'FCFA', name: 'Franc CFA', sort_order: 2, region: 'africa' },
          ],
        });
      }
      if (table === 'reference_tax_jurisdictions') {
        return createOrderedQuery({
          data: [
            { code: 'FR', name: 'France', currency: 'EUR', default_vat_rate: 20 },
            { code: 'BE', name: 'Belgique', currency: 'EUR', default_vat_rate: 21 },
          ],
        });
      }
      if (table === 'reference_tax_jurisdiction_vat_rates') {
        return createOrderedQuery({
          data: [
            { id: 1, jurisdiction_code: 'FR', rate: 20, label: 'Normal', is_default: true, sort_order: 1 },
            { id: 2, jurisdiction_code: 'FR', rate: 10, label: 'Intermediaire', sort_order: 2 },
          ],
        });
      }
      if (table === 'reference_sector_benchmarks') {
        return createOrderedQuery({
          data: [
            { sector: 'b2b_services', metric_key: 'gross_margin', low_value: 20, target_value: 35, high_value: 50 },
          ],
        });
      }
      if (table === 'reference_sector_multiples') {
        return createOrderedQuery({
          data: [{ sector: 'b2b_services', region: 'france', low_value: 4, mid_value: 6, high_value: 8 }],
        });
      }
      if (table === 'reference_region_wacc') {
        return createOrderedQuery({
          data: [{ region: 'france', risk_free_rate: 0.02, equity_premium: 0.06, beta: 1.1, wacc: 0.09 }],
        });
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const firstLoad = await loadReferenceData({ force: true });
    const secondLoad = await loadReferenceData();

    expect(firstLoad.ready).toBe(true);
    expect(secondLoad).toBe(firstLoad);
    expect(getReferenceDataSnapshot().countries[0].code).toBe('FR');
    expect(getCurrencyMetadata('eur')?.symbol).toBe('€');
    expect(getCountryMetadata('be')?.label).toBe('Belgique');
    expect(getTaxJurisdictionMetadata('unknown')?.code).toBe('FR');
    expect(getSectorBenchmarksMetadata('unknown')?.target).toBeUndefined();
    expect(getSectorBenchmarksMetadata('unknown')?.gross_margin?.target).toBe(35);
    expect(getSectorMultiplesMetadata('unknown', 'unknown')?.mid).toBe(6);
    expect(getRegionWaccMetadata('unknown')?.wacc).toBe(9);
  });

  it('keeps loading when one reference source fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    supabase.from.mockImplementation((table) => {
      if (table === 'reference_sector_benchmarks') {
        return createOrderedQuery({ data: null, error: new Error('benchmarks failed') });
      }

      return createOrderedQuery({ data: [] });
    });

    const snapshot = await loadReferenceData({ force: true });
    expect(snapshot.ready).toBe(true);
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('loads accounting plan accounts and templates with country normalization', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'accounting_plans') {
        return createPlanQuery({ data: { id: 'plan_fr' }, error: null });
      }
      if (table === 'accounting_plan_accounts') {
        return createPlanAccountsQuery({
          data: [{ id: 'acc_1', account_code: '401', sort_order: 1 }],
        });
      }
      if (table === 'accounting_mapping_templates') {
        return createPlanAccountsQuery({
          data: [{ source_type: 'expense', source_category: 'default', account_code: '601' }],
        });
      }
      if (table === 'accounting_tax_rate_templates') {
        return createPlanAccountsQuery({
          data: [{ name: 'TVA 20%', rate: 20, is_default: true }],
        });
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const accounts = await getGlobalAccountingPlanAccounts('fr');
    const mappings = await getAccountingMappingTemplates('fr');
    const taxes = await getAccountingTaxRateTemplates('fr');

    expect(accounts).toHaveLength(1);
    expect(mappings).toHaveLength(1);
    expect(taxes).toHaveLength(1);
  });

  it('returns empty accounts when no global plan exists and throws on downstream errors', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'accounting_plans') {
        return createPlanQuery({ data: null, error: null });
      }
      if (table === 'accounting_mapping_templates') {
        return createPlanAccountsQuery({ data: null, error: new Error('mapping error') });
      }
      if (table === 'accounting_tax_rate_templates') {
        return createPlanAccountsQuery({ data: null, error: new Error('tax error') });
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const accounts = await getGlobalAccountingPlanAccounts('BE');
    expect(accounts).toEqual([]);

    await expect(getAccountingMappingTemplates('BE')).rejects.toThrow('mapping error');
    await expect(getAccountingTaxRateTemplates('BE')).rejects.toThrow('tax error');
  });
});
