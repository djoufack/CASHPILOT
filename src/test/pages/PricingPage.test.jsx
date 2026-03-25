import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const navigateSpy = vi.fn();
const toastSpy = vi.fn();
const subscribeSpy = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateSpy,
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

vi.mock('react-helmet', () => ({
  Helmet: ({ children }) => <>{children}</>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, fallback) => fallback || key,
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
  }),
}));

vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({
    plans: [
      {
        id: 'free-plan',
        slug: 'free',
        name: 'Legacy Free',
        price_cents: 0,
        credits_per_month: 0,
        features: ['Legacy'],
      },
      {
        id: 'starter-plan',
        slug: 'starter',
        name: 'Starter',
        price_cents: 1000,
        credits_per_month: 100,
        features: ['Feature A'],
      },
    ],
    currentPlan: null,
    subscriptionStatus: 'none',
    subscribing: null,
    subscribe: subscribeSpy,
  }),
}));

vi.mock('@/hooks/useCredits', () => ({
  useCredits: () => ({
    packages: [
      {
        id: 'pkg-1',
        name: 'Pack 100',
        credits: 100,
        price_cents: 1000,
        currency: 'EUR',
      },
    ],
    credits: { free_credits: 0, paid_credits: 0, subscription_credits: 0, total_used: 0 },
    availableCredits: 0,
    unlimitedAccess: false,
    unlimitedAccessLabel: null,
  }),
}));

vi.mock('@/hooks/useEntitlements', () => ({
  useEntitlements: () => ({
    trialActive: false,
    trialEndsAt: null,
    fullAccessOverride: false,
    accessLabel: null,
  }),
}));

vi.mock('@/hooks/useCreditsGuard', () => ({
  CREDIT_COSTS: {
    PDF_REPORT: 1,
    EXPORT_HTML: 1,
  },
  CREDIT_CATEGORIES: {
    FINANCIAL_STATEMENTS: ['PDF_REPORT'],
    COMMERCIAL_DOCUMENTS: ['PDF_REPORT'],
    ANALYTICAL_REPORTS: ['PDF_REPORT'],
    PEPPOL: ['PDF_REPORT'],
  },
  CREDIT_COST_LABELS: {
    PDF_REPORT: 'credits.costs.pdfReport',
  },
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: toastSpy,
  }),
}));

vi.mock('@/services/stripeService', () => ({
  createCheckoutSession: vi.fn(),
  redirectToCheckout: vi.fn(),
  formatPrice: (value, currency) => `${Number(value || 0).toFixed(2)} ${currency || 'EUR'}`,
}));

vi.mock('@/services/subscriptionService', () => ({
  createSubscriptionCheckout: vi.fn(),
}));

import PricingPage from '@/pages/PricingPage';

describe('PricingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render the legacy free plan card or one-shot credit packs', () => {
    render(<PricingPage />);

    expect(screen.queryByText('Legacy Free')).not.toBeInTheDocument();
    expect(screen.queryByText('pricing.creditPacks')).not.toBeInTheDocument();
    expect(screen.queryByText('Pack 100')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'pricing.subscribe' }).length).toBeGreaterThan(0);
  });

  it('renders trial choice and routes guests to signup trial flow', async () => {
    render(<PricingPage />);

    const trialButton = screen.getByRole('button', { name: 'Choisir la période d’essai (30 jours)' });
    await userEvent.click(trialButton);

    expect(navigateSpy).toHaveBeenCalledWith('/signup?trial=30d&redirect=/app');
  });
});
