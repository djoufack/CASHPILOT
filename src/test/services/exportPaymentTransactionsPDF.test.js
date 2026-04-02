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

import { exportPaymentTransactionsPDF } from '@/services/exportPaymentTransactionsPDF';
import { saveElementAsPdf } from '@/services/pdfExportRuntime';

describe('exportPaymentTransactionsPDF', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate PDF with transaction data', async () => {
    const transactions = [
      { id: 1, label: 'Invoice payment', amount: 5000, flow_direction: 'inflow', status: 'completed', transaction_date: '2026-03-15' },
      { id: 2, label: 'Supplier payment', amount: -3000, flow_direction: 'outflow', status: 'completed', transaction_date: '2026-03-16' },
    ];

    await exportPaymentTransactionsPDF(transactions, 'Main Account', { startDate: '2026-03-01', endDate: '2026-03-31' });
    expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
  });

  it('should handle empty transactions list', async () => {
    await exportPaymentTransactionsPDF([], 'Main Account');
    expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
  });

  it('should handle transactions with various statuses', async () => {
    const transactions = [
      { id: 1, label: 'Tx1', amount: 1000, flow_direction: 'inflow', status: 'completed' },
      { id: 2, label: 'Tx2', amount: 500, flow_direction: 'inflow', status: 'pending' },
      { id: 3, label: 'Tx3', amount: -200, flow_direction: 'outflow', status: 'failed' },
      { id: 4, label: 'Tx4', amount: -100, flow_direction: 'outflow', status: 'cancelled' },
    ];

    await exportPaymentTransactionsPDF(transactions, 'Account', {}, { currency: 'EUR' });
    expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
  });

  it('should handle custom currency', async () => {
    const transactions = [
      { id: 1, label: 'Payment', amount: 100000, flow_direction: 'inflow', status: 'completed' },
    ];

    await exportPaymentTransactionsPDF(transactions, 'XOF Account', {}, { currency: 'XOF' });
    expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
  });

  it('should handle date range display', async () => {
    const transactions = [
      { id: 1, label: 'Payment', amount: 5000, flow_direction: 'inflow', status: 'completed' },
    ];
    const dateRange = { startDate: '2026-01-01', endDate: '2026-12-31' };

    await exportPaymentTransactionsPDF(transactions, 'Account', dateRange);
    expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
  });

  it('should calculate inflow and outflow totals', async () => {
    const transactions = [
      { amount: 5000, flow_direction: 'inflow', status: 'completed' },
      { amount: 3000, flow_direction: 'inflow', status: 'completed' },
      { amount: -2000, flow_direction: 'outflow', status: 'completed' },
    ];

    await exportPaymentTransactionsPDF(transactions, 'Account');
    expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
  });
});
