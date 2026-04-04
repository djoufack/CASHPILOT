import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockToast,
  mockUseCompanyScope,
  mockUseCompany,
  mockUseInvoiceSettings,
  mockFrom,
  mockGetSession,
  mockGetUser,
  mockStorageFrom,
  mockComputeBlobSha256Hex,
  mockExportInvoicePDF,
  mockExportQuotePDF,
  mockExportCreditNotePDF,
  mockExportDeliveryNotePDF,
  mockExportPurchaseOrderPDF,
  mockExportSupplierInvoicePDF,
  mockExtractInvoiceData,
  mockLinkLineItemsToProducts,
} = vi.hoisted(() => ({
  mockToast: vi.fn(),
  mockUseCompanyScope: vi.fn(),
  mockUseCompany: vi.fn(),
  mockUseInvoiceSettings: vi.fn(),
  mockFrom: vi.fn(),
  mockGetSession: vi.fn(),
  mockGetUser: vi.fn(),
  mockStorageFrom: vi.fn(),
  mockComputeBlobSha256Hex: vi.fn(),
  mockExportInvoicePDF: vi.fn(),
  mockExportQuotePDF: vi.fn(),
  mockExportCreditNotePDF: vi.fn(),
  mockExportDeliveryNotePDF: vi.fn(),
  mockExportPurchaseOrderPDF: vi.fn(),
  mockExportSupplierInvoicePDF: vi.fn(),
  mockExtractInvoiceData: vi.fn(),
  mockLinkLineItemsToProducts: vi.fn(),
}));

const tableResponses = {};

function setTableResponse(table, response) {
  tableResponses[table] = response;
}

function getTableResponse(table, mode) {
  return tableResponses[table]?.[mode] || tableResponses[table]?.select || { data: null, error: null };
}

function createQueryChain(table) {
  const chain = {
    table,
    mode: 'select',
    payload: null,
    select: vi.fn(() => {
      chain.mode = 'select';
      return chain;
    }),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    not: vi.fn(() => chain),
    or: vi.fn(() => chain),
    insert: vi.fn((payload) => {
      chain.mode = 'insert';
      chain.payload = payload;
      return chain;
    }),
    upsert: vi.fn((payload) => {
      chain.mode = 'upsert';
      chain.payload = payload;
      return chain;
    }),
    update: vi.fn((payload) => {
      chain.mode = 'update';
      chain.payload = payload;
      return chain;
    }),
    delete: vi.fn(() => chain),
    single: vi.fn(async () => getTableResponse(table, 'single')),
    maybeSingle: vi.fn(async () => getTableResponse(table, 'maybeSingle')),
    then: (onFulfilled, onRejected) =>
      Promise.resolve(getTableResponse(table, chain.mode)).then(onFulfilled, onRejected),
  };

  return chain;
}

function createStorageChain(bucket) {
  return {
    bucket,
    upload: vi.fn(async () => ({ data: null, error: null })),
    download: vi.fn(async () => ({ data: null, error: null })),
    createSignedUrl: vi.fn(async () => ({ data: { signedUrl: `${bucket}/signed` }, error: null })),
    remove: vi.fn(async () => ({ data: null, error: null })),
  };
}

vi.mock('@/services/gedVersioning', async () => {
  const actual = await vi.importActual('@/services/gedVersioning');
  return {
    ...actual,
    computeBlobSha256Hex: mockComputeBlobSha256Hex,
  };
});

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/hooks/useCompanyScope', () => ({
  useCompanyScope: mockUseCompanyScope,
}));

vi.mock('@/hooks/useCompany', () => ({
  useCompany: mockUseCompany,
}));

vi.mock('@/hooks/useInvoiceSettings', () => ({
  useInvoiceSettings: mockUseInvoiceSettings,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      getUser: mockGetUser,
    },
    from: mockFrom,
    storage: {
      from: mockStorageFrom,
    },
  },
}));

vi.mock('@/services/exportDocuments', () => ({
  exportCreditNotePDF: mockExportCreditNotePDF,
  exportDeliveryNotePDF: mockExportDeliveryNotePDF,
  exportInvoicePDF: mockExportInvoicePDF,
  exportPurchaseOrderPDF: mockExportPurchaseOrderPDF,
  exportQuotePDF: mockExportQuotePDF,
}));

vi.mock('@/services/exportSupplierRecords', () => ({
  exportSupplierInvoicePDF: mockExportSupplierInvoicePDF,
}));

