import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/utils/dateLocale', () => ({
  getLocale: () => 'fr-FR',
  formatDate: (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—'),
}));
vi.mock('@/utils/dateFormatting', () => ({ formatDateInput: vi.fn(() => '2026-04-02') }));
vi.mock('@/utils/sanitize', () => ({
  escapeHTML: (s) => String(s || ''),
  setSafeHtml: (el, html) => {
    el.innerHTML = html;
  },
}));
vi.mock('@/services/pdfExportRuntime', () => ({ saveElementAsPdf: vi.fn().mockResolvedValue(undefined) }));

import { exportProjectControlHTML, exportProjectControlPDF } from '@/services/exportProjectControlReport';
import { saveElementAsPdf } from '@/services/pdfExportRuntime';

describe('exportProjectControlReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.createObjectURL = vi.fn(() => 'blob:mock');
    global.URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  const payload = {
    project: { name: 'Alpha', status: 'active' },
    currency: 'EUR',
    kpi: { planned_budget: 100000, actual_cost: 45000 },
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
        display_name: 'Dev',
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
        baseline_label: 'Initial',
        version: 1,
        planned_start_date: '2026-01-01',
        planned_end_date: '2026-12-31',
        planned_budget_hours: 1000,
        planned_budget_amount: 100000,
        is_active: true,
      },
    ],
    financialCurve: [{ month: '2026-01', planned: 8000, actual: 7500 }],
  };

  describe('exportProjectControlHTML', () => {
    it('generates HTML', () => {
      exportProjectControlHTML(payload);
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
    it('handles empty payload', () => {
      exportProjectControlHTML({});
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
  });

  describe('exportProjectControlPDF', () => {
    it('generates PDF', async () => {
      await exportProjectControlPDF(payload);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
    it('handles empty payload', async () => {
      await exportProjectControlPDF({});
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
    it('handles empty arrays', async () => {
      await exportProjectControlPDF({ ...payload, milestones: [], resources: [], baselines: [], financialCurve: [] });
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
  });
});
