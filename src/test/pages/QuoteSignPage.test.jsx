import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const invokeMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, params) => (params ? `${key}:${JSON.stringify(params)}` : key),
    i18n: { resolvedLanguage: 'fr', language: 'fr' },
  }),
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ token: 'test-token' }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: (...args) => invokeMock(...args),
    },
  },
}));

vi.mock('@/components/SignaturePad', () => ({
  default: () => <div data-testid="signature-pad" />,
}));

vi.mock('react-helmet', () => ({
  Helmet: ({ children }) => <div data-testid="helmet">{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }) => <button {...props}>{children}</button>,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }) => <div>{children}</div>,
  CardContent: ({ children }) => <div>{children}</div>,
  CardHeader: ({ children }) => <div>{children}</div>,
  CardTitle: ({ children }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props) => <input {...props} />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }) => <label {...props}>{children}</label>,
}));

import QuoteSignPage from '@/pages/QuoteSignPage';

describe('QuoteSignPage', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockImplementation((fn) => {
      if (fn === 'quote-sign-get') {
        return Promise.resolve({
          data: {
            quote: {
              id: 'quote-1',
              quote_number: 'Q-2027-001',
              total_ht: 1000,
              total_ttc: 1200,
              tax_amount: 200,
              notes: 'Contrat cadre',
              currency: 'EUR',
              document_type: 'contract',
              clients: { company_name: 'Acme SA' },
            },
          },
          error: null,
        });
      }

      return Promise.resolve({ data: null, error: null });
    });
  });

  it('shows the contract context when the signed document is a contract', async () => {
    render(<QuoteSignPage />);

    await waitFor(() => {
      expect(screen.getByText('quoteSignPage.contractTitle')).toBeTruthy();
    });
  });
});
