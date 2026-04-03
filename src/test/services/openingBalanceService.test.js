import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/utils/dateFormatting', () => ({ formatDateInput: vi.fn(() => '2026-01-01') }));
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      like: vi.fn().mockResolvedValue({ error: null }),
    })),
  },
}));

import {
  getOpeningBalanceContraAccount,
  getAccountCodeForCountry,
  generateOpeningEntries,
  deleteOpeningBalanceEntries,
  createOpeningBalanceEntries,
} from '@/services/openingBalanceService';

describe('openingBalanceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getOpeningBalanceContraAccount', () => {
    it('returns 890 for FR', () => {
      expect(getOpeningBalanceContraAccount('FR')).toBe('890');
    });
    it('returns 891 for BE', () => {
      expect(getOpeningBalanceContraAccount('BE')).toBe('891');
    });
    it('returns 11 for OHADA', () => {
      expect(getOpeningBalanceContraAccount('OHADA')).toBe('11');
    });
    it('returns 890 as default', () => {
      expect(getOpeningBalanceContraAccount('DE')).toBe('890');
    });
    it('returns 890 when undefined', () => {
      expect(getOpeningBalanceContraAccount()).toBe('890');
    });
  });

  describe('getAccountCodeForCountry', () => {
    it('returns correct FR codes', () => {
      expect(getAccountCodeForCountry('bank_balance', 'FR')).toBe('512');
      expect(getAccountCodeForCountry('receivables', 'FR')).toBe('411');
      expect(getAccountCodeForCountry('payables', 'FR')).toBe('401');
      expect(getAccountCodeForCountry('equity_capital', 'FR')).toBe('101');
      expect(getAccountCodeForCountry('loan_balance', 'FR')).toBe('164');
      expect(getAccountCodeForCountry('fixed_assets', 'FR')).toBe('218');
    });
    it('returns correct BE codes', () => {
      expect(getAccountCodeForCountry('bank_balance', 'BE')).toBe('550');
      expect(getAccountCodeForCountry('payables', 'BE')).toBe('440');
    });
    it('returns correct OHADA codes', () => {
      expect(getAccountCodeForCountry('bank_balance', 'OHADA')).toBe('521');
    });
    it('returns FR as fallback', () => {
      expect(getAccountCodeForCountry('receivables', 'DE')).toBe('411');
    });
    it('returns null for unknown field', () => {
      expect(getAccountCodeForCountry('unknown', 'FR')).toBeNull();
    });
  });

  describe('generateOpeningEntries', () => {
    it('throws if userId missing', async () => {
      await expect(generateOpeningEntries({}, 'plan1', null)).rejects.toThrow('userId is required');
    });
    it('returns 0 entries for zero balances', async () => {
      const result = await generateOpeningEntries({ bank_balance: 0 }, 'plan1', 'user1');
      expect(result.success).toBe(true);
      expect(result.entriesCreated).toBe(0);
    });
    it('creates entries for positive balances', async () => {
      const { supabase } = await import('@/lib/supabase');
      supabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({ select: vi.fn().mockResolvedValue({ data: [{}, {}, {}, {}], error: null }) }),
      });
      const result = await generateOpeningEntries(
        { bank_balance: 10000, receivables: 5000 },
        'plan1',
        'user1',
        'FR',
        'c1'
      );
      expect(result.entriesCreated).toBe(4);
    });
    it('uses BE codes', async () => {
      const { supabase } = await import('@/lib/supabase');
      const insertFn = vi.fn().mockReturnValue({ select: vi.fn().mockResolvedValue({ data: [{}, {}], error: null }) });
      supabase.from.mockReturnValue({ insert: insertFn });
      await generateOpeningEntries({ bank_balance: 10000 }, 'plan1', 'user1', 'BE');
      expect(insertFn.mock.calls[0][0][0].account_code).toBe('550');
      expect(insertFn.mock.calls[0][0][1].account_code).toBe('891');
    });
  });

  describe('deleteOpeningBalanceEntries', () => {
    it('deletes for user', async () => {
      const { supabase } = await import('@/lib/supabase');
      supabase.from.mockReturnValue({
        delete: vi
          .fn()
          .mockReturnValue({
            eq: vi
              .fn()
              .mockReturnValue({ eq: vi.fn().mockReturnValue({ like: vi.fn().mockResolvedValue({ error: null }) }) }),
          }),
      });
      const result = await deleteOpeningBalanceEntries('user1');
      expect(result.success).toBe(true);
    });
  });

  describe('createOpeningBalanceEntries', () => {
    it('throws on missing params', async () => {
      await expect(createOpeningBalanceEntries(null, null, null)).rejects.toThrow('Missing required parameters');
    });
    it('returns 0 for zero amounts', async () => {
      const result = await createOpeningBalanceEntries('u1', '2026-01-01', [
        { account_code: '512', account_name: 'B', amount: 0, type: 'asset' },
      ]);
      expect(result.entriesCreated).toBe(0);
    });
    it('creates paired entries', async () => {
      const { supabase } = await import('@/lib/supabase');
      supabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({ select: vi.fn().mockResolvedValue({ data: [{}, {}, {}, {}], error: null }) }),
      });
      const result = await createOpeningBalanceEntries('u1', '2026-01-01', [
        { account_code: '512', account_name: 'Banque', amount: 10000, type: 'asset' },
        { account_code: '401', account_name: 'Fourn', amount: 5000, type: 'liability' },
      ]);
      expect(result.entriesCreated).toBe(4);
    });
  });
});
