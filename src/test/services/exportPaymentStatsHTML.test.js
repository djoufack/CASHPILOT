import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/utils/dateLocale', () => ({ getLocale: () => 'fr-FR' }));
vi.mock('@/utils/dateFormatting', () => ({ formatDateInput: vi.fn(() => '2026-04-02') }));

import { exportPaymentStatsHTML } from '@/services/exportPaymentStatsHTML';

describe('exportPaymentStatsHTML', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.createObjectURL = vi.fn(() => 'blob:mock');
    global.URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  it('generates and downloads HTML', () => {
    exportPaymentStatsHTML(
      {
        volumeByMethod: [{ method: 'bank_transfer', volume: 50000 }],
        cashFlowSummary: { totalInflow: 70000, totalOutflow: 45000 },
        balanceSummary: [{ instrument_name: 'Main', balance: 25000 }],
      },
      'Test Corp'
    );
    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });
  it('handles empty stats', () => {
    exportPaymentStatsHTML({}, 'Test');
    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });
  it('handles custom currency', () => {
    exportPaymentStatsHTML({ volumeByMethod: [], cashFlowSummary: {}, balanceSummary: [] }, 'Test', {
      currency: 'XOF',
    });
    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });
  it('handles null company name', () => {
    exportPaymentStatsHTML({ volumeByMethod: [], cashFlowSummary: {}, balanceSummary: [] }, null);
    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });
});
