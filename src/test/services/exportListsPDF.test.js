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
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  const companyInfo = { name: 'Test Corp' };

  // ── exportExpensesListPDF ─────────────────────────────────────────────

  describe('exportExpensesListPDF', () => {
    it('should generate PDF with expenses data', async () => {
      const expenses = [
        { expense_date: '2026-01-15', category: 'Fournitures', description: 'Paper', amount: 50, status: 'paid' },
        { expense_date: '2026-02-01', category: 'Transport', description: 'Taxi', amount: 30, status: 'pending' },
      ];

      await exportExpensesListPDF(expenses, companyInfo);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });

    it('should handle empty expenses list', async () => {
      await exportExpensesListPDF([], companyInfo);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });

    it('should handle filters with date range', async () => {
      const expenses = [{ amount: 100, status: 'paid' }];
      const filters = { startDate: '2026-01-01', endDate: '2026-03-31' };

      await exportExpensesListPDF(expenses, companyInfo, filters);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
  });

  // ── exportStockListPDF ────────────────────────────────────────────────

  describe('exportStockListPDF', () => {
    it('should generate PDF with stock items', async () => {
      const stockItems = [
        { name: 'Widget A', quantity: 100, unit_price: 10, category: 'Electronics' },
        { name: 'Widget B', quantity: 50, unit_price: 20, category: 'Electronics' },
      ];

      await exportStockListPDF(stockItems, companyInfo);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });

    it('should handle empty stock list', async () => {
      await exportStockListPDF([], companyInfo);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
  });

  // ── exportTimesheetsListPDF ───────────────────────────────────────────

  describe('exportTimesheetsListPDF', () => {
    it('should generate PDF with timesheets', async () => {
      const timesheets = [
        { date: '2026-03-01', client_name: 'Client A', hours: 8, description: 'Dev work' },
        { date: '2026-03-02', client_name: 'Client B', hours: 4, description: 'Meeting' },
      ];

      await exportTimesheetsListPDF(timesheets, companyInfo);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });

    it('should handle filters', async () => {
      const timesheets = [{ date: '2026-03-01', hours: 8 }];
      const filters = { startDate: '2026-03-01', endDate: '2026-03-31' };
      await exportTimesheetsListPDF(timesheets, companyInfo, filters);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
  });

  // ── exportProjectsListPDF ─────────────────────────────────────────────

  describe('exportProjectsListPDF', () => {
    it('should generate PDF with projects', async () => {
      const projects = [
        { name: 'Project Alpha', status: 'active', budget: 50000, progress: 60 },
        { name: 'Project Beta', status: 'completed', budget: 30000, progress: 100 },
      ];

      await exportProjectsListPDF(projects, companyInfo);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });

    it('should handle empty projects list', async () => {
      await exportProjectsListPDF([], companyInfo);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
  });

  // ── exportDebtListPDF ─────────────────────────────────────────────────

  describe('exportDebtListPDF', () => {
    it('should generate PDF for receivables', async () => {
      const debts = [
        { client_name: 'Client A', amount: 5000, due_date: '2026-04-15', status: 'pending' },
      ];

      await exportDebtListPDF(debts, companyInfo, 'receivables');
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });

    it('should generate PDF for payables', async () => {
      const debts = [
        { supplier_name: 'Supplier X', amount: 3000, due_date: '2026-04-30', status: 'pending' },
      ];

      await exportDebtListPDF(debts, companyInfo, 'payables');
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });

    it('should handle empty debt list', async () => {
      await exportDebtListPDF([], companyInfo);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
  });

  // ── HTML exports ──────────────────────────────────────────────────────

  describe('HTML export functions', () => {
    it('exportExpensesListHTML should trigger download', () => {
      const expenses = [{ amount: 100, category: 'Transport' }];
      exportExpensesListHTML(expenses, companyInfo);
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });

    it('exportStockListHTML should trigger download', () => {
      exportStockListHTML([{ name: 'Item', quantity: 10 }], companyInfo);
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });

    it('exportTimesheetsListHTML should trigger download', () => {
      exportTimesheetsListHTML([{ date: '2026-03-01', hours: 8 }], companyInfo);
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });

    it('exportProjectsListHTML should trigger download', () => {
      exportProjectsListHTML([{ name: 'Alpha', status: 'active' }], companyInfo);
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });

    it('exportDebtListHTML should trigger download', () => {
      exportDebtListHTML([{ amount: 5000 }], companyInfo, 'receivables');
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
  });
});
