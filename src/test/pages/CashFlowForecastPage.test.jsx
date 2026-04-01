import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { mockFetchForecast } = vi.hoisted(() => ({
  mockFetchForecast: vi.fn(),
}));

vi.mock('react-helmet', () => ({
  Helmet: ({ children }) => <div>{children}</div>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key, fallback) => fallback || _key,
  }),
}));

vi.mock('@/utils/dateLocale', () => ({
  getLocale: () => 'fr-FR',
}));

vi.mock('@/hooks/useCashFlowForecast', () => ({
  useCashFlowForecast: () => ({
    forecast: { dailyProjections: [] },
    scenarios: null,
    milestones: [],
    alerts: [],
    analysis: null,
    workingCapitalKpis: {
      dso: 52,
      dpo: 29,
      dio: 67,
      ccc: 90,
    },
    workingCapitalAlerts: [
      {
        key: 'working_capital_dso',
        severity: 'warning',
        message: 'DSO au-dessus de la cible: acceleration recouvrement recommandee.',
      },
    ],
    loading: false,
    error: null,
    fetchForecast: mockFetchForecast,
  }),
}));

vi.mock('@/components/cashflow/CashFlowSummaryCards', () => ({
  default: () => <div data-testid="cashflow-summary-cards">summary</div>,
}));

vi.mock('@/components/cashflow/CashFlowChart', () => ({
  default: () => <div data-testid="cashflow-chart">chart</div>,
}));

vi.mock('@/components/cashflow/CashFlowAlerts', () => ({
  default: () => <div data-testid="cashflow-alerts">alerts</div>,
}));

import CashFlowForecastPage from '@/pages/CashFlowForecastPage';

describe('CashFlowForecastPage', () => {
  it('exposes the 13-week preset and requests forecast on click', () => {
    render(<CashFlowForecastPage />);

    const thirteenWeeksButton = screen.getByRole('button', { name: 'Mode CFO' });
    expect(thirteenWeeksButton).toBeInTheDocument();

    fireEvent.click(thirteenWeeksButton);
    expect(mockFetchForecast).toHaveBeenCalledWith(91);
  });

  it('shows working-capital monitoring panel for 13-week preset', () => {
    render(<CashFlowForecastPage />);

    expect(screen.queryByText(/Signal BFR - Mode CFO/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Mode CFO' }));

    expect(screen.getByText(/Signal BFR - Mode CFO/i)).toBeInTheDocument();
    expect(screen.getByText(/DSO au-dessus de la cible/i)).toBeInTheDocument();
  });
});
