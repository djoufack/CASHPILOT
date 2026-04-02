import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/utils/dateLocale', () => ({
  getLocale: () => 'fr-FR',
}));
vi.mock('@/utils/dateFormatting', () => ({
  formatDateInput: vi.fn(() => '2026-04-02'),
}));
vi.mock('dompurify', () => ({
  default: { sanitize: (s) => s },
}));
vi.mock('@/services/pdfExportRuntime', () => ({
  saveElementAsPdf: vi.fn().mockResolvedValue(undefined),
}));

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
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  const scenario = {
    name: 'Scenario Test',
    base_date: '2026-01-01',
    end_date: '2026-12-31',
  };

  const makeResult = (overrides = {}) => ({
    period: '2026-01',
    date: '2026-01-31',
    revenue: 10000,
    expenses: 8000,
    balance: 12000,
    cashFlow: 2000,
    cashBalance: 12000,
    cumulativeCashFlow: 2000,
    currentRatio: 1.5,
    quickRatio: 1.2,
    debtToEquity: 0.6,
    roe: 15,
    roce: 12,
    operatingMargin: 20,
    ...overrides,
  });

  const results = [
    makeResult({ period: '2026-01', revenue: 10000, cashBalance: 12000 }),
    makeResult({ period: '2026-02', revenue: 12000, cashBalance: 15000 }),
    makeResult({ period: '2026-03', revenue: 15000, cashBalance: 20000 }),
  ];

  const assumptions = {
    revenueGrowth: 10,
    expenseGrowth: 5,
    initialBalance: 10000,
  };

  // ── exportScenarioSimulationPDF ───────────────────────────────────────

  describe('exportScenarioSimulationPDF', () => {
    it('should generate PDF for scenario simulation', async () => {
      await exportScenarioSimulationPDF(scenario, results, assumptions);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });

    it('should handle currency option', async () => {
      await exportScenarioSimulationPDF(scenario, results, assumptions, { currency: 'XOF' });
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });

    it('should throw on empty results', async () => {
      await expect(
        exportScenarioSimulationPDF(scenario, [], assumptions)
      ).rejects.toThrow('Aucun résultat');
    });

    it('should throw on null results', async () => {
      await expect(
        exportScenarioSimulationPDF(scenario, null, assumptions)
      ).rejects.toThrow();
    });
  });

  // ── exportScenarioComparisonPDF ───────────────────────────────────────

  describe('exportScenarioComparisonPDF', () => {
    const comparison = {
      revenueDelta: 5000,
      expenseDelta: 2000,
      cashFlowDelta: 3000,
      summary: 'Scenario 1 is better',
    };

    it('should generate PDF for scenario comparison', async () => {
      const s1 = { name: 'Optimistic' };
      const s2 = { name: 'Pessimistic' };
      const r2 = results.map((r) => ({ ...r, revenue: r.revenue * 0.8 }));

      await exportScenarioComparisonPDF(s1, s2, results, r2, comparison, { currency: 'EUR' });
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });

    it('should throw when comparison is missing', async () => {
      await expect(
        exportScenarioComparisonPDF({ name: 'A' }, { name: 'B' }, results, results, null)
      ).rejects.toThrow('Données de comparaison manquantes');
    });
  });

  // ── exportScenarioSimulationHTML ──────────────────────────────────────

  describe('exportScenarioSimulationHTML', () => {
    it('should generate and download HTML', () => {
      exportScenarioSimulationHTML(scenario, results, assumptions);
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });

    it('should handle currency option', () => {
      exportScenarioSimulationHTML(scenario, results, assumptions, { currency: 'XOF' });
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
  });

  // ── exportScenarioComparisonHTML ──────────────────────────────────────

  describe('exportScenarioComparisonHTML', () => {
    it('should generate and download HTML', () => {
      const comparison = { revenueDelta: 5000, summary: 'A is better' };
      exportScenarioComparisonHTML({ name: 'A' }, { name: 'B' }, results, results, comparison);
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });

    it('should throw when comparison is missing', () => {
      expect(() =>
        exportScenarioComparisonHTML({ name: 'A' }, { name: 'B' }, results, results, null)
      ).toThrow('Données de comparaison manquantes');
    });
  });
});
