import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── hoisted spies ────────────────────────────────────────────────────────────
const { fromSpy, onNextSpy, onBackSpy, updateWizardDataSpy, excelJsLoadSpy } = vi.hoisted(() => ({
  fromSpy: vi.fn(),
  onNextSpy: vi.fn(),
  onBackSpy: vi.fn(),
  updateWizardDataSpy: vi.fn(),
  excelJsLoadSpy: vi.fn(),
}));

// ── Mock ExcelJS ─────────────────────────────────────────────────────────────
vi.mock('exceljs', () => {
  const defaultRows = [
    [
      { value: 'Code', col: 1 },
      { value: 'Nom', col: 2 },
      { value: 'Type', col: 3 },
    ],
    [
      { value: '100', col: 1 },
      { value: 'Capital', col: 2 },
      { value: 'equity', col: 3 },
    ],
    [
      { value: '512', col: 1 },
      { value: 'Banque', col: 2 },
      { value: 'asset', col: 3 },
    ],
  ];

  const makeWorksheet = (rows) => ({
    eachRow(_opts, cb) {
      rows.forEach((cells, i) => {
        cb(
          {
            eachCell(_o, cb2) {
              cells.forEach((c) => cb2(c));
            },
          },
          i + 1
        );
      });
    },
  });

  // ExcelJS default export is the module itself; `new ExcelJS.Workbook()` is the usage pattern
  class WorkbookClass {
    constructor() {
      this.xlsx = { load: excelJsLoadSpy };
      this.worksheets = [makeWorksheet(defaultRows)];
    }
  }

  return {
    default: { Workbook: WorkbookClass },
  };
});

// ── Other mocks ───────────────────────────────────────────────────────────────
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
  supabase: { from: fromSpy },
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

// ── Helpers ──────────────────────────────────────────────────────────────────
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
  screen.getAllByRole('button').find((b) => b.textContent?.includes('Importer mon plan comptable'));

const uploadFile = (fileInput, name = 'plan.xlsx') => {
  const file = new File([new Uint8Array([80, 75, 3, 4])], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  Object.defineProperty(file, 'arrayBuffer', {
    value: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
  });
  fireEvent.change(fileInput, { target: { files: [file] } });
  return file;
};

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('Step3AccountingPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    excelJsLoadSpy.mockResolvedValue(undefined);
    fromSpy.mockImplementation((table) => {
      if (table !== 'accounting_plans') throw new Error(`Unexpected table: ${table}`);
      return buildPlanChain();
    });
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

    await waitFor(() => expect(getImportButton()).toBeTruthy());
    fireEvent.click(getImportButton());

    const fileInput = screen.getByLabelText('Choisir un fichier a importer');
    uploadFile(fileInput);

    await waitFor(() => {
      expect(screen.getByText('2 comptes detectes')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Fichier/i)).not.toBeInTheDocument();
  });

  it('shows a readable error when an xlsx file cannot be parsed', async () => {
    excelJsLoadSpy.mockRejectedValue(new Error('Workbook corrupted'));

    render(
      <Step3AccountingPlan
        onNext={onNextSpy}
        onBack={onBackSpy}
        wizardData={{ selectedPlanId: null }}
        updateWizardData={updateWizardDataSpy}
      />
    );

    await waitFor(() => expect(getImportButton()).toBeTruthy());
    fireEvent.click(getImportButton());

    const fileInput = screen.getByLabelText('Choisir un fichier a importer');
    uploadFile(fileInput, 'broken.xlsx');

    await waitFor(() => {
      expect(
        screen.getByText("Impossible de lire ce fichier Excel. Verifiez que le fichier n'est pas corrompu.")
      ).toBeInTheDocument();
    });
    expect(onNextSpy).not.toHaveBeenCalled();
  });
});