vi.mock('@/services/invoiceExtractionService', () => ({
  extractInvoiceData: mockExtractInvoiceData,
}));

vi.mock('@/services/supplierInvoiceLineItemLinking', () => ({
  linkLineItemsToProducts: mockLinkLineItemsToProducts,
}));

vi.mock('@/utils/activeCompanyStorage', () => ({
  setStoredActiveCompanyId: vi.fn(),
}));

import {
  buildGedDocumentVersionIndex,
  enrichDocumentsWithGedVersionInfo,
  buildGedVersionStoragePath,
} from '@/services/gedVersioning';
import { computeRetentionUntilFromDays, resolveGedRetentionPolicy } from '@/services/gedRetentionPolicies';
import { enrichGedDocumentsWithWorkflowInfo, resolveGedWorkflowRecord } from '@/services/gedWorkflow';
import { useGedHub } from '@/hooks/useGedHub';

describe('gedVersioning helpers', () => {
  it('builds a version summary and enriches documents', () => {
    const versionIndex = buildGedDocumentVersionIndex([
      {
        source_table: 'quotes',
        source_id: 'doc-1',
        version: 2,
        content_hash: 'hash-2',
      },
      {
        source_table: 'quotes',
        source_id: 'doc-1',
        version: 1,
        content_hash: 'hash-1',
      },
    ]);

    const enriched = enrichDocumentsWithGedVersionInfo(
      [
        {
          sourceTable: 'quotes',
          sourceId: 'doc-1',
          fileUrl: 'storage/path',
        },
      ],
      versionIndex
    );

    expect(enriched[0].currentVersion).toBe(2);
    expect(enriched[0].versionCount).toBe(2);
    expect(enriched[0].hasVersionHistory).toBe(true);
  });

  it('builds a deterministic version storage path', () => {
    expect(
      buildGedVersionStoragePath({
        userId: 'user-1',
        sourceTable: 'quotes',
        sourceId: 'doc-1',
        version: 2,
        contentHash: 'abcdef1234567890',
        fileName: 'My File.pdf',
      })
    ).toBe('user-1/quotes/doc-1/v2-abcdef123456-My_File.pdf');
  });
});

describe('gedRetentionPolicies helpers', () => {
  it('resolves the most specific active policy and computes the retention date', () => {
    const policy = resolveGedRetentionPolicy(
      [
        { source_table: 'quotes', doc_category: 'all', retention_days: 30, is_active: true },
        { source_table: 'quotes', doc_category: 'accounting', retention_days: 90, is_active: true },
      ],
      { sourceTable: 'quotes', docCategory: 'accounting' }
    );

    expect(policy?.retention_days).toBe(90);
    expect(computeRetentionUntilFromDays('2026-03-27T00:00:00.000Z', policy?.retention_days)).toBe('2026-06-25');
  });
});

describe('gedWorkflow helpers', () => {
  it('resolves a workflow record and enriches documents with workflow state', () => {
    const workflow = resolveGedWorkflowRecord(
      [
        {
          company_id: 'company-1',
          source_table: 'quotes',
          source_id: 'doc-1',
          workflow_status: 'signed',
          signed_by: 'user-1',
          signed_at: '2026-03-27T10:00:00.000Z',
          comment: 'ok',
        },
      ],
      { sourceTable: 'quotes', sourceId: 'doc-1' }
    );

    expect(workflow?.workflow_status).toBe('signed');

    const enriched = enrichGedDocumentsWithWorkflowInfo(
      [
        {
          sourceTable: 'quotes',
          sourceId: 'doc-1',
        },
      ],
      [workflow]
    );

    expect(enriched[0]).toMatchObject({
      workflowStatus: 'signed',
      workflowSignedBy: 'user-1',
      workflowComment: 'ok',
      hasWorkflow: true,
    });
  });
});

