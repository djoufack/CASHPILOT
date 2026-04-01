import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockUseAccountingClosingAssistant, refreshMock, runClosingMock, countUnpostedMock } = vi.hoisted(() => ({
  mockUseAccountingClosingAssistant: vi.fn(),
  refreshMock: vi.fn(),
  runClosingMock: vi.fn(),
  confirmClosingMock: vi.fn(),
  countUnpostedMock: vi.fn(),
}));

vi.mock('@/hooks/useAccountingClosingAssistant', () => ({
  useAccountingClosingAssistant: mockUseAccountingClosingAssistant,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, fallback) => (typeof fallback === 'string' && fallback.length > 0 ? fallback : key),
  }),
  Trans: ({ children }) => children,
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

import ClosingAssistant from '@/components/accounting/ClosingAssistant';

describe('ClosingAssistant', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    refreshMock.mockResolvedValue({ unposted: 1, history: [] });
    runClosingMock.mockResolvedValue({
      status: 'running',
      depreciationEntriesGenerated: 2,
      unpostedBefore: 1,
      unpostedAfter: 0,
      journalSummary: { gap: 0, balanced: true, totalDebit: 2000, totalCredit: 2000 },
      workflow: {
        nextAction: {
          key: 'finalize_closing_validation',
        },
        progress: {
          completed: 2,
          total: 3,
          percent: 67,
        },
        milestones: [],
      },
    });
    countUnpostedMock.mockResolvedValue(1);

    mockUseAccountingClosingAssistant.mockReturnValue({
      loading: false,
      running: false,
      closingHistory: [],
      latestClosure: null,
      countUnpostedDepreciation: countUnpostedMock,
      runClosing: runClosingMock,
      confirmClosing: vi.fn(),
      refresh: refreshMock,
    });
  });

  it('runs assisted closing for the provided period', async () => {
    const user = userEvent.setup();
    render(
      <ClosingAssistant
        period={{
          startDate: '2026-03-01',
          endDate: '2026-03-31',
        }}
      />
    );

    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalled();
    });

    expect(screen.getByRole('heading', { name: /Cloture assistee/i })).toBeInTheDocument();
    expect(screen.getByText(/Workflow de cloture guidee/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Executer controles J\+5 \/ J\+10/i }));

    expect(runClosingMock).toHaveBeenCalledWith({
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
      finalizeClosing: false,
    });
  });
});
