import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, optionsOrFallback) => {
      if (typeof optionsOrFallback === 'string') {
        return optionsOrFallback;
      }

      if (optionsOrFallback && typeof optionsOrFallback === 'object') {
        const template = optionsOrFallback.defaultValue || key;
        return String(template).replace(/\{\{(\w+)\}\}/g, (_match, token) => {
          const value = optionsOrFallback[token];
          return value == null ? '' : String(value);
        });
      }

      return key;
    },
  }),
}));

import ApprovalHistoryDialog from '@/components/suppliers/ApprovalHistoryDialog';

describe('ApprovalHistoryDialog', () => {
  it('renders workflow levels for multilevel approvals', () => {
    render(
      <ApprovalHistoryDialog
        open
        onOpenChange={() => {}}
        invoice={{
          invoice_number: 'SI-001',
          approval_status: 'pending',
          approval_steps: [
            {
              id: 'step-1',
              level: 1,
              status: 'approved',
              decided_at: '2026-03-27T10:00:00.000Z',
            },
            {
              id: 'step-2',
              level: 2,
              status: 'pending',
              decided_at: null,
            },
          ],
        }}
      />
    );

    expect(screen.getByText('SI-001')).toBeInTheDocument();
    expect(screen.getByText(/Workflow levels/i)).toBeInTheDocument();
    expect(screen.getByText('N1')).toBeInTheDocument();
    expect(screen.getByText('N2')).toBeInTheDocument();
  });
});
