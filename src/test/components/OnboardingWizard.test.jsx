import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  navigateSpy,
  currentStepRef,
  savingRef,
  onboardingErrorRef,
  wizardDataRef,
  nextStepSpy,
  prevStepSpy,
  completeOnboardingSpy,
} = vi.hoisted(() => ({
  navigateSpy: vi.fn(),
  currentStepRef: { value: 0 },
  savingRef: { value: false },
  onboardingErrorRef: { value: null },
  wizardDataRef: {
    companyInfo: {},
    selectedPlanId: null,
    selectedPlanCountry: null,
    openingBalances: {},
  },
  nextStepSpy: vi.fn(),
  prevStepSpy: vi.fn(),
  completeOnboardingSpy: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateSpy,
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
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => {
      const {
        initial: _initial,
        animate: _animate,
        exit: _exit,
        transition: _transition,
        whileHover: _whileHover,
        whileTap: _whileTap,
        variants: _variants,
        ...rest
      } = props;
      return <div {...rest}>{children}</div>;
    },
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

vi.mock('@/hooks/useOnboarding', () => ({
  useOnboarding: () => ({
    currentStep: currentStepRef.value,
    saving: savingRef.value,
    error: onboardingErrorRef.value,
    wizardData: wizardDataRef,
    updateWizardData: vi.fn(),
    nextStep: nextStepSpy,
    prevStep: prevStepSpy,
    completeOnboarding: completeOnboardingSpy,
  }),
}));

vi.mock('@/components/onboarding/steps/Step1Welcome', () => ({
  default: ({ onNext }) => (
    <button type="button" onClick={onNext}>
      Commencer
    </button>
  ),
}));

vi.mock('@/components/onboarding/steps/Step2CompanyInfo', () => ({
  default: () => <div>Step2</div>,
}));

vi.mock('@/components/onboarding/steps/Step3AccountingPlan', () => ({
  default: () => <div>Step3</div>,
}));

vi.mock('@/components/onboarding/steps/Step4OpeningBalances', () => ({
  default: () => <div>Step4</div>,
}));

vi.mock('@/components/onboarding/steps/Step5Confirmation', () => ({
  default: () => <div>Step5</div>,
}));

import OnboardingWizard from '@/components/onboarding/OnboardingWizard';

describe('OnboardingWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentStepRef.value = 0;
    savingRef.value = false;
    onboardingErrorRef.value = null;
    wizardDataRef.companyInfo = {};
    wizardDataRef.selectedPlanId = null;
    wizardDataRef.selectedPlanCountry = null;
    wizardDataRef.openingBalances = {};
    nextStepSpy.mockResolvedValue({ success: true, step: 1 });
    prevStepSpy.mockResolvedValue({ success: true, step: 0 });
    completeOnboardingSpy.mockResolvedValue({ success: true, completed: true, step: 5 });
  });

  it('blocks early skip before the company and plan prerequisites exist', () => {
    render(<OnboardingWizard />);

    expect(screen.queryByRole('button', { name: "Passer pour l'instant" })).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(navigateSpy).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Vous pourrez quitter l’assistant apres la creation de la societe et le choix du plan comptable.'
    );
  });

  it('allows a safe skip once the wizard is advanced and prerequisites exist', () => {
    currentStepRef.value = 3;
    wizardDataRef.companyInfo = { id: 'company-1', company_name: 'ACME' };
    wizardDataRef.selectedPlanId = 'plan-1';

    render(<OnboardingWizard />);

    fireEvent.click(screen.getByRole('button', { name: "Passer pour l'instant" }));

    expect(navigateSpy).toHaveBeenCalledWith('/app');
  });

  it('surfaces a persistence error when next step persistence fails', async () => {
    nextStepSpy.mockResolvedValue({ success: false, error: 'persist failed' });

    render(<OnboardingWizard />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Commencer' }));
      await Promise.resolve();
    });

    expect(nextStepSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert')).toHaveTextContent('persist failed');
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
