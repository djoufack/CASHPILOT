import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/utils/dateLocale', () => ({ getLocale: () => 'fr-FR' }));
vi.mock('@/utils/dateFormatting', () => ({ formatDateInput: vi.fn(() => '2026-04-02') }));
vi.mock('dompurify', () => ({ default: { sanitize: (s) => s } }));
vi.mock('@/services/pdfExportRuntime', () => ({ saveElementAsPdf: vi.fn().mockResolvedValue(undefined) }));

import {
  exportExpensesListPDF,
  exportStockListPDF,
  exportTimesheetsListPDF,
  exportProjectsListPDF,
  exportDebtListPDF,
  exportExpensesListHTML,
  exportStockListHTML,
  exportTimesheetsListHTML,
  exportProjectsListHTML,
  exportDebtListHTML,
} from '@/services/exportListsPDF';
import { saveElementAsPdf } from '@/services/pdfExportRuntime';

describe('exportListsPDF', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.createObjectURL = vi.fn(() => 'blob:mock');
    global.URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });
  const ci = { name: 'Test Corp' };

  describe('exportExpensesListPDF', () => {
    it('generates PDF', async () => {
      await exportExpensesListPDF([{ amount: 50, status: 'paid' }], ci);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
    it('handles empty', async () => {
      await exportExpensesListPDF([], ci);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
    it('handles filters', async () => {
      await exportExpensesListPDF([{ amount: 100 }], ci, { startDate: '2026-01-01', endDate: '2026-03-31' });
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
  });

  describe('exportStockListPDF', () => {
    it('generates PDF', async () => {
      await exportStockListPDF([{ name: 'A', quantity: 10 }], ci);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
    it('handles empty', async () => {
      await exportStockListPDF([], ci);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
  });

  describe('exportTimesheetsListPDF', () => {
    it('generates PDF', async () => {
      await exportTimesheetsListPDF([{ date: '2026-03-01', hours: 8 }], ci);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
  });

  describe('exportProjectsListPDF', () => {
    it('generates PDF', async () => {
      await exportProjectsListPDF([{ name: 'Alpha', status: 'active' }], ci);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
    it('handles empty', async () => {
      await exportProjectsListPDF([], ci);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
  });

  describe('exportDebtListPDF', () => {
    it('generates receivables PDF', async () => {
      await exportDebtListPDF([{ amount: 5000 }], ci, 'receivables');
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
    it('generates payables PDF', async () => {
      await exportDebtListPDF([{ amount: 3000 }], ci, 'payables');
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
    it('handles empty', async () => {
      await exportDebtListPDF([], ci);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
  });

  describe('HTML exports', () => {
    it('exportExpensesListHTML', () => {
      exportExpensesListHTML([{ amount: 100 }], ci);
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
    it('exportStockListHTML', () => {
      exportStockListHTML([{ name: 'A' }], ci);
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
    it('exportTimesheetsListHTML', () => {
      exportTimesheetsListHTML([{ hours: 8 }], ci);
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
    it('exportProjectsListHTML', () => {
      exportProjectsListHTML([{ name: 'X' }], ci);
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
    it('exportDebtListHTML', () => {
      exportDebtListHTML([{ amount: 5000 }], ci);
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
  });
});
