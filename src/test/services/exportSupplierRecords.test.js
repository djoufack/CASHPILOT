import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all external dependencies
vi.mock('@/utils/dateLocale', () => ({
  getLocale: vi.fn(() => 'fr-FR'),
}));

vi.mock('@/utils/dateFormatting', () => ({
  formatDateInput: vi.fn(() => '2026-04-02'),
}));

vi.mock('@/services/pdfExportRuntime', () => ({
  saveElementAsPdf: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/services/invoiceTemplateExport', () => ({
  renderInvoiceTemplateContent: vi.fn().mockResolvedValue({ content: '<div>invoice</div>', settings: {} }),
  buildStandaloneTemplateHtml: vi.fn((title, content) => `<html><title>${title}</title>${content}</html>`),
  resolveInvoiceExportSettings: vi.fn().mockResolvedValue({
    template_id: 'dmg_default',
    color_theme: 'default',
    font_family: 'Inter',
  }),
}));

vi.mock('@/config/invoiceThemes', () => ({
  getTheme: vi.fn(() => ({
    primary: '#0f274f',
    accent: '#21d4c8',
    text: '#1f2937',
    textLight: '#6b7280',
    border: '#e5e7eb',
  })),
}));

vi.mock('@/utils/sanitize', () => ({
  escapeHTML: vi.fn((s) => String(s || '')),
  setSafeHtml: vi.fn((el, html) => { el.innerHTML = html; }),
}));

// Since the pure functions (getStockMeta, normalizePricingType, toDisplayDate, formatMoney)
// are not exported, we test them indirectly through the exported functions.
// We also import the module to test the exported functions.

import {
  exportSupplierServicePDF,
  exportSupplierServiceHTML,
  exportSupplierProductPDF,
  exportSupplierProductHTML,
  exportSupplierInvoicePDF,
  exportSupplierInvoiceHTML,
} from '@/services/exportSupplierRecords';

import { saveElementAsPdf } from '@/services/pdfExportRuntime';
import { renderInvoiceTemplateContent } from '@/services/invoiceTemplateExport';

describe('exportSupplierRecords', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // exportSupplierServicePDF
  // ==========================================================================
  describe('exportSupplierServicePDF', () => {
    it('generates PDF for a fixed-price service', async () => {
      const service = {
        service_name: 'Consulting',
        pricing_type: 'fixed',
        fixed_price: 5000,
      };
      const supplier = { company_name: 'Acme Corp', currency: 'EUR' };
      const company = { company_name: 'My Company' };

      await exportSupplierServicePDF(service, supplier, company);

      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });

    it('generates PDF for an hourly-rate service', async () => {
      const service = {
        service_name: 'Dev',
        pricing_type: 'hourly',
        hourly_rate: 150,
      };

      await exportSupplierServicePDF(service, null, null);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // exportSupplierServiceHTML
  // ==========================================================================
  describe('exportSupplierServiceHTML', () => {
    it('generates HTML download for a service', async () => {
      // Mock URL.createObjectURL and revokeObjectURL
      const mockUrl = 'blob:http://test/123';
      global.URL.createObjectURL = vi.fn(() => mockUrl);
      global.URL.revokeObjectURL = vi.fn();

      const service = { service_name: 'Test Service', pricing_type: 'per_unit' };
      const supplier = { company_name: 'Supplier' };
      const company = { company_name: 'Company' };

      await exportSupplierServiceHTML(service, supplier, company);

      // The function creates a download link
      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // exportSupplierProductPDF
  // ==========================================================================
  describe('exportSupplierProductPDF', () => {
    it('generates PDF for a product with stock', async () => {
      const product = {
        product_name: 'Widget',
        sku: 'WDG-001',
        unit_price: 25.50,
        stock_quantity: 100,
        min_stock_level: 10,
        category: { name: 'Hardware' },
      };

      await exportSupplierProductPDF(product, null, null);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });

    it('generates PDF for a product with zero stock (rupture)', async () => {
      const product = {
        product_name: 'Out of Stock',
        stock_quantity: 0,
        min_stock_level: 5,
      };

      await exportSupplierProductPDF(product, null, null);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });

    it('generates PDF for a product with low stock', async () => {
      const product = {
        product_name: 'Low Stock',
        stock_quantity: 3,
        min_stock_level: 10,
      };

      await exportSupplierProductPDF(product, null, null);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // exportSupplierProductHTML
  // ==========================================================================
  describe('exportSupplierProductHTML', () => {
    it('generates HTML for a product', async () => {
      global.URL.createObjectURL = vi.fn(() => 'blob:test');
      global.URL.revokeObjectURL = vi.fn();

      const product = { product_name: 'Test Product', stock_quantity: 50, min_stock_level: 5 };
      await exportSupplierProductHTML(product, null, null);

      expect(URL.createObjectURL).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // exportSupplierInvoicePDF
  // ==========================================================================
  describe('exportSupplierInvoicePDF', () => {
    it('generates PDF for a supplier invoice', async () => {
      const invoice = {
        id: 'inv-123',
        invoice_number: 'SI-2026-001',
        total_ttc: 1200,
        tax_rate: 20,
        currency: 'EUR',
      };
      const supplier = { company_name: 'Supplier Inc' };

      await exportSupplierInvoicePDF(invoice, supplier, {});

      expect(renderInvoiceTemplateContent).toHaveBeenCalledTimes(1);
      expect(saveElementAsPdf).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // exportSupplierInvoiceHTML
  // ==========================================================================
  describe('exportSupplierInvoiceHTML', () => {
    it('generates HTML for a supplier invoice', async () => {
      global.URL.createObjectURL = vi.fn(() => 'blob:test');
      global.URL.revokeObjectURL = vi.fn();

      const invoice = {
        id: 'inv-456',
        invoice_number: 'SI-2026-002',
        total_ttc: 500,
        currency: 'USD',
      };

      await exportSupplierInvoiceHTML(invoice, null, null);

      expect(renderInvoiceTemplateContent).toHaveBeenCalledTimes(1);
      expect(URL.createObjectURL).toHaveBeenCalled();
    });
  });
});
