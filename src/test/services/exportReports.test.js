import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/utils/dateLocale', () => ({ getLocale: () => 'fr-FR' }));
vi.mock('@/utils/dateFormatting', () => ({ formatDateInput: vi.fn(() => '2026-04-02') }));
vi.mock('dompurify', () => ({ default: { sanitize: (s) => s } }));
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
    global.URL.createObjectURL = vi.fn(() => 'blob:mock');
    global.URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });
  const ci = { name: 'Test Corp' };

  describe('exportAnalyticsPDF', () => {
    it('generates PDF', async () => {
      await exportAnalyticsPDF({ totalRevenue: 100000, totalExpenses: 60000 }, ci);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
    it('handles empty data', async () => {
      await exportAnalyticsPDF({}, ci);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
  });

  describe('exportSupplierReportPDF', () => {
    it('generates PDF', async () => {
      await exportSupplierReportPDF({ suppliers: [{ name: 'A', total: 15000 }], totalPayables: 25000 }, ci);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
  });

  describe('exportDashboardPDF', () => {
    it('generates PDF', async () => {
      await exportDashboardPDF({ totalRevenue: 100000, totalExpenses: 60000, netProfit: 40000 }, ci);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
  });

  describe('HTML exports', () => {
    it('exportAnalyticsHTML', async () => {
      await exportAnalyticsHTML({ totalRevenue: 50000, totalExpenses: 30000 }, ci);
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
    it('exportSupplierReportHTML', () => {
      exportSupplierReportHTML({ suppliers: [] }, ci);
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
    it('exportDashboardHTML', () => {
      exportDashboardHTML({ totalRevenue: 50000, totalExpenses: 30000, netProfit: 20000 }, ci);
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
    it('exportReportHTML', () => {
      exportReportHTML('analytics', ci);
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
    it('exportReportHTML no companyInfo', () => {
      exportReportHTML('dashboard');
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
  });
});
