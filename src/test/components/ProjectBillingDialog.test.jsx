import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { fetchBillableTimesheetsForProjectSpy, markAsInvoicedSpy, createInvoiceSpy, onOpenChangeSpy } = vi.hoisted(
  () => ({
    fetchBillableTimesheetsForProjectSpy: vi.fn(),
    markAsInvoicedSpy: vi.fn(),
    createInvoiceSpy: vi.fn(),
    onOpenChangeSpy: vi.fn(),
  })
);

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, options) => options?.defaultValue ?? key,
  }),
}));

vi.mock('@/hooks/useTimesheets', () => ({
  useTimesheets: () => ({
    // Keep this callback unstable on each render to reproduce production behavior.
    fetchBillableTimesheetsForProject: (...args) => fetchBillableTimesheetsForProjectSpy(...args),
    markAsInvoiced: markAsInvoicedSpy,
  }),
}));

vi.mock('@/hooks/useInvoices', () => ({
  useInvoices: () => ({
    createInvoice: createInvoiceSpy,
  }),
}));

vi.mock('@/hooks/useProducts', () => ({
  useProducts: () => ({
    products: [],
  }),
}));

vi.mock('@/hooks/useServices', () => ({
  useServices: () => ({
    services: [],
  }),
}));

vi.mock('@/hooks/useDefaultTaxRate', () => ({
  useDefaultTaxRate: () => ({
    defaultRate: 21,
  }),
}));

vi.mock('@/hooks/useDefaultPaymentDays', () => ({
  useDefaultPaymentDays: () => ({
    defaultDays: 30,
  }),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  DialogContent: ({ children }) => <div>{children}</div>,
  DialogHeader: ({ children }) => <div>{children}</div>,
  DialogTitle: ({ children }) => <h2>{children}</h2>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }) => <button {...props}>{children}</button>,
}));

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ checked, onCheckedChange }) => (
    <input type="checkbox" checked={Boolean(checked)} onChange={onCheckedChange} />
  ),
}));

vi.mock('@/utils/calculations', () => ({
  formatCurrency: (value, currency = 'EUR') => `${Number(value || 0).toFixed(2)} ${currency}`,
}));

vi.mock('@/utils/dateFormatting', () => ({
  addDaysToDateInput: () => '2026-04-01',
  formatDateInput: () => '2026-03-22',
}));

vi.mock('@/components/ProductPicker', () => ({
  default: () => <div data-testid="product-picker" />,
}));

vi.mock('@/components/ServicePicker', () => ({
  default: () => <div data-testid="service-picker" />,
}));

import ProjectBillingDialog from '@/components/ProjectBillingDialog';

describe('ProjectBillingDialog', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchBillableTimesheetsForProjectSpy.mockResolvedValue([]);
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
  });

  const defaultProps = {
    open: true,
    onOpenChange: onOpenChangeSpy,
    projectId: 'project-1',
    project: {
      id: 'project-1',
      name: 'Projet test',
      client_id: 'client-1',
      client: { preferred_currency: 'EUR' },
    },
    onSuccess: vi.fn(),
  };

  it('loads billable timesheets only once when opening the dialog', async () => {
    render(<ProjectBillingDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('projects.noTimesheets')).toBeInTheDocument();
    });

    // Ensure no hidden reload loop is running.
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(fetchBillableTimesheetsForProjectSpy).toHaveBeenCalledTimes(1);
    expect(fetchBillableTimesheetsForProjectSpy).toHaveBeenCalledWith('project-1');
  });

  it('stops loading and shows an empty state when fetching timesheets fails', async () => {
    fetchBillableTimesheetsForProjectSpy.mockRejectedValue(new Error('network failure'));

    render(<ProjectBillingDialog {...defaultProps} />);

    await waitFor(() => {
      expect(fetchBillableTimesheetsForProjectSpy).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByText('projects.noTimesheets')).toBeInTheDocument();
    });
  });
});
