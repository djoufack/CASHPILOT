import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/utils/dateLocale', () => ({ getLocale: () => 'fr-FR' }));
vi.mock('@/utils/accountingCurrency', () => ({ resolveAccountingCurrency: () => 'EUR' }));
vi.mock('dompurify', () => ({ default: { sanitize: (s) => s } }));
vi.mock('@/services/pdfExportRuntime', () => ({ saveElementAsPdf: vi.fn().mockResolvedValue(undefined) }));

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

  describe('exportBalanceSheetPDF', () => {
    it('generates PDF for standard balance sheet', async () => {
      await exportBalanceSheetPDF({ totalAssets: 100000, totalPassif: 100000, balanced: true }, companyInfo, period);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
    it('handles SYSCOHADA', async () => {
      await exportBalanceSheetPDF(
        {
          totalAssets: 50000,
          totalPassif: 50000,
          balanced: true,
          syscohada: {
            actif: [{ label: 'Immo', total: 30000, rows: [{ account_code: '21', label: 'Terrain', balance: 30000 }] }],
            passif: [{ label: 'CP', total: 50000, rows: [{ account_code: '10', label: 'Cap', balance: 50000 }] }],
          },
        },
        companyInfo,
        period
      );
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
    it('handles empty balance sheet', async () => {
      await exportBalanceSheetPDF({ totalAssets: 0, totalPassif: 0, balanced: true }, companyInfo, period);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
  });

  describe('exportIncomeStatementPDF', () => {
    it('generates PDF', async () => {
      await exportIncomeStatementPDF(
        {
          totalRevenues: 50000,
          totalExpenses: 30000,
          netResult: 20000,
          sections: [
            { label: 'Produits', total: 50000, rows: [{ account_code: '70', label: 'Ventes', balance: 50000 }] },
          ],
        },
        companyInfo,
        period
      );
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
  });

  describe('exportVATDeclarationPDF', () => {
    it('generates PDF', async () => {
      await exportVATDeclarationPDF(
        {
          outputVAT: { total: 2000, byRate: { 20: { base: 10000, vat: 2000 } } },
          inputVAT: { total: 500, goods: 300, services: 200 },
          netVAT: 1500,
        },
        companyInfo,
        period
      );
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
  });

  describe('exportTaxEstimationPDF', () => {
    it('generates PDF', async () => {
      await exportTaxEstimationPDF(
        { revenuBrut: 100000, charges: 60000, beneficeNet: 40000, estimatedTax: 10000, rows: [] },
        companyInfo,
        period
      );
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
  });

  describe('exportReconciliationPDF', () => {
    it('generates PDF', async () => {
      await exportReconciliationPDF(
        { summary: { matched: 10, unmatched: 2 }, sessions: [], unmatchedItems: [] },
        companyInfo,
        period
      );
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
  });

  describe('exportFinancialDiagnosticPDF', () => {
    const diag = {
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
    it('generates PDF', async () => {
      await exportFinancialDiagnosticPDF(diag, companyInfo, period);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
    it('returns early for invalid diagnostic', async () => {
      await exportFinancialDiagnosticPDF({ valid: false }, companyInfo, period);
      expect(saveElementAsPdf).not.toHaveBeenCalled();
    });
    it('returns early for null', async () => {
      await exportFinancialDiagnosticPDF(null, companyInfo, period);
      expect(saveElementAsPdf).not.toHaveBeenCalled();
    });
  });

  describe('exportFinancialAnnexesPDF', () => {
    it('generates PDF', async () => {
      await exportFinancialAnnexesPDF({ sections: [], companyDetails: {} }, companyInfo, period);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
  });
});
