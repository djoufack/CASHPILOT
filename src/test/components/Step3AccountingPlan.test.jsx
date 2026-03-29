import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromSpy, onNextSpy, onBackSpy, updateWizardDataSpy, xlsxReadSpy, sheetToJsonSpy } = vi.hoisted(() => ({
  fromSpy: vi.fn(),
  onNextSpy: vi.fn(),
  onBackSpy: vi.fn(),
  updateWizardDataSpy: vi.fn(),
  xlsxReadSpy: vi.fn(),
  sheetToJsonSpy: vi.fn(),
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

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }) => <button {...props}>{children}</button>,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: fromSpy,
  },
}));

vi.mock('xlsx', () => ({
  read: xlsxReadSpy,
  utils: {
    sheet_to_json: sheetToJsonSpy,
  },
}));

vi.mock('lucide-react', () => ({
  ArrowLeft: () => null,
  ArrowRight: () => null,
  FileText: () => null,
  Upload: () => null,
  CheckCircle2: () => null,
  ChevronDown: () => null,
  ChevronUp: () => null,
}));

import Step3AccountingPlan from '@/components/onboarding/steps/Step3AccountingPlan';

const buildPlanChain = () => {
  const resolved = Promise.resolve({ data: [], error: null });
  const chain = {
    select: vi.fn(() => chain),
    or: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => resolved),
  };
  return chain;
};

const getImportButton = () =>
  screen.getAllByRole('button').find((button) => button.textContent?.includes('Importer mon plan comptable'));

describe('Step3AccountingPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    fromSpy.mockImplementation((table) => {
      if (table !== 'accounting_plans') {
        throw new Error(`Unexpected table in test: ${table}`);
      }
      return buildPlanChain();
    });

    xlsxReadSpy.mockReturnValue({
      Sheets: {
        Plan1: {},
      },
      SheetNames: ['Plan1'],
    });

    sheetToJsonSpy.mockReturnValue([
      ['Code', 'Nom', 'Type'],
      ['100', 'Capital', 'equity'],
      ['512', 'Banque', 'asset'],
    ]);
  });

  it('parses a real xlsx file and keeps account selection usable', async () => {
    render(
      <Step3AccountingPlan
        onNext={onNextSpy}
        onBack={onBackSpy}
        wizardData={{ selectedPlanId: null }}
        updateWizardData={updateWizardDataSpy}
      />
    );

    await waitFor(() => {
      expect(getImportButton()).toBeTruthy();
    });
    const importButton = getImportButton();
    fireEvent.click(importButton);

    const fileInput = screen.getByLabelText('Choisir un fichier a importer');
    const file = new File([new Uint8Array([80, 75, 3, 4])], 'plan.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    Object.defineProperty(file, 'arrayBuffer', {
      value: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('2 comptes detectes')).toBeInTheDocument();
    });
    expect(xlsxReadSpy).toHaveBeenCalledTimes(1);
    expect(sheetToJsonSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Fichier/i)).not.toBeInTheDocument();
  });

  it('shows a readable error when an xlsx file cannot be parsed', async () => {
    xlsxReadSpy.mockImplementation(() => {
      throw new Error('Workbook corrupted');
    });

    render(
      <Step3AccountingPlan
        onNext={onNextSpy}
        onBack={onBackSpy}
        wizardData={{ selectedPlanId: null }}
        updateWizardData={updateWizardDataSpy}
      />
    );

    await waitFor(() => {
      expect(getImportButton()).toBeTruthy();
    });
    fireEvent.click(getImportButton());

    const fileInput = screen.getByLabelText('Choisir un fichier a importer');
    const file = new File([new Uint8Array([1, 2, 3])], 'broken.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    Object.defineProperty(file, 'arrayBuffer', {
      value: vi.fn().mockResolvedValue(new ArrayBuffer(3)),
    });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(
        screen.getByText("Impossible de lire ce fichier Excel. Verifiez que le fichier n'est pas corrompu.")
      ).toBeInTheDocument();
    });
    expect(onNextSpy).not.toHaveBeenCalled();
  });
});
