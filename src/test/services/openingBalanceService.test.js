import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/utils/dateFormatting', () => ({
  formatDateInput: vi.fn(() => '2026-01-01'),
}));

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

  // ── getOpeningBalanceContraAccount ─────────────────────────────────────

  describe('getOpeningBalanceContraAccount', () => {
    it('should return 890 for FR', () => {
      expect(getOpeningBalanceContraAccount('FR')).toBe('890');
    });

    it('should return 891 for BE', () => {
      expect(getOpeningBalanceContraAccount('BE')).toBe('891');
    });

    it('should return 11 for OHADA', () => {
      expect(getOpeningBalanceContraAccount('OHADA')).toBe('11');
    });

    it('should return 890 as default for unknown country', () => {
      expect(getOpeningBalanceContraAccount('DE')).toBe('890');
    });

    it('should return 890 when no country specified', () => {
      expect(getOpeningBalanceContraAccount()).toBe('890');
    });
  });

  // ── getAccountCodeForCountry ──────────────────────────────────────────

  describe('getAccountCodeForCountry', () => {
    it('should return correct bank code for FR', () => {
      expect(getAccountCodeForCountry('bank_balance', 'FR')).toBe('512');
    });

    it('should return correct bank code for BE', () => {
      expect(getAccountCodeForCountry('bank_balance', 'BE')).toBe('550');
    });

    it('should return correct bank code for OHADA', () => {
      expect(getAccountCodeForCountry('bank_balance', 'OHADA')).toBe('521');
    });

    it('should return FR code as fallback for unknown country', () => {
      expect(getAccountCodeForCountry('receivables', 'DE')).toBe('411');
    });

    it('should return null for unknown field', () => {
      expect(getAccountCodeForCountry('unknown_field', 'FR')).toBeNull();
    });

    it('should return correct codes for all fields', () => {
      expect(getAccountCodeForCountry('payables', 'FR')).toBe('401');
      expect(getAccountCodeForCountry('equity_capital', 'FR')).toBe('101');
      expect(getAccountCodeForCountry('loan_balance', 'FR')).toBe('164');
      expect(getAccountCodeForCountry('fixed_assets', 'FR')).toBe('218');
    });

    it('should return correct BE codes for all fields', () => {
      expect(getAccountCodeForCountry('payables', 'BE')).toBe('440');
      expect(getAccountCodeForCountry('equity_capital', 'BE')).toBe('100');
      expect(getAccountCodeForCountry('loan_balance', 'BE')).toBe('174');
      expect(getAccountCodeForCountry('fixed_assets', 'BE')).toBe('215');
    });
  });

  // ── generateOpeningEntries ────────────────────────────────────────────

  describe('generateOpeningEntries', () => {
    it('should throw if userId is missing', async () => {
      await expect(generateOpeningEntries({}, 'plan1', null)).rejects.toThrow('userId is required');
    });

    it('should return 0 entries when all balances are zero', async () => {
      const balances = { bank_balance: 0, receivables: 0, payables: 0 };
      const result = await generateOpeningEntries(balances, 'plan1', 'user1');
      expect(result.success).toBe(true);
      expect(result.entriesCreated).toBe(0);
    });

    it('should create entries for positive balances', async () => {
      const { supabase } = await import('@/lib/supabase');
      const mockInsertSelect = vi.fn().mockResolvedValue({
        data: [{}, {}, {}, {}],
        error: null,
      });
      supabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({ select: mockInsertSelect }),
      });

      const balances = { bank_balance: 10000, receivables: 5000 };
      const result = await generateOpeningEntries(balances, 'plan1', 'user1', 'FR', 'company1');
      expect(result.success).toBe(true);
      expect(result.entriesCreated).toBe(4); // 2 entries per balance (main + contra)
    });

    it('should skip negative balances', async () => {
      const balances = { bank_balance: -500, receivables: 0 };
      const result = await generateOpeningEntries(balances, 'plan1', 'user1');
      expect(result.success).toBe(true);
      expect(result.entriesCreated).toBe(0);
    });

    it('should throw on insert error', async () => {
      const { supabase } = await import('@/lib/supabase');
      const mockInsertSelect = vi.fn().mockResolvedValue({
        data: null,
        error: new Error('Insert failed'),
      });
      supabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({ select: mockInsertSelect }),
      });

      const balances = { bank_balance: 10000 };
      await expect(generateOpeningEntries(balances, 'plan1', 'user1')).rejects.toThrow('Insert failed');
    });

    it('should use correct country codes for BE', async () => {
      const { supabase } = await import('@/lib/supabase');
      const insertFn = vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: [{}, {}], error: null }),
      });
      supabase.from.mockReturnValue({ insert: insertFn });

      const balances = { bank_balance: 10000 };
      await generateOpeningEntries(balances, 'plan1', 'user1', 'BE');

      const insertedEntries = insertFn.mock.calls[0][0];
      expect(insertedEntries[0].account_code).toBe('550'); // BE bank code
      expect(insertedEntries[1].account_code).toBe('891'); // BE contra
    });
  });

  // ── deleteOpeningBalanceEntries ────────────────────────────────────────

  describe('deleteOpeningBalanceEntries', () => {
    it('should delete entries for user', async () => {
      const { supabase } = await import('@/lib/supabase');
      const mockLike = vi.fn().mockResolvedValue({ error: null });
      const mockEq = vi.fn().mockReturnValue({ like: mockLike, eq: vi.fn().mockReturnValue({ like: mockLike }) });
      supabase.from.mockReturnValue({
        delete: vi.fn().mockReturnValue({ eq: mockEq }),
      });

      const result = await deleteOpeningBalanceEntries('user1');
      expect(result.success).toBe(true);
    });

    it('should filter by companyId if provided', async () => {
      const { supabase } = await import('@/lib/supabase');
      const mockLike = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
      const mockEq2 = vi.fn().mockReturnValue({ like: mockLike });
      const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
      supabase.from.mockReturnValue({
        delete: vi.fn().mockReturnValue({ eq: mockEq1 }),
      });

      const result = await deleteOpeningBalanceEntries('user1', 'company1');
      expect(result.success).toBe(true);
    });

    it('should throw on delete error', async () => {
      const { supabase } = await import('@/lib/supabase');
      const mockLike = vi.fn().mockResolvedValue({ error: new Error('Delete failed') });
      supabase.from.mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ like: mockLike }),
          }),
        }),
      });

      await expect(deleteOpeningBalanceEntries('user1')).rejects.toThrow('Delete failed');
    });
  });

  // ── createOpeningBalanceEntries ────────────────────────────────────────

  describe('createOpeningBalanceEntries', () => {
    it('should throw on missing parameters', async () => {
      await expect(createOpeningBalanceEntries(null, null, null)).rejects.toThrow('Missing required parameters');
      await expect(createOpeningBalanceEntries('user1', null, null)).rejects.toThrow('Missing required parameters');
      await expect(createOpeningBalanceEntries('user1', '2026-01-01', [])).rejects.toThrow('Missing required parameters');
    });

    it('should return 0 entries when all amounts are zero', async () => {
      const balances = [
        { account_code: '512', account_name: 'Banque', amount: 0, type: 'asset' },
      ];
      const result = await createOpeningBalanceEntries('user1', '2026-01-01', balances);
      expect(result.success).toBe(true);
      expect(result.entriesCreated).toBe(0);
    });

    it('should create paired entries for non-zero balances', async () => {
      const { supabase } = await import('@/lib/supabase');
      supabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: [{}, {}, {}, {}],
            error: null,
          }),
        }),
      });

      const balances = [
        { account_code: '512', account_name: 'Banque', amount: 10000, type: 'asset' },
        { account_code: '401', account_name: 'Fournisseurs', amount: 5000, type: 'liability' },
      ];
      const result = await createOpeningBalanceEntries('user1', '2026-01-01', balances);
      expect(result.success).toBe(true);
      expect(result.entriesCreated).toBe(4);
    });

    it('should handle asset types with debit entries', async () => {
      const { supabase } = await import('@/lib/supabase');
      const insertFn = vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: [{}, {}], error: null }),
      });
      supabase.from.mockReturnValue({ insert: insertFn });

      const balances = [
        { account_code: '512', account_name: 'Banque', amount: 5000, type: 'asset' },
      ];
      await createOpeningBalanceEntries('user1', '2026-01-01', balances);

      const entries = insertFn.mock.calls[0][0];
      // Asset with positive amount: debit main, credit contra
      expect(entries[0].debit).toBe(5000);
      expect(entries[0].credit).toBe(0);
      expect(entries[1].debit).toBe(0);
      expect(entries[1].credit).toBe(5000);
    });

    it('should handle liability types with credit entries', async () => {
      const { supabase } = await import('@/lib/supabase');
      const insertFn = vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: [{}, {}], error: null }),
      });
      supabase.from.mockReturnValue({ insert: insertFn });

      const balances = [
        { account_code: '401', account_name: 'Fournisseurs', amount: 3000, type: 'liability' },
      ];
      await createOpeningBalanceEntries('user1', '2026-01-01', balances);

      const entries = insertFn.mock.calls[0][0];
      // Liability with positive amount: credit main, debit contra
      expect(entries[0].debit).toBe(0);
      expect(entries[0].credit).toBe(3000);
      expect(entries[1].debit).toBe(3000);
      expect(entries[1].credit).toBe(0);
    });
  });
});
