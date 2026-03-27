import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AlertsPanel, { resolveAlertAction } from '@/components/pilotage/AlertsPanel';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key, fallback) => fallback || _key,
  }),
}));

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

  it('falls back to severity defaults when alert type is unknown', () => {
    expect(resolveAlertAction({ type: 'unknown_type', severity: 'warning' })).toMatchObject({
      to: '/app/pilotage?tab=accounting',
    });
  });

  it('renders a one-click action for each alert type with a stable destination', () => {
    render(
      <MemoryRouter>
        <AlertsPanel
          alerts={[
            {
              type: 'negative_operating_cashflow',
              severity: 'critical',
              message: 'Flux de tresorerie operationnel negatif',
            },
            {
              type: 'negative_working_capital',
              severity: 'warning',
              message: 'Fonds de roulement negatif',
            },
          ]}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: 'Ouvrir la trésorerie' })).toHaveAttribute('href', '/app/cash-flow');

    expect(screen.getByRole('link', { name: 'Ouvrir le pilotage comptable' })).toHaveAttribute(
      'href',
      '/app/pilotage?tab=accounting'
    );
  });
});
