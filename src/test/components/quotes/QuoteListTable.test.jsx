import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
  }),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
  },
}));

vi.mock('@/components/PaginationControls', () => ({
  default: () => <div data-testid="pagination-controls" />,
}));

vi.mock('@/hooks/useCreditsGuard', () => ({
  CREDIT_COSTS: {
    PDF_QUOTE: 1,
    EXPORT_HTML: 1,
  },
}));

vi.mock('@/utils/calculations', () => ({
  formatCurrency: (value) => `${Number(value || 0).toFixed(2)} EUR`,
}));

import QuoteListTable from '@/components/quotes/QuoteListTable';

const basePagination = {
  currentPage: 1,
  totalPages: 1,
  totalCount: 1,
  pageSize: 20,
  pageSizeOptions: [10, 20, 50],
  hasNextPage: false,
  hasPrevPage: false,
  nextPage: vi.fn(),
  prevPage: vi.fn(),
  goToPage: vi.fn(),
  changePageSize: vi.fn(),
};

const baseProps = {
  pagination: basePagination,
  getQuoteClient: (quote) => quote.client,
  onViewQuote: vi.fn(),
  onExportPDF: vi.fn(),
  onExportHTML: vi.fn(),
  onDelete: vi.fn(),
  onRequestSignature: vi.fn(),
  onCopySignatureLink: vi.fn(),
  onOpenDialog: vi.fn(),
  onConvertToContract: vi.fn(),
  onMarkAsLost: vi.fn(),
};

describe('QuoteListTable', () => {
  it('shows the document type and conversion action for quote documents', () => {
    render(
      <QuoteListTable
        filteredQuotes={[
          {
            id: 'quote-1',
            quote_number: 'Q-2027-001',
            document_type: 'quote',
            client_id: 'client-1',
            client: { company_name: 'Acme SA' },
            date: '2027-03-27',
            total_ttc: 1200,
            status: 'sent',
            signature_status: 'unsigned',
          },
        ]}
        paginatedQuotes={[
          {
            id: 'quote-1',
            quote_number: 'Q-2027-001',
            document_type: 'quote',
            client_id: 'client-1',
            client: { company_name: 'Acme SA' },
            date: '2027-03-27',
            total_ttc: 1200,
            status: 'sent',
            signature_status: 'unsigned',
          },
        ]}
        loading={false}
        {...baseProps}
      />
    );

    expect(screen.getByText('quotesPage.documentTypeQuote')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'quotesPage.convertToContract' })).toBeTruthy();
  });

  it('keeps the contract badge but hides the conversion action for contract documents', () => {
    render(
      <QuoteListTable
        filteredQuotes={[
          {
            id: 'quote-2',
            quote_number: 'Q-2027-002',
            document_type: 'contract',
            client_id: 'client-2',
            client: { company_name: 'Beta SARL' },
            date: '2027-03-28',
            total_ttc: 900,
            status: 'sent',
            signature_status: 'unsigned',
          },
        ]}
        paginatedQuotes={[
          {
            id: 'quote-2',
            quote_number: 'Q-2027-002',
            document_type: 'contract',
            client_id: 'client-2',
            client: { company_name: 'Beta SARL' },
            date: '2027-03-28',
            total_ttc: 900,
            status: 'sent',
            signature_status: 'unsigned',
          },
        ]}
        loading={false}
        {...baseProps}
      />
    );

    expect(screen.getByText('quotesPage.documentTypeContract')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'quotesPage.convertToContract' })).toBeNull();
  });

  it('shows loss reason and next best action labels for rejected quotes', () => {
    render(
      <QuoteListTable
        filteredQuotes={[
          {
            id: 'quote-3',
            quote_number: 'Q-2027-003',
            document_type: 'quote',
            client_id: 'client-3',
            client: { company_name: 'Gamma BV' },
            date: '2027-03-29',
            total_ttc: 1500,
            status: 'rejected',
            signature_status: 'rejected',
            loss_reason_category: 'budget',
            loss_reason_details: 'Prix juge trop eleve',
            next_best_action: 'offer_discount',
          },
        ]}
        paginatedQuotes={[
          {
            id: 'quote-3',
            quote_number: 'Q-2027-003',
            document_type: 'quote',
            client_id: 'client-3',
            client: { company_name: 'Gamma BV' },
            date: '2027-03-29',
            total_ttc: 1500,
            status: 'rejected',
            signature_status: 'rejected',
            loss_reason_category: 'budget',
            loss_reason_details: 'Prix juge trop eleve',
            next_best_action: 'offer_discount',
          },
        ]}
        loading={false}
        {...baseProps}
      />
    );

    expect(screen.getByText('quotesPage.lossReasonCategories.budget')).toBeTruthy();
    expect(screen.getByText('offer_discount')).toBeTruthy();
  });

  it('exposes mark-as-lost action for active quotes', () => {
    const onMarkAsLost = vi.fn();
    render(
      <QuoteListTable
        filteredQuotes={[
          {
            id: 'quote-4',
            quote_number: 'Q-2027-004',
            document_type: 'quote',
            client_id: 'client-4',
            client: { company_name: 'Delta SRL' },
            date: '2027-03-30',
            total_ttc: 1800,
            status: 'sent',
            signature_status: 'unsigned',
          },
        ]}
        paginatedQuotes={[
          {
            id: 'quote-4',
            quote_number: 'Q-2027-004',
            document_type: 'quote',
            client_id: 'client-4',
            client: { company_name: 'Delta SRL' },
            date: '2027-03-30',
            total_ttc: 1800,
            status: 'sent',
            signature_status: 'unsigned',
          },
        ]}
        loading={false}
        {...baseProps}
        onMarkAsLost={onMarkAsLost}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'quotesPage.markAsLost' }));
    expect(onMarkAsLost).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'quote-4',
      })
    );
  });
});
