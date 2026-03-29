import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  initializeAccountingSpy,
  initializeAccountingFromPlanSpy,
  generateOpeningEntriesSpy,
  activeCompanyIdSpy,
  onCompleteSpy,
  onBackSpy,
} = vi.hoisted(() => ({
  initializeAccountingSpy: vi.fn(),
  initializeAccountingFromPlanSpy: vi.fn(),
  generateOpeningEntriesSpy: vi.fn(),
  activeCompanyIdSpy: vi.fn(),
  onCompleteSpy: vi.fn(),
  onBackSpy: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, fallbackOrOptions, maybeOptions) => {
      if (typeof fallbackOrOptions === 'string') return fallbackOrOptions;
      if (typeof maybeOptions === 'string') return maybeOptions;
      if (fallbackOrOptions?.defaultValue) return fallbackOrOptions.defaultValue;
      return key;
    },
  }),
  Trans: ({ children }) => children,
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }) => <button {...props}>{children}</button>,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('@/hooks/useActiveCompanyId', () => ({
  useActiveCompanyId: () => activeCompanyIdSpy(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { name: 'OHADA Standard', country_code: 'OHADA' }, error: null }),
    })),
  },
}));

vi.mock('@/services/accountingInitService', () => ({
  initializeAccounting: (...args) => initializeAccountingSpy(...args),
  initializeAccountingFromPlan: (...args) => initializeAccountingFromPlanSpy(...args),
}));

vi.mock('@/services/openingBalanceService', () => ({
  generateOpeningEntries: (...args) => generateOpeningEntriesSpy(...args),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

vi.mock('lucide-react', () => ({
  ArrowLeft: () => null,
  CheckCircle2: () => null,
  Loader2: () => null,
  Rocket: () => null,
  Building2: () => null,
  FileText: () => null,
  PiggyBank: () => null,
  PartyPopper: () => null,
}));

import Step5Confirmation from '@/components/onboarding/steps/Step5Confirmation';

describe('Step5Confirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    activeCompanyIdSpy.mockReturnValue(null);
    initializeAccountingSpy.mockResolvedValue({ success: true });
    initializeAccountingFromPlanSpy.mockResolvedValue({ success: true });
    generateOpeningEntriesSpy.mockResolvedValue({ success: true });
  });

  it('uses wizard company id and the selected plan when launching initialization', async () => {
    vi.useFakeTimers();

    try {
      render(
        <Step5Confirmation
          onComplete={onCompleteSpy}
          onBack={onBackSpy}
          wizardData={{
            companyInfo: { id: 'company-wizard-1', company_name: 'ACME' },
            selectedPlanId: 'plan-1',
            selectedPlanCountry: 'OHADA',
            openingBalances: { bank_balance: '100' },
          }}
        />
      );

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Lancer la configuration' }));
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(initializeAccountingFromPlanSpy).toHaveBeenCalledWith('user-1', 'plan-1', 'OHADA', 'company-wizard-1');

      expect(initializeAccountingSpy).not.toHaveBeenCalled();
      expect(generateOpeningEntriesSpy).toHaveBeenCalledWith(
        expect.any(Object),
        'plan-1',
        'user-1',
        'OHADA',
        'company-wizard-1'
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });

      expect(onCompleteSpy).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows a clear error when no active company can be resolved', async () => {
    render(
      <Step5Confirmation
        onComplete={onCompleteSpy}
        onBack={onBackSpy}
        wizardData={{
          companyInfo: { company_name: 'ACME' },
          openingBalances: {},
        }}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Lancer la configuration' }));
    });

    expect(await screen.findByText("Aucune societe active ou societe du wizard n'est disponible.")).toBeInTheDocument();

    expect(initializeAccountingSpy).not.toHaveBeenCalled();
    expect(initializeAccountingFromPlanSpy).not.toHaveBeenCalled();
    expect(onCompleteSpy).not.toHaveBeenCalled();
  });
});
