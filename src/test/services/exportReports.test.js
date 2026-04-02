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
  captureElementAsImage: vi.fn().mockResolvedValue(null),
}));

import {
  exportAnalyticsPDF,
  exportSupplierReportPDF,
  exportAnalyticsHTML,
  exportSupplierReportHTML,
  exportDashboardPDF,
  exportDashboardHTML,
  exportReportHTML,
} from '@/services/exportReports';
import { saveElementAsPdf } from '@/services/pdfExportRuntime';

describe('exportReports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  const companyInfo = { name: 'Test Corp' };

  // ── exportAnalyticsPDF ────────────────────────────────────────────────

  describe('exportAnalyticsPDF', () => {
    it('should generate PDF for analytics data', async () => {
      const data = {
        totalRevenue: 100000,
        totalExpenses: 60000,
        revenueByMonth: [],
        expensesByCategory: [],
        clientsRevenue: [],
      };

      await exportAnalyticsPDF(data, companyInfo);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });

    it('should handle missing data properties', async () => {
      await exportAnalyticsPDF({}, companyInfo);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
  });

  // ── exportSupplierReportPDF ───────────────────────────────────────────

  describe('exportSupplierReportPDF', () => {
    it('should generate PDF for supplier report', async () => {
      const reportData = {
        totalPayables: 25000,
        overduePayables: 5000,
        suppliers: [
          { name: 'Supplier A', total: 15000, status: 'active' },
          { name: 'Supplier B', total: 10000, status: 'active' },
        ],
        topSuppliers: [],
      };

      await exportSupplierReportPDF(reportData, companyInfo);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
  });

  // ── exportDashboardPDF ────────────────────────────────────────────────

  describe('exportDashboardPDF', () => {
    it('should generate PDF for dashboard data', async () => {
      const data = {
        totalRevenue: 100000,
        totalExpenses: 60000,
        netProfit: 40000,
        pendingInvoices: 5,
        overdueInvoices: 2,
        recentTransactions: [],
      };

      await exportDashboardPDF(data, companyInfo);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
  });

  // ── HTML export functions ─────────────────────────────────────────────

  describe('exportAnalyticsHTML', () => {
    it('should trigger download', async () => {
      const data = { totalRevenue: 50000, totalExpenses: 30000 };
      await exportAnalyticsHTML(data, companyInfo);
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
  });

  describe('exportSupplierReportHTML', () => {
    it('should trigger download', () => {
      const reportData = { suppliers: [], totalPayables: 0 };
      exportSupplierReportHTML(reportData, companyInfo);
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
  });

  describe('exportDashboardHTML', () => {
    it('should trigger download', () => {
      const data = { totalRevenue: 50000, totalExpenses: 30000, netProfit: 20000 };
      exportDashboardHTML(data, companyInfo);
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
  });

  describe('exportReportHTML', () => {
    it('should generate generic report HTML', () => {
      exportReportHTML('analytics', companyInfo);
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });

    it('should handle missing companyInfo', () => {
      exportReportHTML('dashboard');
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
  });
});
