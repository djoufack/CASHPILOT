import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/utils/dateLocale', () => ({ getLocale: () => 'fr-FR' }));
vi.mock('@/utils/dateFormatting', () => ({ formatDateInput: vi.fn(() => '2026-04-02') }));
vi.mock('dompurify', () => ({ default: { sanitize: (s) => s } }));
vi.mock('@/services/pdfExportRuntime', () => ({ saveElementAsPdf: vi.fn().mockResolvedValue(undefined) }));

import { exportPaymentTransactionsPDF } from '@/services/exportPaymentTransactionsPDF';
import { saveElementAsPdf } from '@/services/pdfExportRuntime';

describe('exportPaymentTransactionsPDF', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates PDF with transactions', async () => {
    await exportPaymentTransactionsPDF(
      [
        { id: 1, label: 'Pay', amount: 5000, flow_direction: 'inflow', status: 'completed' },
        { id: 2, label: 'Sup', amount: -3000, flow_direction: 'outflow', status: 'completed' },
      ],
      'Main',
      { startDate: '2026-03-01', endDate: '2026-03-31' }
    );
    expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
  });
  it('handles empty', async () => {
    await exportPaymentTransactionsPDF([], 'Main');
    expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
  });
  it('handles various statuses', async () => {
    await exportPaymentTransactionsPDF(
      [
        { amount: 1000, flow_direction: 'inflow', status: 'completed' },
        { amount: 500, flow_direction: 'inflow', status: 'pending' },
        { amount: -200, flow_direction: 'outflow', status: 'failed' },
        { amount: -100, flow_direction: 'outflow', status: 'cancelled' },
      ],
      'Acct',
      {},
      { currency: 'EUR' }
    );
    expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
  });
  it('handles custom currency', async () => {
    await exportPaymentTransactionsPDF(
      [{ amount: 100000, flow_direction: 'inflow', status: 'completed' }],
      'XOF',
      {},
      { currency: 'XOF' }
    );
    expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
  });
});
