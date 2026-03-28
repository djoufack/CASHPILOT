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
  exportCreditNotePDF: vi.fn(),
  exportDeliveryNotePDF: vi.fn(),
  exportInvoicePDF: vi.fn(),
  exportPurchaseOrderPDF: vi.fn(),
  exportQuotePDF: vi.fn(),
}));

vi.mock('@/services/exportSupplierRecords', () => ({
  exportSupplierInvoicePDF: vi.fn(),
}));

vi.mock('@/services/invoiceExtractionService', () => ({
  extractInvoiceData: vi.fn(),
}));

vi.mock('@/services/supplierInvoiceLineItemLinking', () => ({
  linkLineItemsToProducts: vi.fn(),
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
});
