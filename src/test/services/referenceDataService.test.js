import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

import {
  getReferenceDataSnapshot,
  getCurrencyMetadata,
  getCountryMetadata,
  getTaxJurisdictionMetadata,
  getSectorBenchmarksMetadata,
  getSectorMultiplesMetadata,
  getRegionWaccMetadata,
  getGlobalAccountingPlan,
  getAccountingMappingTemplates,
  getAccountingTaxRateTemplates,
} from '@/services/referenceDataService';

describe('referenceDataService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getReferenceDataSnapshot', () => {
    it('returns snapshot with expected keys', () => {
      const snap = getReferenceDataSnapshot();
      expect(snap).toHaveProperty('ready');
      expect(snap).toHaveProperty('countries');
      expect(snap).toHaveProperty('currencies');
    });
  });

  describe('metadata accessors', () => {
    it('getCurrencyMetadata returns null for unknown', () => {
      expect(getCurrencyMetadata('UNKNOWN')).toBeNull();
    });
    it('getCountryMetadata returns null for unknown', () => {
      expect(getCountryMetadata('XX')).toBeNull();
    });
    it('getTaxJurisdictionMetadata handles empty', () => {
      const r = getTaxJurisdictionMetadata('FR');
      expect(r === null || r?.code === 'FR').toBe(true);
    });
    it('getSectorBenchmarksMetadata returns null', () => {
      expect(getSectorBenchmarksMetadata('tech')).toBeNull();
    });
    it('getSectorMultiplesMetadata returns null', () => {
      expect(getSectorMultiplesMetadata('tech', 'france')).toBeNull();
    });
    it('getRegionWaccMetadata returns null', () => {
      expect(getRegionWaccMetadata('france')).toBeNull();
    });
  });

  describe('getGlobalAccountingPlan', () => {
    it('queries with correct filters', async () => {
      const { supabase } = await import('@/lib/supabase');
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'p1' }, error: null }) }),
      });
      const result = await getGlobalAccountingPlan('FR');
      expect(result).toHaveProperty('id', 'p1');
    });
    it('throws on error', async () => {
      const { supabase } = await import('@/lib/supabase');
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi
          .fn()
          .mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: new Error('Not found') }) }),
      });
      await expect(getGlobalAccountingPlan('FR')).rejects.toThrow();
    });
  });

  describe('getAccountingMappingTemplates', () => {
    it('queries templates', async () => {
      const { supabase } = await import('@/lib/supabase');
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi
          .fn()
          .mockReturnValue({
            order: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: [{ id: 1 }], error: null }) }),
          }),
      });
      const result = await getAccountingMappingTemplates('FR');
      expect(result).toHaveLength(1);
    });
  });

  describe('getAccountingTaxRateTemplates', () => {
    it('queries tax rate templates', async () => {
      const { supabase } = await import('@/lib/supabase');
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi
          .fn()
          .mockReturnValue({
            order: vi
              .fn()
              .mockReturnValue({ order: vi.fn().mockResolvedValue({ data: [{ id: 1, rate: 20 }], error: null }) }),
          }),
      });
      const result = await getAccountingTaxRateTemplates('FR');
      expect(result).toHaveLength(1);
    });
  });
});
