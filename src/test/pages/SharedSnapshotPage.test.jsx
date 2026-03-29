import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const snapshotData = {
  companyName: 'Test Company',
  module: 'pilotage',
  title: 'Pilotage partagé',
  currency: 'EUR',
  generatedAt: '2026-03-27T08:00:00.000Z',
  period: {
    startDate: '2026-01-01',
    endDate: '2026-03-31',
    label: '1 janv. 2026 - 31 mars 2026',
  },
  scope: {
    region: 'france',
    sector: 'b2b_services',
  },
  summaryCards: [
    { label: 'Revenus', value: '1 000 EUR', hint: 'Tendance stable', accentClass: 'text-emerald-300' },
    { label: 'Marge', value: '18 %', hint: 'Sous surveillance', accentClass: 'text-orange-300' },
  ],
  signalCards: [{ label: 'Alertes critiques', value: '1', hint: 'Priorité haute' }],
  alerts: [
    {
      severity: 'critical',
      title: 'Flux de tresorerie operationnel negatif',
      message: 'Les encaissements doivent etre acceleres.',
      value: -1200,
      threshold: 0,
    },
  ],
};

vi.mock('react-router-dom', () => ({
  useParams: () => ({ token: 'share-token-123' }),
}));

vi.mock('react-helmet', () => ({
  Helmet: ({ children }) => <>{children}</>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, fallback, options) => {
      if (typeof fallback === 'string') return fallback;
      if (options?.company) return `${options.company}`;
      return key;
    },
    i18n: { resolvedLanguage: 'fr', language: 'fr' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              id: 'snapshot-1',
              title: 'Pilotage partagé',
              snapshot_type: 'pilotage',
              snapshot_data: snapshotData,
              created_at: '2026-03-27T08:15:00.000Z',
              expires_at: null,
            },
            error: null,
          }),
        }),
      }),
    }),
  },
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div data-testid="shared-snapshot-chart">{children}</div>,
  AreaChart: () => null,
  Area: () => null,
  BarChart: () => null,
  Bar: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Cell: () => null,
}));

import SharedSnapshotPage from '@/pages/SharedSnapshotPage';

describe('SharedSnapshotPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a pilotage snapshot view with the shared payload', async () => {
    render(<SharedSnapshotPage />);

    await waitFor(() => {
      expect(screen.getByText('Pilotage partagé')).toBeInTheDocument();
    });

    expect(screen.getByText('Test Company')).toBeInTheDocument();
    expect(screen.getByText(/france/i)).toBeInTheDocument();
    expect(screen.getByText(/b2b_services/i)).toBeInTheDocument();
    expect(screen.getByText('Revenus')).toBeInTheDocument();
    expect(screen.getByText('Flux de tresorerie operationnel negatif')).toBeInTheDocument();
  });
});
