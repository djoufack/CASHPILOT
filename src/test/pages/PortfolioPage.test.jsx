import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const mockUseAuth = vi.hoisted(() => vi.fn());
const mockUseCompany = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());
const mockRpc = vi.hoisted(() => vi.fn());
const mockToast = vi.hoisted(() => vi.fn());

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: mockUseAuth,
}));

vi.mock('@/hooks/useCompany', () => ({
  useCompany: mockUseCompany,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: mockRpc,
  },
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/components/ui/PanelInfoPopover', () => ({
  default: () => <span data-testid="panel-info-popover" />,
}));

import PortfolioPage from '@/pages/PortfolioPage';

describe('PortfolioPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', email: 'test@example.com' },
    });

    mockUseCompany.mockReturnValue({
      companies: [
        {
          id: 'company-1',
          company_name: 'Acme SARL',
          accounting_currency: 'EUR',
        },
      ],
      activeCompany: {
        id: 'company-1',
        company_name: 'Acme SARL',
        accounting_currency: 'EUR',
      },
      switchCompany: vi.fn(),
      loading: false,
    });

    mockRpc.mockImplementation((fnName) => {
      switch (fnName) {
        case 'get_portfolio_invoices':
          return Promise.resolve({
            data: [
              {
                company_id: 'company-1',
                total_ttc: 120000,
                balance_due: 18000,
                status: 'sent',
                payment_status: 'unpaid',
                due_date: '2026-04-01',
                created_at: '2026-03-10T10:00:00Z',
                invoice_number: 'INV-001',
                client_company_name: 'Client Alpha',
              },
            ],
            error: null,
          });
        case 'get_portfolio_payments':
          return Promise.resolve({
            data: [{ company_id: 'company-1', amount: 80000, payment_date: '2026-03-12T10:00:00Z' }],
            error: null,
          });
        case 'get_portfolio_projects':
          return Promise.resolve({
            data: [{ company_id: 'company-1', status: 'active', created_at: '2026-03-11T10:00:00Z' }],
            error: null,
          });
        case 'get_portfolio_quotes':
          return Promise.resolve({
            data: [{ company_id: 'company-1', status: 'sent', total_ttc: 35000, created_at: '2026-03-13T10:00:00Z' }],
            error: null,
          });
        default:
          return Promise.resolve({ data: [], error: null });
      }
    });
  });

  it('renders a stress-tests section backed by live portfolio totals', async () => {
    render(
      <MemoryRouter>
        <PortfolioPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByTestId('portfolio-stress-tests')).toBeInTheDocument());
    expect(screen.getByTestId('portfolio-stress-test-card-revenueShock')).toBeInTheDocument();
    expect(screen.getByTestId('portfolio-stress-test-card-collectionShock')).toBeInTheDocument();
    expect(screen.getByTestId('portfolio-stress-test-card-pipelineShock')).toBeInTheDocument();
  });
});
