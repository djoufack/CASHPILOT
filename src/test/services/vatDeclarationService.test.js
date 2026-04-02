import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock Supabase
const mockSelect = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockGte = vi.fn().mockReturnThis();
const mockLte = vi.fn().mockReturnThis();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
      eq: mockEq,
      gte: mockGte,
      lte: mockLte,
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
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: first call returns invoices, second returns expenses
    let callCount = 0;
    mockLte.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // invoices query chain ends with eq('status','paid') so we return from mockEq
        return {
          select: mockSelect,
          eq: vi.fn().mockResolvedValue({
            data: [
              { total_ht: 1000, total_ttc: 1200, tax_rate: 20, status: 'paid' },
              { total_ht: 500, total_ttc: 527.5, tax_rate: 5.5, status: 'paid' },
            ],
            error: null,
          }),
          gte: mockGte,
          lte: mockLte,
        };
      }
      // expenses: no more chaining after lte
      return {
        data: [
          { amount: 300, vat_amount: 60, vat_rate: 20, category: 'equipment' },
          { amount: 200, vat_amount: 40, vat_rate: 20, category: 'consulting' },
        ],
        error: null,
      };
    });
  });

  // ── calculateVATBreakdown ───────────────────────────────────────────────

  describe('calculateVATBreakdown', () => {
    it('should return correct structure with period, outputVAT, inputVAT', async () => {
      // Simplify: mock supabase.from to return different data per table
      const { supabase } = await import('@/lib/supabase');

      let fromCallCount = 0;
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
            eq: vi.fn().mockResolvedValue({
              data: [
                { total_ht: 1000, total_ttc: 1200, tax_rate: 20, status: 'paid' },
              ],
              error: null,
            }),
          });
        } else {
          chain.lte.mockResolvedValue({
            data: [
              { amount: 300, vat_amount: 60, vat_rate: 20, category: 'equipment' },
              { amount: 200, vat_amount: 40, vat_rate: 20, category: 'consulting' },
            ],
            error: null,
          });
        }
        return chain;
      });

      const result = await calculateVATBreakdown('user1', '2026-01-01', '2026-03-31');

      expect(result).toHaveProperty('period');
      expect(result).toHaveProperty('outputVAT');
      expect(result).toHaveProperty('inputVAT');
      expect(result).toHaveProperty('netVAT');
      expect(result.period.start).toBe('2026-01-01');
      expect(result.period.end).toBe('2026-03-31');
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
            eq: vi.fn().mockResolvedValue({
              data: [
                { total_ht: 1000, total_ttc: 1200, tax_rate: 20, status: 'paid' },
              ],
              error: null,
            }),
          });
        } else {
          chain.lte.mockResolvedValue({ data: [], error: null });
        }
        return chain;
      });

      const result = await calculateVATBreakdown('user1', '2026-01-01', '2026-03-31');
      expect(result.outputVAT.total).toBe(200);
      expect(result.outputVAT.byRate[20].vat).toBe(200);
    });

    it('should categorize input VAT between goods and services', async () => {
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
          chain.lte.mockResolvedValue({
            data: [
              { amount: 300, vat_amount: 60, vat_rate: 20, category: 'equipment' },
              { amount: 200, vat_amount: 40, vat_rate: 20, category: 'consulting' },
            ],
            error: null,
          });
        }
        return chain;
      });

      const result = await calculateVATBreakdown('user1', '2026-01-01', '2026-03-31');
      expect(result.inputVAT.goods).toBe(60);
      expect(result.inputVAT.services).toBe(40);
      expect(result.inputVAT.total).toBe(100);
    });

    it('should throw on invoice query error', async () => {
      const { supabase } = await import('@/lib/supabase');

      supabase.from.mockImplementation(() => {
        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn(),
        };
        chain.lte.mockReturnValue({
          ...chain,
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: new Error('DB error'),
          }),
        });
        return chain;
      });

      await expect(calculateVATBreakdown('user1', '2026-01-01', '2026-03-31')).rejects.toThrow();
    });
  });

  // ── generateCA3 ─────────────────────────────────────────────────────────

  describe('generateCA3', () => {
    it('should return CA3 format with correct line structure', async () => {
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
            eq: vi.fn().mockResolvedValue({
              data: [{ total_ht: 1000, total_ttc: 1200, tax_rate: 20 }],
              error: null,
            }),
          });
        } else {
          chain.lte.mockResolvedValue({
            data: [{ amount: 100, vat_amount: 20, vat_rate: 20, category: 'equipment' }],
            error: null,
          });
        }
        return chain;
      });

      const period = { startDate: '2026-01-01', endDate: '2026-03-31' };
      const result = await generateCA3('user1', period);

      expect(result.format).toBe('CA3');
      expect(result.period).toBe(period);
      expect(result.lines).toHaveProperty('line01_ca_ht');
      expect(result.lines).toHaveProperty('line08_tva_collectee');
      expect(result.lines).toHaveProperty('line28_tva_nette');
      expect(result.summary).toHaveProperty('tvaCollectee');
      expect(result.summary).toHaveProperty('tvaDeductible');
      expect(result.summary).toHaveProperty('isCredit');
    });
  });

  // ── generateIntervat ────────────────────────────────────────────────────

  describe('generateIntervat', () => {
    it('should return Intervat format with grid structure', async () => {
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
            eq: vi.fn().mockResolvedValue({
              data: [{ total_ht: 500, total_ttc: 605, tax_rate: 21 }],
              error: null,
            }),
          });
        } else {
          chain.lte.mockResolvedValue({
            data: [{ amount: 100, vat_amount: 21, vat_rate: 21, category: 'supplies' }],
            error: null,
          });
        }
        return chain;
      });

      const period = { startDate: '2026-01-01', endDate: '2026-03-31' };
      const result = await generateIntervat('user1', period);

      expect(result.format).toBe('Intervat');
      expect(result.grids).toHaveProperty('grid00');
      expect(result.grids).toHaveProperty('grid54');
      expect(result.grids).toHaveProperty('grid59');
      expect(result.grids).toHaveProperty('grid71');
      expect(result.grids).toHaveProperty('grid72');
      expect(result.summary).toHaveProperty('btwVerschuldigd');
    });
  });

  // ── generateVATDeclaration ──────────────────────────────────────────────

  describe('generateVATDeclaration', () => {
    beforeEach(async () => {
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

    it('should use CA3 for FR', async () => {
      const period = { startDate: '2026-01-01', endDate: '2026-03-31' };
      const result = await generateVATDeclaration('user1', period, 'FR');
      expect(result.format).toBe('CA3');
    });

    it('should use Intervat for BE', async () => {
      const period = { startDate: '2026-01-01', endDate: '2026-03-31' };
      const result = await generateVATDeclaration('user1', period, 'BE');
      expect(result.format).toBe('Intervat');
    });

    it('should throw for unsupported country', async () => {
      const period = { startDate: '2026-01-01', endDate: '2026-03-31' };
      await expect(generateVATDeclaration('user1', period, 'DE')).rejects.toThrow('Country DE not supported');
    });

    it('should default to FR when no country specified', async () => {
      const period = { startDate: '2026-01-01', endDate: '2026-03-31' };
      const result = await generateVATDeclaration('user1', period);
      expect(result.format).toBe('CA3');
    });
  });

  // ── exportDeclarationJSON ───────────────────────────────────────────────

  describe('exportDeclarationJSON', () => {
    it('should return blob and filename', () => {
      const declaration = {
        format: 'CA3',
        period: { startDate: '2026-01-01' },
        lines: { line01_ca_ht: 1000 },
      };
      const result = exportDeclarationJSON(declaration);
      expect(result).toHaveProperty('blob');
      expect(result).toHaveProperty('filename');
      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.filename).toContain('CA3');
      expect(result.filename).toContain('2026-01-01');
    });

    it('should create valid JSON content', () => {
      const declaration = { format: 'Intervat', period: { startDate: '2026-04-01' } };
      const result = exportDeclarationJSON(declaration);
      expect(result.filename).toContain('Intervat');
    });
  });
});
