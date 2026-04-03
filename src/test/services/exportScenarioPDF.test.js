import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/utils/dateLocale', () => ({ getLocale: () => 'fr-FR' }));
vi.mock('@/utils/dateFormatting', () => ({ formatDateInput: vi.fn(() => '2026-04-02') }));
vi.mock('dompurify', () => ({ default: { sanitize: (s) => s } }));
vi.mock('@/services/pdfExportRuntime', () => ({ saveElementAsPdf: vi.fn().mockResolvedValue(undefined) }));

import {
  exportScenarioSimulationPDF,
  exportScenarioComparisonPDF,
  exportScenarioSimulationHTML,
  exportScenarioComparisonHTML,
} from '@/services/exportScenarioPDF';
import { saveElementAsPdf } from '@/services/pdfExportRuntime';

describe('exportScenarioPDF', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.createObjectURL = vi.fn(() => 'blob:mock');
    global.URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  const scenario = { name: 'Test', base_date: '2026-01-01', end_date: '2026-12-31' };
  const mk = (o = {}) => ({
    period: '2026-01',
    revenue: 10000,
    expenses: 8000,
    cashBalance: 12000,
    cashFlow: 2000,
    cumulativeCashFlow: 2000,
    currentRatio: 1.5,
    quickRatio: 1.2,
    debtToEquity: 0.6,
    roe: 15,
    roce: 12,
    operatingMargin: 20,
    balance: 12000,
    ...o,
  });
  const results = [
    mk({ period: '2026-01', revenue: 10000, cashBalance: 12000 }),
    mk({ period: '2026-02', revenue: 12000, cashBalance: 15000 }),
    mk({ period: '2026-03', revenue: 15000, cashBalance: 20000 }),
  ];
  const assumptions = { revenueGrowth: 10, expenseGrowth: 5, initialBalance: 10000 };

  describe('exportScenarioSimulationPDF', () => {
    it('generates PDF', async () => {
      await exportScenarioSimulationPDF(scenario, results, assumptions);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
    it('handles currency option', async () => {
      await exportScenarioSimulationPDF(scenario, results, assumptions, { currency: 'XOF' });
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
    it('throws on empty results', async () => {
      await expect(exportScenarioSimulationPDF(scenario, [], assumptions)).rejects.toThrow('Aucun résultat');
    });
  });

  describe('exportScenarioComparisonPDF', () => {
    it('generates PDF', async () => {
      const cmp = { summary: { finalRevenueDiff: 5000, finalCashDiff: 3000, finalProfitDiff: 2000 }, byPeriod: [] };
      await exportScenarioComparisonPDF({ name: 'A' }, { name: 'B' }, results, results, cmp, { currency: 'EUR' });
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
    it('throws when comparison missing', async () => {
      await expect(exportScenarioComparisonPDF({ name: 'A' }, { name: 'B' }, results, results, null)).rejects.toThrow(
        'Données de comparaison manquantes'
      );
    });
  });

  describe('exportScenarioSimulationHTML', () => {
    it('downloads HTML', () => {
      exportScenarioSimulationHTML(scenario, results, assumptions);
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
  });

  describe('exportScenarioComparisonHTML', () => {
    it('downloads HTML', () => {
      exportScenarioComparisonHTML({ name: 'A' }, { name: 'B' }, results, results, {
        summary: {
          finalRevenueDiff: 5000,
          finalCashDiff: 3000,
          revenueCagr1: 10,
          revenueCagr2: 8,
          avgProfitMargin1: 20,
          avgProfitMargin2: 15,
        },
        byPeriod: [],
      });
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
    it('throws when comparison missing', () => {
      expect(() => exportScenarioComparisonHTML({ name: 'A' }, { name: 'B' }, results, results, null)).toThrow();
    });
  });
});
