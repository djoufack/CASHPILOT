import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockUseAuth,
  mockUseCompany,
  mockUseCompanyScope,
  mockUseToast,
  mockUseBankConnections,
  mockFrom,
  mockInvoke,
  mockRefresh,
  mockListInstitutions,
  mockSyncConnection,
  mockDisconnectBank,
  mockTranslate,
} = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockUseCompany: vi.fn(),
  mockUseCompanyScope: vi.fn(),
  mockUseToast: vi.fn(),
  mockUseBankConnections: vi.fn(),
  mockFrom: vi.fn(),
  mockInvoke: vi.fn(),
  mockRefresh: vi.fn(),
  mockListInstitutions: vi.fn(),
  mockSyncConnection: vi.fn(),
  mockDisconnectBank: vi.fn(),
  mockTranslate: vi.fn((key, fallback) => (typeof fallback === 'string' && fallback.length > 0 ? fallback : key)),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: mockUseAuth,
}));

vi.mock('@/hooks/useCompany', () => ({
  useCompany: mockUseCompany,
}));

vi.mock('@/hooks/useCompanyScope', () => ({
  useCompanyScope: mockUseCompanyScope,
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: mockUseToast,
}));

vi.mock('@/hooks/useBankConnections', () => ({
  useBankConnections: mockUseBankConnections,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: mockTranslate,
  }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mockFrom,
    functions: {
      invoke: mockInvoke,
    },
  },
}));

import { useEmbeddedBanking } from '@/hooks/useEmbeddedBanking';

function createQueryChain(result) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  };

  chain.then = (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected);
  return chain;
}

describe('useEmbeddedBanking', () => {
  const toastSpy = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
    });
    mockUseCompany.mockReturnValue({
      company: { id: 'company-1', country: 'BE' },
    });
    mockUseCompanyScope.mockReturnValue({
      applyCompanyScope: (query) => query,
    });
    mockUseToast.mockReturnValue({
      toast: toastSpy,
    });

    mockListInstitutions.mockResolvedValue([]);
    mockRefresh.mockResolvedValue(undefined);
    mockSyncConnection.mockResolvedValue({});
    mockDisconnectBank.mockResolvedValue(undefined);

    mockUseBankConnections.mockReturnValue({
      connections: [
        {
          id: 'connection-1',
          status: 'active',
          account_balance: 1200,
          account_currency: 'EUR',
          institution_name: 'Demo Bank',
          account_name: 'Main account',
        },
      ],
      loading: false,
      totalBalance: 1200,
      integrationHealth: {
        ready: true,
        message: null,
      },
      integrationHealthLoading: false,
      refreshIntegrationHealth: vi.fn().mockResolvedValue(undefined),
      listInstitutions: mockListInstitutions,
      initiateConnection: vi.fn().mockResolvedValue({}),
      syncConnection: mockSyncConnection,
      disconnectBank: mockDisconnectBank,
      refresh: mockRefresh,
    });

    mockFrom.mockImplementation((table) => {
      if (table === 'bank_transfers') {
        return createQueryChain({
          data: [],
          error: null,
        });
      }

      if (table === 'bank_sync_history') {
        return createQueryChain({
          data: [],
          error: null,
        });
      }

      return createQueryChain({
        data: [],
        error: null,
      });
    });
  });

  it('enables bank transfers when integration is ready and one active connection exists', async () => {
    const { result } = renderHook(() => useEmbeddedBanking());
    await waitFor(() => {
      expect(mockListInstitutions).toHaveBeenCalled();
    });
    expect(result.current.bankTransfersEnabled).toBe(true);
  });

  it('keeps transfers enabled when provider health is degraded but a connected account exists', async () => {
    mockUseBankConnections.mockReturnValue({
      connections: [
        {
          id: 'connection-2',
          status: 'connected',
          account_balance: 900,
          account_currency: 'EUR',
          institution_name: 'Fallback Bank',
          account_name: 'Secondary account',
        },
      ],
      loading: false,
      totalBalance: 900,
      integrationHealth: {
        ready: false,
        message: 'Provider maintenance',
      },
      integrationHealthLoading: false,
      refreshIntegrationHealth: vi.fn().mockResolvedValue(undefined),
      listInstitutions: mockListInstitutions,
      initiateConnection: vi.fn().mockResolvedValue({}),
      syncConnection: mockSyncConnection,
      disconnectBank: mockDisconnectBank,
      refresh: mockRefresh,
    });

    const { result } = renderHook(() => useEmbeddedBanking());
    await waitFor(() => {
      expect(mockListInstitutions).toHaveBeenCalled();
    });

    expect(result.current.bankTransfersEnabled).toBe(true);
  });

  it('invokes bank-transfer edge function and refreshes transfers on success', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        success: true,
        transfer: {
          id: 'transfer-1',
          status: 'completed',
        },
      },
      error: null,
    });

    const { result } = renderHook(() => useEmbeddedBanking());
    await waitFor(() => {
      expect(mockListInstitutions).toHaveBeenCalled();
    });

    toastSpy.mockClear();
    mockRefresh.mockClear();

    const payload = {
      connection_id: 'connection-1',
      recipient_name: 'Vendor One',
      recipient_iban: 'BE68539007547034',
      amount: 50,
      currency: 'EUR',
      reference: 'INV-001',
    };

    await act(async () => {
      await result.current.initiateTransfer(payload);
    });

    expect(mockInvoke).toHaveBeenCalledWith(
      'bank-transfer',
      expect.objectContaining({
        body: payload,
      })
    );
    expect(mockRefresh).toHaveBeenCalled();
    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.any(String),
      })
    );
  });
});