describe('useGedHub GED versioning', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    for (const key of Object.keys(tableResponses)) {
      delete tableResponses[key];
    }

    mockUseCompanyScope.mockReturnValue({
      activeCompanyId: 'company-1',
      withCompanyScope: (payload) => ({ ...payload, company_id: 'company-1' }),
    });
    mockUseCompany.mockReturnValue({
      activeCompany: {
        id: 'company-1',
        accounting_currency: 'EUR',
      },
    });
    mockUseInvoiceSettings.mockReturnValue({
      settings: {},
    });
    mockGetUser.mockResolvedValue({
      data: {
        user: { id: 'user-1' },
      },
      error: null,
    });
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: { id: 'user-1' },
          access_token: 'token-1',
        },
      },
      error: null,
    });
    mockComputeBlobSha256Hex.mockResolvedValue('hash-same');
    mockExtractInvoiceData.mockResolvedValue(null);
    mockLinkLineItemsToProducts.mockImplementation((items) => items);
    mockToast.mockImplementation(() => {});
    mockStorageFrom.mockImplementation(() => createStorageChain('bucket'));
    mockFrom.mockImplementation((table) => createQueryChain(table));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('skips identical uploads and returns the existing version', async () => {
    setTableResponse('document_hub_versions', {
      maybeSingle: {
        data: {
          id: 'version-1',
          version: 1,
          content_hash: 'hash-same',
          storage_path: 'user-1/quotes/doc-1/v1-hash-same-file.pdf',
        },
        error: null,
      },
    });

    const { result } = renderHook(() => useGedHub({ disableAutoFetch: true }));
    const document = {
      sourceTable: 'quotes',
      sourceId: 'doc-1',
      currentVersion: 1,
      fileUrl: 'user-1/quotes/doc-1/v1-hash-same-file.pdf',
      raw: { company_id: 'company-1' },
    };
    const file = new File(['same-content'], 'file.pdf', { type: 'application/pdf' });

    await act(async () => {
      const uploadResult = await result.current.uploadDocumentFile(document, file);
      expect(uploadResult).toMatchObject({
        duplicated: true,
        version: 1,
        contentHash: 'hash-same',
      });
    });

    expect(mockStorageFrom).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalledWith('quotes');
  });

  it('creates a new version when the uploaded file differs', async () => {
    mockComputeBlobSha256Hex.mockResolvedValueOnce('hash-new');
    setTableResponse('document_hub_versions', {
      maybeSingle: {
        data: {
          id: 'version-1',
          version: 1,
          content_hash: 'hash-old',
          storage_path: 'user-1/quotes/doc-1/v1-hash-old-file.pdf',
        },
        error: null,
      },
      insert: {
        data: null,
        error: null,
      },
    });
    setTableResponse('quotes', {
      update: {
        data: null,
        error: null,
      },
    });

    const { result } = renderHook(() => useGedHub({ disableAutoFetch: true }));
    const document = {
      sourceTable: 'quotes',
      sourceId: 'doc-1',
      currentVersion: 1,
      fileUrl: 'user-1/quotes/doc-1/v1-hash-old-file.pdf',
      raw: { company_id: 'company-1' },
    };
    const file = new File(['different-content'], 'report final.pdf', { type: 'application/pdf' });

    let uploadResult;
    await act(async () => {
      uploadResult = await result.current.uploadDocumentFile(document, file);
    });

    expect(uploadResult).toMatchObject({
      duplicated: false,
      version: 2,
      contentHash: 'hash-new',
    });

    const storage = mockStorageFrom.mock.results[0].value;
    expect(storage.upload).toHaveBeenCalledTimes(1);
    expect(storage.upload.mock.calls[0][0]).toContain('/quotes/doc-1/v2-hash-new-report_final.pdf');

    const versionInsertPayload = mockFrom.mock.results.find(
      (entry) => entry.value.table === 'document_hub_versions' && entry.value.mode === 'insert'
    ).value.payload;
    expect(versionInsertPayload).toMatchObject({
      company_id: 'company-1',
      source_table: 'quotes',
      source_id: 'doc-1',
      version: 2,
      content_hash: 'hash-new',
      storage_bucket: 'quotes',
    });

    const updateChain = mockFrom.mock.results.find(
      (entry) => entry.value.table === 'quotes' && entry.value.mode === 'update'
    ).value;
    const updateCall = updateChain.update.mock.calls[0][0];
    expect(updateCall).toMatchObject({
      file_url: expect.stringContaining('/quotes/doc-1/v2-hash-new-report_final.pdf'),
      file_generated_at: expect.any(String),
    });
  });

  it('fetches documents with their current version metadata', async () => {
    setTableResponse('quotes', {
      select: {
        data: [
          {
            id: 'doc-1',
            quote_number: 'QT-001',
            company_id: 'company-1',
            created_at: '2026-03-27T09:00:00.000Z',
            file_url: 'user-1/quotes/doc-1/v2-hash-new-report_final.pdf',
          },
        ],
        error: null,
      },
    });
    setTableResponse('document_hub_versions', {
      select: {
        data: [
          {
            source_table: 'quotes',
            source_id: 'doc-1',
            version: 2,
            content_hash: 'hash-new',
          },
          {
            source_table: 'quotes',
            source_id: 'doc-1',
            version: 1,
            content_hash: 'hash-old',
          },
        ],
        error: null,
      },
    });

    const { result } = renderHook(() => useGedHub({ disableAutoFetch: true }));

    await act(async () => {
      await result.current.fetchDocuments();
    });

    expect(result.current.documents).toHaveLength(1);
    expect(result.current.documents[0]).toMatchObject({
      sourceTable: 'quotes',
      currentVersion: 2,
      versionCount: 2,
    });
  });

  it('loads retention policies and derives automatic retention for documents without explicit values', async () => {
    setTableResponse('quotes', {
      select: {
        data: [
          {
            id: 'doc-1',
            quote_number: 'QT-001',
            company_id: 'company-1',
            created_at: '2026-03-27T09:00:00.000Z',
            file_url: 'user-1/quotes/doc-1/v1-hash-file.pdf',
          },
        ],
        error: null,
      },
    });
    setTableResponse('document_hub_retention_policies', {
      select: {
        data: [
          {
            company_id: 'company-1',
            source_table: 'quotes',
            doc_category: 'all',
            retention_days: 45,
            is_active: true,
          },
        ],
        error: null,
      },
    });
    setTableResponse('document_hub_versions', {
      select: {
        data: [],
        error: null,
      },
    });

    const { result } = renderHook(() => useGedHub({ disableAutoFetch: true }));

    await act(async () => {
      await result.current.fetchDocuments();
    });

    expect(result.current.retentionPolicies).toHaveLength(1);
    expect(result.current.documents[0]).toMatchObject({
      sourceTable: 'quotes',
      retentionDays: 45,
      effectiveRetentionUntil: '2026-05-11',
      isRetentionAutomatic: true,
    });
  });

  it('loads workflow rows and enriches documents with workflow state', async () => {
    setTableResponse('quotes', {
      select: {
        data: [
          {
            id: 'doc-1',
            quote_number: 'QT-001',
            company_id: 'company-1',
            created_at: '2026-03-27T09:00:00.000Z',
            file_url: 'user-1/quotes/doc-1/v1-hash-file.pdf',
          },
        ],
        error: null,
      },
    });
    setTableResponse('document_hub_workflows', {
      select: {
        data: [
          {
            company_id: 'company-1',
            source_table: 'quotes',
            source_id: 'doc-1',
            workflow_status: 'approved',
            approved_by: 'user-1',
            approved_at: '2026-03-27T11:00:00.000Z',
            comment: 'validé',
          },
        ],
        error: null,
      },
    });
    setTableResponse('document_hub_versions', {
      select: {
        data: [],
        error: null,
      },
    });
    setTableResponse('document_hub_metadata', {
      select: {
        data: [],
        error: null,
      },
    });

    const { result } = renderHook(() => useGedHub({ disableAutoFetch: true }));

    await act(async () => {
      await result.current.fetchDocuments();
    });

    expect(result.current.workflowRows).toHaveLength(1);
    expect(result.current.documents[0]).toMatchObject({
      sourceTable: 'quotes',
      workflowStatus: 'approved',
      workflowApprovedBy: 'user-1',
      workflowComment: 'validé',
      hasWorkflow: true,
    });
  });

  it('applies the automatic retention policy when saving metadata without an explicit retention date', async () => {
    setTableResponse('document_hub_retention_policies', {
      select: {
        data: [
          {
            company_id: 'company-1',
            source_table: 'quotes',
            doc_category: 'all',
            retention_days: 45,
            is_active: true,
          },
        ],
        error: null,
      },
    });

    const upsertChain = createQueryChain('document_hub_metadata');
    setTableResponse('document_hub_metadata', {
      upsert: {
        data: null,
        error: null,
      },
    });
    mockFrom.mockImplementation((table) => {
      if (table === 'document_hub_metadata') return upsertChain;
      return createQueryChain(table);
    });

    const { result } = renderHook(() => useGedHub({ disableAutoFetch: true }));

    await act(async () => {
      await result.current.fetchDocuments();
    });

    await act(async () => {
      await result.current.upsertMetadata(
        {
          sourceTable: 'quotes',
          sourceId: 'doc-1',
          createdAt: '2026-03-27T09:00:00.000Z',
          docCategory: 'general',
          retentionUntil: null,
          raw: { company_id: 'company-1' },
        },
        {
          notes: 'hello',
        }
      );
    });

    expect(upsertChain.upsert).toHaveBeenCalledTimes(1);
    expect(upsertChain.upsert.mock.calls[0][0]).toMatchObject({
      retention_until: '2026-05-11',
      doc_category: 'general',
      company_id: 'company-1',
      source_table: 'quotes',
      source_id: 'doc-1',
    });
  });

  it('saves a company-scoped retention policy with normalized payload', async () => {
    const upsertChain = createQueryChain('document_hub_retention_policies');
    setTableResponse('document_hub_retention_policies', {
      upsert: {
        data: [
          {
            company_id: 'company-1',
            source_table: 'quotes',
            doc_category: 'all',
            retention_days: 60,
            is_active: true,
          },
        ],
        error: null,
      },
    });
    mockFrom.mockImplementation((table) => {
      if (table === 'document_hub_retention_policies') return upsertChain;
      return createQueryChain(table);
    });

    const { result } = renderHook(() => useGedHub({ disableAutoFetch: true }));

    await act(async () => {
      await result.current.saveRetentionPolicy({
        sourceTable: 'quotes',
        docCategory: 'all',
        retentionDays: '60',
        is_active: true,
      });
    });

    expect(upsertChain.upsert).toHaveBeenCalledTimes(1);
    expect(upsertChain.upsert.mock.calls[0][0]).toMatchObject({
      company_id: 'company-1',
      source_table: 'quotes',
      doc_category: 'all',
      retention_days: 60,
      is_active: true,
      updated_by: 'user-1',
    });
  });

  it('persists workflow actions with company-scoped transitions', async () => {
    setTableResponse('quotes', {
      select: {
        data: [
          {
            id: 'doc-1',
            quote_number: 'QT-001',
            company_id: 'company-1',
            created_at: '2026-03-27T09:00:00.000Z',
            file_url: 'user-1/quotes/doc-1/v1-hash-file.pdf',
          },
        ],
        error: null,
      },
    });
    setTableResponse('document_hub_workflows', {
      select: {
        data: [],
        error: null,
      },
      upsert: {
        data: null,
        error: null,
      },
    });
    setTableResponse('document_hub_versions', {
      select: {
        data: [],
        error: null,
      },
    });
    setTableResponse('document_hub_metadata', {
      select: {
        data: [],
        error: null,
      },
    });

    const workflowChain = createQueryChain('document_hub_workflows');
    mockFrom.mockImplementation((table) => {
      if (table === 'document_hub_workflows') return workflowChain;
      return createQueryChain(table);
    });

    const { result } = renderHook(() => useGedHub({ disableAutoFetch: true }));
    const document = {
      sourceTable: 'quotes',
      sourceId: 'doc-1',
      workflowComment: 'note initiale',
      workflowRequestedBy: 'user-old',
      workflowRequestedAt: '2026-03-26T09:00:00.000Z',
      workflowApprovedBy: 'user-old',
      workflowApprovedAt: '2026-03-26T10:00:00.000Z',
      workflowRejectedBy: null,
      workflowRejectedAt: null,
      workflowSignedBy: null,
      workflowSignedAt: null,
      raw: { company_id: 'company-1' },
    };

    await act(async () => {
      await result.current.requestDocumentWorkflow(document, { comment: 'Validation demandee' });
      await result.current.approveDocumentWorkflow(document, { comment: 'OK' });
      await result.current.rejectDocumentWorkflow(document, { comment: 'Non conforme' });
      await result.current.signDocumentWorkflow(document, { comment: 'Signe' });
    });

    const payloads = workflowChain.upsert.mock.calls.map(([payload]) => payload.workflow_status);
    expect(payloads).toEqual(['pending_review', 'approved', 'rejected', 'signed']);
    expect(workflowChain.upsert.mock.calls[0][0]).toMatchObject({
      company_id: 'company-1',
      source_table: 'quotes',
      source_id: 'doc-1',
      requested_by: 'user-1',
      requested_at: expect.any(String),
    });
    expect(workflowChain.upsert.mock.calls[1][0]).toMatchObject({
      approved_by: 'user-1',
      approved_at: expect.any(String),
      rejected_by: null,
      signed_by: null,
    });
    expect(workflowChain.upsert.mock.calls[2][0]).toMatchObject({
      rejected_by: 'user-1',
      rejected_at: expect.any(String),
      approved_by: null,
      signed_by: null,
    });
    expect(workflowChain.upsert.mock.calls[3][0]).toMatchObject({
      signed_by: 'user-1',
      signed_at: expect.any(String),
    });
  });

  it('resolves document access URLs for direct links and signed storage paths', async () => {
    const { result } = renderHook(() => useGedHub({ disableAutoFetch: true }));

    const direct = await result.current.getDocumentAccessUrl({
      sourceTable: 'quotes',
      fileUrl: 'https://cdn.example.com/file.pdf',
    });
    expect(direct).toBe('https://cdn.example.com/file.pdf');

    const signed = await result.current.getDocumentAccessUrl({
      sourceTable: 'quotes',
      fileUrl: 'user-1/quotes/doc-1/v1-file.pdf',
    });
    expect(signed).toBe('bucket/signed');

    const missing = await result.current.getDocumentAccessUrl({
      sourceTable: 'unknown',
      fileUrl: 'x',
    });
    expect(missing).toBeNull();
  });

  it('generates PDFs for all supported source tables and reports unsupported types', async () => {
    vi.useFakeTimers();

    setTableResponse('invoices', { single: { data: { id: 'inv-1' }, error: null } });
    setTableResponse('quotes', { single: { data: { id: 'qt-1' }, error: null } });
    setTableResponse('credit_notes', { single: { data: { id: 'cn-1' }, error: null } });
    setTableResponse('delivery_notes', { single: { data: { id: 'dn-1' }, error: null } });
    setTableResponse('purchase_orders', { single: { data: { id: 'po-1' }, error: null } });
    setTableResponse('supplier_invoices', {
      single: { data: { id: 'si-1', supplier: { id: 'sup-1' } }, error: null },
    });

    const { result } = renderHook(() => useGedHub({ disableAutoFetch: true }));

    await act(async () => {
      await result.current.generatePdf({ sourceTable: 'invoices', sourceId: 'inv-1' });
      await result.current.generatePdf({ sourceTable: 'quotes', sourceId: 'qt-1' });
      await result.current.generatePdf({ sourceTable: 'credit_notes', sourceId: 'cn-1' });
      await result.current.generatePdf({ sourceTable: 'delivery_notes', sourceId: 'dn-1' });
      await result.current.generatePdf({ sourceTable: 'purchase_orders', sourceId: 'po-1' });
      await result.current.generatePdf({ sourceTable: 'supplier_invoices', sourceId: 'si-1' });
      await result.current.generatePdf({ sourceTable: 'unknown', sourceId: 'x-1' });
    });

    expect(mockExportInvoicePDF).toHaveBeenCalledTimes(1);
    expect(mockExportQuotePDF).toHaveBeenCalledTimes(1);
    expect(mockExportCreditNotePDF).toHaveBeenCalledTimes(1);
    expect(mockExportDeliveryNotePDF).toHaveBeenCalledTimes(1);
    expect(mockExportPurchaseOrderPDF).toHaveBeenCalledTimes(1);
    expect(mockExportSupplierInvoicePDF).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Erreur generation',
        variant: 'destructive',
      })
    );

    vi.runAllTimers();
    vi.useRealTimers();
  });

  it('handles metadata upsert fallback when metadata table is unavailable', async () => {
    setTableResponse('document_hub_metadata', {
      upsert: {
        data: null,
        error: { code: 'PGRST205' },
      },
    });

    const metadataChain = createQueryChain('document_hub_metadata');
    mockFrom.mockImplementation((table) => {
      if (table === 'document_hub_metadata') return metadataChain;
      return createQueryChain(table);
    });

    const { result } = renderHook(() => useGedHub({ disableAutoFetch: true }));

    await act(async () => {
      await result.current.upsertMetadata(
        {
          sourceTable: 'quotes',
          sourceId: 'doc-1',
          createdAt: '2026-03-27T09:00:00.000Z',
          raw: { company_id: 'company-1' },
        },
        { notes: 'note' }
      );
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Metadonnees indisponibles',
        variant: 'destructive',
      })
    );
  });

  it('creates drafts for all supported source tables with scoped payloads', async () => {
    const createdRows = {
      invoices: { id: 'inv-1' },
      quotes: { id: 'qt-1' },
      credit_notes: { id: 'cn-1' },
      delivery_notes: { id: 'dn-1' },
      purchase_orders: { id: 'po-1' },
      supplier_invoices: { id: 'si-1' },
    };

    for (const [table, row] of Object.entries(createdRows)) {
      setTableResponse(table, {
        single: { data: row, error: null },
      });
    }

    const { result } = renderHook(() => useGedHub({ disableAutoFetch: true }));

    await act(async () => {
      await result.current.createDocumentDraft(
        {
          sourceTable: 'invoices',
          clientId: 'client-1',
          amount: 100,
          date: '2026-04-01',
        },
        { skipRefresh: true }
      );
      await result.current.createDocumentDraft(
        {
          sourceTable: 'quotes',
          clientId: 'client-1',
          amount: 200,
          date: '2026-04-01',
        },
        { skipRefresh: true }
      );
      await result.current.createDocumentDraft(
        {
          sourceTable: 'credit_notes',
          clientId: 'client-1',
          amount: 50,
          date: '2026-04-01',
        },
        { skipRefresh: true }
      );
      await result.current.createDocumentDraft(
        {
          sourceTable: 'delivery_notes',
          clientId: 'client-1',
          date: '2026-04-01',
        },
        { skipRefresh: true }
      );
      await result.current.createDocumentDraft(
        {
          sourceTable: 'purchase_orders',
          clientId: 'client-1',
          amount: 400,
          date: '2026-04-01',
        },
        { skipRefresh: true }
      );
      await result.current.createDocumentDraft(
        {
          sourceTable: 'supplier_invoices',
          supplierId: 'supplier-1',
          amount: 300,
          date: '2026-04-01',
        },
        { skipRefresh: true }
      );
    });

    const invoiceInsert = mockFrom.mock.results.find(
      (entry) => entry.value.table === 'invoices' && entry.value.payload?.client_id === 'client-1'
    )?.value?.payload;
    expect(invoiceInsert).toMatchObject({
      company_id: 'company-1',
      client_id: 'client-1',
      total_ttc: 100,
    });

    const supplierInsert = mockFrom.mock.results.find(
      (entry) => entry.value.table === 'supplier_invoices' && entry.value.payload?.supplier_id === 'supplier-1'
    )?.value?.payload;
    expect(supplierInsert).toMatchObject({
      company_id: 'company-1',
      supplier_id: 'supplier-1',
      total_ttc: 300,
    });
  });

  it('validates draft creation prerequisites and surfaces explicit errors', async () => {
    const { result } = renderHook(() => useGedHub({ disableAutoFetch: true }));

    await expect(result.current.createDocumentDraft({}, { skipRefresh: true })).rejects.toThrow(
      'Type de document invalide.'
    );
    await expect(
      result.current.createDocumentDraft(
        {
          sourceTable: 'invoices',
          amount: 100,
        },
        { skipRefresh: true }
      )
    ).rejects.toThrow('Veuillez selectionner un client.');
    await expect(
      result.current.createDocumentDraft(
        {
          sourceTable: 'supplier_invoices',
          amount: 100,
        },
        { skipRefresh: true }
      )
    ).rejects.toThrow('Veuillez selectionner un fournisseur.');
  });

  it('creates and uploads a document in one flow', async () => {
    setTableResponse('quotes', {
      single: { data: { id: 'qt-200', quote_number: 'QT-200', company_id: 'company-1' }, error: null },
      update: { data: null, error: null },
    });
    setTableResponse('document_hub_versions', {
      maybeSingle: { data: null, error: null },
      insert: { data: null, error: null },
    });

    const { result } = renderHook(() => useGedHub({ disableAutoFetch: true }));
    const file = new File(['pdf-content'], 'quote.pdf', { type: 'application/pdf' });

    await act(async () => {
      const created = await result.current.createAndUploadDocument(
        {
          sourceTable: 'quotes',
          clientId: 'client-1',
          amount: 450,
          date: '2026-04-01',
        },
        file
      );
      expect(created.id).toBe('qt-200');
    });

    expect(mockStorageFrom).toHaveBeenCalled();
    const versionInsert = mockFrom.mock.results.find(
      (entry) => entry.value.table === 'document_hub_versions' && entry.value.mode === 'insert'
    );
    expect(versionInsert).toBeTruthy();
  });

  it('extracts supplier invoice data and inserts mapped supplier line items', async () => {
    mockComputeBlobSha256Hex.mockResolvedValue('hash-supplier');
    mockExtractInvoiceData.mockResolvedValue({
      invoice_number: 'SUP-001',
      invoice_date: '2026-04-02',
      due_date: '2026-05-02',
      total_ht: 100,
      total_tva: 20,
      total_ttc: 120,
      tva_rate: 20,
      line_items: [{ description: 'Office Chair', quantity: 2, unit_price: 50, total: 100, vat_rate: 20 }],
    });
    mockLinkLineItemsToProducts.mockReturnValue([
      { description: 'Office Chair', quantity: 2, unit_price: 50, total: 100, vat_rate: 20, user_product_id: 'p-1' },
    ]);

    setTableResponse('document_hub_versions', {
      maybeSingle: { data: null, error: null },
      insert: { data: null, error: null },
    });
    setTableResponse('supplier_invoices', {
      single: {
        data: {
          id: 'si-10',
          company_id: 'company-1',
          supplier_id: 'supplier-1',
          status: 'pending',
          payment_status: 'pending',
          approval_status: 'pending',
          total_ht: 0,
          vat_amount: 0,
          vat_rate: 0,
          total_ttc: 0,
          total_amount: 0,
        },
        error: null,
      },
      update: { data: null, error: null },
    });
    setTableResponse('supplier_invoice_line_items', {
      select: { count: 0, error: null },
      insert: { data: null, error: null },
    });
    setTableResponse('products', {
      select: {
        data: [{ id: 'p-1', product_name: 'Office Chair', supplier_id: 'supplier-1', is_active: true }],
        error: null,
      },
    });

    const { result } = renderHook(() => useGedHub({ disableAutoFetch: true }));
    const file = new File(['supplier pdf'], 'supplier.pdf', { type: 'application/pdf' });

    await act(async () => {
      const upload = await result.current.uploadDocumentFile(
        {
          sourceTable: 'supplier_invoices',
          sourceId: 'si-10',
          currentVersion: 1,
          raw: { company_id: 'company-1' },
        },
        file,
        { skipRefresh: true }
      );
      expect(upload.duplicated).toBe(false);
    });

    expect(mockExtractInvoiceData).toHaveBeenCalled();
    expect(mockLinkLineItemsToProducts).toHaveBeenCalled();
    const inserted = mockFrom.mock.results.find(
      (entry) => entry.value.table === 'supplier_invoice_line_items' && entry.value.mode === 'insert'
    )?.value?.payload;
    expect(inserted?.[0]).toMatchObject({
      invoice_id: 'si-10',
      user_product_id: 'p-1',
      description: 'Office Chair',
    });
  });

  it('extracts sales invoice data and inserts invoice items for accounting docs', async () => {
    mockComputeBlobSha256Hex.mockResolvedValue('hash-invoice');
    mockExtractInvoiceData.mockResolvedValue({
      invoice_number: 'INV-900',
      invoice_date: '2026-04-03',
      due_date: '2026-05-03',
      total_ht: 200,
      total_tva: 40,
      total_ttc: 240,
      tva_rate: 20,
      line_items: [{ description: 'Consulting', quantity: 2, unit_price: 100, total: 200 }],
    });

    setTableResponse('document_hub_versions', {
      maybeSingle: { data: null, error: null },
      insert: { data: null, error: null },
    });
    setTableResponse('invoices', {
      single: {
        data: {
          id: 'inv-10',
          company_id: 'company-1',
          status: 'draft',
          payment_status: 'unpaid',
          total_ht: 0,
          total_ttc: 0,
          tax_rate: 0,
        },
        error: null,
      },
      update: { data: null, error: null },
    });
    setTableResponse('invoice_items', {
      select: { count: 0, error: null },
      insert: { data: null, error: null },
    });

    const { result } = renderHook(() => useGedHub({ disableAutoFetch: true }));
    const file = new File(['invoice pdf'], 'invoice.pdf', { type: 'application/pdf' });

    await act(async () => {
      const upload = await result.current.uploadDocumentFile(
        {
          sourceTable: 'invoices',
          sourceId: 'inv-10',
          currentVersion: 1,
          raw: { company_id: 'company-1' },
        },
        file,
        { skipRefresh: true }
      );
      expect(upload.duplicated).toBe(false);
    });

    expect(mockExtractInvoiceData).toHaveBeenCalled();
    const invoiceItemInsert = mockFrom.mock.results.find(
      (entry) => entry.value.table === 'invoice_items' && entry.value.mode === 'insert'
    )?.value?.payload;
    expect(invoiceItemInsert?.[0]).toMatchObject({
      invoice_id: 'inv-10',
      description: 'Consulting',
      item_type: 'manual',
    });
  });
});
