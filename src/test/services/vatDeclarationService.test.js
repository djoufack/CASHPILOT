import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
    })),
  },
}));

import {
  calculateVATBreakdown,
  generateCA3,
  generateIntervat,
  generateVATDeclaration,
  exportDeclarationJSON,
} from '@/services/vatDeclarationService';

describe('vatDeclarationService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { supabase } = await import('@/lib/supabase');
    supabase.from.mockImplementation((table) => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn(),
      };
      if (table === 'invoices') {
        chain.lte.mockReturnValue({
          ...chain,
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        });
      } else {
        chain.lte.mockResolvedValue({ data: [], error: null });
      }
      return chain;
    });
  });

  describe('calculateVATBreakdown', () => {
    it('should return correct structure', async () => {
      const result = await calculateVATBreakdown('user1', '2026-01-01', '2026-03-31');
      expect(result).toHaveProperty('period');
      expect(result).toHaveProperty('outputVAT');
      expect(result).toHaveProperty('inputVAT');
      expect(result).toHaveProperty('netVAT');
    });

    it('should calculate output VAT from invoices', async () => {
      const { supabase } = await import('@/lib/supabase');
      supabase.from.mockImplementation((table) => {
        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn(),
        };
        if (table === 'invoices') {
          chain.lte.mockReturnValue({
            ...chain,
            eq: vi.fn().mockResolvedValue({ data: [{ total_ht: 1000, total_ttc: 1200, tax_rate: 20 }], error: null }),
          });
        } else {
          chain.lte.mockResolvedValue({ data: [], error: null });
        }
        return chain;
      });
      const result = await calculateVATBreakdown('user1', '2026-01-01', '2026-03-31');
      expect(result.outputVAT.total).toBe(200);
    });

    it('should categorize input VAT', async () => {
      const { supabase } = await import('@/lib/supabase');
      supabase.from.mockImplementation((table) => {
        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn(),
        };
        if (table === 'invoices') {
          chain.lte.mockReturnValue({ ...chain, eq: vi.fn().mockResolvedValue({ data: [], error: null }) });
        } else {
          chain.lte.mockResolvedValue({
            data: [
              { amount: 300, vat_amount: 60, category: 'equipment' },
              { amount: 200, vat_amount: 40, category: 'consulting' },
            ],
            error: null,
          });
        }
        return chain;
      });
      const result = await calculateVATBreakdown('user1', '2026-01-01', '2026-03-31');
      expect(result.inputVAT.goods).toBe(60);
      expect(result.inputVAT.services).toBe(40);
    });
  });

  describe('generateCA3', () => {
    it('should return CA3 format', async () => {
      const result = await generateCA3('user1', { startDate: '2026-01-01', endDate: '2026-03-31' });
      expect(result.format).toBe('CA3');
      expect(result.lines).toHaveProperty('line01_ca_ht');
      expect(result.lines).toHaveProperty('line28_tva_nette');
      expect(result.summary).toHaveProperty('isCredit');
    });
  });

  describe('generateIntervat', () => {
    it('should return Intervat format', async () => {
      const result = await generateIntervat('user1', { startDate: '2026-01-01', endDate: '2026-03-31' });
      expect(result.format).toBe('Intervat');
      expect(result.grids).toHaveProperty('grid00');
      expect(result.grids).toHaveProperty('grid71');
      expect(result.grids).toHaveProperty('grid72');
    });
  });

  describe('generateVATDeclaration', () => {
    it('should use CA3 for FR', async () => {
      const result = await generateVATDeclaration('user1', { startDate: '2026-01-01', endDate: '2026-03-31' }, 'FR');
      expect(result.format).toBe('CA3');
    });
    it('should use Intervat for BE', async () => {
      const result = await generateVATDeclaration('user1', { startDate: '2026-01-01', endDate: '2026-03-31' }, 'BE');
      expect(result.format).toBe('Intervat');
    });
    it('should throw for unsupported country', async () => {
      await expect(
        generateVATDeclaration('user1', { startDate: '2026-01-01', endDate: '2026-03-31' }, 'DE')
      ).rejects.toThrow('Country DE not supported');
    });
    it('should default to FR', async () => {
      const result = await generateVATDeclaration('user1', { startDate: '2026-01-01', endDate: '2026-03-31' });
      expect(result.format).toBe('CA3');
    });
  });

  describe('exportDeclarationJSON', () => {
    it('should return blob and filename', () => {
      const result = exportDeclarationJSON({ format: 'CA3', period: { startDate: '2026-01-01' }, lines: {} });
      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.filename).toContain('CA3');
    });
  });
});
