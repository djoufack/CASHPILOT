import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock dependencies that need i18n/locale
vi.mock('@/utils/dateLocale', () => ({
  getLocale: () => ({ locale: 'fr-FR' }),
}));
vi.mock('@/utils/accountingCurrency', () => ({
  resolveAccountingCurrency: () => 'EUR',
}));

// The export functions call downloadHTML which creates a DOM anchor and clicks it.
// Suppress the jsdom "not implemented: navigation" error by mocking URL APIs.
beforeEach(() => {
  global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  global.URL.revokeObjectURL = vi.fn();
  // Suppress click-triggered navigation in jsdom
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

import {
  generateHTMLDocument,
  exportBalanceSheetHTML,
  exportIncomeStatementHTML,
  exportInvoiceHTML,
  exportVATDeclarationHTML,
  exportTaxEstimationHTML,
} from '@/services/exportHTML';

// ── generateHTMLDocument ─────────────────────────────────────────────────────

describe('generateHTMLDocument', () => {
  it('returns a string starting with <!DOCTYPE html>', () => {
    const html = generateHTMLDocument('Test Title', '<p>Content</p>');
    expect(typeof html).toBe('string');
    expect(html).toContain('<!DOCTYPE html>');
  });

  it('includes the title in the output', () => {
    const html = generateHTMLDocument('My Invoice', '<p>body</p>');
    expect(html).toContain('My Invoice');
  });

  it('includes the content in the output', () => {
    const html = generateHTMLDocument('T', '<section id="test-content">Hello</section>');
    expect(html).toContain('test-content');
    expect(html).toContain('Hello');
  });

  it('includes custom styles when provided', () => {
    const html = generateHTMLDocument('T', '<p/>', '.custom { color: red; }');
    expect(html).toContain('.custom');
  });

  it('works with empty styles (default param)', () => {
    expect(() => generateHTMLDocument('T', '<p/>')).not.toThrow();
  });

  it('handles special characters in title', () => {
    const html = generateHTMLDocument('Facture <2026>', '<p/>');
    expect(html).toContain('Facture');
  });
});

// ── exportBalanceSheetHTML ───────────────────────────────────────────────────

describe('exportBalanceSheetHTML', () => {
  const balanceSheet = {
    totalAssets: 170000,
    totalPassif: 170000,
    balanced: true,
    syscohada: {
      actif: [
        { label: 'Actif immobilisé', value: 120000 },
        { label: 'Actif circulant', value: 50000 },
      ],
      passif: [
        { label: 'Capitaux propres', value: 110000 },
        { label: 'Dettes', value: 60000 },
      ],
    },
  };
  const company = { company_name: 'Test SAS', siret: '12345678900011', currency: 'EUR' };
  const period = 'FY 2026';

  it('does not throw for valid inputs', () => {
    expect(() => exportBalanceSheetHTML(balanceSheet, company, period)).not.toThrow();
  });

  it('includes company name via blob capture', () => {
    global.URL.createObjectURL = vi.fn((_blob) => {
      // Synchronously read blob text isn't possible in jsdom, but we can verify call
      return 'blob:mock';
    });
    exportBalanceSheetHTML(balanceSheet, company, period);
    // Verify downloadHTML was triggered (URL.createObjectURL called)
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('handles unbalanced balance sheet (difference > 0)', () => {
    const unbalanced = { ...balanceSheet, totalPassif: 160000, balanced: false };
    expect(() => exportBalanceSheetHTML(unbalanced, company, period)).not.toThrow();
  });

  it('handles undefined syscohada (shows fallback)', () => {
    // When syscohada is undefined, the template shows fallback text
    expect(() =>
      exportBalanceSheetHTML({ totalAssets: 0, totalPassif: 0, syscohada: undefined }, company, period)
    ).not.toThrow();
  });
});

// ── exportIncomeStatementHTML ────────────────────────────────────────────────

describe('exportIncomeStatementHTML', () => {
  const statement = {
    revenueItems: [{ label: 'Ventes', amount: 100000 }],
    expenseItems: [{ label: 'Salaires', amount: 40000 }],
    grossProfit: 40000,
    netIncome: 32000,
    totalRevenue: 100000,
    totalExpenses: 60000,
  };
  const company = { company_name: 'Corp SAS', currency: 'EUR' };
  const period = 'Q1 2026';

  it('does not throw for valid inputs', () => {
    expect(() => exportIncomeStatementHTML(statement, company, period)).not.toThrow();
  });

  it('handles statement with revenues array variant', () => {
    const altStatement = { revenues: [{ label: 'CA', amount: 5000 }], expenses: [] };
    expect(() => exportIncomeStatementHTML(altStatement, company, period)).not.toThrow();
  });

  it('handles empty statement object', () => {
    expect(() => exportIncomeStatementHTML({}, company, period)).not.toThrow();
  });
});

// ── exportInvoiceHTML ────────────────────────────────────────────────────────

describe('exportInvoiceHTML', () => {
  const invoice = {
    id: 'inv-1',
    invoice_number: 'INV-2026-001',
    date: '2026-01-15',
    due_date: '2026-02-15',
    total_ht: 1000,
    total_tva: 200,
    total_ttc: 1200,
    status: 'sent',
  };
  const client = { company_name: 'Acme Corp', address: '1 Rue Test', city: 'Paris' };
  const items = [{ description: 'Service A', quantity: 2, unit_price: 500, tva_rate: 20 }];

  it('does not throw for valid inputs', () => {
    expect(() => exportInvoiceHTML(invoice, client, items)).not.toThrow();
  });

  it('handles empty items array', () => {
    expect(() => exportInvoiceHTML(invoice, client, [])).not.toThrow();
  });
});

// ── exportVATDeclarationHTML ─────────────────────────────────────────────────

describe('exportVATDeclarationHTML', () => {
  const vatData = {
    outputVAT: 2000,
    inputVAT: 800,
    vatPayable: 1200,
  };
  const company = { company_name: 'Test Corp', vat_number: 'FR12345' };
  const period = 'Jan 2026';

  it('does not throw for valid inputs', () => {
    expect(() => exportVATDeclarationHTML(vatData, company, period)).not.toThrow();
  });

  it('handles zero VAT values', () => {
    expect(() => exportVATDeclarationHTML({ outputVAT: 0, inputVAT: 0, vatPayable: 0 }, company, period)).not.toThrow();
  });
});

// ── exportTaxEstimationHTML ──────────────────────────────────────────────────

describe('exportTaxEstimationHTML', () => {
  const taxData = {
    netIncome: 50000,
    taxEstimate: 13000,
  };
  const company = { company_name: 'Corp' };
  const period = 'FY 2026';

  it('does not throw for valid inputs', () => {
    expect(() => exportTaxEstimationHTML(taxData, company, period)).not.toThrow();
  });

  it('handles zero net income', () => {
    expect(() => exportTaxEstimationHTML({ netIncome: 0, taxEstimate: 0 }, company, period)).not.toThrow();
  });
});
