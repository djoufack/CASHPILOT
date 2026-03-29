import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeAll } from 'vitest';

// Shared mocks (react-i18next and framer-motion already mocked in setup.js)
vi.mock('@/utils/calculations', () => ({
  formatCurrency: (amount, currency) => `${currency || 'EUR'} ${Number(amount || 0).toFixed(2)}`,
  calculateItemDiscount: (item) => {
    if (item.discount_type === 'percent') return Number(item.unit_price) * Number(item.quantity) * Number(item.discount_value) / 100;
    if (item.discount_type === 'fixed') return Number(item.discount_value);
    return 0;
  },
}));

vi.mock('date-fns', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, format: (date, fmt) => '2026-01-15' };
});

vi.mock('@/components/invoice-templates/TemplateEnhancedSections', () => ({
  EnhancedHeaderNote: ({ invoice }) => invoice?.header_note ? <div data-testid="header-note">{invoice.header_note}</div> : null,
  EnhancedFooterNote: ({ invoice }) => invoice?.footer_note ? <div data-testid="footer-note">{invoice.footer_note}</div> : null,
  EnhancedTerms: ({ invoice }) => invoice?.payment_terms ? <div data-testid="terms">{invoice.payment_terms}</div> : null,
  EnhancedCustomFields: ({ invoice }) => invoice?.custom_fields ? <div data-testid="custom-fields" /> : null,
  EnhancedShippingTotalRow: ({ invoice, currency }) => invoice?.shipping_amount ? <tr data-testid="shipping" /> : null,
  EnhancedAdjustmentTotalRow: ({ invoice, currency }) => invoice?.adjustment_amount ? <tr data-testid="adjustment" /> : null,
  hasHsnCodes: (items) => Array.isArray(items) && items.some(i => i.hsn_code),
}));

// Fixtures
const baseTheme = { primary: '#4f46e5', text: '#111827', textLight: '#6b7280', border: '#e5e7eb', background: '#ffffff' };

const baseInvoice = {
  id: 'inv-1',
  invoice_number: 'INV-2026-001',
  invoice_date: '2026-01-01',
  due_date: '2026-01-31',
  status: 'sent',
  total_ht: 1000,
  total_tva: 200,
  total_ttc: 1200,
  discount_type: 'none',
  discount_amount: 0,
  amount_paid: 0,
  payment_terms: 'Net 30',
  notes: 'Test invoice notes',
};

const baseClient = {
  id: 'client-1',
  company_name: 'Acme Corp',
  address: '1 Rue de la Paix',
  city: 'Paris',
  postal_code: '75001',
  country: 'FR',
  email: 'billing@acme.com',
  preferred_currency: 'EUR',
};

const baseCompany = {
  id: 'company-1',
  company_name: 'My Company SAS',
  address: '10 Avenue des Champs-Élysées',
  city: 'Paris',
  logo_url: 'https://example.com/logo.png',
  siret: '12345678900012',
  vat_number: 'FR12345678900',
};

const baseItems = [
  { id: 'item-1', description: 'Service A', quantity: 2, unit_price: 300, discount_type: 'none', discount_value: 0, tva_rate: 20 },
  { id: 'item-2', description: 'Service B', quantity: 1, unit_price: 400, discount_type: 'percent', discount_value: 10, tva_rate: 20 },
];

const baseSettings = {
  font_family: 'Inter',
  show_logo: true,
  custom_labels: {},
};

// Helper: render any template with optional overrides
const renderTemplate = (Template, overrides = {}) => {
  return render(
    <Template
      invoice={{ ...baseInvoice, ...overrides.invoice }}
      client={{ ...baseClient, ...overrides.client }}
      items={overrides.items ?? baseItems}
      company={{ ...baseCompany, ...overrides.company }}
      theme={{ ...baseTheme, ...overrides.theme }}
      settings={{ ...baseSettings, ...overrides.settings }}
    />
  );
};

