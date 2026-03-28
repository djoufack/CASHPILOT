import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const { mockUseInterCompany, mockAutoCompute } = vi.hoisted(() => ({
  mockUseInterCompany: vi.fn(),
  mockAutoCompute: vi.fn(),
}));

vi.mock('react-helmet', () => ({
  Helmet: ({ children }) => <div>{children}</div>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key, fallback) => fallback || _key,
  }),
}));

vi.mock('@/components/intercompany/InterCompanyLinksList', () => ({
  default: () => <div data-testid="intercompany-links-list">Links</div>,
}));

vi.mock('@/components/intercompany/TransferPricingPanel', () => ({
  default: () => <div data-testid="transfer-pricing-panel">Pricing</div>,
}));

vi.mock('@/components/intercompany/EliminationSummary', () => ({
  default: () => <div data-testid="elimination-summary">Eliminations</div>,
}));

vi.mock('@/hooks/useInterCompany', () => ({
  useInterCompany: mockUseInterCompany,
}));

import InterCompanyPage from '@/pages/InterCompanyPage';

describe('InterCompanyPage', () => {
  it('renders and triggers automatic elimination processing', async () => {
    const user = userEvent.setup();
    mockUseInterCompany.mockReturnValue({
      links: [],
      transactions: [],
      pricingRules: [],
      eliminations: [],
      loading: false,
      fetchData: vi.fn(),
      createLink: vi.fn(),
      toggleLink: vi.fn(),
      deleteLink: vi.fn(),
      updatePricingRule: vi.fn(),
      deletePricingRule: vi.fn(),
      computeEliminations: vi.fn(),
      autoComputeEliminations: mockAutoCompute,
    });

    render(<InterCompanyPage />);

    const autoButton = screen.getByTestId('intercompany-auto-elimination-button');
    expect(autoButton).toBeInTheDocument();

    await user.click(autoButton);
    expect(mockAutoCompute).toHaveBeenCalledTimes(1);
  });
});
