import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-helmet', () => ({
  Helmet: ({ children }) => <div>{children}</div>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, fallbackOrOptions) => {
      if (typeof fallbackOrOptions === 'string') return fallbackOrOptions;
      return key;
    },
    i18n: { resolvedLanguage: 'fr' },
  }),
}));

vi.mock('@/hooks/useComplianceGroupCockpit', () => ({
  useComplianceGroupCockpit: () => ({
    metrics: {
      companyCount: 4,
      peppolConfiguredCount: 3,
      portfolioCount: 2,
      portfolioCompaniesCount: 4,
      certificationsTotal: 5,
      certificationsCertified: 4,
      certificationsExpired: 1,
      certificationsInProgress: 0,
      pendingEliminationsCount: 2,
      eliminatedAmount: 1250,
      criticalUpdatesCount: 1,
      upcomingUpdatesCount: 2,
      latestEliminationAt: '2026-03-27T10:00:00.000Z',
    },
    warnings: [],
    hasIssues: true,
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

import CompanyComplianceCockpitPage from '@/pages/CompanyComplianceCockpitPage';

describe('CompanyComplianceCockpitPage', () => {
  it('renders unified cockpit KPIs and module links', () => {
    render(
      <MemoryRouter>
        <CompanyComplianceCockpitPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('co-cockpit-kpi-companies')).toHaveTextContent('4');
    expect(screen.getByTestId('co-cockpit-kpi-portfolios')).toHaveTextContent('2');
    expect(screen.getByTestId('co-cockpit-kpi-certifications')).toHaveTextContent('4/5');
    expect(screen.getByTestId('co-cockpit-kpi-intercompany')).toHaveTextContent('2');
    expect(screen.getByTestId('co-cockpit-link-portfolio')).toBeInTheDocument();
    expect(screen.getByTestId('co-cockpit-link-peppol')).toBeInTheDocument();
    expect(screen.getByTestId('co-cockpit-link-regulatory-intel')).toBeInTheDocument();
  });
});