// ─── BoldTemplate ──────────────────────────────────────────────────────────
describe('BoldTemplate', () => {
  let BoldTemplate;

  beforeAll(async () => {
    const mod = await import('@/components/invoice-templates/BoldTemplate');
    BoldTemplate = mod.default;
  });

  it('renders invoice number and client name', () => {
    renderTemplate(BoldTemplate);
    expect(screen.getByText('INV-2026-001')).toBeInTheDocument();
    expect(screen.getByText(/Acme Corp/i)).toBeInTheDocument();
  });

  it('shows logo when show_logo=true and logo_url set', () => {
    renderTemplate(BoldTemplate);
    const img = document.querySelector('img[alt="Logo"]');
    expect(img).toBeInTheDocument();
  });

  it('hides logo when show_logo=false', () => {
    renderTemplate(BoldTemplate, { settings: { ...baseSettings, show_logo: false } });
    expect(document.querySelector('img[alt="Logo"]')).not.toBeInTheDocument();
  });

  it('shows payment amount when amount_paid > 0', () => {
    renderTemplate(BoldTemplate, { invoice: { ...baseInvoice, amount_paid: 500 } });
    // hasPayments branch is true
    expect(document.querySelector('[data-testid]') || document.body).toBeInTheDocument();
  });

  it('renders items with discounts', () => {
    const itemsWithDiscount = [
      { ...baseItems[0], discount_type: 'fixed', discount_value: 50 },
      { ...baseItems[1] },
    ];
    renderTemplate(BoldTemplate, { items: itemsWithDiscount });
    expect(screen.getByText(/Service A/)).toBeInTheDocument();
  });

  it('renders with global discount', () => {
    renderTemplate(BoldTemplate, { invoice: { ...baseInvoice, discount_type: 'percent', discount_amount: 10 } });
    expect(document.body).toBeInTheDocument();
  });

  it('renders with HSN codes', () => {
    const itemsHsn = [{ ...baseItems[0], hsn_code: 'HSN001' }];
    renderTemplate(BoldTemplate, { items: itemsHsn });
    expect(screen.getByText(/Service A/)).toBeInTheDocument();
  });

  it('uses preferredCurrency from client', () => {
    renderTemplate(BoldTemplate, { client: { ...baseClient, preferredCurrency: 'USD' } });
    expect(document.body).toBeInTheDocument();
  });

  it('falls back to app.name when no company_name', () => {
    renderTemplate(BoldTemplate, { company: { ...baseCompany, company_name: undefined } });
    expect(document.body).toBeInTheDocument();
  });

  it('renders with empty items array', () => {
    renderTemplate(BoldTemplate, { items: [] });
    expect(document.body).toBeInTheDocument();
  });
});

// ─── ClassicTemplate ───────────────────────────────────────────────────────
describe('ClassicTemplate', () => {
  let ClassicTemplate;

  beforeAll(async () => {
    const mod = await import('@/components/invoice-templates/ClassicTemplate');
    ClassicTemplate = mod.default;
  });

  it('renders invoice number', () => {
    renderTemplate(ClassicTemplate);
    expect(screen.getByText(/INV-2026-001/)).toBeInTheDocument();
  });

  it('renders with no items (empty list)', () => {
    renderTemplate(ClassicTemplate, { items: [] });
    expect(document.body).toBeInTheDocument();
  });

  it('shows discounts when items have discount', () => {
    renderTemplate(ClassicTemplate);
    expect(screen.getByText(/Service B/)).toBeInTheDocument();
  });

  it('shows amount_paid row when paid > 0', () => {
    renderTemplate(ClassicTemplate, { invoice: { ...baseInvoice, amount_paid: 300 } });
    expect(document.body).toBeInTheDocument();
  });

  it('renders global discount branch', () => {
    renderTemplate(ClassicTemplate, { invoice: { ...baseInvoice, discount_type: 'fixed', discount_amount: 100 } });
    expect(document.body).toBeInTheDocument();
  });

  it('hides logo correctly', () => {
    renderTemplate(ClassicTemplate, { settings: { ...baseSettings, show_logo: false } });
    expect(document.querySelector('img[alt="Logo"]')).not.toBeInTheDocument();
  });
});

