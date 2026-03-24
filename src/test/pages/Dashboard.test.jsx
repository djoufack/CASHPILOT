import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks – hooks
// ---------------------------------------------------------------------------

const mockUser = { id: 'user-1', email: 'test@example.com' };

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
    signOut: vi.fn(),
  }),
}));

vi.mock('@/hooks/useInvoices', () => ({
  useInvoices: () => ({
    invoices: [
      {
        id: 'inv-1',
        invoice_number: 'INV-001',
        client: { company_name: 'Acme Corp' },
        total_ttc: 1200,
        status: 'paid',
        created_at: '2026-01-15T10:00:00Z',
      },
      {
        id: 'inv-2',
        invoice_number: 'INV-002',
        client: { company_name: 'Beta Inc' },
        total_ttc: 3000,
        status: 'sent',
        created_at: '2026-02-01T10:00:00Z',
      },
    ],
    fetchInvoices: vi.fn(),
    loading: false,
  }),
}));

vi.mock('@/hooks/useTimesheets', () => ({
  useTimesheets: () => ({
    timesheets: [
      {
        id: 'ts-1',
        task: { name: 'Dev Task' },
        project: { name: 'Project Alpha' },
        duration_minutes: 120,
        date: '2026-01-10',
      },
    ],
    fetchTimesheets: vi.fn(),
    loading: false,
  }),
}));

vi.mock('@/hooks/useProjects', () => ({
  useProjects: () => ({
    projects: [{ id: 'proj-1', name: 'Project Alpha', status: 'active' }],
    fetchProjects: vi.fn(),
    loading: false,
  }),
}));

