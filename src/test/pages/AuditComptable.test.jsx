import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const mockRunAudit = vi.fn();

vi.mock('@/hooks/useAuditComptable', () => ({
  AUTO_FIXABLE_AUDIT_CHECK_IDS: ['zero_entries', 'chart_coherence', 'fec_conformity'],
  useAuditComptable: () => ({
    auditResult: null,
    loading: false,
    error: null,
    runAudit: mockRunAudit,
    applyAutoFixes: vi.fn(),
    fixing: false,
    fixReport: null,
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key, fallback) => fallback || _key,
  }),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
  },
}));

vi.mock('react-helmet', () => ({
  Helmet: ({ children }) => <div>{children}</div>,
}));

import AuditComptable from '@/pages/AuditComptable';

describe('AuditComptable autorun', () => {
  it('runs the audit once from query params', () => {
    render(
      <MemoryRouter initialEntries={['/app/audit-comptable?autoRun=1&start=2026-01-01&end=2026-03-27']}>
        <AuditComptable />
      </MemoryRouter>
    );

    expect(mockRunAudit).toHaveBeenCalledTimes(1);
    expect(mockRunAudit).toHaveBeenCalledWith('2026-01-01', '2026-03-27');
    expect(screen.getByText('Audit Comptable')).toBeInTheDocument();
  });
});
