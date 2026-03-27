import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/cfo/CfoChatPanel', () => ({
  default: () => <div data-testid="cfo-chat-panel">Chat</div>,
}));

vi.mock('@/components/cfo/CfoInsightsCard', () => ({
  default: () => <div data-testid="cfo-insights-card">Insights</div>,
}));

vi.mock('@/components/cfo/CfoAlertsList', () => ({
  default: () => <div data-testid="cfo-alerts-list">Alerts</div>,
}));

vi.mock('@/components/cfo/CfoGuidedActionsPanel', () => ({
  default: () => <div data-testid="cfo-guided-actions-panel">Guided actions</div>,
}));

vi.mock('react-helmet', () => ({
  Helmet: ({ children }) => <div>{children}</div>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key, fallback) => fallback || _key,
  }),
}));

import CfoPage from '@/pages/CfoPage';

describe('CfoPage', () => {
  it('renders the guided actions panel on the CFO page', () => {
    render(<CfoPage />);

    expect(screen.getByTestId('cfo-guided-actions-panel')).toBeInTheDocument();
    expect(screen.getByTestId('cfo-chat-panel')).toBeInTheDocument();
    expect(screen.getByTestId('cfo-insights-card')).toBeInTheDocument();
    expect(screen.getByTestId('cfo-alerts-list')).toBeInTheDocument();
  });
});
