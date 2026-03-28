import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { mockUseGedHub } = vi.hoisted(() => ({
  mockUseGedHub: vi.fn(),
}));

vi.mock('@/hooks/useGedHub', () => ({
  useGedHub: mockUseGedHub,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key, fallback) => fallback || _key,
  }),
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('react-helmet', () => ({
  Helmet: ({ children }) => <div>{children}</div>,
}));

import GedHubPage from '@/pages/GedHubPage';

describe('GedHubPage version display', () => {
  it('renders the version and workflow columns for GED documents', () => {
    mockUseGedHub.mockReturnValue({
      documents: [
        {
          sourceTable: 'quotes',
          sourceId: 'doc-1',
          number: 'QT-001',
          sourceLabel: 'Devis',
          counterpartyName: 'Acme',
          status: 'draft',
          amount: 120,
          currency: 'EUR',
          tags: ['alpha'],
          createdAt: '2026-03-27T09:00:00.000Z',
          currentVersion: 2,
          versionCount: 2,
          effectiveRetentionUntil: '2026-05-11',
          isRetentionAutomatic: true,
          workflowStatus: 'approved',
          workflowApprovedAt: '2026-03-27T10:00:00.000Z',
          workflowComment: 'validé',
          fileUrl: 'user-1/quotes/doc-1/v2-hash-file.pdf',
        },
      ],
      loading: false,
      generatingKey: null,
      mutating: false,
      clients: [],
      suppliers: [],
      counterpartiesLoading: false,
      retentionPolicies: [
        {
          company_id: 'company-1',
          source_table: 'quotes',
          doc_category: 'all',
          retention_days: 45,
          is_active: true,
        },
      ],
      retentionPoliciesLoading: false,
      workflowRows: [
        {
          company_id: 'company-1',
          source_table: 'quotes',
          source_id: 'doc-1',
          workflow_status: 'approved',
        },
      ],
      fetchDocuments: vi.fn(),
      createDocumentDraft: vi.fn(),
      createAndUploadDocument: vi.fn(),
      uploadDocumentFile: vi.fn(),
      upsertMetadata: vi.fn(),
      saveRetentionPolicy: vi.fn(),
      requestDocumentWorkflow: vi.fn(),
      approveDocumentWorkflow: vi.fn(),
      rejectDocumentWorkflow: vi.fn(),
      signDocumentWorkflow: vi.fn(),
      getDocumentAccessUrl: vi.fn(),
      generatePdf: vi.fn(),
      sourceConfig: {},
    });

    render(<GedHubPage />);

    expect(screen.getByText('Politiques de retention automatiques')).toBeInTheDocument();
    expect(screen.getByText('Nouvelle politique')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
    expect(screen.getByText('Automatique')).toBeInTheDocument();
    expect(screen.getByText('Version')).toBeInTheDocument();
    expect(screen.getByText('v2')).toBeInTheDocument();
    expect(screen.getByText('2 versions')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Workflow' })).toBeInTheDocument();
    expect(screen.getByText('Approuvé')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Workflow$/i })).toBeInTheDocument();
    expect(screen.getAllByText('2026-05-11').length).toBeGreaterThanOrEqual(2);
  });

  it('opens the retention policy dialog from the GED HUB panel', () => {
    mockUseGedHub.mockReturnValue({
      documents: [],
      loading: false,
      generatingKey: null,
      mutating: false,
      clients: [],
      suppliers: [],
      counterpartiesLoading: false,
      retentionPolicies: [],
      retentionPoliciesLoading: false,
      workflowRows: [],
      fetchDocuments: vi.fn(),
      createDocumentDraft: vi.fn(),
      createAndUploadDocument: vi.fn(),
      uploadDocumentFile: vi.fn(),
      upsertMetadata: vi.fn(),
      saveRetentionPolicy: vi.fn(),
      requestDocumentWorkflow: vi.fn(),
      approveDocumentWorkflow: vi.fn(),
      rejectDocumentWorkflow: vi.fn(),
      signDocumentWorkflow: vi.fn(),
      getDocumentAccessUrl: vi.fn(),
      generatePdf: vi.fn(),
      sourceConfig: {},
    });

    render(<GedHubPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Nouvelle politique' }));

    expect(screen.getByText('Nouvelle politique de retention')).toBeInTheDocument();
    expect(screen.getByText('Module GED')).toBeInTheDocument();
    expect(screen.getByText('Retention en jours')).toBeInTheDocument();
  });

  it('opens the GED workflow dialog and triggers the request action', () => {
    const requestDocumentWorkflow = vi.fn();
    mockUseGedHub.mockReturnValue({
      documents: [
        {
          sourceTable: 'quotes',
          sourceId: 'doc-1',
          number: 'QT-001',
          sourceLabel: 'Devis',
          counterpartyName: 'Acme',
          status: 'draft',
          amount: 120,
          currency: 'EUR',
          tags: ['alpha'],
          createdAt: '2026-03-27T09:00:00.000Z',
          currentVersion: 2,
          versionCount: 2,
          effectiveRetentionUntil: '2026-05-11',
          isRetentionAutomatic: true,
          workflowStatus: 'pending_review',
          workflowRequestedAt: '2026-03-27T10:00:00.000Z',
          workflowComment: 'Veuillez valider',
          fileUrl: 'user-1/quotes/doc-1/v2-hash-file.pdf',
        },
      ],
      loading: false,
      generatingKey: null,
      mutating: false,
      clients: [],
      suppliers: [],
      counterpartiesLoading: false,
      retentionPolicies: [],
      retentionPoliciesLoading: false,
      workflowRows: [
        {
          company_id: 'company-1',
          source_table: 'quotes',
          source_id: 'doc-1',
          workflow_status: 'pending_review',
        },
      ],
      fetchDocuments: vi.fn(),
      createDocumentDraft: vi.fn(),
      createAndUploadDocument: vi.fn(),
      uploadDocumentFile: vi.fn(),
      upsertMetadata: vi.fn(),
      saveRetentionPolicy: vi.fn(),
      requestDocumentWorkflow,
      approveDocumentWorkflow: vi.fn(),
      rejectDocumentWorkflow: vi.fn(),
      signDocumentWorkflow: vi.fn(),
      getDocumentAccessUrl: vi.fn(),
      generatePdf: vi.fn(),
      sourceConfig: {},
    });

    render(<GedHubPage />);

    fireEvent.click(screen.getByRole('button', { name: /^Workflow$/i }));

    expect(screen.getByText('Workflow GED - QT-001')).toBeInTheDocument();
    expect(screen.getByText('Demander validation')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Demander validation' }));

    expect(requestDocumentWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceTable: 'quotes',
        sourceId: 'doc-1',
      }),
      { comment: 'Veuillez valider' }
    );
  });
});
