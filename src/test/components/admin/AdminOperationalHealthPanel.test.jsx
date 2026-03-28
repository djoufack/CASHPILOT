import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockRefresh = vi.fn();
const mockUpdateEdgeStatus = vi.fn();

vi.mock('@/hooks/useAdminOperationalHealth', () => ({
  useAdminOperationalHealth: () => ({
    edgeFunctions: [
      {
        id: 'edge-1',
        function_name: 'webhooks',
        status: 'healthy',
        avg_latency_ms: 160,
        error_rate_pct: 1.2,
        last_success_at: '2026-03-28T03:00:00.000Z',
        last_checked_at: '2026-03-28T03:05:00.000Z',
        check_source: 'synthetic',
      },
    ],
    webhookSummary: {
      totalEndpoints: 4,
      activeEndpoints: 3,
      inactiveEndpoints: 1,
      deliveryTotal24h: 18,
      deliverySuccess24h: 16,
      deliveryFailure24h: 2,
      totalFailureCount: 4,
      lastTriggeredAt: '2026-03-28T03:04:00.000Z',
    },
    loading: false,
    error: null,
    refresh: mockRefresh,
    updateEdgeStatus: mockUpdateEdgeStatus,
  }),
}));

import AdminOperationalHealthPanel from '@/components/admin/AdminOperationalHealthPanel';

describe('AdminOperationalHealthPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders health panel and refresh action', () => {
    render(<AdminOperationalHealthPanel />);

    expect(screen.getByText(/Sante operationnelle/i)).toBeInTheDocument();
    expect(screen.getByText(/Webhooks \(24h\)/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Actualiser/i }));
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('updates function status from selector', async () => {
    render(<AdminOperationalHealthPanel />);

    fireEvent.change(screen.getByDisplayValue('healthy'), {
      target: { value: 'degraded' },
    });

    await waitFor(() => {
      expect(mockUpdateEdgeStatus).toHaveBeenCalledWith('edge-1', 'degraded');
    });
  });
});
