import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/utils/dateFormatting', () => ({
  formatDateInput: vi.fn(() => '2026-04-02'),
}));
vi.mock('@/utils/accountingCurrency', () => ({
  resolveAccountingCurrency: vi.fn((c) => c?.accounting_currency?.toUpperCase() || 'EUR'),
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

describe('databaseCurrencyService (extended)', () => {
  let supabase;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/lib/supabase');
    supabase = mod.supabase;
  });

  describe('getDatabaseExchangeRate', () => {
    it('returns the first rate when data is a non-empty array', async () => {
      supabase.rpc.mockResolvedValue({
        data: [{ rate: 1.085, source: 'ECB' }],
        error: null,
      });

      const result = await getDatabaseExchangeRate({
        fromCurrency: 'EUR',
        toCurrency: 'USD',
        effectiveOn: '2026-01-15',
      });

      expect(result).toEqual({ rate: 1.085, source: 'ECB' });
      expect(supabase.rpc).toHaveBeenCalledWith('get_exchange_rate', {
        p_from_currency: 'EUR',
        p_to_currency: 'USD',
        p_effective_on: '2026-01-15',
        p_company_id: null,
      });
    });

    it('returns null when data is empty array', async () => {
      supabase.rpc.mockResolvedValue({ data: [], error: null });

      const result = await getDatabaseExchangeRate({
        fromCurrency: 'EUR',
        toCurrency: 'XAF',
      });
      expect(result).toBeNull();
    });

    it('returns null when data is not an array', async () => {
      supabase.rpc.mockResolvedValue({ data: null, error: null });

      const result = await getDatabaseExchangeRate({
        fromCurrency: 'EUR',
        toCurrency: 'GBP',
      });
      expect(result).toBeNull();
    });

    it('throws on error', async () => {
      const err = { message: 'RPC failed' };
      supabase.rpc.mockResolvedValue({ data: null, error: err });

      await expect(getDatabaseExchangeRate({ fromCurrency: 'EUR', toCurrency: 'USD' })).rejects.toBe(err);
    });

    it('uses formatDateInput default when effectiveOn is null', async () => {
      supabase.rpc.mockResolvedValue({ data: [{ rate: 1.0 }], error: null });

      await getDatabaseExchangeRate({ fromCurrency: 'EUR', toCurrency: 'USD', effectiveOn: null });

      expect(supabase.rpc).toHaveBeenCalledWith(
        'get_exchange_rate',
        expect.objectContaining({
          p_effective_on: '2026-04-02',
        })
      );
    });

    it('passes companyId when provided', async () => {
      supabase.rpc.mockResolvedValue({ data: [{ rate: 655.957 }], error: null });

      await getDatabaseExchangeRate({
        fromCurrency: 'EUR',
        toCurrency: 'XAF',
        effectiveOn: '2026-03-01',
        companyId: 'company-abc',
      });

      expect(supabase.rpc).toHaveBeenCalledWith(
        'get_exchange_rate',
        expect.objectContaining({
          p_company_id: 'company-abc',
        })
      );
    });
  });

  describe('convertAmountWithDatabaseRate', () => {
    it('returns converted amount', async () => {
      supabase.rpc.mockResolvedValue({ data: 108.5, error: null });

      const result = await convertAmountWithDatabaseRate({
        amount: 100,
        fromCurrency: 'EUR',
        toCurrency: 'USD',
        effectiveOn: '2026-01-15',
      });

      expect(result).toBe(108.5);
      expect(supabase.rpc).toHaveBeenCalledWith('convert_currency_amount', {
        p_amount: 100,
        p_from_currency: 'EUR',
        p_to_currency: 'USD',
        p_effective_on: '2026-01-15',
        p_company_id: null,
        p_scale: 6,
      });
    });

    it('throws on error', async () => {
      const err = { message: 'conversion failed' };
      supabase.rpc.mockResolvedValue({ data: null, error: err });

      await expect(
        convertAmountWithDatabaseRate({
          amount: 100,
          fromCurrency: 'EUR',
          toCurrency: 'USD',
        })
      ).rejects.toBe(err);
    });

    it('uses custom scale', async () => {
      supabase.rpc.mockResolvedValue({ data: 108.5, error: null });

      await convertAmountWithDatabaseRate({
        amount: 100,
        fromCurrency: 'EUR',
        toCurrency: 'USD',
        effectiveOn: '2026-01-15',
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

  describe('listAccessibleFxRates', () => {
    it('returns rates array filtering by null company_id', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({ data: [{ id: 'r1' }], error: null }),
        or: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
      supabase.from.mockReturnValue(mockQuery);

      const result = await listAccessibleFxRates();
      expect(result).toEqual([{ id: 'r1' }]);
      expect(mockQuery.is).toHaveBeenCalledWith('company_id', null);
    });

    it('uses or filter when companyId is provided', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        or: vi.fn().mockResolvedValue({ data: [{ id: 'r2' }], error: null }),
      };
      supabase.from.mockReturnValue(mockQuery);

      const result = await listAccessibleFxRates({ companyId: 'comp-1' });
      expect(result).toEqual([{ id: 'r2' }]);
      expect(mockQuery.or).toHaveBeenCalledWith('company_id.is.null,company_id.eq.comp-1');
    });

    it('returns empty array when data is null', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      supabase.from.mockReturnValue(mockQuery);

      const result = await listAccessibleFxRates();
      expect(result).toEqual([]);
    });

    it('throws on error', async () => {
      const err = { message: 'query failed' };
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({ data: null, error: err }),
      };
      supabase.from.mockReturnValue(mockQuery);

      await expect(listAccessibleFxRates()).rejects.toBe(err);
    });
  });

  describe('resolveAccountingCurrency (re-export)', () => {
    it('returns EUR by default', () => {
      expect(resolveAccountingCurrency({})).toBe('EUR');
    });

    it('returns company accounting currency', () => {
      expect(resolveAccountingCurrency({ accounting_currency: 'xaf' })).toBe('XAF');
    });
  });
});
