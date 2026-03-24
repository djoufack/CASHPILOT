import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  fromSpy,
  maybeSingleSpy,
  singleSpy,
  updatePayloadSpy,
  insertPayloadSpy,
  setStoredActiveCompanyIdSpy,
  toastSpy,
  onNextSpy,
  onBackSpy,
  updateWizardDataSpy,
} = vi.hoisted(() => ({
  fromSpy: vi.fn(),
  maybeSingleSpy: vi.fn(),
  singleSpy: vi.fn(),
  updatePayloadSpy: vi.fn(),
  insertPayloadSpy: vi.fn(),
  setStoredActiveCompanyIdSpy: vi.fn(),
  toastSpy: vi.fn(),
  onNextSpy: vi.fn(),
  onBackSpy: vi.fn(),
  updateWizardDataSpy: vi.fn(),
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

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: toastSpy }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('@/contexts/ReferenceDataContext', () => ({
  useReferenceData: () => ({
    countryOptions: [
      { value: 'FR', label: 'France' },
      { value: 'CI', label: "Côte d'Ivoire" },
    ],
    currencyOptions: [
      { value: 'EUR', label: 'EUR - Euro' },
      { value: 'XOF', label: 'XOF - CFA' },
    ],
  }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: fromSpy,
  },
}));

vi.mock('@/utils/activeCompanyStorage', () => ({
  setStoredActiveCompanyId: setStoredActiveCompanyIdSpy,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }) => <button {...props}>{children}</button>,
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props) => <input {...props} />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }) => <label {...props}>{children}</label>,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }) => <div>{children}</div>,
  SelectContent: ({ children }) => <div>{children}</div>,
  SelectItem: ({ children }) => <div>{children}</div>,
  SelectTrigger: ({ children }) => <div>{children}</div>,
  SelectValue: ({ children }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/searchable-select', () => ({
  SearchableSelect: ({ value, onValueChange, options = [] }) => (
    <select value={value || ''} onChange={(e) => onValueChange?.(e.target.value)}>
      <option value="">--</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

import Step2CompanyInfo from '@/components/onboarding/steps/Step2CompanyInfo';

const buildCompanyChain = () => {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: maybeSingleSpy,
    update: vi.fn((payload) => {
      updatePayloadSpy(payload);
      return chain;
    }),
    insert: vi.fn((payload) => {
      insertPayloadSpy(payload);
      return chain;
    }),
    single: singleSpy,
  };
  return chain;
};

describe('Step2CompanyInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    maybeSingleSpy.mockResolvedValue({ data: null, error: null });
    singleSpy.mockResolvedValue({ data: { id: 'company-1' }, error: null });

    fromSpy.mockImplementation((table) => {
      if (table !== 'company') {
        throw new Error(`Unexpected table in test: ${table}`);
      }
      return buildCompanyChain();
    });
  });

  it('releases saving state when save request hangs (no infinite "Sauvegarde...")', async () => {
    vi.useFakeTimers();
    singleSpy.mockImplementation(() => new Promise(() => {}));

    try {
      render(
        <Step2CompanyInfo
          onNext={onNextSpy}
          onBack={onBackSpy}
          wizardData={{ companyInfo: { company_name: 'ACME' } }}
          updateWizardData={updateWizardDataSpy}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Suivant' }));

      expect(screen.getByRole('button', { name: 'Sauvegarde...' })).toBeDisabled();

      await act(async () => {
        vi.advanceTimersByTime(15100);
        await Promise.resolve();
      });

      expect(screen.getByRole('button', { name: 'Suivant' })).not.toBeDisabled();
      expect(onNextSpy).not.toHaveBeenCalled();
      expect(toastSpy).toHaveBeenCalledTimes(1);
      expect(insertPayloadSpy).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('updates existing company by id when company id is already known', async () => {
    render(
      <Step2CompanyInfo
        onNext={onNextSpy}
        onBack={onBackSpy}
        wizardData={{ companyInfo: { id: 'company-1', company_name: 'ACME' } }}
        updateWizardData={updateWizardDataSpy}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Suivant' }));

    await waitFor(() => {
      expect(onNextSpy).toHaveBeenCalledTimes(1);
    });

    expect(updatePayloadSpy).toHaveBeenCalledTimes(1);
    expect(insertPayloadSpy).not.toHaveBeenCalled();
    expect(updateWizardDataSpy).toHaveBeenCalledWith('companyInfo', expect.objectContaining({ id: 'company-1' }));
  });

  it('sets the active company immediately after saving the company', async () => {
    render(
      <Step2CompanyInfo
        onNext={onNextSpy}
        onBack={onBackSpy}
        wizardData={{ companyInfo: { company_name: 'ACME' } }}
        updateWizardData={updateWizardDataSpy}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Suivant' }));

    await waitFor(() => {
      expect(onNextSpy).toHaveBeenCalledTimes(1);
    });

    expect(setStoredActiveCompanyIdSpy).toHaveBeenCalledWith('company-1');
  });
});
