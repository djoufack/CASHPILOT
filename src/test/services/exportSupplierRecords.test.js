import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  saveElementAsPdf: vi.fn().mockResolvedValue(undefined),
  formatDateInput: vi.fn(() => '2026-04-04'),
  supabaseFrom: vi.fn(),
  renderInvoiceTemplateContent: vi.fn().mockResolvedValue({ content: '<article>Invoice</article>' }),
  buildStandaloneTemplateHtml: vi.fn(
    (title, content) => `<html><head><title>${title}</title></head><body>${content}</body></html>`
  ),
  resolveInvoiceExportSettings: vi.fn().mockResolvedValue({ color_theme: 'default', font_family: 'Inter' }),
  getTheme: vi.fn(() => ({
    primary: '#111111',
    accent: '#333333',
    text: '#222222',
    textLight: '#666666',
    border: '#eeeeee',
  })),
  escapeHTML: vi.fn((value) => String(value ?? '')),
  setSafeHtml: vi.fn((element, content) => {
    element.innerHTML = content;
  }),
}));

vi.mock('@/utils/dateLocale', () => ({
  getLocale: () => 'fr-FR',
}));

vi.mock('@/services/pdfExportRuntime', () => ({
  saveElementAsPdf: mocks.saveElementAsPdf,
}));

vi.mock('@/utils/dateFormatting', () => ({
  formatDateInput: mocks.formatDateInput,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mocks.supabaseFrom,
  },
}));

vi.mock('@/services/invoiceTemplateExport', () => ({
  renderInvoiceTemplateContent: mocks.renderInvoiceTemplateContent,
  buildStandaloneTemplateHtml: mocks.buildStandaloneTemplateHtml,
  resolveInvoiceExportSettings: mocks.resolveInvoiceExportSettings,
}));

vi.mock('@/config/invoiceThemes', () => ({
  getTheme: mocks.getTheme,
}));

vi.mock('@/utils/sanitize', () => ({
  escapeHTML: mocks.escapeHTML,
  setSafeHtml: mocks.setSafeHtml,
}));

import {
  exportSupplierInvoiceHTML,
  exportSupplierInvoicePDF,
  exportSupplierProductHTML,
  exportSupplierProductPDF,
  exportSupplierServiceHTML,
  exportSupplierServicePDF,
} from '@/services/exportSupplierRecords';

describe('exportSupplierRecords', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveInvoiceExportSettings.mockResolvedValue({ color_theme: 'default', font_family: 'Inter' });

    URL.createObjectURL = vi.fn(() => 'blob://cashpilot');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  it('exports supplier service to PDF and HTML', async () => {
    await exportSupplierServicePDF(
      { service_name: 'Audit', pricing_type: 'fixed', fixed_price: 1200, unit: 'mission' },
      { company_name: 'Fournisseur Demo', currency: 'EUR' },
      { company_name: 'CashPilot' }
    );

    expect(mocks.saveElementAsPdf).toHaveBeenCalledTimes(1);
    expect(mocks.resolveInvoiceExportSettings).toHaveBeenCalled();
    expect(mocks.setSafeHtml).toHaveBeenCalled();
    expect(mocks.saveElementAsPdf.mock.calls[0][1].filename).toContain('Supplier_Service_Audit_2026-04-04.pdf');

    await exportSupplierServiceHTML(
      { service_name: 'Audit', pricing_type: 'hourly', hourly_rate: 150 },
      { company_name: 'Fournisseur Demo', currency: 'EUR' },
      { company_name: 'CashPilot' }
    );

    expect(mocks.buildStandaloneTemplateHtml).toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it('exports supplier product to PDF and HTML with stock metadata branches', async () => {
    await exportSupplierProductPDF(
      { product_name: 'PC', stock_quantity: 0, min_stock_level: 3, unit_price: 899, sku: 'PC-01' },
      { company_name: 'Hardware Inc', currency: 'EUR' },
      { company_name: 'CashPilot' }
    );
    await exportSupplierProductHTML(
      { product_name: 'PC', stock_quantity: 10, min_stock_level: 3, unit_price: 899, sku: 'PC-01' },
      { company_name: 'Hardware Inc', currency: 'EUR' },
      { company_name: 'CashPilot' }
    );

    expect(mocks.saveElementAsPdf).toHaveBeenCalledTimes(1);
    expect(mocks.resolveInvoiceExportSettings).toHaveBeenCalledTimes(2);
    expect(mocks.buildStandaloneTemplateHtml).toHaveBeenCalled();
  });

  it('exports supplier invoice to PDF and HTML with normalized template payload', async () => {
    mocks.supabaseFrom.mockImplementation((table) => {
      if (table !== 'supplier_invoice_line_items') {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        select: () => ({
          eq: () => ({
            order: vi.fn().mockResolvedValue({
              data: [{ description: 'Ligne 1', quantity: 2, unit_price: 100, total: 200, vat_rate: 20 }],
              error: null,
            }),
          }),
        }),
      };
    });

    const invoice = {
      id: 'inv_1',
      invoice_number: 'FA-001',
      total_ttc: 1200,
      currency: 'EUR',
      supplier_name_extracted: 'Supplier OCR',
    };
    const supplier = { company_name: 'Supplier SA', currency: 'EUR', email: 'supplier@example.com' };
    const company = { company_name: 'CashPilot' };

    await exportSupplierInvoicePDF(invoice, supplier, company);
    await exportSupplierInvoiceHTML(invoice, supplier, company);

    expect(mocks.renderInvoiceTemplateContent).toHaveBeenCalledTimes(2);
    const firstPayload = mocks.renderInvoiceTemplateContent.mock.calls[0][0];
    expect(firstPayload.invoice.items).toHaveLength(1);
    expect(firstPayload.invoice.client.company_name).toBe('Supplier SA');
    expect(mocks.saveElementAsPdf).toHaveBeenCalledTimes(1);
    expect(mocks.buildStandaloneTemplateHtml).toHaveBeenCalledWith('Facture fournisseur', '<article>Invoice</article>');
  });
});
