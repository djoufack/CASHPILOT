import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/utils/dateLocale', () => ({
  getLocale: () => 'fr-FR',
  formatDate: (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—',
}));
vi.mock('@/utils/dateFormatting', () => ({
  formatDateInput: vi.fn(() => '2026-04-02'),
}));
vi.mock('@/utils/sanitize', () => ({
  escapeHTML: (s) => String(s || ''),
  setSafeHtml: (el, html) => { el.innerHTML = html; },
}));
vi.mock('@/services/pdfExportRuntime', () => ({
  saveElementAsPdf: vi.fn().mockResolvedValue(undefined),
}));

import { exportProjectControlHTML, exportProjectControlPDF } from '@/services/exportProjectControlReport';
import { saveElementAsPdf } from '@/services/pdfExportRuntime';

describe('exportProjectControlReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  const payload = {
    project: {
      name: 'Project Alpha',
      status: 'active',
      start_date: '2026-01-01',
      end_date: '2026-12-31',
    },
    currency: 'EUR',
    kpi: {
      planned_budget: 100000,
      actual_cost: 45000,
      budget_variance: 55000,
      budget_consumed_pct: 45,
      schedule_variance: 5,
    },
    milestones: [
      {
        title: 'Phase 1',
        planned_date: '2026-03-31',
        actual_date: '2026-04-05',
        status: 'completed',
        planned_amount: 25000,
        adjustment: 0,
        net_amount: 25000,
      },
    ],
    resources: [
      {
        resource_type: 'human',
        display_name: 'Dev Team',
        planned_quantity: 100,
        actual_quantity: 80,
        unit: 'hours',
        planned_cost: 10000,
        actual_cost: 8000,
        utilization_pct: 80,
      },
    ],
    baselines: [
      {
        baseline_label: 'Initial Plan',
        version: 1,
        planned_start_date: '2026-01-01',
        planned_end_date: '2026-12-31',
        planned_budget_hours: 1000,
        planned_budget_amount: 100000,
        is_active: true,
      },
    ],
    financialCurve: [
      { month: '2026-01', planned: 8000, actual: 7500 },
      { month: '2026-02', planned: 16000, actual: 15000 },
      { month: '2026-03', planned: 25000, actual: 23000 },
    ],
  };

  // ── exportProjectControlHTML ──────────────────────────────────────────

  describe('exportProjectControlHTML', () => {
    it('should generate and download HTML report', () => {
      exportProjectControlHTML(payload);
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });

    it('should handle empty payload', () => {
      exportProjectControlHTML({});
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });

    it('should handle missing milestones and resources', () => {
      exportProjectControlHTML({ project: { name: 'Test' }, kpi: {} });
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
  });

  // ── exportProjectControlPDF ───────────────────────────────────────────

  describe('exportProjectControlPDF', () => {
    it('should generate PDF for project control report', async () => {
      await exportProjectControlPDF(payload);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });

    it('should handle empty payload', async () => {
      await exportProjectControlPDF({});
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });

    it('should handle custom currency', async () => {
      await exportProjectControlPDF({ ...payload, currency: 'XOF' });
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });

    it('should handle empty arrays for milestones and resources', async () => {
      await exportProjectControlPDF({
        ...payload,
        milestones: [],
        resources: [],
        baselines: [],
        financialCurve: [],
      });
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
  });
});
