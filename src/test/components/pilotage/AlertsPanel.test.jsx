import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AlertsPanel, { resolveAlertAction } from '@/components/pilotage/AlertsPanel';
import { buildPilotageAlertCandidates } from '@/hooks/usePilotageAlertSubscriptions';

const mockSaveSettings = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key, fallback) => fallback || _key,
  }),
}));

vi.mock('@/hooks/usePilotageAlertSubscriptions', async () => {
  const actual = await vi.importActual('@/hooks/usePilotageAlertSubscriptions');
  return {
    ...actual,
    usePilotageAlertSubscriptions: () => ({
      settings: {
        negative_equity: { enabled: true, threshold: 0 },
        low_interest_coverage: { enabled: true, threshold: 1 },
        low_dscr: { enabled: true, threshold: 1.5 },
        bfr_drift: { enabled: true, threshold: 30 },
        negative_operating_cashflow: { enabled: true, threshold: 0 },
        high_gearing: { enabled: true, threshold: 1 },
        negative_net_income: { enabled: true, threshold: 0 },
        negative_working_capital: { enabled: true, threshold: 0 },
      },
      loading: false,
      saving: false,
      saveSettings: mockSaveSettings,
    }),
  };
});

describe('AlertsPanel', () => {
  it('maps SQL alert types to stable one-click action targets', () => {
    expect(resolveAlertAction({ type: 'negative_operating_cashflow', severity: 'critical' })).toMatchObject({
      to: '/app/cash-flow',
      labelDefault: 'Ouvrir la trésorerie',
    });

    expect(resolveAlertAction({ type: 'low_interest_coverage', severity: 'critical' })).toMatchObject({
      to: '/app/pilotage?tab=financial',
      labelDefault: 'Ouvrir le pilotage financier',
    });

    expect(resolveAlertAction({ type: 'negative_working_capital', severity: 'warning' })).toMatchObject({
      to: '/app/pilotage?tab=accounting',
      labelDefault: 'Ouvrir le pilotage comptable',
    });
  });

  it('recomputes visible alerts from user thresholds and filters disabled rows', () => {
    const alerts = buildPilotageAlertCandidates(
      {
        balanceSheet: { totalEquity: 1200 },
        netIncome: -120,
        pilotageRatios: {
          coverage: { interestCoverage: 0.9, dscr: 1.3 },
          activity: { bfrToRevenue: 42 },
          cashFlow: { operatingCashFlow: 500 },
          structure: { gearing: 1.1, workingCapital: 0 },
        },
      },
      {
        low_dscr: { enabled: true, threshold: 1.5 },
        high_gearing: { enabled: false, threshold: 1 },
      }
    );

    expect(alerts).toEqual([
      expect.objectContaining({ type: 'low_interest_coverage', threshold: 1 }),
      expect.objectContaining({ type: 'low_dscr', threshold: 1.5 }),
      expect.objectContaining({ type: 'bfr_drift', threshold: 30 }),
      expect.objectContaining({ type: 'negative_net_income', threshold: 0 }),
    ]);
    expect(alerts.find((alert) => alert.type === 'high_gearing')).toBeUndefined();
  });

  it('renders alert rows and opens the threshold dialog for editing', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AlertsPanel
          data={{
            company: { id: 'comp-1', company_name: 'Test Co' },
            balanceSheet: { totalEquity: 1200 },
            netIncome: -120,
            pilotageRatios: {
              coverage: { interestCoverage: 0.9, dscr: 1.3 },
              activity: { bfrToRevenue: 42 },
              cashFlow: { operatingCashFlow: 500 },
              structure: { gearing: 1.1, workingCapital: 0 },
            },
          }}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('pilotage.alertSubscriptions.messages.low_dscr')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Ouvrir le pilotage financier' })[0]).toHaveAttribute(
      'href',
      '/app/pilotage?tab=financial'
    );

    await user.click(screen.getByRole('button', { name: 'pilotage.alertSubscriptions.manage' }));
    const thresholdInput = screen.getAllByRole('spinbutton')[2];
    await user.clear(thresholdInput);
    await user.type(thresholdInput, '1.8');
    await user.click(screen.getByRole('button', { name: 'pilotage.alertSubscriptions.save' }));

    expect(mockSaveSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        low_dscr: expect.objectContaining({ threshold: 1.8 }),
      })
    );
  });
});
