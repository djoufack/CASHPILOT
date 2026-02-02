import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatCurrency, calculateItemDiscount } from '@/utils/calculations';
import { format } from 'date-fns';
import {
  EnhancedHeaderNote, EnhancedFooterNote, EnhancedTerms,
  EnhancedCustomFields, EnhancedShippingTotalRow, EnhancedAdjustmentTotalRow,
  hasHsnCodes
} from './TemplateEnhancedSections';

const ModernTemplate = ({ invoice, client, items, company, theme, settings }) => {
  const { t } = useTranslation();
  const getLabel = (key, def) => settings?.custom_labels?.[key] || def;

  const hasItemDiscounts = items?.some(item =>
    item.discount_type && item.discount_type !== 'none' && Number(item.discount_value) > 0
  );
  const hasGlobalDiscount = invoice.discount_type && invoice.discount_type !== 'none' && Number(invoice.discount_amount) > 0;
  const hasPayments = Number(invoice.amount_paid) > 0;
  const currency = client?.preferredCurrency || client?.preferred_currency || 'EUR';
  const showHsn = hasHsnCodes(items);

  return (
    <div className="bg-white text-black flex" style={{ fontFamily: settings?.font_family || 'Inter', color: theme.text }}>
      {/* Accent sidebar */}
      <div className="w-2 min-h-full flex-shrink-0" style={{ backgroundColor: theme.accent }} />

      <div className="flex-1 p-6 md:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start mb-10 gap-4">
          <div>
            {settings?.show_logo && company?.logo_url && (
              <img src={company.logo_url} alt="Logo" className="h-10 w-auto object-contain mb-3" />
            )}
            <h1 className="text-2xl font-light tracking-wide uppercase" style={{ color: theme.primary }}>
              {getLabel('invoiceTitle', 'INVOICE')}
            </h1>
            <p className="text-lg font-semibold mt-1" style={{ color: theme.accent }}>
              {invoice.invoice_number || invoice.invoiceNumber}
            </p>
            {invoice.reference && (
              <p className="text-sm mt-1" style={{ color: theme.textLight }}>Ref: {invoice.reference}</p>
            )}
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold" style={{ color: theme.primary }}>
              {company?.company_name || t('app.name')}
            </h2>
            {company && (
              <div className="text-sm mt-1 space-y-0.5" style={{ color: theme.textLight }}>
                {company.address && <p>{company.address}</p>}
                {(company.postal_code || company.city) && <p>{company.postal_code} {company.city}</p>}
                {company.email && <p>{company.email}</p>}
                {company.phone && <p>{company.phone}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px mb-8" style={{ backgroundColor: theme.border }} />

        {/* Custom Fields */}
        <EnhancedCustomFields invoice={invoice} theme={theme} className="mb-4 p-3 rounded-lg" />

        {/* Client + Dates in cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <div className="sm:col-span-2 p-4 rounded-lg" style={{ backgroundColor: theme.secondary }}>
            <p className="text-xs uppercase tracking-wide mb-2 font-semibold" style={{ color: theme.accent }}>
              {getLabel('billTo', 'Bill To')}
            </p>
            <p className="font-bold text-lg">{client?.companyName || client?.company_name}</p>
            <p>{client?.contactName || client?.contact_name}</p>
            <p className="whitespace-pre-line">{client?.address}</p>
            {(client?.postal_code || client?.city) && <p>{client?.postal_code} {client?.city}</p>}
            {(client?.vatNumber || client?.vat_number) && <p className="text-sm mt-1">TVA: {client.vatNumber || client.vat_number}</p>}
            <p className="text-sm">{client?.email}</p>
          </div>
          <div className="space-y-3">
            <div className="p-3 rounded-lg" style={{ backgroundColor: theme.secondary }}>
              <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: theme.accent }}>{getLabel('issueDate', t('invoices.issueDate'))}</p>
              <p className="font-semibold mt-1">{invoice.date || invoice.issueDate ? format(new Date(invoice.date || invoice.issueDate), 'MMM dd, yyyy') : '-'}</p>
            </div>
            <div className="p-3 rounded-lg" style={{ backgroundColor: theme.secondary }}>
              <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: theme.accent }}>{getLabel('dueDate', t('invoices.dueDate'))}</p>
              <p className="font-semibold mt-1">{invoice.due_date || invoice.dueDate ? format(new Date(invoice.due_date || invoice.dueDate), 'MMM dd, yyyy') : '-'}</p>
            </div>
            <div className="flex gap-2">
              <span className="px-3 py-1 rounded text-white text-xs" style={{ backgroundColor: theme.accent }}>{t(`status.${invoice.status}`)}</span>
              {invoice.payment_status && invoice.payment_status !== 'unpaid' && (
                <span className="px-3 py-1 rounded text-white text-xs" style={{ backgroundColor: theme.primary }}>{t(`payments.${invoice.payment_status}`)}</span>
              )}
            </div>
          </div>
        </div>

        {/* Header Note */}
        <EnhancedHeaderNote invoice={invoice} style={{ color: theme.text, marginBottom: '1rem' }} />

        {/* Items */}
        <div className="overflow-x-auto mb-8">
          <table className="w-full min-w-[400px]">
            <thead>
              <tr style={{ backgroundColor: theme.primary }}>
                <th className="text-left py-3 px-4 text-white text-sm">{getLabel('description', t('invoices.description'))}</th>
                {showHsn && <th className="text-left py-3 px-4 text-white text-xs">HSN</th>}
                <th className="text-right py-3 px-4 text-white text-sm">{getLabel('quantity', t('invoices.quantity'))}</th>
                <th className="text-right py-3 px-4 text-white text-sm">{getLabel('unitPrice', t('invoices.unitPrice'))}</th>
                {hasItemDiscounts && <th className="text-right py-3 px-4 text-white text-sm">{t('discounts.discount')}</th>}
                <th className="text-right py-3 px-4 text-white text-sm">{getLabel('amount', t('invoices.amount'))}</th>
              </tr>
            </thead>
            <tbody>
              {items?.map((item, index) => {
                const lineTotal = Number(item.quantity) * Number(item.unit_price || item.unitPrice || 0);
                const itemDiscount = calculateItemDiscount(item);
                const netAmount = lineTotal - itemDiscount;
                return (
                  <tr key={index} style={{ borderBottom: `1px solid ${theme.border}`, backgroundColor: index % 2 === 1 ? theme.secondary : 'transparent' }}>
                    <td className="py-3 px-4">{item.description}</td>
                    {showHsn && <td className="py-3 px-4 text-xs" style={{ color: theme.textLight }}>{item.hsn_code || ''}</td>}
                    <td className="text-right py-3 px-4">{Number(item.quantity).toFixed(2)}</td>
                    <td className="text-right py-3 px-4">{formatCurrency(Number(item.unit_price || item.unitPrice || 0), currency)}</td>
                    {hasItemDiscounts && (
                      <td className="text-right py-3 px-4" style={{ color: theme.accent }}>
                        {itemDiscount > 0 ? `-${formatCurrency(itemDiscount, currency)}` : '-'}
                      </td>
                    )}
                    <td className="text-right py-3 px-4 font-medium">{formatCurrency(netAmount, currency)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end mb-8">
          <div className="w-80 space-y-2">
            <div className="flex justify-between py-1"><span style={{ color: theme.textLight }}>{getLabel('totalHT', t('invoices.totalHT'))}:</span><span className="font-semibold">{formatCurrency(Number(invoice.total_ht || invoice.subtotal || 0), currency)}</span></div>
            {hasGlobalDiscount && (
              <div className="flex justify-between py-1" style={{ color: theme.accent }}>
                <span>{t('discounts.global')}:</span><span>-{formatCurrency(Number(invoice.discount_amount), currency)}</span>
              </div>
            )}
            <div className="flex justify-between py-1"><span style={{ color: theme.textLight }}>{getLabel('taxAmount', t('invoices.taxAmount'))} ({Number(invoice.tax_rate || invoice.taxRate || 0)}%):</span><span>{formatCurrency(Number(invoice.total_ttc || invoice.total || 0) - Number(invoice.total_ht || invoice.subtotal || 0) - Number(invoice.shipping_fee || 0) - Number(invoice.adjustment || 0), currency)}</span></div>
            <EnhancedShippingTotalRow invoice={invoice} currency={currency} theme={theme} />
            <EnhancedAdjustmentTotalRow invoice={invoice} currency={currency} theme={theme} />
            <div className="flex justify-between text-xl font-bold py-3 px-4 rounded" style={{ backgroundColor: theme.accent, color: 'white' }}>
              <span>{getLabel('totalTTC', t('invoices.totalTTC'))}:</span>
              <span>{formatCurrency(Number(invoice.total_ttc || invoice.total || 0), currency)}</span>
            </div>
            {hasPayments && (
              <>
                <div className="flex justify-between py-1 text-green-600"><span>{t('payments.amountPaid')}:</span><span>-{formatCurrency(Number(invoice.amount_paid), currency)}</span></div>
                <div className="flex justify-between py-2 font-bold text-lg" style={{ borderTop: `2px solid ${theme.border}` }}>
                  <span>{t('payments.balanceDue')}:</span>
                  <span style={{ color: Number(invoice.balance_due) > 0 ? '#dc2626' : '#16a34a' }}>{formatCurrency(Number(invoice.balance_due || 0), currency)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="p-4 rounded-lg mb-6" style={{ backgroundColor: theme.secondary }}>
            <h3 className="font-semibold text-sm mb-2" style={{ color: theme.accent }}>{t('timesheets.notes')}</h3>
            <p className="whitespace-pre-line text-sm">{invoice.notes}</p>
          </div>
        )}

        {/* Terms & Conditions */}
        <EnhancedTerms invoice={invoice} theme={theme} label={getLabel('terms', t('invoiceEnhanced.termsAndConditions'))} className="p-4 rounded-lg mb-6" />

        {/* Footer Note */}
        <EnhancedFooterNote invoice={invoice} theme={theme} className="mb-6" />

        {/* Bank Details */}
        {settings?.show_bank_details && company && (company.iban || company.bank_name) && (
          <div className="p-4 rounded-lg mb-6" style={{ backgroundColor: theme.secondary }}>
            <h3 className="font-semibold text-sm mb-2" style={{ color: theme.accent }}>{getLabel('bankDetails', 'Coordonnées bancaires')}</h3>
            <div className="text-sm grid grid-cols-2 gap-x-4 gap-y-1" style={{ color: theme.textLight }}>
              {company.bank_name && <p>Banque: <span style={{ color: theme.text }}>{company.bank_name}</span></p>}
              {company.iban && <p>IBAN: <span className="font-mono text-xs" style={{ color: theme.text }}>{company.iban}</span></p>}
              {company.swift && <p>BIC: <span className="font-mono text-xs" style={{ color: theme.text }}>{company.swift}</span></p>}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-sm pt-4" style={{ borderTop: `1px solid ${theme.border}`, color: theme.textLight }}>
          <p>{settings?.footer_text || `${company?.company_name || t('app.name')} — Merci pour votre confiance !`}</p>
          {company?.registration_number && <p className="text-xs mt-1">SIRET: {company.registration_number} {company.tax_id ? `- TVA: ${company.tax_id}` : ''}</p>}
        </div>
      </div>
    </div>
  );
};

export default ModernTemplate;
