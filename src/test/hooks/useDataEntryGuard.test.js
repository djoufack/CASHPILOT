import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockToast = vi.fn();
vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/utils/dataEntryGuard', () => ({
  runDataEntryGuard: vi.fn(),
}));

import { useDataEntryGuard } from '@/hooks/useDataEntryGuard';
import { runDataEntryGuard } from '@/utils/dataEntryGuard';

describe('useDataEntryGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns guardInput function', () => {
    const { guardInput } = useDataEntryGuard();
    expect(typeof guardInput).toBe('function');
  });

  it('throws and toasts on blocking issues', () => {
    runDataEntryGuard.mockReturnValue({
      blockingIssues: [
        {
          message: 'Amount is required',
          howToFix: 'Enter an amount.',
        },
      ],
      corrections: [],
      warnings: [],
      sanitizedPayload: {},
      sanitizedItems: [],
    });

    const { guardInput } = useDataEntryGuard();

    expect(() => guardInput({ entity: 'expense', payload: {} })).toThrow('Amount is required Enter an amount.');

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Saisie bloquee',
        variant: 'destructive',
      })
    );
  });

  it('attaches guardReport to thrown error', () => {
    const report = {
      blockingIssues: [{ message: 'Error', howToFix: null }],
      corrections: [],
      warnings: [],
      sanitizedPayload: {},
      sanitizedItems: [],
    };
    runDataEntryGuard.mockReturnValue(report);

    const { guardInput } = useDataEntryGuard();
    let caughtError;
    try {
      guardInput({ entity: 'expense', payload: {} });
    } catch (e) {
      caughtError = e;
    }
    expect(caughtError.guardReport).toBe(report);
  });

  it('uses message without howToFix when howToFix is missing', () => {
    runDataEntryGuard.mockReturnValue({
      blockingIssues: [{ message: 'Simple error' }],
      corrections: [],
      warnings: [],
      sanitizedPayload: {},
      sanitizedItems: [],
    });

    const { guardInput } = useDataEntryGuard();
    expect(() => guardInput({ entity: 'expense', payload: {} })).toThrow('Simple error');
  });

  it('returns sanitized payload and items on valid input', () => {
    runDataEntryGuard.mockReturnValue({
      blockingIssues: [],
      corrections: [],
      warnings: [],
      sanitizedPayload: { amount: 100 },
      sanitizedItems: [],
    });

    const { guardInput } = useDataEntryGuard();
    const result = guardInput({ entity: 'expense', payload: { amount: '100' } });

    expect(result.payload).toEqual({ amount: 100 });
    expect(result.items).toEqual([]);
    expect(result.report).toBeDefined();
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('toasts correction notification when corrections exist', () => {
    runDataEntryGuard.mockReturnValue({
      blockingIssues: [],
      corrections: [{ message: 'Tax rate normalized.' }],
      warnings: [],
      sanitizedPayload: { tax_rate: 21 },
      sanitizedItems: [],
    });

    const { guardInput } = useDataEntryGuard();
    guardInput({ entity: 'invoice', payload: { tax_rate: 0.21 } });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Controle de saisie',
        duration: 7000,
      })
    );
  });

  it('toasts warning notification when warnings exist', () => {
    runDataEntryGuard.mockReturnValue({
      blockingIssues: [],
      corrections: [],
      warnings: [{ message: 'Currency looks odd', howToFix: 'Use ISO code.' }],
      sanitizedPayload: {},
      sanitizedItems: [],
    });

    const { guardInput } = useDataEntryGuard();
    guardInput({ entity: 'expense', payload: {} });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Controle de saisie',
        description: expect.stringContaining('Currency looks odd'),
      })
    );
  });

  it('combines correction and warning in notification', () => {
    runDataEntryGuard.mockReturnValue({
      blockingIssues: [],
      corrections: [{ message: 'Fixed value.' }],
      warnings: [{ message: 'Watch out', howToFix: 'Check.' }],
      sanitizedPayload: {},
      sanitizedItems: [],
    });

    const { guardInput } = useDataEntryGuard();
    guardInput({ entity: 'expense', payload: {} });

    expect(mockToast).toHaveBeenCalledTimes(1);
    const desc = mockToast.mock.calls[0][0].description;
    expect(desc).toContain('Fixed value.');
    expect(desc).toContain('Watch out');
  });

  it('does not toast when no corrections or warnings', () => {
    runDataEntryGuard.mockReturnValue({
      blockingIssues: [],
      corrections: [],
      warnings: [],
      sanitizedPayload: {},
      sanitizedItems: [],
    });

    const { guardInput } = useDataEntryGuard();
    guardInput({ entity: 'expense', payload: {} });
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('passes all parameters to runDataEntryGuard', () => {
    runDataEntryGuard.mockReturnValue({
      blockingIssues: [],
      corrections: [],
      warnings: [],
      sanitizedPayload: {},
      sanitizedItems: [],
    });

    const { guardInput } = useDataEntryGuard();
    guardInput({
      entity: 'invoice',
      operation: 'create',
      payload: { client_id: 'c1' },
      items: [{ description: 'x' }],
      referencePayload: { old: true },
      options: { maxAmount: 500 },
    });

    expect(runDataEntryGuard).toHaveBeenCalledWith({
      entity: 'invoice',
      operation: 'create',
      payload: { client_id: 'c1' },
      items: [{ description: 'x' }],
      referencePayload: { old: true },
      options: { maxAmount: 500 },
    });
  });
});
