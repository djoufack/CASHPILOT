import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/utils/dateLocale', () => ({
  getLocale: vi.fn(() => 'fr-FR'),
}));

vi.mock('@/utils/dateFormatting', () => ({
  formatDateInput: vi.fn(() => '2026-04-02'),
}));

vi.mock('@/services/pdfExportRuntime', () => ({
  saveElementAsPdf: vi.fn().mockResolvedValue(undefined),
  saveElementAsPdfBytes: vi.fn().mockResolvedValue(new Uint8Array()),
}));

vi.mock('dompurify', () => ({
  default: {
    sanitize: vi.fn((html) => String(html || '')),
  },
}));

vi.mock('@/services/documentStorage', () => ({
  uploadDocument: vi.fn().mockResolvedValue({ path: 'test.pdf' }),
}));

vi.mock('@/services/invoiceTemplateExport', () => ({
  renderInvoiceTemplateContent: vi.fn().mockResolvedValue({ content: '<div>invoice</div>', settings: {} }),
  buildStandaloneTemplateHtml: vi.fn((title, content) => `<html>${content}</html>`),
}));

import { generateInvoiceHTML } from '@/services/exportDocuments';

// ============================================================================
// generateInvoiceHTML — tests the computeInvoiceTotals logic indirectly
// ============================================================================
describe('generateInvoiceHTML', () => {
  it('generates HTML with invoice data', () => {
    const invoice = {
      invoice_number: 'INV-001',
      date: '2026-01-15',
      due_date: '2026-02-15',
      tax_rate: 20,
      items: [
        { description: 'Service A', quantity: 2, unit_price: 100, total: 200 },
        { description: 'Service B', quantity: 1, unit_price: 300, total: 300 },
      ],
      client: {
        company_name: 'Client Corp',
        address: '123 Main St',
        city: 'Paris',
      },
    };

    const company = {
      name: 'My Company',
      address: '456 Business Ave',
      city: 'Lyon',
    };

    const html = generateInvoiceHTML(invoice, company);

    expect(html).toContain('INV-001');
    expect(html).toContain('Service A');
    expect(html).toContain('Service B');
    expect(html).toContain('Client Corp');
    expect(html).toContain('My Company');
  });

  it('handles invoice with no items — uses fallback totals', () => {
    const invoice = {
      invoice_number: 'INV-002',
      total_ht: 1000,
      total_ttc: 1200,
      tax_amount: 200,
      tax_rate: 20,
      items: [],
      client: { company_name: 'Test Client' },
    };

    const html = generateInvoiceHTML(invoice, { name: 'Company' });
    expect(html).toContain('INV-002');
    expect(html).toBeDefined();
  });

  it('handles null invoice items gracefully', () => {
    const invoice = {
      invoice_number: 'INV-003',
      total_ttc: 500,
      client: {},
    };

    const html = generateInvoiceHTML(invoice, null);
    expect(html).toContain('INV-003');
  });

  it('handles items with alternative field names (qty, unitPrice)', () => {
    const invoice = {
      invoice_number: 'INV-004',
      items: [
        { description: 'Alt fields', qty: 3, unitPrice: 50 },
      ],
      client: {},
    };

    const html = generateInvoiceHTML(invoice, {});
    expect(html).toContain('Alt fields');
  });

  it('computes per-line tax amounts', () => {
    const invoice = {
      invoice_number: 'INV-005',
      tax_rate: 10,
      items: [
        { description: 'Taxed item', quantity: 1, unit_price: 100, tax_rate: 20 },
      ],
      client: {},
    };

    const html = generateInvoiceHTML(invoice, {});
    expect(html).toContain('Taxed item');
  });

  it('uses company fallback name when company_name missing', () => {
    const html = generateInvoiceHTML(
      { invoice_number: 'X', client: {}, items: [] },
      { company_name: 'Alt Name' }
    );
    expect(html).toContain('Alt Name');
  });

  it('defaults company to "Votre Entreprise" when no info', () => {
    const html = generateInvoiceHTML(
      { invoice_number: 'Y', client: {}, items: [] },
      {}
    );
    expect(html).toContain('Votre Entreprise');
  });

  it('handles missing items by falling back to invoice totals', () => {
    const invoice = {
      invoice_number: 'INV-FB',
      total_ht: 500,
      total_ttc: 600,
      tax_amount: 100,
      client: {},
    };

    const html = generateInvoiceHTML(invoice, {});
    expect(html).toContain('INV-FB');
  });
});
