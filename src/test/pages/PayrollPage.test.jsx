import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks – hooks
// ---------------------------------------------------------------------------

const mockFetchData = vi.fn();
const mockCreatePayrollPeriod = vi.fn();
const mockAddVariableItem = vi.fn();
const mockRemoveVariableItem = vi.fn();
const mockResolveAnomaly = vi.fn();
const mockCalculatePayroll = vi.fn();
const mockValidatePayroll = vi.fn();
const mockExportPayroll = vi.fn();

vi.mock('@/hooks/usePayroll', () => ({
  usePayroll: () => ({
    loading: false,
    error: null,
    periods: [
      {
        id: 'period-1',
        period_label: 'Janvier 2026',
        period_start: '2026-01-01',
        period_end: '2026-01-31',
        status: 'draft',
        jurisdiction: 'France',
        created_at: '2026-01-01T08:00:00Z',
      },
      {
        id: 'period-2',
        period_label: 'Fevrier 2026',
        period_start: '2026-02-01',
        period_end: '2026-02-28',
        status: 'validated',
        jurisdiction: 'France',
        created_at: '2026-02-01T08:00:00Z',
      },
    ],
    variableItems: [
      {
        id: 'vi-1',
        payroll_period_id: 'period-1',
        employee_id: 'emp-1',
        item_type: 'bonus',
        label: 'Prime annuelle',
        amount: 500,
        employee: { id: 'emp-1', full_name: 'Jean Dupont' },
      },
    ],
    anomalies: [
      {
        id: 'anom-1',
        payroll_period_id: 'period-1',
        employee_id: 'emp-1',
        severity: 'warning',
        message: 'Heures supplementaires non validees',
        resolved: false,
        employee: { id: 'emp-1', full_name: 'Jean Dupont' },
      },
    ],
    exports: [],
    employees: [
      { id: 'emp-1', full_name: 'Jean Dupont' },
      { id: 'emp-2', full_name: 'Marie Martin' },
    ],
    fetchData: mockFetchData,
    createPayrollPeriod: mockCreatePayrollPeriod,
    addVariableItem: mockAddVariableItem,
    removeVariableItem: mockRemoveVariableItem,
    resolveAnomaly: mockResolveAnomaly,
    calculatePayroll: mockCalculatePayroll,
    validatePayroll: mockValidatePayroll,
    exportPayroll: mockExportPayroll,
  }),
}));

vi.mock('@/hooks/useCompany', () => ({
  useCompany: () => ({
    company: {
      id: 'company-1',
      company_name: 'Test Company',
      currency: 'EUR',
      accounting_currency: 'EUR',
    },
  }),
}));

vi.mock('@/config/statusMappings', () => ({
  PAYROLL_STATUSES: {
    draft: {
      label: 'Brouillon',
      bg: 'bg-gray-500/20',
      text: 'text-gray-300',
      border: 'border-gray-500/30',
      dot: 'bg-gray-400',
      chartFill: 'rgba(156,163,175,0.5)',
    },
    calculated: {
      label: 'Calcule',
      bg: 'bg-blue-500/20',
      text: 'text-blue-300',
      border: 'border-blue-500/30',
      dot: 'bg-blue-400',
      chartFill: 'rgba(96,165,250,0.6)',
    },
    validated: {
      label: 'Valide',
      bg: 'bg-emerald-500/20',
      text: 'text-emerald-300',
      border: 'border-emerald-500/30',
      dot: 'bg-emerald-400',
      chartFill: 'rgba(52,211,153,0.6)',
    },
    exported: {
      label: 'Exporte',
      bg: 'bg-purple-500/20',
      text: 'text-purple-300',
      border: 'border-purple-500/30',
      dot: 'bg-purple-400',
      chartFill: 'rgba(168,85,247,0.6)',
    },
  },
}));

// ---------------------------------------------------------------------------
// Mocks – utilities and services
// ---------------------------------------------------------------------------

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/services/errorTracking', () => ({
  captureError: vi.fn(),
}));

vi.mock('react-helmet', () => ({
  Helmet: ({ children }) => <div data-testid="helmet">{children}</div>,
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...rest }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/payroll' }),
}));

// ---------------------------------------------------------------------------
// Import the component under test (AFTER mocks)
// ---------------------------------------------------------------------------

import PayrollPage from '@/pages/PayrollPage';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PayrollPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing and displays the page title', () => {
    render(<PayrollPage />);
    expect(screen.getByText('Paie')).toBeTruthy();
    expect(screen.getByText('Gestion de la paie, calcul des bulletins et suivi historique')).toBeTruthy();
  });

  it('displays the four navigation tabs', () => {
    render(<PayrollPage />);
    expect(screen.getByText('Periodes')).toBeTruthy();
    expect(screen.getByText('Calcul')).toBeTruthy();
    expect(screen.getByText('Bulletins')).toBeTruthy();
    expect(screen.getByText('Historique')).toBeTruthy();
  });

  it('displays the Actualiser (refresh) button', () => {
    render(<PayrollPage />);
    const refreshBtn = screen.getByText('Actualiser');
    expect(refreshBtn).toBeTruthy();
  });

  it('clicking Actualiser button calls fetchData', () => {
    render(<PayrollPage />);
    const refreshBtn = screen.getByText('Actualiser');
    fireEvent.click(refreshBtn);
    expect(mockFetchData).toHaveBeenCalledTimes(1);
  });

  it('renders the Periodes tab by default with period cards', () => {
    render(<PayrollPage />);
    // The PeriodesTab should show both periods
    expect(screen.getByText('Janvier 2026')).toBeTruthy();
    expect(screen.getByText('Fevrier 2026')).toBeTruthy();
  });

  it('displays the period count', () => {
    render(<PayrollPage />);
    expect(screen.getByText(/2 periodes/)).toBeTruthy();
  });

  it('shows "Nouvelle periode" button in the Periodes tab', () => {
    render(<PayrollPage />);
    expect(screen.getByText('Nouvelle periode')).toBeTruthy();
  });

  it('displays jurisdiction info for periods', () => {
    render(<PayrollPage />);
    const jurisdictionElements = screen.getAllByText(/Juridiction : France/);
    expect(jurisdictionElements.length).toBeGreaterThan(0);
  });

  it('displays status badges for periods (Brouillon and Valide)', () => {
    render(<PayrollPage />);
    expect(screen.getByText('Brouillon')).toBeTruthy();
    expect(screen.getByText('Valide')).toBeTruthy();
  });
});
