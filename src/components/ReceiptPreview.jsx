
import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useCompany } from '@/hooks/useCompany';
import { useInvoiceSettings } from '@/hooks/useInvoiceSettings';
import { getTheme } from '@/config/invoiceThemes';
import { formatCurrency } from '@/utils/calculations';
import { exportReceiptToPDF } from '@/services/exportReceiptPDF';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';

const ReceiptPreview = ({ payment, invoice, client, allocations = [] }) => {
  const { t } = useTranslation();
  const receiptRef = useRef();
  const { company } = useCompany();
  const { settings } = useInvoiceSettings();
  const { toast } = useToast();
  const theme = getTheme(settings?.color_theme);

  const currency = client?.preferredCurrency || client?.preferred_currency || 'EUR';

  const handleExportPDF = async () => {
    try {
      await exportReceiptToPDF(
        receiptRef.current,
        payment.receipt_number,
        payment.payment_date
      );
      toast({ title: t('common.success'), description: t('receipts.exported') });
    } catch (err) {
      toast({ title: t('common.error'), description: t('receipts.exportError'), variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleExportPDF} className="bg-orange-500 hover:bg-orange-600">
          <Download className="w-4 h-4 mr-2" />
          {t('receipts.exportPDF')}
        </Button>
      </div>

      <div ref={receiptRef} className="bg-white text-black p-6 md:p-8 rounded-lg shadow-xl" style={{ fontFamily: settings?.font_family || 'Inter' }}>
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              {settings?.show_logo && company?.logo_url && (
                <img src={company.logo_url} alt="Logo" className="h-12 w-auto object-contain" />
              )}
              <h1 className="text-2xl font-bold" style={{ color: theme.primary }}>
                {company?.company_name || t('app.name')}
              </h1>
            </div>
            {company && (
              <div className="text-sm space-y-0.5" style={{ color: theme.textLight }}>
                {company.address && <p>{company.address}</p>}
                {(company.postal_code || company.city) && <p>{company.postal_code} {company.city}</p>}
                {company.phone && <p>Tel: {company.phone}</p>}
                {company.email && <p>{company.email}</p>}
              </div>
            )}
          </div>
          <div className="text-right">
            <h2 className="text-3xl font-bold" style={{ color: theme.accent }}>
              {t('receipts.title')}
            </h2>
            <p className="font-mono text-sm mt-2" style={{ color: theme.textLight }}>
              {payment.receipt_number}
            </p>
          </div>
        </div>

        <div className="h-px mb-6" style={{ backgroundColor: theme.border }} />

        {/* Payment details */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <p className="text-xs uppercase tracking-widest mb-2 font-semibold" style={{ color: theme.accent }}>
              {t('receipts.receivedFrom')}
            </p>
            <p className="font-bold text-lg">{client?.company_name || client?.companyName}</p>
            <p>{client?.contact_name || client?.contactName}</p>
            {client?.address && <p className="text-sm" style={{ color: theme.textLight }}>{client.address}</p>}
            {(client?.postal_code || client?.city) && <p className="text-sm" style={{ color: theme.textLight }}>{client.postal_code} {client.city}</p>}
            {client?.email && <p className="text-sm" style={{ color: theme.textLight }}>{client.email}</p>}
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest mb-2 font-semibold" style={{ color: theme.accent }}>
              {t('receipts.paymentDetails')}
            </p>
            <table className="text-sm">
              <tbody>
                <tr>
                  <td className="pr-4 py-1" style={{ color: theme.textLight }}>{t('payments.date')}:</td>
                  <td className="font-semibold">{payment.payment_date ? format(new Date(payment.payment_date), 'dd/MM/yyyy') : '-'}</td>
                </tr>
                <tr>
                  <td className="pr-4 py-1" style={{ color: theme.textLight }}>{t('payments.method')}:</td>
                  <td className="font-semibold">{t(`payments.${payment.payment_method}`)}</td>
                </tr>
                {payment.reference && (
                  <tr>
                    <td className="pr-4 py-1" style={{ color: theme.textLight }}>{t('payments.reference')}:</td>
                    <td className="font-semibold font-mono text-xs">{payment.reference}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Amount box */}
        <div className="p-6 rounded-lg mb-8 text-center" style={{ backgroundColor: theme.secondary }}>
          <p className="text-sm uppercase tracking-widest mb-2" style={{ color: theme.textLight }}>{t('receipts.amountReceived')}</p>
          <p className="text-4xl font-bold" style={{ color: theme.primary }}>
            {formatCurrency(Number(payment.amount), currency)}
          </p>
        </div>

        {/* Invoice reference(s) */}
        {(invoice || (allocations && allocations.length > 0)) && (
          <div className="mb-8">
            <p className="text-xs uppercase tracking-widest mb-3 font-semibold" style={{ color: theme.accent }}>
              {t('receipts.appliedTo')}
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: `2px solid ${theme.border}` }}>
                  <th className="text-left py-2" style={{ color: theme.textLight }}>{t('invoices.invoiceNumber')}</th>
                  <th className="text-right py-2" style={{ color: theme.textLight }}>{t('invoices.totalTTC')}</th>
                  <th className="text-right py-2" style={{ color: theme.textLight }}>{t('receipts.applied')}</th>
                  <th className="text-right py-2" style={{ color: theme.textLight }}>{t('payments.balanceDue')}</th>
                </tr>
              </thead>
              <tbody>
                {invoice && !payment.is_lump_sum && (
                  <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                    <td className="py-2 font-medium">{invoice.invoice_number}</td>
                    <td className="text-right py-2">{formatCurrency(Number(invoice.total_ttc || 0), currency)}</td>
                    <td className="text-right py-2 font-semibold" style={{ color: theme.accent }}>{formatCurrency(Number(payment.amount), currency)}</td>
                    <td className="text-right py-2">{formatCurrency(Number(invoice.balance_due || 0), currency)}</td>
                  </tr>
                )}
                {allocations.map((alloc, index) => (
                  <tr key={index} style={{ borderBottom: `1px solid ${theme.border}` }}>
                    <td className="py-2 font-medium">{alloc.invoice?.invoice_number || '-'}</td>
                    <td className="text-right py-2">{formatCurrency(Number(alloc.invoice?.total_ttc || 0), currency)}</td>
                    <td className="text-right py-2 font-semibold" style={{ color: theme.accent }}>{formatCurrency(Number(alloc.amount), currency)}</td>
                    <td className="text-right py-2">-</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Notes */}
        {payment.notes && (
          <div className="mb-6 p-4 rounded" style={{ backgroundColor: theme.secondary }}>
            <p className="text-xs font-semibold mb-1" style={{ color: theme.accent }}>{t('timesheets.notes')}</p>
            <p className="text-sm whitespace-pre-line">{payment.notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs pt-4" style={{ borderTop: `1px solid ${theme.border}`, color: theme.textLight }}>
          <p>{settings?.footer_text || `${company?.company_name || t('app.name')} — ${t('receipts.thankYou')}`}</p>
          {company?.registration_number && <p className="mt-1">SIRET: {company.registration_number} {company.tax_id ? `- TVA: ${company.tax_id}` : ''}</p>}
        </div>
      </div>
    </div>
  );
};

export default ReceiptPreview;
