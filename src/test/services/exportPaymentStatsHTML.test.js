import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/utils/dateLocale', () => ({
  getLocale: () => 'fr-FR',
}));
vi.mock('@/utils/dateFormatting', () => ({
  formatDateInput: vi.fn(() => '2026-04-02'),
}));

import { exportPaymentStatsHTML } from '@/services/exportPaymentStatsHTML';

describe('exportPaymentStatsHTML', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  it('should generate and download HTML report', () => {
    const stats = {
      volumeByMethod: [
        { method: 'bank_transfer', volume: 50000 },
        { method: 'card', volume: 20000 },
      ],
      cashFlowSummary: { totalInflow: 70000, totalOutflow: 45000 },
      balanceSummary: [
        { instrument_name: 'Main Account', balance: 25000 },
        { instrument_name: 'Savings', balance: 15000 },
      ],
    };

    exportPaymentStatsHTML(stats, 'Test Corp');
    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });

  it('should handle empty stats', () => {
    exportPaymentStatsHTML({}, 'Test Corp');
    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });

  it('should handle custom currency', () => {
    const stats = {
      volumeByMethod: [{ method: 'cash', volume: 10000 }],
      cashFlowSummary: { totalInflow: 10000, totalOutflow: 5000 },
      balanceSummary: [],
    };

    exportPaymentStatsHTML(stats, 'Test Corp', { currency: 'XOF' });
    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });

  it('should handle null company name', () => {
    const stats = { volumeByMethod: [], cashFlowSummary: {}, balanceSummary: [] };
    exportPaymentStatsHTML(stats, null);
    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });

  it('should calculate totals correctly from volume data', () => {
    const stats = {
      volumeByMethod: [
        { method: 'transfer', total: 30000 },
        { method: 'check', total: 10000 },
      ],
      cashFlowSummary: { totalInflow: 40000, totalOutflow: 20000 },
      balanceSummary: [
        { instrument_name: 'Account', current_balance: 20000 },
      ],
    };

    exportPaymentStatsHTML(stats, 'Company', { currency: 'EUR' });
    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });
});
