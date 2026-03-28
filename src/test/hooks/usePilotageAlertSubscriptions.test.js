import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const { mockToast, mockUser, mockUseActiveCompanyId } = vi.hoisted(() => ({
  mockToast: vi.fn(),
  mockUser: { id: 'user-1', email: 'pilotage@example.com' },
  mockUseActiveCompanyId: vi.fn(() => 'comp-1'),
}));

const createChain = (resolvedValue = { data: null, error: null }) => {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(resolvedValue),
    upsert: vi.fn().mockReturnThis(),
  };
  return chain;
};

const chainsByTable = {};

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock('@/hooks/useActiveCompanyId', () => ({
  useActiveCompanyId: mockUseActiveCompanyId,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn((table) => {
      if (!chainsByTable[table]) {
        chainsByTable[table] = createChain();
      }
      return chainsByTable[table];
    }),
  },
}));

import {
  buildPilotageAlertCandidates,
  normalizePilotageAlertSettings,
  usePilotageAlertSubscriptions,
} from '@/hooks/usePilotageAlertSubscriptions';

describe('usePilotageAlertSubscriptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(chainsByTable).forEach((key) => {
      delete chainsByTable[key];
    });
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes alert subscription settings and falls back to defaults', () => {
    const normalized = normalizePilotageAlertSettings({
      low_dscr: { enabled: false, threshold: '1.4' },
      high_gearing: { enabled: true, threshold: 'not-a-number' },
    });

    expect(normalized.low_dscr).toEqual({ enabled: false, threshold: 1.4 });
    expect(normalized.high_gearing).toEqual({ enabled: true, threshold: 1 });
    expect(normalized.negative_equity).toEqual({ enabled: true, threshold: 0 });
  });

  it('recomputes alerts from user thresholds', () => {
    const alerts = buildPilotageAlertCandidates(
      {
        balanceSheet: { totalEquity: 1000 },
        netIncome: -250,
        pilotageRatios: {
          coverage: { interestCoverage: 1.2, dscr: 1.1 },
          activity: { bfrToRevenue: 36 },
          cashFlow: { operatingCashFlow: -50 },
          structure: { gearing: 1.6, workingCapital: -15 },
        },
      },
      {
        low_dscr: { enabled: true, threshold: 1.3 },
        high_gearing: { enabled: false, threshold: 1 },
      }
    );

    expect(alerts.map((alert) => alert.type)).toEqual([
      'low_dscr',
      'bfr_drift',
      'negative_operating_cashflow',
      'negative_net_income',
      'negative_working_capital',
    ]);
  });

  it('persists company-scoped alert settings to user_company_preferences', async () => {
    chainsByTable.user_company_preferences = createChain({
      data: {
        user_id: 'user-1',
        active_company_id: 'comp-1',
        pilotage_alert_settings: {},
      },
      error: null,
    });

    const { result } = renderHook(() => usePilotageAlertSubscriptions('comp-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.saveSettings({
        low_dscr: { enabled: true, threshold: 1.8 },
        high_gearing: { enabled: false, threshold: 1.2 },
      });
    });

    expect(chainsByTable.user_company_preferences.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        active_company_id: 'comp-1',
        pilotage_alert_settings: {
          'comp-1': expect.objectContaining({
            low_dscr: { enabled: true, threshold: 1.8 },
            high_gearing: { enabled: false, threshold: 1.2 },
          }),
        },
      }),
      { onConflict: 'user_id' }
    );

    expect(mockToast).toHaveBeenCalled();
  });
});
