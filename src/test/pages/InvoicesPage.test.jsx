import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks – hooks
// ---------------------------------------------------------------------------

const mockDeleteInvoice = vi.fn();
const mockUpdateInvoiceStatus = vi.fn();
const mockGetInvoiceItems = vi.fn().mockReturnValue([]);
const mockFetchInvoices = vi.fn();

vi.mock('@/hooks/useInvoices', () => ({
  useInvoices: () => ({
    invoices: [
      {
        id: 'inv-1',
        invoice_number: 'INV-001',
        client_id: 'client-1',
        date: '2026-01-15',
        due_date: '2026-02-15',
        total_ht: 1000,
        total_ttc: 1200,
        status: 'sent',
        payment_status: 'unpaid',
        created_at: '2026-01-15T10:00:00Z',
      },
      {
        id: 'inv-2',
        invoice_number: 'INV-002',
        client_id: 'client-2',
        date: '2026-02-01',
        due_date: '2026-03-01',
        total_ht: 2500,
        total_ttc: 3000,
        status: 'paid',
        payment_status: 'paid',
        created_at: '2026-02-01T10:00:00Z',
      },
      {
        id: 'inv-3',
        invoice_number: 'INV-003',
        client_id: 'client-1',
        date: '2026-03-01',
        due_date: '2026-01-01',
        total_ht: 500,
        total_ttc: 600,
        status: 'sent',
        payment_status: 'unpaid',
        created_at: '2026-03-01T10:00:00Z',
      },
    ],
    deleteInvoice: mockDeleteInvoice,
    updateInvoiceStatus: mockUpdateInvoiceStatus,
    getInvoiceItems: mockGetInvoiceItems,
    fetchInvoices: mockFetchInvoices,
  }),
}));

vi.mock('@/hooks/useClients', () => ({
  useClients: () => ({
    clients: [
      { id: 'client-1', company_name: 'Acme Corp', email: 'contact@acme.com', preferred_currency: 'EUR' },
      { id: 'client-2', company_name: 'Beta Industries', email: 'info@beta.com', preferred_currency: 'USD' },
    ],
  }),
}));

vi.mock('@/hooks/useCompany', () => ({
  useCompany: () => ({
    company: {
      id: 'company-1',
      company_name: 'Test Company',
      accounting_currency: 'EUR',
    },
  }),
}));

vi.mock('@/hooks/useInvoiceSettings', () => ({
  useInvoiceSettings: () => ({
    settings: { logo_url: null, payment_terms: 'Net 30' },
  }),
}));

vi.mock('@/hooks/useCreditsGuard', () => ({
  useCreditsGuard: () => ({
    guardedAction: (_cost, _label, action) => action(),
    modalProps: { open: false, onClose: vi.fn() },
  }),
  CREDIT_COSTS: {
    PDF_INVOICE: 1,
    EXPORT_HTML: 1,
    PDF_REPORT: 1,
  },
}));

vi.mock('@/hooks/useEmailService', () => ({
  useEmailService: () => ({
    sendInvoiceEmail: vi.fn(),
    sending: false,
  }),
}));

vi.mock('@/hooks/usePagination', () => ({
  usePagination: () => ({
    from: 0,
    to: 19,
    page: 1,
    pageSize: 20,
    totalCount: 3,
    setTotalCount: vi.fn(),
    totalPages: 1,
    hasPrev: false,
    hasNext: false,
    prevPage: vi.fn(),
    nextPage: vi.fn(),
  }),
  default: () => ({
    from: 0,
    to: 19,
    page: 1,
    pageSize: 20,
    totalCount: 3,
    setTotalCount: vi.fn(),
    totalPages: 1,
    hasPrev: false,
    hasNext: false,
    prevPage: vi.fn(),
    nextPage: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Mocks – UI/services
// ---------------------------------------------------------------------------

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/services/exportDocuments', () => ({
  exportInvoicePDF: vi.fn(),
  exportInvoiceHTML: vi.fn(),
}));

vi.mock('@/services/exportFacturX', () => ({
  exportFacturX: vi.fn(),
  validateForFacturX: vi.fn().mockReturnValue({ isValid: true, errors: [] }),
}));

vi.mock('@/services/errorTracking', () => ({
  captureError: vi.fn(),
}));

vi.mock('@/utils/invoiceTax', () => ({
  resolveInvoiceTaxAmount: (inv) => (inv.total_ttc || 0) - (inv.total_ht || 0),
}));

vi.mock('react-helmet', () => ({
  Helmet: ({ children }) => <div data-testid="helmet">{children}</div>,
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...filterMotionProps(props)}>{children}</div>,
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

function filterMotionProps(props) {
  const {
    initial: _initial,
    animate: _animate,
    exit: _exit,
    transition: _transition,
    whileHover: _whileHover,
    whileTap: _whileTap,
    variants: _variants,
    ...rest
  } = props;
  return rest;
}

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...rest }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/invoices' }),
}));

