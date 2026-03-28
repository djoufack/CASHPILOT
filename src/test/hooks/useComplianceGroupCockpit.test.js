import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { mockUseAuth, mockUseSupabaseQuery } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockUseSupabaseQuery: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: mockUseAuth,
}));

vi.mock('@/hooks/useSupabaseQuery', () => ({
  useSupabaseQuery: mockUseSupabaseQuery,
}));

import { buildComplianceGroupCockpitMetrics, useComplianceGroupCockpit } from '@/hooks/useComplianceGroupCockpit';

describe('buildComplianceGroupCockpitMetrics', () => {
  it('computes unified KPI metrics from module datasets', () => {
    const metrics = buildComplianceGroupCockpitMetrics({
      companies: [
        { id: 'c-1', peppol_endpoint_id: '0088:123' },
        { id: 'c-2', peppol_endpoint_id: null },
      ],
      portfolios: [
        {
          id: 'p-1',
          company_portfolio_members: [{ company_id: 'c-1' }, { company_id: 'c-2' }],
        },
      ],
      complianceStatus: [{ status: 'certified' }, { status: 'expired' }, { status: 'in_progress' }],
      eliminations: [
        { status: 'draft', eliminated_amount: 200, created_at: '2026-03-27T10:00:00.000Z' },
        { status: 'validated', eliminated_amount: 125, created_at: '2026-03-26T10:00:00.000Z' },
      ],
      updates: [
        {
          severity: 'critical',
          status: 'new',
          effective_date: '2099-01-10',
        },
        {
          severity: 'low',
          status: 'dismissed',
          effective_date: '2099-02-10',
        },
      ],
    });

    expect(metrics.companyCount).toBe(2);
    expect(metrics.peppolConfiguredCount).toBe(1);
    expect(metrics.portfolioCount).toBe(1);
    expect(metrics.portfolioCompaniesCount).toBe(2);
    expect(metrics.certificationsTotal).toBe(3);
    expect(metrics.certificationsCertified).toBe(1);
    expect(metrics.certificationsExpired).toBe(1);
    expect(metrics.certificationsInProgress).toBe(1);
    expect(metrics.pendingEliminationsCount).toBe(1);
    expect(metrics.eliminatedAmount).toBe(325);
    expect(metrics.criticalUpdatesCount).toBe(1);
    expect(metrics.latestEliminationAt).toBe('2026-03-27T10:00:00.000Z');
  });
});

describe('useComplianceGroupCockpit', () => {
  it('flags issue mode when warnings are present', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } });
    mockUseSupabaseQuery.mockReturnValue({
      data: {
        metrics: buildComplianceGroupCockpitMetrics({}),
        warnings: ['company: timeout'],
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => useComplianceGroupCockpit());

    expect(result.current.warnings).toHaveLength(1);
    expect(result.current.hasIssues).toBe(true);
  });
});
