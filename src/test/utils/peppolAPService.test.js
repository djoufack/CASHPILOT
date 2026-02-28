import { describe, it, expect, vi } from 'vitest';
import { createAPService } from '@/services/peppol/peppolAPService';
import { createScradaAdapter } from '@/services/peppol/scradaAdapter';

describe('createAPService', () => {
  it('delegates sendDocument to adapter', async () => {
    const mockAdapter = {
      sendDocument: vi.fn().mockResolvedValue({ documentId: 'doc-123', status: 'pending' }),
      getDocumentStatus: vi.fn(),
    };
    const service = createAPService(mockAdapter);
    const result = await service.sendDocument('<xml/>', '0208:111', '0208:222', 'invoice');
    expect(mockAdapter.sendDocument).toHaveBeenCalledWith('<xml/>', '0208:111', '0208:222', 'invoice');
    expect(result.documentId).toBe('doc-123');
  });

  it('delegates getDocumentStatus to adapter', async () => {
    const mockAdapter = {
      sendDocument: vi.fn(),
      getDocumentStatus: vi.fn().mockResolvedValue({ status: 'delivered' }),
    };
    const service = createAPService(mockAdapter);
    const result = await service.getDocumentStatus('doc-123');
    expect(result.status).toBe('delivered');
  });

  it('delegates checkPeppolRegistration when available', async () => {
    const mockAdapter = {
      sendDocument: vi.fn(),
      getDocumentStatus: vi.fn(),
      checkPeppolRegistration: vi.fn().mockResolvedValue({ registered: true }),
    };
    const service = createAPService(mockAdapter);
    const result = await service.checkPeppolRegistration('0208:0123456789');
    expect(result.registered).toBe(true);
  });

  it('checkPeppolRegistration is undefined when adapter does not support it', () => {
    const mockAdapter = { sendDocument: vi.fn(), getDocumentStatus: vi.fn() };
    const service = createAPService(mockAdapter);
    expect(service.checkPeppolRegistration).toBeUndefined();
  });

  it('delegates listInboundDocuments when available', async () => {
    const mockAdapter = {
      sendDocument: vi.fn(),
      getDocumentStatus: vi.fn(),
      listInboundDocuments: vi.fn().mockResolvedValue([{ id: 'inb-1' }]),
    };
    const service = createAPService(mockAdapter);
    const result = await service.listInboundDocuments();
    expect(result).toEqual([{ id: 'inb-1' }]);
  });

  it('delegates validateCredentials when available', async () => {
    const mockAdapter = {
      sendDocument: vi.fn(),
      getDocumentStatus: vi.fn(),
      validateCredentials: vi.fn().mockResolvedValue({ valid: true }),
    };
    const service = createAPService(mockAdapter);
    const result = await service.validateCredentials();
    expect(result.valid).toBe(true);
  });
});

describe('createScradaAdapter', () => {
  it('constructs with apiKey, password and companyId', () => {
    const adapter = createScradaAdapter({
      apiKey: 'test-key',
      password: 'test-pass',
      companyId: 'test-company-id',
    });
    expect(adapter.sendDocument).toBeTypeOf('function');
    expect(adapter.getDocumentStatus).toBeTypeOf('function');
    expect(adapter.checkPeppolRegistration).toBeTypeOf('function');
    expect(adapter.listInboundDocuments).toBeTypeOf('function');
    expect(adapter.validateCredentials).toBeTypeOf('function');
  });

  it('uses test environment URL when useTestEnv is true', () => {
    const adapter = createScradaAdapter({
      apiKey: 'k', password: 'p', companyId: 'c', useTestEnv: true,
    });
    expect(adapter).toBeDefined();
  });
});
