import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockRefresh = vi.fn();
const mockToggleFlag = vi.fn();
const mockSetRolloutPercentage = vi.fn();

vi.mock('@/hooks/useAdminFeatureFlags', () => ({
  useAdminFeatureFlags: () => ({
    flags: [
      {
        id: 'flag-1',
        flag_key: 'admin.operational_health',
        flag_name: 'Dashboard sante operationnelle',
        flag_description: 'Expose edge/webhooks health',
        target_area: 'admin',
        is_enabled: true,
        rollout_percentage: 100,
        last_changed_at: '2026-03-28T01:00:00.000Z',
      },
    ],
    loading: false,
    error: null,
    refresh: mockRefresh,
    toggleFlag: mockToggleFlag,
    setRolloutPercentage: mockSetRolloutPercentage,
  }),
}));

import AdminFeatureFlagsPanel from '@/components/admin/AdminFeatureFlagsPanel';

describe('AdminFeatureFlagsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders feature flags panel and allows refresh', () => {
    render(<AdminFeatureFlagsPanel />);
    expect(screen.getByText(/Feature flags admin/i)).toBeInTheDocument();
    expect(screen.getByText(/Dashboard sante operationnelle/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Actualiser/i }));
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('triggers rollout update and toggle actions', async () => {
    render(<AdminFeatureFlagsPanel />);

    fireEvent.change(screen.getByDisplayValue('100%'), {
      target: { value: '50' },
    });
    await waitFor(() => {
      expect(mockSetRolloutPercentage).toHaveBeenCalledWith('flag-1', 50);
    });

    fireEvent.click(screen.getByRole('button', { name: /Desactiver/i }));
    await waitFor(() => {
      expect(mockToggleFlag).toHaveBeenCalledWith('flag-1', false);
    });
  });
});
