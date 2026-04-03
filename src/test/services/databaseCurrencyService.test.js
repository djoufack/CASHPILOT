import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/utils/dateFormatting', () => ({
  formatDateInput: vi.fn(() => '2026-04-02'),
}));
vi.mock('@/utils/accountingCurrency', () => ({
  resolveAccountingCurrency: vi.fn(() => 'EUR'),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

import {
  getDatabaseExchangeRate,
  convertAmountWithDatabaseRate,
  listAccessibleFxRates,
  resolveAccountingCurrency,
} from '@/services/databaseCurrencyService';

describe('databaseCurrencyService', () => {
  let supabase;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/lib/supabase');
    supabase = mod.supabase;
  });

  // ── resolveAccountingCurrency (re-export) ─────────────────────────────

  describe('resolveAccountingCurrency', () => {
    it('should be re-exported from accountingCurrency util', () => {
      expect(resolveAccountingCurrency).toBeDefined();
      expect(resolveAccountingCurrency()).toBe('EUR');
    });
  });

  // ── getDatabaseExchangeRate ───────────────────────────────────────────

  describe('getDatabaseExchangeRate', () => {
    it('should call RPC with correct parameters', async () => {
      supabase.rpc.mockResolvedValue({
        data: [{ rate: 1.08, base_currency: 'EUR', quote_currency: 'USD' }],
        error: null,
      });

      const result = await getDatabaseExchangeRate({
        fromCurrency: 'EUR',
        toCurrency: 'USD',
        effectiveOn: '2026-04-01',
      });

      expect(supabase.rpc).toHaveBeenCalledWith('get_exchange_rate', {
        p_from_currency: 'EUR',
        p_to_currency: 'USD',
        p_effective_on: '2026-04-01',
        p_company_id: null,
      });
      expect(result).toEqual({ rate: 1.08, base_currency: 'EUR', quote_currency: 'USD' });
    });

    it('should use default date when effectiveOn is not provided', async () => {
      supabase.rpc.mockResolvedValue({ data: [{ rate: 1.0 }], error: null });
      await getDatabaseExchangeRate({ fromCurrency: 'EUR', toCurrency: 'EUR' });

      expect(supabase.rpc).toHaveBeenCalledWith(
        'get_exchange_rate',
        expect.objectContaining({
          p_effective_on: '2026-04-02',
        })
      );
    });

    it('should return null when no rate found', async () => {
      supabase.rpc.mockResolvedValue({ data: [], error: null });
      const result = await getDatabaseExchangeRate({ fromCurrency: 'EUR', toCurrency: 'XYZ' });
      expect(result).toBeNull();
    });

    it('should return null when data is not an array', async () => {
      supabase.rpc.mockResolvedValue({ data: null, error: null });
      const result = await getDatabaseExchangeRate({ fromCurrency: 'EUR', toCurrency: 'USD' });
      expect(result).toBeNull();
    });

    it('should throw on RPC error', async () => {
      supabase.rpc.mockResolvedValue({ data: null, error: new Error('RPC error') });
      await expect(getDatabaseExchangeRate({ fromCurrency: 'EUR', toCurrency: 'USD' })).rejects.toThrow('RPC error');
    });

    it('should pass companyId when provided', async () => {
      supabase.rpc.mockResolvedValue({ data: [{ rate: 1.08 }], error: null });
      await getDatabaseExchangeRate({ fromCurrency: 'EUR', toCurrency: 'USD', companyId: 'comp1' });

      expect(supabase.rpc).toHaveBeenCalledWith(
        'get_exchange_rate',
        expect.objectContaining({
          p_company_id: 'comp1',
        })
      );
    });
  });

  // ── convertAmountWithDatabaseRate ─────────────────────────────────────

  describe('convertAmountWithDatabaseRate', () => {
    it('should call RPC with correct parameters', async () => {
      supabase.rpc.mockResolvedValue({ data: 108.5, error: null });

      const result = await convertAmountWithDatabaseRate({
        amount: 100,
        fromCurrency: 'EUR',
        toCurrency: 'USD',
        effectiveOn: '2026-04-01',
      });

      expect(supabase.rpc).toHaveBeenCalledWith('convert_currency_amount', {
        p_amount: 100,
        p_from_currency: 'EUR',
        p_to_currency: 'USD',
        p_effective_on: '2026-04-01',
        p_company_id: null,
        p_scale: 6,
      });
      expect(result).toBe(108.5);
    });

    it('should throw on RPC error', async () => {
      supabase.rpc.mockResolvedValue({ data: null, error: new Error('Conversion failed') });
      await expect(
        convertAmountWithDatabaseRate({
          amount: 100,
          fromCurrency: 'EUR',
          toCurrency: 'USD',
        })
      ).rejects.toThrow('Conversion failed');
    });

    it('should pass custom scale', async () => {
      supabase.rpc.mockResolvedValue({ data: 108.5, error: null });
      await convertAmountWithDatabaseRate({
        amount: 100,
        fromCurrency: 'EUR',
        toCurrency: 'USD',
        scale: 2,
      });

      expect(supabase.rpc).toHaveBeenCalledWith(
        'convert_currency_amount',
        expect.objectContaining({
          p_scale: 2,
        })
      );
    });
  });

  // ── listAccessibleFxRates ─────────────────────────────────────────────

  describe('listAccessibleFxRates', () => {
    it('should list FX rates without companyId', async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({
          data: [{ id: 1, base_currency: 'EUR', quote_currency: 'USD', rate: 1.08 }],
          error: null,
        }),
        or: vi.fn(),
      };
      supabase.from.mockReturnValue(mockChain);

      const result = await listAccessibleFxRates();
      expect(result).toHaveLength(1);
    });

    it('should filter by companyId when provided', async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        is: vi.fn(),
        or: vi.fn().mockResolvedValue({
          data: [{ id: 1 }],
          error: null,
        }),
      };
      supabase.from.mockReturnValue(mockChain);

      const result = await listAccessibleFxRates({ companyId: 'comp1' });
      expect(result).toHaveLength(1);
    });

    it('should throw on query error', async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({ data: null, error: new Error('Query error') }),
      };
      supabase.from.mockReturnValue(mockChain);

      await expect(listAccessibleFxRates()).rejects.toThrow('Query error');
    });

    it('should return empty array when no data', async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      supabase.from.mockReturnValue(mockChain);

      const result = await listAccessibleFxRates();
      expect(result).toEqual([]);
    });
  });
});
