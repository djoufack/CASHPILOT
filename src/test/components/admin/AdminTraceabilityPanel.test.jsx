import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockRefresh = vi.fn();

vi.mock('@/hooks/useAdminTraceability', () => ({
  useAdminTraceability: () => ({
    traces: [
      {
        id: 'trace-1',
        action: 'admin_feature_flag_update',
        resource: 'admin_feature_flags',
        actor_name: 'Demo Admin',
        user_id: 'user-1',
        severity: 'warning',
        operation_status: 'success',
        correlation_id: 'a8bc8b7b-cc19-4edf-b2a8-1b716d5a4979',
        created_at: '2026-03-28T04:00:00.000Z',
      },
    ],
    loading: false,
    error: null,
    refresh: mockRefresh,
  }),
}));

import AdminTraceabilityPanel from '@/components/admin/AdminTraceabilityPanel';

describe('AdminTraceabilityPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders traceability panel and refresh action', () => {
    render(<AdminTraceabilityPanel />);
    expect(screen.getByText(/Tracabilite admin renforcee/i)).toBeInTheDocument();
    expect(screen.getByText(/admin_feature_flag_update/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Actualiser/i }));
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('filters entries via search', () => {
    render(<AdminTraceabilityPanel />);

    fireEvent.change(screen.getByPlaceholderText(/Rechercher action/i), {
      target: { value: 'inconnu' },
    });

    expect(screen.getByText(/Aucune trace admin disponible/i)).toBeInTheDocument();
  });
});
