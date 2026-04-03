import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/utils/dateLocale', () => ({ getLocale: () => 'fr-FR' }));
vi.mock('@/utils/dateFormatting', () => ({ formatDateInput: vi.fn(() => '2026-04-02') }));
vi.mock('dompurify', () => ({ default: { sanitize: (s) => s } }));
vi.mock('@/services/pdfExportRuntime', () => ({ saveElementAsPdf: vi.fn().mockResolvedValue(undefined) }));

import { exportPaymentInstrumentsPDF } from '@/services/exportPaymentInstrumentsPDF';
import { saveElementAsPdf } from '@/services/pdfExportRuntime';

describe('exportPaymentInstrumentsPDF', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates PDF with instruments', async () => {
    await exportPaymentInstrumentsPDF(
      [
        { id: 1, label: 'Main', instrument_type: 'bank_account', current_balance: 50000, status: 'active' },
        { id: 2, label: 'Visa', instrument_type: 'card', current_balance: 2000, status: 'active' },
        { id: 3, label: 'Cash', instrument_type: 'cash', current_balance: 500, status: 'active' },
      ],
      'Test'
    );
    expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
  });
  it('handles empty list', async () => {
    await exportPaymentInstrumentsPDF([], 'Test');
    expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
  });
  it('handles various statuses', async () => {
    await exportPaymentInstrumentsPDF(
      [
        { id: 1, label: 'A', instrument_type: 'bank_account', current_balance: 0, status: 'inactive' },
        { id: 2, label: 'B', instrument_type: 'card', current_balance: 0, status: 'suspended' },
        { id: 3, label: 'C', instrument_type: 'cash', current_balance: 0, status: 'closed' },
      ],
      'Test'
    );
    expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
  });
  it('handles unknown types', async () => {
    await exportPaymentInstrumentsPDF(
      [{ id: 1, label: 'X', instrument_type: 'crypto', current_balance: 5000, status: 'active' }],
      'Test'
    );
    expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
  });
  it('handles custom currency', async () => {
    await exportPaymentInstrumentsPDF(
      [{ id: 1, label: 'A', instrument_type: 'bank_account', current_balance: 1000000, status: 'active' }],
      'Test',
      { currency: 'XOF' }
    );
    expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
  });
});
