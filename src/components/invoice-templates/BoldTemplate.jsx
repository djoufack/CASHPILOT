import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatCurrency, calculateItemDiscount } from '@/utils/calculations';
import { format } from 'date-fns';
import {
  EnhancedHeaderNote, EnhancedFooterNote, EnhancedTerms,
  EnhancedCustomFields, EnhancedShippingTotalRow, EnhancedAdjustmentTotalRow,
  hasHsnCodes
} from './TemplateEnhancedSections';

const BoldTemplate = ({ invoice, client, items, company, theme, settings }) => {
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
    <div className="bg-white text-black" style={{ fontFamily: settings?.font_family || 'Inter', color: theme.text }}>
      {/* Bold colored header */}
      <div className="p-8 md:p-10" style={{ backgroundColor: theme.primary, color: 'white' }}>
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              {settings?.show_logo && company?.logo_url && (
                <img src={company.logo_url} alt="Logo" loading="lazy" className="h-12 w-auto object-contain brightness-0 invert" />
              )}
              <h1 className="text-3xl font-black uppercase tracking-tight">
                {company?.company_name || t('app.name')}
              </h1>
            </div>
            <div className="text-sm opacity-80 mt-2">
              {company?.address && <span>{company.address} | </span>}
              {company?.email && <span>{company.email} | </span>}
              {company?.phone && <span>{company.phone}</span>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-5xl font-black">{getLabel('invoiceTitle', 'INVOICE')}</p>
            <p className="text-lg mt-2 font-mono opacity-80">{invoice.invoice_number || invoice.invoiceNumber}</p>
            {invoice.reference && (
              <p className="text-sm mt-1 opacity-70">Ref: {invoice.reference}</p>
            )}
          </div>
        </div>
      </div>

      {/* Status + dates bar */}
      <div className="flex flex-wrap gap-4 items-center justify-between px-8 py-4" style={{ backgroundColor: theme.accent, color: 'white' }}>
        <div className="flex gap-4 text-sm font-semibold">
          <span>{getLabel('issueDate', t('invoices.issueDate'))}: {invoice.date || invoice.issueDate ? format(new Date(invoice.date || invoice.issueDate), 'MMM dd, yyyy') : '-'}</span>
          <span>|</span>
          <span>{getLabel('dueDate', t('invoices.dueDate'))}: {invoice.due_date || invoice.dueDate ? format(new Date(invoice.due_date || invoice.dueDate), 'MMM dd, yyyy') : '-'}</span>
        </div>
        <div className="flex gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/20">{t(`status.${invoice.status}`)}</span>
          {invoice.payment_status && invoice.payment_status !== 'unpaid' && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/20">{t(`payments.${invoice.payment_status}`)}</span>
          )}
        </div>
      </div>

      <div className="p-8 md:p-10">
        {/* Custom Fields */}
        <EnhancedCustomFields invoice={invoice} theme={theme} className="mb-4 p-4 rounded-lg" />

        {/* Client */}
        <div className="mb-8 p-5 rounded-lg" style={{ backgroundColor: theme.secondary }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: theme.accent }}>{getLabel('billTo', 'BILL TO')}</p>
          <p className="text-xl font-bold">{client?.companyName || client?.company_name}</p>
          <p>{client?.contactName || client?.contact_name}</p>
          <p className="whitespace-pre-line text-sm mt-1" style={{ color: theme.textLight }}>{client?.address}</p>
          {(client?.postal_code || client?.city) && <p className="text-sm" style={{ color: theme.textLight }}>{client?.postal_code} {client?.city}</p>}
          {(client?.vatNumber || client?.vat_number) && <p className="text-sm mt-1">TVA: {client.vatNumber || client.vat_number}</p>}
          <p className="text-sm">{client?.email}</p>
        </div>

        {/* Header Note */}
        <EnhancedHeaderNote invoice={invoice} style={{ color: theme.text, marginBottom: '1rem' }} />

        {/* Items */}
        <div className="overflow-x-auto mb-8">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left py-4 px-4 text-xs font-black uppercase tracking-wider" style={{ color: theme.primary, borderBottom: `3px solid ${theme.accent}` }}>{getLabel('description', t('invoices.description'))}</th>
                {showHsn && <th className="text-left py-4 px-4 text-xs font-black uppercase tracking-wider" style={{ color: theme.primary, borderBottom: `3px solid ${theme.accent}` }}>HSN</th>}
                <th className="text-right py-4 px-4 text-xs font-black uppercase tracking-wider" style={{ color: theme.primary, borderBottom: `3px solid ${theme.accent}` }}>{getLabel('quantity', t('invoices.quantity'))}</th>
                <th className="text-right py-4 px-4 text-xs font-black uppercase tracking-wider" style={{ color: theme.primary, borderBottom: `3px solid ${theme.accent}` }}>{getLabel('unitPrice', t('invoices.unitPrice'))}</th>
                {hasItemDiscounts && <th className="text-right py-4 px-4 text-xs font-black uppercase tracking-wider" style={{ color: theme.primary, borderBottom: `3px solid ${theme.accent}` }}>Disc.</th>}
                <th className="text-right py-4 px-4 text-xs font-black uppercase tracking-wider" style={{ color: theme.primary, borderBottom: `3px solid ${theme.accent}` }}>{getLabel('amount', t('invoices.amount'))}</th>
              </tr>
            </thead>
            <tbody>
              {items?.map((item, index) => {
                const lineTotal = Number(item.quantity) * Number(item.unit_price || item.unitPrice || 0);
                const itemDiscount = calculateItemDiscount(item);
                const netAmount = lineTotal - itemDiscount;
                return (
                  <tr key={index} style={{ borderBottom: `1px solid ${theme.border}` }}>
                    <td className="py-4 px-4 font-medium">{item.description}</td>
                    {showHsn && <td className="py-4 px-4 text-xs" style={{ color: theme.textLight }}>{item.hsn_code || ''}</td>}
                    <td className="text-right py-4 px-4">{Number(item.quantity).toFixed(2)}</td>
                    <td className="text-right py-4 px-4">{formatCurrency(Number(item.unit_price || item.unitPrice || 0), currency)}</td>
                    {hasItemDiscounts && (
                      <td className="text-right py-4 px-4" style={{ color: theme.accent }}>
                        {itemDiscount > 0 ? `-${formatCurrency(itemDiscount, currency)}` : '-'}
                      </td>
                    )}
                    <td className="text-right py-4 px-4 font-bold">{formatCurrency(netAmount, currency)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end mb-8">
          <div className="w-80">
            <div className="space-y-2 mb-3">
              <div className="flex justify-between py-1"><span style={{ color: theme.textLight }}>{getLabel('totalHT', t('invoices.totalHT'))}</span><span className="font-semibold">{formatCurrency(Number(invoice.total_ht || invoice.subtotal || 0), currency)}</span></div>
              {hasGlobalDiscount && (
                <div className="flex justify-between py-1" style={{ color: theme.accent }}><span>Discount</span><span>-{formatCurrency(Number(invoice.discount_amount), currency)}</span></div>
              )}
              <div className="flex justify-between py-1"><span style={{ color: theme.textLight }}>Tax ({Number(invoice.tax_rate || invoice.taxRate || 0)}%)</span><span>{formatCurrency(Number(invoice.total_ttc || invoice.total || 0) - Number(invoice.total_ht || invoice.subtotal || 0) - Number(invoice.shipping_fee || 0) - Number(invoice.adjustment || 0), currency)}</span></div>
              <EnhancedShippingTotalRow invoice={invoice} currency={currency} theme={theme} />
              <EnhancedAdjustmentTotalRow invoice={invoice} currency={currency} theme={theme} />
            </div>
            <div className="p-4 rounded-lg" style={{ backgroundColor: theme.primary, color: 'white' }}>
              <div className="flex justify-between text-2xl font-black">
                <span>{getLabel('totalTTC', 'TOTAL')}</span>
                <span>{formatCurrency(Number(invoice.total_ttc || invoice.total || 0), currency)}</span>
              </div>
            </div>
            {hasPayments && (
              <div className="mt-3 space-y-2">
                <div className="flex justify-between text-green-600"><span>{t('payments.amountPaid')}</span><span>-{formatCurrency(Number(invoice.amount_paid), currency)}</span></div>
                <div className="flex justify-between font-bold text-lg p-3 rounded" style={{ backgroundColor: theme.secondary }}>
                  <span>{t('payments.balanceDue')}</span>
                  <span style={{ color: Number(invoice.balance_due) > 0 ? '#dc2626' : '#16a34a' }}>{formatCurrency(Number(invoice.balance_due || 0), currency)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="p-4 rounded-lg mb-6" style={{ backgroundColor: theme.secondary }}>
            <p className="text-xs font-bold uppercase mb-2" style={{ color: theme.accent }}>{t('timesheets.notes')}</p>
            <p className="whitespace-pre-line text-sm">{invoice.notes}</p>
          </div>
        )}

        {/* Terms & Conditions */}
        <EnhancedTerms invoice={invoice} theme={theme} label={getLabel('terms', t('invoiceEnhanced.termsAndConditions'))} className="p-4 rounded-lg mb-6" />

        {/* Footer Note */}
        <EnhancedFooterNote invoice={invoice} theme={theme} className="mb-6" />

        {/* Bank */}
        {settings?.show_bank_details && company && (company.iban || company.bank_name) && (
          <div className="text-xs mb-6" style={{ color: theme.textLight }}>
            <p className="font-bold mb-1" style={{ color: theme.primary }}>{getLabel('bankDetails', 'Coordonnées bancaires')}</p>
            {company.bank_name && <span>Banque: {company.bank_name} </span>}
            {company.iban && <span>| IBAN: {company.iban} </span>}
            {company.swift && <span>| BIC: {company.swift}</span>}
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs pt-4" style={{ borderTop: `3px solid ${theme.accent}`, color: theme.textLight }}>
          <p className="font-bold" style={{ color: theme.primary }}>{settings?.footer_text || company?.company_name || t('app.name')}</p>
          {company?.registration_number && <p className="mt-1">SIRET: {company.registration_number} {company.tax_id ? `| TVA: ${company.tax_id}` : ''}</p>}
        </div>
      </div>
    </div>
  );
};

export default BoldTemplate;