vi.mock('@/components/CreditsGuardModal', () => ({
  default: () => null,
}));

vi.mock('@/components/ExportButton', () => ({
  default: () => <button data-testid="export-button">Export</button>,
}));

vi.mock('@/components/InvoiceGenerator', () => ({
  default: ({ onSuccess: _onSuccess }) => <div data-testid="invoice-generator">Invoice Generator</div>,
}));

vi.mock('@/components/QuickInvoice', () => ({
  default: ({ onSuccess: _onSuccess }) => <div data-testid="quick-invoice">Quick Invoice</div>,
}));

vi.mock('@/components/GenericCalendarView', () => ({
  default: () => <div data-testid="calendar-view">Calendar View</div>,
}));

vi.mock('@/components/GenericAgendaView', () => ({
  default: () => <div data-testid="agenda-view">Agenda View</div>,
}));

vi.mock('@/components/GenericKanbanView', () => ({
  default: () => <div data-testid="kanban-view">Kanban View</div>,
}));

vi.mock('@/components/invoices/InvoiceListTable', () => ({
  default: ({ data }) => (
    <div data-testid="invoice-list-table">
      {data.paginatedInvoices.map((inv) => (
        <div key={inv.id} data-testid={`invoice-row-${inv.id}`}>
          {inv.invoice_number}
        </div>
      ))}
    </div>
  ),
}));

vi.mock('@/components/invoices/InvoiceGalleryView', () => ({
  default: () => <div data-testid="invoice-gallery-view">Gallery</div>,
}));

vi.mock('@/components/invoices/InvoiceDialogs', () => ({
  default: () => <div data-testid="invoice-dialogs" />,
}));

vi.mock('@/components/SectionErrorBoundary', () => ({
  default: ({ children }) => <>{children}</>,
}));

// ---------------------------------------------------------------------------
// Import the component under test (AFTER mocks)
// ---------------------------------------------------------------------------

import InvoicesPage from '@/pages/InvoicesPage';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InvoicesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing and displays the page title', () => {
    render(<InvoicesPage />);
    expect(screen.getByText('invoices.title')).toBeTruthy();
    expect(screen.getByText('invoices.subtitle')).toBeTruthy();
  });

  it('renders the invoice list table with invoice rows by default', () => {
    render(<InvoicesPage />);
    expect(screen.getByTestId('invoice-list-table')).toBeTruthy();
    expect(screen.getByTestId('invoice-row-inv-1')).toBeTruthy();
    expect(screen.getByTestId('invoice-row-inv-2')).toBeTruthy();
    expect(screen.getByTestId('invoice-row-inv-3')).toBeTruthy();
  });

  it('displays the Generate Invoice button and toggles the generator view', () => {
    render(<InvoicesPage />);

    const generateBtn = screen.getByText('invoices.generateInvoice');
    expect(generateBtn).toBeTruthy();

    fireEvent.click(generateBtn);
    expect(screen.getByTestId('invoice-generator')).toBeTruthy();
    expect(screen.queryByTestId('invoice-list-table')).toBeNull();
  });

  it('renders the export button when there are invoices', () => {
    render(<InvoicesPage />);
    expect(screen.getByTestId('export-button')).toBeTruthy();
  });

  it('shows view mode tabs (list, gallery, calendar, agenda, kanban)', () => {
    render(<InvoicesPage />);
    expect(screen.getByText('common.list')).toBeTruthy();
    expect(screen.getByText('common.gallery')).toBeTruthy();
    expect(screen.getByText('common.calendar')).toBeTruthy();
    expect(screen.getByText('common.agenda')).toBeTruthy();
    expect(screen.getByText('common.kanban')).toBeTruthy();
  });

  it('shows the lump-sum payment button when the list is visible', () => {
    render(<InvoicesPage />);
    expect(screen.getByText('payments.lumpSum')).toBeTruthy();
  });

  it('includes the InvoiceDialogs component', () => {
    render(<InvoicesPage />);
    expect(screen.getByTestId('invoice-dialogs')).toBeTruthy();
  });
});