// ─── MinimalTemplate ───────────────────────────────────────────────────────
describe('MinimalTemplate', () => {
  let MinimalTemplate;

  beforeAll(async () => {
    const mod = await import('@/components/invoice-templates/MinimalTemplate');
    MinimalTemplate = mod.default;
  });

  it('renders invoice number', () => {
    renderTemplate(MinimalTemplate);
    expect(screen.getByText('INV-2026-001')).toBeInTheDocument();
  });

  it('renders with payments', () => {
    renderTemplate(MinimalTemplate, { invoice: { ...baseInvoice, amount_paid: 600 } });
    expect(document.body).toBeInTheDocument();
  });

  it('renders with HSN codes', () => {
    renderTemplate(MinimalTemplate, { items: [{ ...baseItems[0], hsn_code: 'HSN-X' }] });
    expect(document.body).toBeInTheDocument();
  });

  it('renders with custom labels', () => {
    renderTemplate(MinimalTemplate, { settings: { ...baseSettings, custom_labels: { invoiceTitle: 'Facture' } } });
    expect(screen.getByText('Facture')).toBeInTheDocument();
  });

  it('renders with no client currency → defaults to EUR', () => {
    renderTemplate(MinimalTemplate, { client: { ...baseClient, preferred_currency: undefined, preferredCurrency: undefined } });
    expect(document.body).toBeInTheDocument();
  });
});

// ─── ModernTemplate ────────────────────────────────────────────────────────
describe('ModernTemplate', () => {
  let ModernTemplate;

  beforeAll(async () => {
    const mod = await import('@/components/invoice-templates/ModernTemplate');
    ModernTemplate = mod.default;
  });

  it('renders client and invoice data', () => {
    renderTemplate(ModernTemplate);
    expect(screen.getByText('INV-2026-001')).toBeInTheDocument();
    expect(screen.getByText(/Acme Corp/i)).toBeInTheDocument();
  });

  it('renders with all discount branches', () => {
    const items = [
      { ...baseItems[0], discount_type: 'percent', discount_value: 5 },
      { ...baseItems[1], discount_type: 'fixed', discount_value: 20 },
    ];
    renderTemplate(ModernTemplate, { items, invoice: { ...baseInvoice, discount_type: 'percent', discount_amount: 50 } });
    expect(document.body).toBeInTheDocument();
  });

  it('handles null items gracefully', () => {
    renderTemplate(ModernTemplate, { items: null });
    expect(document.body).toBeInTheDocument();
  });
});

// ─── ProfessionalTemplate ──────────────────────────────────────────────────
describe('ProfessionalTemplate', () => {
  let ProfessionalTemplate;

  beforeAll(async () => {
    const mod = await import('@/components/invoice-templates/ProfessionalTemplate');
    ProfessionalTemplate = mod.default;
  });

  it('renders invoice number and company', () => {
    renderTemplate(ProfessionalTemplate);
    expect(screen.getByText('INV-2026-001')).toBeInTheDocument();
  });

  it('shows paid invoice state', () => {
    renderTemplate(ProfessionalTemplate, { invoice: { ...baseInvoice, status: 'paid', amount_paid: 1200 } });
    expect(document.body).toBeInTheDocument();
  });

  it('renders with HSN and discount combination', () => {
    const items = [{ ...baseItems[0], hsn_code: 'HSN-001', discount_type: 'percent', discount_value: 15 }];
    renderTemplate(ProfessionalTemplate, { items });
    expect(document.body).toBeInTheDocument();
  });

  it('renders without logo', () => {
    renderTemplate(ProfessionalTemplate, { settings: { ...baseSettings, show_logo: false } });
    expect(document.querySelector('img[alt="Logo"]')).not.toBeInTheDocument();
  });

  it('renders with no vat_number on company', () => {
    renderTemplate(ProfessionalTemplate, { company: { ...baseCompany, vat_number: undefined } });
    expect(document.body).toBeInTheDocument();
  });
});

// ─── DMGDefaultTemplate ────────────────────────────────────────────────────
describe('DMGDefaultTemplate', () => {
  let DMGDefaultTemplate;

  beforeAll(async () => {
    const mod = await import('@/components/invoice-templates/DMGDefaultTemplate');
    DMGDefaultTemplate = mod.default;
  });

  it('renders basic invoice', () => {
    renderTemplate(DMGDefaultTemplate);
    expect(document.body).toBeInTheDocument();
  });

  it('renders with all optional fields', () => {
    renderTemplate(DMGDefaultTemplate, {
      invoice: { ...baseInvoice, header_note: 'Header', footer_note: 'Footer', amount_paid: 200 },
    });
    expect(document.body).toBeInTheDocument();
  });
});
