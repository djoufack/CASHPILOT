import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import IntegrationsHubPage from '@/pages/IntegrationsHubPage';

vi.mock('react-helmet', () => ({
  Helmet: ({ children }) => <>{children}</>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, fallback) => fallback || key,
  }),
}));

vi.mock('@/components/settings/ConnectionSettings', () => ({
  default: () => <div data-testid="connection-settings">Connection settings</div>,
}));

vi.mock('@/components/settings/AccountingConnectors', () => ({
  default: () => <div data-testid="accounting-connectors">Accounting connectors</div>,
}));

vi.mock('@/components/settings/McpServicesCatalog', () => ({
  default: () => <div data-testid="mcp-services-catalog">MCP services</div>,
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/hooks/useIntegrationAutomationPacks', () => ({
  useIntegrationAutomationPacks: () => ({
    packs: [
      {
        id: 'pack-1',
        provider: 'zapier',
        pack_name: 'Factures impayees -> Slack Finance',
        description: 'Pack demo',
        trigger_event: 'invoice.overdue',
        target_module: 'Ventes',
        endpoint_path: '/api/v1/webhooks/invoices/overdue',
        tags: ['sales'],
        sample_payload: { invoice_number: 'FAC-1' },
        status: 'ready',
      },
    ],
    loading: false,
    error: null,
    refresh: vi.fn(),
    markPackInstalled: vi.fn(),
    setPackStatus: vi.fn(),
  }),
}));

describe('IntegrationsHubPage', () => {
  it('renders integration packs panel with actions', () => {
    render(<IntegrationsHubPage />);

    expect(screen.getByText('Packs d integration Zapier/Make')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Endpoint' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Payload' })).toBeTruthy();
  });
});
