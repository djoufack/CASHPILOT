import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function loadService({ url = 'https://supabase.example.com', anonKey = 'anon-key' } = {}) {
  vi.resetModules();
  vi.doMock('@/lib/customSupabaseClient', () => ({
    supabaseUrl: url,
    supabaseAnonKey: anonKey,
  }));
  return import('@/services/invoiceExtractionService');
}

describe('invoiceExtractionService.extractInvoiceData', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('throws when Supabase URL is missing', async () => {
    const { extractInvoiceData } = await loadService({ url: '' });
    await expect(extractInvoiceData({})).rejects.toThrow('Supabase URL not configured');
  });

  it('returns extracted data on success and uses explicit access token', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        data: { supplier_name: 'ACME', total_amount: 123.45 },
      }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    const { extractInvoiceData } = await loadService();
    const result = await extractInvoiceData({
      filePath: 'documents/invoice.pdf',
      fileType: 'application/pdf',
      userId: 'user-1',
      accessToken: 'jwt-token',
    });

    expect(result).toEqual({ supplier_name: 'ACME', total_amount: 123.45 });
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://supabase.example.com/functions/v1/extract-invoice',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer jwt-token',
          apikey: 'anon-key',
        }),
      })
    );
  });

  it('throws when access token is missing', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const { extractInvoiceData } = await loadService();
    await expect(
      extractInvoiceData({
        filePath: 'documents/invoice.png',
        fileType: 'image/png',
        userId: 'user-2',
      })
    ).rejects.toThrow('Session utilisateur indisponible.');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([
    [402, { error: 'x' }, 'insufficient_credits'],
    [404, { error: 'x' }, 'File not found in storage'],
    [422, { error: 'x' }, 'extraction_failed'],
    [502, { error: 'x' }, 'AI service temporarily unavailable'],
    [500, { error: 'edge-failed' }, 'edge-failed'],
  ])('maps HTTP %s errors to "%s"', async (status, body, expectedMessage) => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status,
      json: vi.fn().mockResolvedValue(body),
    });
    vi.stubGlobal('fetch', fetchSpy);

    const { extractInvoiceData } = await loadService();
    await expect(
      extractInvoiceData({
        filePath: 'documents/invoice.pdf',
        fileType: 'application/pdf',
        userId: 'user-1',
        accessToken: 'jwt-token',
      })
    ).rejects.toThrow(expectedMessage);
  });

  it('returns a default error when response JSON parsing fails', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: vi.fn().mockRejectedValue(new Error('invalid-json')),
    });
    vi.stubGlobal('fetch', fetchSpy);

    const { extractInvoiceData } = await loadService();
    await expect(
      extractInvoiceData({
        filePath: 'documents/invoice.pdf',
        fileType: 'application/pdf',
        userId: 'user-1',
        accessToken: 'jwt-token',
      })
    ).rejects.toThrow('Extraction failed');
  });
});
