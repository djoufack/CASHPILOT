import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
  }),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => {
      const {
        whileHover: _whileHover,
        whileTap: _whileTap,
        initial: _initial,
        animate: _animate,
        exit: _exit,
        transition: _transition,
        variants: _variants,
        ...rest
      } = props;
      return <div {...rest}>{children}</div>;
    },
  },
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }) => <button {...props}>{children}</button>,
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/hooks/useCompany', () => ({
  useCompany: () => ({
    company: { id: 'company-1', company_name: 'Test Company', peppol_endpoint_id: null },
  }),
}));

vi.mock('@/hooks/useInvoiceSettings', () => ({
  useInvoiceSettings: () => ({
    settings: { color_theme: 'classic', template_id: 'classic' },
  }),
}));

vi.mock('@/hooks/useCreditsGuard', () => ({
  useCreditsGuard: () => ({
    guardedAction: (_cost, _label, action) => action(),
    modalProps: { open: false },
  }),
  CREDIT_COSTS: {
    PDF_INVOICE: 1,
  },
}));

vi.mock('@/hooks/usePeppolSend', () => ({
  usePeppolSend: () => ({
    sendViaPeppol: vi.fn(),
    sending: false,
    canUsePeppol: false,
    creditsModalProps: { open: false },
  }),
}));

vi.mock('@/services/exportPDF', () => ({
  exportInvoiceToPDF: vi.fn(),
}));

vi.mock('@/services/exportUBL', () => ({
  exportUBL: vi.fn(),
}));

vi.mock('@/services/exportFacturX', () => ({
  exportFacturXPdf: vi.fn(),
  validateForFacturX: vi.fn().mockReturnValue({ isValid: true, errors: [] }),
}));

vi.mock('@/services/pdfExportRuntime', () => ({
  saveElementAsPdfBytes: vi.fn(),
}));

vi.mock('@/config/invoiceThemes', () => ({
  getTheme: () => ({}),
}));

vi.mock('@/config/invoiceTemplates', () => ({
  DEFAULT_INVOICE_TEMPLATE_ID: 'classic',
}));

vi.mock('@/components/CreditsGuardModal', () => ({
  default: () => null,
}));

vi.mock('@/components/peppol/PeppolStatusBadge', () => ({
  default: () => null,
}));

vi.mock('@/components/invoice-templates/ClassicTemplate', () => ({
  default: () => <div data-testid="invoice-template" />,
}));
vi.mock('@/components/invoice-templates/ModernTemplate', () => ({
  default: () => <div data-testid="invoice-template" />,
}));
vi.mock('@/components/invoice-templates/MinimalTemplate', () => ({
  default: () => <div data-testid="invoice-template" />,
}));
vi.mock('@/components/invoice-templates/BoldTemplate', () => ({
  default: () => <div data-testid="invoice-template" />,
}));
vi.mock('@/components/invoice-templates/ProfessionalTemplate', () => ({
  default: () => <div data-testid="invoice-template" />,
}));
vi.mock('@/components/invoice-templates/DMGDefaultTemplate', () => ({
  default: () => <div data-testid="invoice-template" />,
}));

import InvoicePreview from '@/components/InvoicePreview';

const baseInvoice = {
  id: 'inv-1',
  invoice_number: 'INV-001',
  status: 'sent',
  payment_status: 'unpaid',
  total_ttc: 1200,
};

describe('InvoicePreview payment link entry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a direct payment action when no payment link exists', () => {
    const onGeneratePaymentLink = vi.fn();

    render(
      <InvoicePreview
        invoice={baseInvoice}
        client={{ company_name: 'Acme Corp', preferred_currency: 'EUR' }}
        items={[]}
        onGeneratePaymentLink={onGeneratePaymentLink}
      />
    );

    const generateButton = screen.getByRole('button', { name: 'invoices.generatePaymentLink' });
    expect(generateButton).toBeTruthy();

    fireEvent.click(generateButton);
    expect(onGeneratePaymentLink).toHaveBeenCalledWith(baseInvoice);
  });

  it('shows copy and open actions when a payment link already exists', () => {
    render(
      <InvoicePreview
        invoice={{
          ...baseInvoice,
          stripe_payment_link_url: 'https://pay.stripe.com/link/abc123',
        }}
        client={{ company_name: 'Acme Corp', preferred_currency: 'EUR' }}
        items={[]}
      />
    );

    expect(screen.getByRole('button', { name: 'invoices.copyPaymentLink' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'invoices.openPaymentLink' })).toBeTruthy();
  });
});
