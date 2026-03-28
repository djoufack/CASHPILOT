import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockUseCfoChat = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useCfoChat', () => ({
  useCfoChat: mockUseCfoChat,
}));

import CfoChatPanel from '@/components/cfo/CfoChatPanel';

describe('CfoChatPanel', () => {
  it('renders source evidence below assistant answers', () => {
    mockUseCfoChat.mockReturnValue({
      messages: [
        {
          role: 'assistant',
          content: 'Analyse CFO avec preuves source.',
          timestamp: '2026-03-23T10:00:00.000Z',
          toolCalls: [
            {
              type: 'source_evidence',
              tables_used: ['invoices', 'expenses', 'payments'],
              metrics: {
                totalRevenue: 1500,
                totalExpenses: 425.75,
                netResult: 1074.25,
                totalPaid: 900,
                unpaidTotal: 600,
                overdueCount: 2,
                clientCount: 4,
                invoiceCount: 7,
              },
              generated_at: '2026-03-23T10:00:00.000Z',
            },
          ],
        },
      ],
      loading: false,
      suggestions: [],
      sendMessage: vi.fn(),
      clearHistory: vi.fn(),
    });

    render(<CfoChatPanel />);

    expect(screen.getByText('Preuves source')).toBeInTheDocument();
    expect(screen.getByText('Tables utilisées')).toBeInTheDocument();
    expect(screen.getByText('Chiffres clés')).toBeInTheDocument();
    expect(screen.getByText('invoices, expenses, payments')).toBeInTheDocument();
    expect(screen.getByText(/CA total/i)).toBeInTheDocument();
    expect(screen.getByText(/1 500,00 EUR/i)).toBeInTheDocument();
  });
});
