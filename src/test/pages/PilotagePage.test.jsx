import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

let snapshotDialogProps = null;

vi.mock('@/hooks/useEntitlements', () => ({
  useEntitlements: () => ({
    hasEntitlement: () => true,
  }),
}));

vi.mock('@/hooks/usePilotageData', () => ({
  usePilotageData: () => ({
    loading: false,
    company: {
      company_name: 'Test Company',
      accounting_currency: 'EUR',
    },
    region: 'france',
    sector: 'b2b_services',
    regionSource: 'fallback',
    alerts: [],
    revenue: 120000,
    totalExpenses: 80000,
    netIncome: 40000,
    cashFlow: { summary: { net: 12000 } },
    dataQuality: {
      datasetStatus: 'ready',
      entriesCount: 42,
      criticalAlerts: 1,
      warningAlerts: 2,
      valuationMode: 'full',
      preTaxReady: true,
      monthlyPoints: 12,
      topIssues: ['Issue 1'],
      blockingIssues: 0,
      dataWarnings: 1,
    },
    analysisAvailability: {
      overview: {},
      accounting: {},
      financial: {},
      taxValuation: {},
      simulator: {},
      aiAudit: {},
      dataAvailability: {},
    },
  }),
}));

vi.mock('@/components/pilotage/PilotageHeader', () => ({
  default: () => <div data-testid="pilotage-header">Header</div>,
}));

vi.mock('@/components/pilotage/PilotageOverviewTab', () => ({
  default: () => <div>Overview tab</div>,
}));

vi.mock('@/components/pilotage/PilotageAccountingTab', () => ({
  default: () => <div>Accounting tab</div>,
}));

vi.mock('@/components/pilotage/PilotageFinancialTab', () => ({
  default: () => <div>Financial tab</div>,
}));

vi.mock('@/components/pilotage/PilotageTaxValuationTab', () => ({
  default: () => <div>Tax valuation tab</div>,
}));

vi.mock('@/components/pilotage/PilotageSimulatorTab', () => ({
  default: () => <div>Simulator tab</div>,
}));

vi.mock('@/components/pilotage/PilotageAuditTab', () => ({
  default: () => <div>Audit tab</div>,
}));

vi.mock('@/components/pilotage/PilotageDataAvailabilityTab', () => ({
  default: () => <div>Data availability tab</div>,
}));

vi.mock('@/components/SnapshotShareDialog', () => ({
  default: (props) => {
    snapshotDialogProps = props;
    return (
      <div
        data-testid="pilotage-snapshot-share-dialog"
        data-snapshot-type={props.snapshotType}
        data-snapshot-title={props.title}
      />
    );
  },
}));

import PilotagePage from '@/pages/PilotagePage';

describe('PilotagePage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    snapshotDialogProps = null;
  });

  it('opens the financial tab when the tab query parameter is set', () => {
    render(
      <MemoryRouter initialEntries={['/app/pilotage?tab=financial']}>
        <PilotagePage />
      </MemoryRouter>
    );

    expect(screen.getByText('Financial tab')).toBeInTheDocument();
    expect(screen.queryByText('Overview tab')).not.toBeInTheDocument();
  });

  it('provides a secure snapshot payload for Pilotage sharing', () => {
    render(
      <MemoryRouter initialEntries={['/app/pilotage']}>
        <PilotagePage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('pilotage-snapshot-share-dialog')).toBeInTheDocument();
    expect(snapshotDialogProps).toBeTruthy();
    expect(snapshotDialogProps.snapshotType).toBe('pilotage');
    expect(snapshotDialogProps.snapshotData).toMatchObject({
      module: 'pilotage',
      companyName: 'Test Company',
      period: {
        startDate: expect.any(String),
        endDate: expect.any(String),
      },
      scope: {
        region: 'france',
        sector: 'b2b_services',
      },
      summaryCards: expect.any(Array),
      signalCards: expect.any(Array),
      alerts: expect.any(Array),
    });
  });
});
