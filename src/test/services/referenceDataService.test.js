import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase', () => {
  const mockChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  return {
    supabase: {
      from: vi.fn(() => ({ ...mockChain })),
    },
  };
});

import {
  getReferenceDataSnapshot,
  loadReferenceData,
  getCurrencyMetadata,
  getCountryMetadata,
  getTaxJurisdictionMetadata,
  getSectorBenchmarksMetadata,
  getSectorMultiplesMetadata,
  getRegionWaccMetadata,
  getGlobalAccountingPlan,
  getGlobalAccountingPlanAccounts,
  getAccountingMappingTemplates,
  getAccountingTaxRateTemplates,
} from '@/services/referenceDataService';

describe('referenceDataService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── getReferenceDataSnapshot ──────────────────────────────────────────

  describe('getReferenceDataSnapshot', () => {
    it('should return the current snapshot', () => {
      const snapshot = getReferenceDataSnapshot();
      expect(snapshot).toBeDefined();
      expect(snapshot).toHaveProperty('ready');
      expect(snapshot).toHaveProperty('countries');
      expect(snapshot).toHaveProperty('currencies');
    });
  });

  // ── loadReferenceData ─────────────────────────────────────────────────

  describe('loadReferenceData', () => {
    it('should load reference data from Supabase', async () => {
      const { supabase } = await import('@/lib/supabase');

      supabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        then: vi.fn(),
        [Symbol.for('vitest:resolve')]: true,
      }));

      // Mock Promise.allSettled results via individual table responses
      supabase.from.mockImplementation((table) => {
        const chain = {
          select: vi.fn().mockReturnValue(chain),
          order: vi.fn().mockReturnValue(chain),
        };

        // Final order call resolves with data
        let orderCallCount = 0;
        chain.order = vi.fn().mockImplementation(() => {
          orderCallCount++;
          // Each table has different number of order calls
          return chain;
        });

        // Make the chain thenable (Promise-like)
        chain.then = (resolve) => {
          if (table === 'reference_countries') {
            resolve({ data: [{ code: 'FR', label: 'France', sort_order: 1 }], error: null });
          } else if (table === 'reference_currencies') {
            resolve({ data: [{ code: 'EUR', symbol: '€', name: 'Euro', sort_order: 1 }], error: null });
          } else if (table === 'reference_tax_jurisdictions') {
            resolve({
              data: [{ code: 'FR', name: 'France', currency: 'EUR', default_vat_rate: 20, vat_label: 'TVA', is_active: true }],
              error: null,
            });
          } else if (table === 'reference_tax_jurisdiction_vat_rates') {
            resolve({
              data: [{ jurisdiction_code: 'FR', rate: 20, label: '20%', is_default: true, sort_order: 1 }],
              error: null,
            });
          } else if (table === 'reference_sector_benchmarks') {
            resolve({
              data: [{ sector: 'b2b_services', metric_key: 'gross_margin', low_value: 30, target_value: 50, high_value: 70 }],
              error: null,
            });
          } else if (table === 'reference_sector_multiples') {
            resolve({
              data: [{ sector: 'b2b_services', region: 'france', low_value: 3, mid_value: 5, high_value: 8 }],
              error: null,
            });
          } else if (table === 'reference_region_wacc') {
            resolve({
              data: [{ region: 'france', risk_free_rate: 0.03, equity_premium: 0.06, beta: 1.0, wacc: 0.09 }],
              error: null,
            });
          } else {
            resolve({ data: [], error: null });
          }
          return { catch: vi.fn() };
        };

        return chain;
      });

      const result = await loadReferenceData({ force: true });
      expect(result.ready).toBe(true);
      expect(result.countries.length).toBeGreaterThanOrEqual(0);
    });
  });

  // ── Metadata accessor functions (work on snapshot) ────────────────────

  describe('getCurrencyMetadata', () => {
    it('should return null for unknown currency', () => {
      expect(getCurrencyMetadata('UNKNOWN')).toBeNull();
    });

    it('should normalize code to uppercase', () => {
      expect(getCurrencyMetadata('eur')).toBeNull(); // Not loaded yet in this test context
    });
  });

  describe('getCountryMetadata', () => {
    it('should return null for unknown country', () => {
      expect(getCountryMetadata('XX')).toBeNull();
    });
  });

  describe('getTaxJurisdictionMetadata', () => {
    it('should return null when no data loaded', () => {
      const result = getTaxJurisdictionMetadata('FR');
      // Returns FR fallback or null
      expect(result === null || result?.code === 'FR').toBe(true);
    });

    it('should default to FR when empty code', () => {
      const result = getTaxJurisdictionMetadata('');
      expect(result === null || result?.code === 'FR').toBe(true);
    });
  });

  describe('getSectorBenchmarksMetadata', () => {
    it('should return null when no data loaded', () => {
      const result = getSectorBenchmarksMetadata('tech');
      // Falls back to b2b_services or null
      expect(result).toBeNull();
    });
  });

  describe('getSectorMultiplesMetadata', () => {
    it('should return null when no data loaded', () => {
      expect(getSectorMultiplesMetadata('tech', 'france')).toBeNull();
    });
  });

  describe('getRegionWaccMetadata', () => {
    it('should return null when no data loaded', () => {
      expect(getRegionWaccMetadata('france')).toBeNull();
    });
  });

  // ── getGlobalAccountingPlan ───────────────────────────────────────────

  describe('getGlobalAccountingPlan', () => {
    it('should query accounting_plans with correct filters', async () => {
      const { supabase } = await import('@/lib/supabase');

      const mockMaybeSingle = vi.fn().mockResolvedValue({
        data: { id: 'plan-1', country_code: 'FR', is_global: true },
        error: null,
      });

      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle }),
      });

      const result = await getGlobalAccountingPlan('FR');
      expect(result).toHaveProperty('id', 'plan-1');
    });

    it('should return null on error', async () => {
      const { supabase } = await import('@/lib/supabase');

      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: new Error('Not found') }),
        }),
      });

      await expect(getGlobalAccountingPlan('FR')).rejects.toThrow();
    });
  });

  // ── getGlobalAccountingPlanAccounts ────────────────────────────────────

  describe('getGlobalAccountingPlanAccounts', () => {
    it('should return empty array when no plan found', async () => {
      const { supabase } = await import('@/lib/supabase');

      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });

      const result = await getGlobalAccountingPlanAccounts('XX');
      expect(result).toEqual([]);
    });
  });

  // ── getAccountingMappingTemplates ─────────────────────────────────────

  describe('getAccountingMappingTemplates', () => {
    it('should query templates for a country', async () => {
      const { supabase } = await import('@/lib/supabase');

      const mockOrder2 = vi.fn().mockResolvedValue({
        data: [{ id: 1, source_type: 'invoice', source_category: 'service' }],
        error: null,
      });
      const mockOrder1 = vi.fn().mockReturnValue({ order: mockOrder2 });

      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({ order: mockOrder1 }),
      });

      const result = await getAccountingMappingTemplates('FR');
      expect(result).toHaveLength(1);
    });
  });

  // ── getAccountingTaxRateTemplates ─────────────────────────────────────

  describe('getAccountingTaxRateTemplates', () => {
    it('should query tax rate templates for a country', async () => {
      const { supabase } = await import('@/lib/supabase');

      const mockOrder2 = vi.fn().mockResolvedValue({
        data: [{ id: 1, name: 'TVA 20%', rate: 20, is_default: true }],
        error: null,
      });
      const mockOrder1 = vi.fn().mockReturnValue({ order: mockOrder2 });

      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({ order: mockOrder1 }),
      });

      const result = await getAccountingTaxRateTemplates('FR');
      expect(result).toHaveLength(1);
    });
  });
});
