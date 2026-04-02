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

import { exportPaymentInstrumentsPDF } from '@/services/exportPaymentInstrumentsPDF';
import { saveElementAsPdf } from '@/services/pdfExportRuntime';

describe('exportPaymentInstrumentsPDF', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate PDF with instruments grouped by type', async () => {
    const instruments = [
      { id: 1, label: 'Main Account', instrument_type: 'bank_account', current_balance: 50000, status: 'active' },
      { id: 2, label: 'Visa Card', instrument_type: 'card', current_balance: 2000, status: 'active' },
      { id: 3, label: 'Petty Cash', instrument_type: 'cash', current_balance: 500, status: 'active' },
    ];

    await exportPaymentInstrumentsPDF(instruments, 'Test Corp');
    expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
  });

  it('should handle empty instruments list', async () => {
    await exportPaymentInstrumentsPDF([], 'Test Corp');
    expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
  });

  it('should handle instruments with various statuses', async () => {
    const instruments = [
      { id: 1, label: 'Active', instrument_type: 'bank_account', current_balance: 10000, status: 'active' },
      { id: 2, label: 'Inactive', instrument_type: 'bank_account', current_balance: 0, status: 'inactive' },
      { id: 3, label: 'Suspended', instrument_type: 'card', current_balance: 500, status: 'suspended' },
      { id: 4, label: 'Closed', instrument_type: 'cash', current_balance: 0, status: 'closed' },
    ];

    await exportPaymentInstrumentsPDF(instruments, 'Test Corp');
    expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
  });

  it('should handle unknown instrument types', async () => {
    const instruments = [
      { id: 1, label: 'Crypto', instrument_type: 'crypto_wallet', current_balance: 5000, status: 'active' },
    ];

    await exportPaymentInstrumentsPDF(instruments, 'Test Corp');
    expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
  });

  it('should handle custom currency option', async () => {
    const instruments = [
      { id: 1, label: 'Account XOF', instrument_type: 'bank_account', current_balance: 1000000, status: 'active' },
    ];

    await exportPaymentInstrumentsPDF(instruments, 'Test Corp', { currency: 'XOF' });
    expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
  });
});