vi.mock('@/hooks/useClients', () => ({
  useClients: () => ({
    clients: [{ id: 'client-1', company_name: 'Acme Corp' }],
    fetchClients: vi.fn(),
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

vi.mock('@/hooks/useExpenses', () => ({
  useExpenses: () => ({
    expenses: [{ id: 'exp-1', amount: 200, date: '2026-01-05', category: 'office' }],
    fetchExpenses: vi.fn(),
    loading: false,
  }),
}));

vi.mock('@/hooks/useCashFlow', () => ({
  useCashFlow: () => ({
    cashFlowData: [],
    summary: { totalIncome: 4200, totalExpenses: 200, net: 4000 },
    loading: false,
  }),
}));

vi.mock('@/hooks/useCreditsGuard', () => ({
  useCreditsGuard: () => ({
    guardedAction: (_cost, _label, action) => action(),
    modalProps: { open: false, onClose: vi.fn() },
  }),
  CREDIT_COSTS: {
    PDF_REPORT: 1,
    EXPORT_HTML: 1,
    PDF_INVOICE: 1,
  },
}));

// ---------------------------------------------------------------------------
// Mocks – utilities and services
// ---------------------------------------------------------------------------

vi.mock('@/utils/currencyService', () => ({
  formatCurrency: (amount, _currency) => `${Number(amount || 0).toFixed(2)} EUR`,
  formatCompactCurrency: (amount, _currency) => `${Number(amount || 0).toFixed(0)} EUR`,
  getCurrencySymbol: () => 'EUR',
}));

vi.mock('@/services/databaseCurrencyService', () => ({
  resolveAccountingCurrency: () => 'EUR',
}));

vi.mock('@/utils/calculations', () => ({
  formatTrendLabel: (val) => `${val || 0}%`,
}));

vi.mock('@/shared/canonicalDashboardSnapshot', () => ({
  buildCanonicalDashboardSnapshot: () => ({
    metrics: {
      revenue: 4200,
      profitMargin: 75,
      occupancyRate: 60,
      totalExpenses: 200,
      netCashFlow: 4000,
      revenueTrend: 12,
      marginTrend: 5,
      occupancyTrend: -3,
    },
    revenueData: [
      { name: 'Jan', revenue: 1200 },
      { name: 'Feb', revenue: 3000 },
    ],
    clientRevenueData: [
      { name: 'Acme Corp', amount: 1200 },
      { name: 'Beta Inc', amount: 3000 },
    ],
    revenueByType: { product: 2000, service: 2200, other: 0 },
    revenueBreakdownData: [
      { name: 'Jan', products: 800, services: 400 },
      { name: 'Feb', products: 1200, services: 1800 },
    ],
  }),
  getCanonicalInvoiceAmount: (inv) => inv.total_ttc || 0,
}));

vi.mock('@/services/exportReports', () => ({
  exportDashboardPDF: vi.fn(),
  exportDashboardHTML: vi.fn(),
}));

vi.mock('@/services/errorTracking', () => ({
  captureError: vi.fn(),
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Mocks – UI components
// ---------------------------------------------------------------------------

vi.mock('react-helmet', () => ({
  Helmet: ({ children }) => <div data-testid="helmet">{children}</div>,
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => {
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
      return <div {...rest}>{children}</div>;
    },
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...rest }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/dashboard' }),
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div data-testid="responsive-container">{children}</div>,
  AreaChart: () => <div data-testid="area-chart" />,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  LineChart: () => <div data-testid="line-chart" />,
  Line: () => null,
  BarChart: () => <div data-testid="bar-chart" />,
  Bar: () => null,
  Legend: () => null,
}));

vi.mock('@/components/CreditsGuardModal', () => ({
  default: () => null,
}));

vi.mock('@/components/AccountingHealthWidget', () => ({
  default: () => <div data-testid="accounting-health-widget">Accounting Health</div>,
}));

vi.mock('@/components/dashboard/ObligationsPanel', () => ({
  default: () => <div data-testid="obligations-panel">Obligations</div>,
}));

vi.mock('@/components/SnapshotShareDialog', () => ({
  default: () => <button data-testid="snapshot-share-dialog">Share</button>,
}));

vi.mock('@/components/SectionErrorBoundary', () => ({
  default: ({ children }) => <>{children}</>,
}));

// ---------------------------------------------------------------------------
// Import the component under test (AFTER mocks)
// ---------------------------------------------------------------------------

import Dashboard from '@/pages/Dashboard';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing and displays the dashboard title', () => {
    render(<Dashboard />);
    expect(screen.getByText('dashboard.title')).toBeTruthy();
  });

  it('displays the three KPI stat cards', () => {
    render(<Dashboard />);
    expect(screen.getByText('dashboard.totalRevenue')).toBeTruthy();
    expect(screen.getByText('dashboard.profitMargin')).toBeTruthy();
    expect(screen.getByText('dashboard.occupancyRate')).toBeTruthy();
  });

  it('displays computed metric values from the canonical snapshot', () => {
    render(<Dashboard />);
    // Revenue should be formatted
    expect(screen.getByText('4200 EUR')).toBeTruthy();
    // Profit margin rounded
    expect(screen.getByText('75%')).toBeTruthy();
    // Occupancy rate rounded
    expect(screen.getByText('60%')).toBeTruthy();
  });

  it('shows the expenses and net cash flow cards', () => {
    render(<Dashboard />);
    expect(screen.getByText('dashboard.totalExpenses')).toBeTruthy();
    expect(screen.getByText('dashboard.netCashFlow')).toBeTruthy();
  });

  it('renders the revenue breakdown chart section', () => {
    render(<Dashboard />);
    expect(screen.getByText('dashboard.revenueBreakdown')).toBeTruthy();
    expect(screen.getByTestId('bar-chart')).toBeTruthy();
  });

  it('renders the revenue overview and revenue-by-client charts', () => {
    render(<Dashboard />);
    expect(screen.getByText('dashboard.revenueOverview')).toBeTruthy();
    expect(screen.getByText('dashboard.revenueByClient')).toBeTruthy();
  });

  it('renders quick action links', () => {
    render(<Dashboard />);
    expect(screen.getByText('dashboard.newTimesheet')).toBeTruthy();
    expect(screen.getByText('dashboard.newInvoice')).toBeTruthy();
    expect(screen.getByText('dashboard.newClient')).toBeTruthy();
  });

  it('renders recent invoices section with data', () => {
    render(<Dashboard />);
    expect(screen.getByText('dashboard.recentInvoices')).toBeTruthy();
    expect(screen.getByText('INV-001')).toBeTruthy();
    expect(screen.getByText('INV-002')).toBeTruthy();
  });

  it('renders recent timesheets section with data', () => {
    render(<Dashboard />);
    expect(screen.getByText('dashboard.recentTimesheets')).toBeTruthy();
    expect(screen.getByText('Dev Task')).toBeTruthy();
    expect(screen.getByText('Project Alpha')).toBeTruthy();
  });

  it('renders the accounting health widget and obligations panel', () => {
    render(<Dashboard />);
    expect(screen.getByTestId('accounting-health-widget')).toBeTruthy();
    expect(screen.getByTestId('obligations-panel')).toBeTruthy();
  });

  it('renders the PDF and HTML export buttons', () => {
    render(<Dashboard />);
    // PDF button
    expect(screen.getByText(/PDF/)).toBeTruthy();
    // HTML button
    expect(screen.getByText(/HTML/)).toBeTruthy();
  });
});
