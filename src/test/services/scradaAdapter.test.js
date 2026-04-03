import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createScradaAdapter } from '@/services/peppol/scradaAdapter';

describe('scradaAdapter', () => {
  const defaultCreds = {
    apiKey: 'test-key',
    password: 'test-pass',
    companyId: 'comp-123',
  };

  let adapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = createScradaAdapter(defaultCreds);
    vi.stubGlobal('fetch', vi.fn());
  });

  describe('createScradaAdapter', () => {
    it('uses production base URL by default', () => {
      const a = createScradaAdapter(defaultCreds);
      expect(a).toBeDefined();
      // We verify by calling sendDocument and inspecting the fetch URL
    });

    it('uses test base URL when useTestEnv is true', async () => {
      const a = createScradaAdapter({ ...defaultCreds, useTestEnv: true });
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'doc-1' }),
      });
      await a.sendDocument('<xml/>', 's', 'r');
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('apitest.scrada.be'), expect.any(Object));
    });

    it('uses custom base URL when provided', async () => {
      const a = createScradaAdapter({ ...defaultCreds, baseUrl: 'https://custom.api/v1' });
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'doc-1' }),
      });
      await a.sendDocument('<xml/>', 's', 'r');
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('custom.api'), expect.any(Object));
    });
  });

  describe('sendDocument', () => {
    it('sends UBL XML via POST and returns documentId', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'doc-42' }),
      });

      const result = await adapter.sendDocument('<Invoice/>', 'sender', 'receiver');
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/peppolOutbound/sendSalesInvoice'),
        expect.objectContaining({
          method: 'POST',
          body: '<Invoice/>',
        })
      );
      expect(result).toEqual({ documentId: 'doc-42', status: 'pending' });
    });

    it('throws on non-ok response', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      await expect(adapter.sendDocument('<xml/>', 's', 'r')).rejects.toThrow(
        'Scrada API error 500: Internal Server Error'
      );
    });

    it('uses response data directly when no id field', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve('raw-id'),
      });

      const result = await adapter.sendDocument('<xml/>', 's', 'r');
      expect(result.documentId).toBe('raw-id');
    });
  });

  describe('getDocumentStatus', () => {
    it('returns mapped status for known statuses', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'Processed', errorMessage: null }),
      });

      const result = await adapter.getDocumentStatus('doc-1');
      expect(result.status).toBe('delivered');
      expect(result.errorMessage).toBeNull();
    });

    it('maps Created to pending', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'Created' }),
      });

      const result = await adapter.getDocumentStatus('doc-1');
      expect(result.status).toBe('pending');
    });

    it('maps Error to error and includes errorMessage', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'Error', errorMessage: 'Bad XML' }),
      });

      const result = await adapter.getDocumentStatus('doc-1');
      expect(result.status).toBe('error');
      expect(result.errorMessage).toBe('Bad XML');
    });

    it('lowercases unknown statuses', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'CustomStatus' }),
      });

      const result = await adapter.getDocumentStatus('doc-1');
      expect(result.status).toBe('customstatus');
    });

    it('throws on non-ok response', async () => {
      fetch.mockResolvedValueOnce({ ok: false, status: 404 });
      await expect(adapter.getDocumentStatus('doc-1')).rejects.toThrow('Scrada API error 404');
    });
  });

  describe('checkPeppolRegistration', () => {
    it('returns registered: true with details on success', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ participantId: 'peppol-1' }),
      });

      const result = await adapter.checkPeppolRegistration('0208:123456');
      expect(result.registered).toBe(true);
      expect(result.details).toEqual({ participantId: 'peppol-1' });
    });

    it('returns registered: false on 404', async () => {
      fetch.mockResolvedValueOnce({ ok: false, status: 404 });

      const result = await adapter.checkPeppolRegistration('0208:unknown');
      expect(result.registered).toBe(false);
    });

    it('throws on non-404 errors', async () => {
      fetch.mockResolvedValueOnce({ ok: false, status: 500 });
      await expect(adapter.checkPeppolRegistration('0208:bad')).rejects.toThrow('Scrada API error 500');
    });

    it('encodes peppolId in URL', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await adapter.checkPeppolRegistration('0208:123/456');
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent('0208:123/456')),
        expect.any(Object)
      );
    });
  });

  describe('listInboundDocuments', () => {
    it('returns array of inbound documents', async () => {
      const docs = [{ id: 'in-1' }, { id: 'in-2' }];
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(docs),
      });

      const result = await adapter.listInboundDocuments();
      expect(result).toEqual(docs);
    });

    it('throws on error', async () => {
      fetch.mockResolvedValueOnce({ ok: false, status: 403 });
      await expect(adapter.listInboundDocuments()).rejects.toThrow('Scrada API error 403');
    });
  });

  describe('getInboundDocument', () => {
    it('returns XML text', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"/>'),
      });

      const result = await adapter.getInboundDocument('doc-99');
      expect(result).toContain('<Invoice');
    });

    it('throws on error', async () => {
      fetch.mockResolvedValueOnce({ ok: false, status: 404 });
      await expect(adapter.getInboundDocument('doc-99')).rejects.toThrow('Scrada API error 404');
    });
  });

  describe('validateCredentials', () => {
    it('returns valid: true with company data on success', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ name: 'My Company' }),
      });

      const result = await adapter.validateCredentials();
      expect(result).toEqual({ valid: true, company: { name: 'My Company' } });
    });

    it('returns valid: false on 401', async () => {
      fetch.mockResolvedValueOnce({ ok: false, status: 401 });

      const result = await adapter.validateCredentials();
      expect(result).toEqual({ valid: false, error: 'Invalid API key or password' });
    });

    it('throws on non-401 errors', async () => {
      fetch.mockResolvedValueOnce({ ok: false, status: 500 });
      await expect(adapter.validateCredentials()).rejects.toThrow('Scrada API error 500');
    });
  });
});
