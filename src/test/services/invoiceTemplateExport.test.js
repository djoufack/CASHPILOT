import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

vi.mock('@/config/invoiceThemes', () => ({
  getTheme: vi.fn(() => ({
    id: 'default',
    primary: '#1f2937',
    secondary: '#f3f4f6',
    accent: '#f97316',
    text: '#111827',
  })),
}));

vi.mock('@/config/invoiceTemplates', () => ({
  DEFAULT_INVOICE_TEMPLATE_ID: 'dmg_default',
}));

// Mock all template components as simple functions returning null
vi.mock('@/components/invoice-templates/ClassicTemplate', () => ({ default: () => null }));
vi.mock('@/components/invoice-templates/ModernTemplate', () => ({ default: () => null }));
vi.mock('@/components/invoice-templates/MinimalTemplate', () => ({ default: () => null }));
vi.mock('@/components/invoice-templates/BoldTemplate', () => ({ default: () => null }));
vi.mock('@/components/invoice-templates/ProfessionalTemplate', () => ({ default: () => null }));
vi.mock('@/components/invoice-templates/DMGDefaultTemplate', () => ({ default: () => null }));

import { resolveInvoiceExportSettings, buildStandaloneTemplateHtml } from '@/services/invoiceTemplateExport';

describe('invoiceTemplateExport', () => {
  let supabase;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/lib/supabase');
    supabase = mod.supabase;
  });

  describe('resolveInvoiceExportSettings', () => {
    it('returns normalized override settings when provided', async () => {
      const settings = await resolveInvoiceExportSettings('user-1', {
        template_id: 'classic',
        color_theme: 'ocean',
      });

      expect(settings.template_id).toBe('classic');
      expect(settings.color_theme).toBe('ocean');
      expect(settings.show_logo).toBe(true);
      expect(settings.font_family).toBe('Inter');
      // Should NOT call supabase at all
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('normalizes unknown template_id to default', async () => {
      const settings = await resolveInvoiceExportSettings('user-1', {
        template_id: 'nonexistent_template',
      });
      expect(settings.template_id).toBe('dmg_default');
    });

    it('fetches settings from DB when no override', async () => {
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { template_id: 'modern', color_theme: 'ocean', font_family: 'Roboto' },
          error: null,
        }),
      });

      const settings = await resolveInvoiceExportSettings('user-1');
      expect(supabase.from).toHaveBeenCalledWith('invoice_settings');
      expect(settings.template_id).toBe('modern');
      expect(settings.font_family).toBe('Roboto');
    });

    it('gets current user when userId is null', async () => {
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'auto-user' } },
      });
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      const settings = await resolveInvoiceExportSettings(null);
      expect(supabase.auth.getUser).toHaveBeenCalled();
      expect(settings.template_id).toBe('dmg_default');
    });

    it('returns defaults when no user and no override', async () => {
      supabase.auth.getUser.mockResolvedValue({ data: { user: null } });

      const settings = await resolveInvoiceExportSettings(null);
      expect(settings.template_id).toBe('dmg_default');
      expect(settings.show_logo).toBe(true);
      expect(settings.show_bank_details).toBe(true);
    });

    it('returns defaults when DB query errors', async () => {
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'DB error' },
        }),
      });

      const settings = await resolveInvoiceExportSettings('user-1');
      expect(settings.template_id).toBe('dmg_default');
    });

    it('fills in default custom_labels and font_family', async () => {
      const settings = await resolveInvoiceExportSettings('user-1', {
        template_id: 'bold',
        custom_labels: null,
        font_family: null,
      });
      expect(settings.custom_labels).toEqual({});
      expect(settings.font_family).toBe('Inter');
    });
  });

  describe('buildStandaloneTemplateHtml', () => {
    it('returns a full HTML document with title and content', () => {
      const html = buildStandaloneTemplateHtml('My Invoice', '<div>content</div>');
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<title>My Invoice</title>');
      expect(html).toContain('<div>content</div>');
      expect(html).toContain('body { margin: 0; background: #ffffff; }');
    });

    it('sanitizes special characters in title', () => {
      const html = buildStandaloneTemplateHtml('<script>alert("xss")</script>', '<p>safe</p>');
      expect(html).not.toContain('<script>alert');
      expect(html).toContain('&lt;script&gt;');
    });

    it('handles null/undefined title gracefully', () => {
      const html = buildStandaloneTemplateHtml(null, '<div>test</div>');
      expect(html).toContain('<title>');
      expect(html).toContain('<div>test</div>');
    });
  });
});
