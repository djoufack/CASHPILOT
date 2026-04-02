import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/utils/dateLocale', () => ({
  getLocale: () => 'fr-FR',
}));
vi.mock('@/utils/accountingCurrency', () => ({
  resolveAccountingCurrency: () => 'EUR',
}));
vi.mock('dompurify', () => ({
  default: { sanitize: (s) => s },
}));
vi.mock('@/services/pdfExportRuntime', () => ({
  saveElementAsPdf: vi.fn().mockResolvedValue(undefined),
}));

import {
  exportBalanceSheetPDF,
  exportIncomeStatementPDF,
  exportVATDeclarationPDF,
  exportTaxEstimationPDF,
  exportReconciliationPDF,
  exportFinancialDiagnosticPDF,
  exportFinancialAnnexesPDF,
} from '@/services/exportAccountingPDF';
import { saveElementAsPdf } from '@/services/pdfExportRuntime';

describe('exportAccountingPDF', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const companyInfo = { company_name: 'Test Corp' };
  const period = { startDate: '2026-01-01', endDate: '2026-03-31' };

  // ── exportBalanceSheetPDF ─────────────────────────────────────────────

  describe('exportBalanceSheetPDF', () => {
    it('should generate PDF for standard balance sheet', async () => {
      const balanceSheet = {
        totalAssets: 100000,
        totalPassif: 100000,
        balanced: true,
        syscohada: null,
      };

      await exportBalanceSheetPDF(balanceSheet, companyInfo, period);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });

    it('should handle SYSCOHADA balance sheet', async () => {
      const balanceSheet = {
        totalAssets: 50000,
        totalPassif: 50000,
        balanced: true,
        syscohada: {
          actif: [
            { label: 'Immobilisations', total: 30000, rows: [{ account_code: '21', label: 'Terrain', balance: 30000 }] },
          ],
          passif: [
            { label: 'Capitaux propres', total: 50000, rows: [{ account_code: '10', label: 'Capital', balance: 50000 }] },
          ],
        },
      };

      await exportBalanceSheetPDF(balanceSheet, companyInfo, period);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });

    it('should handle empty balance sheet', async () => {
      const balanceSheet = {
        totalAssets: 0,
        totalPassif: 0,
        balanced: true,
        syscohada: null,
      };

      await exportBalanceSheetPDF(balanceSheet, companyInfo, period);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });

    it('should handle missing companyInfo', async () => {
      const balanceSheet = { totalAssets: 1000, totalPassif: 1000, balanced: true };
      await exportBalanceSheetPDF(balanceSheet, null, period);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });

    it('should handle minimal period', async () => {
      const balanceSheet = { totalAssets: 1000, totalPassif: 1000, balanced: true };
      const minPeriod = { startDate: '2026-01-01', endDate: '2026-12-31' };
      await exportBalanceSheetPDF(balanceSheet, companyInfo, minPeriod);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
  });

  // ── exportIncomeStatementPDF ──────────────────────────────────────────

  describe('exportIncomeStatementPDF', () => {
    it('should generate PDF for income statement', async () => {
      const incomeStatement = {
        totalRevenues: 50000,
        totalExpenses: 30000,
        netResult: 20000,
        sections: [],
      };

      await exportIncomeStatementPDF(incomeStatement, companyInfo, period);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });

    it('should handle income statement with sections', async () => {
      const incomeStatement = {
        totalRevenues: 50000,
        totalExpenses: 30000,
        netResult: 20000,
        sections: [
          { label: 'Produits', total: 50000, rows: [{ account_code: '70', label: 'Ventes', balance: 50000 }] },
          { label: 'Charges', total: 30000, rows: [{ account_code: '60', label: 'Achats', balance: 30000 }] },
        ],
      };

      await exportIncomeStatementPDF(incomeStatement, companyInfo, period);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
  });

  // ── exportVATDeclarationPDF ───────────────────────────────────────────

  describe('exportVATDeclarationPDF', () => {
    it('should generate PDF for VAT declaration', async () => {
      const vatData = {
        outputVAT: { total: 2000, byRate: { 20: { base: 10000, vat: 2000 } } },
        inputVAT: { total: 500, goods: 300, services: 200 },
        netVAT: 1500,
      };

      await exportVATDeclarationPDF(vatData, companyInfo, period);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
  });

  // ── exportTaxEstimationPDF ────────────────────────────────────────────

  describe('exportTaxEstimationPDF', () => {
    it('should generate PDF for tax estimation', async () => {
      const taxData = {
        revenuBrut: 100000,
        charges: 60000,
        beneficeNet: 40000,
        estimatedTax: 10000,
        rows: [],
      };

      await exportTaxEstimationPDF(taxData, companyInfo, period);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
  });

  // ── exportReconciliationPDF ───────────────────────────────────────────

  describe('exportReconciliationPDF', () => {
    it('should generate PDF for reconciliation report', async () => {
      const reconciliationData = {
        summary: { matched: 10, unmatched: 2, total: 12 },
        sessions: [],
        unmatchedItems: [],
      };

      await exportReconciliationPDF(reconciliationData, companyInfo, period);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
  });

  // ── exportFinancialDiagnosticPDF ──────────────────────────────────────

  describe('exportFinancialDiagnosticPDF', () => {
    const validDiagnostic = {
      valid: true,
      margins: {
        revenue: 100000,
        grossMargin: 45000,
        grossMarginPercent: 45.0,
        ebitda: 20000,
        ebitdaMargin: 20.0,
        operatingResult: 15000,
        operatingMargin: 15.0,
      },
      financing: {
        caf: 18000,
        workingCapital: 30000,
        bfr: 12000,
        bfrVariation: -2000,
        operatingCashFlow: 16000,
        netDebt: 20000,
        equity: 50000,
        totalDebt: 70000,
      },
      ratios: {
        profitability: { roe: 15.5, roce: 12.3 },
        liquidity: { currentRatio: 1.8, quickRatio: 1.2, cashRatio: 0.35 },
        leverage: { financialLeverage: 0.8 },
      },
    };

    it('should generate PDF for financial diagnostic', async () => {
      await exportFinancialDiagnosticPDF(validDiagnostic, companyInfo, period);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });

    it('should handle viewSnapshot parameter', async () => {
      const viewSnapshot = {
        visibleCards: [
          { section: 'Marges', title: 'Marge brute', formattedCurrentValue: '45%', formattedComparisonValue: '42%', formattedBenchmarkValue: '40%' },
        ],
        mode: 'detail',
        comparisonLabel: 'N-1',
        benchmarkSector: 'Tech',
        sectionFilter: 'all',
        sortMode: 'custom',
        period: { label: '2026', comparedLabel: '2025' },
      };

      await exportFinancialDiagnosticPDF(validDiagnostic, companyInfo, period, viewSnapshot);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });

    it('should return early for invalid diagnostic', async () => {
      await exportFinancialDiagnosticPDF({ valid: false }, companyInfo, period);
      expect(saveElementAsPdf).not.toHaveBeenCalled();
    });

    it('should return early for null diagnostic', async () => {
      await exportFinancialDiagnosticPDF(null, companyInfo, period);
      expect(saveElementAsPdf).not.toHaveBeenCalled();
    });
  });

  // ── exportFinancialAnnexesPDF ─────────────────────────────────────────

  describe('exportFinancialAnnexesPDF', () => {
    it('should generate PDF for financial annexes', async () => {
      const annexesData = {
        sections: [],
        companyDetails: {},
      };

      await exportFinancialAnnexesPDF(annexesData, companyInfo, period);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
  });
});
