import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/invoiceThemes', () => ({
  getTheme: vi.fn((name) => ({
    primary: '#0f274f',
    accent: '#21d4c8',
    text: '#1f2937',
    textLight: '#6b7280',
    border: '#e5e7eb',
    name: name || 'default',
  })),
}));

vi.mock('@/config/invoiceTemplates', () => ({
  DEFAULT_INVOICE_TEMPLATE_ID: 'dmg_default',
}));

// Mock React SSR and template components
vi.mock('react-dom/server', () => ({
  renderToStaticMarkup: vi.fn(() => '<div>rendered</div>'),
}));

vi.mock('@/components/invoice-templates/ClassicTemplate', () => ({ default: () => null }));
vi.mock('@/components/invoice-templates/ModernTemplate', () => ({ default: () => null }));
vi.mock('@/components/invoice-templates/MinimalTemplate', () => ({ default: () => null }));
vi.mock('@/components/invoice-templates/BoldTemplate', () => ({ default: () => null }));
vi.mock('@/components/invoice-templates/ProfessionalTemplate', () => ({ default: () => null }));
vi.mock('@/components/invoice-templates/DMGDefaultTemplate', () => ({ default: () => null }));

import {
  resolveInvoiceExportSettings,
  buildStandaloneTemplateHtml,
} from '@/services/invoiceTemplateExport';

// ============================================================================
// resolveInvoiceExportSettings — with settingsOverride
// ============================================================================
describe('resolveInvoiceExportSettings', () => {
  it('returns normalized override settings when provided', async () => {
    const result = await resolveInvoiceExportSettings(null, {
      template_id: 'classic',
      color_theme: 'ocean',
      font_family: 'Roboto',
    });

    expect(result.template_id).toBe('classic');
    expect(result.color_theme).toBe('ocean');
    expect(result.font_family).toBe('Roboto');
    expect(result.show_logo).toBe(true); // default
    expect(result.show_bank_details).toBe(true); // default
  });

  it('falls back to default template_id for invalid template', async () => {
    const result = await resolveInvoiceExportSettings(null, {
      template_id: 'nonexistent_template',
    });

    expect(result.template_id).toBe('dmg_default');
  });

  it('fills in defaults for empty override', async () => {
    const result = await resolveInvoiceExportSettings(null, {});

    expect(result.template_id).toBe('dmg_default');
    expect(result.font_family).toBe('Inter');
    expect(result.custom_labels).toEqual({});
    expect(result.show_payment_terms).toBe(true);
    expect(result.footer_text).toBe('');
  });

  it('preserves valid template ids: modern, minimal, bold, professional', async () => {
    for (const id of ['modern', 'minimal', 'bold', 'professional']) {
      const result = await resolveInvoiceExportSettings(null, { template_id: id });
      expect(result.template_id).toBe(id);
    }
  });
});

// ============================================================================
// buildStandaloneTemplateHtml
// ============================================================================
describe('buildStandaloneTemplateHtml', () => {
  it('builds valid HTML document structure', () => {
    const html = buildStandaloneTemplateHtml('Test Invoice', '<p>Content</p>');

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="fr">');
    expect(html).toContain('<meta charset="UTF-8"');
    expect(html).toContain('<title>Test Invoice</title>');
    expect(html).toContain('<p>Content</p>');
    expect(html).toContain('</html>');
  });

  it('escapes HTML in title', () => {
    const html = buildStandaloneTemplateHtml('<script>alert(1)</script>', '<p>ok</p>');

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('includes body margin reset style', () => {
    const html = buildStandaloneTemplateHtml('Title', '');
    expect(html).toContain('body { margin: 0; background: #ffffff; }');
  });

  it('handles empty title', () => {
    const html = buildStandaloneTemplateHtml('', '<div>body</div>');
    expect(html).toContain('<title></title>');
    expect(html).toContain('<div>body</div>');
  });
});
