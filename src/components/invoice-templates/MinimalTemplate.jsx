import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatCurrency, calculateItemDiscount } from '@/utils/calculations';
import { format } from 'date-fns';
import {
  EnhancedHeaderNote, EnhancedFooterNote, EnhancedTerms,
  EnhancedCustomFields, EnhancedShippingTotalRow, EnhancedAdjustmentTotalRow,
  hasHsnCodes
} from './TemplateEnhancedSections';

const MinimalTemplate = ({ invoice, client, items, company, theme, settings }) => {
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
    <div className="bg-white text-black p-8 md:p-12" style={{ fontFamily: settings?.font_family || 'Inter', color: theme.text }}>
      {/* Minimal header */}
      <div className="mb-12">
        <div className="flex justify-between items-start">
          <div>
            {settings?.show_logo && company?.logo_url && (
              <img src={company.logo_url} alt="Logo" className="h-8 w-auto object-contain mb-4" />
            )}
            <p className="text-sm" style={{ color: theme.textLight }}>{company?.company_name || t('app.name')}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-extralight tracking-widest uppercase" style={{ color: theme.primary }}>
              {getLabel('invoiceTitle', 'Invoice')}
            </p>
            <p className="text-sm mt-2 font-mono" style={{ color: theme.textLight }}>
              {invoice.invoice_number || invoice.invoiceNumber}
            </p>
            {invoice.reference && (
              <p className="text-xs mt-1" style={{ color: theme.textLight }}>Ref: {invoice.reference}</p>
            )}
          </div>
        </div>
      </div>

      {/* Custom Fields */}
      <EnhancedCustomFields invoice={invoice} theme={theme} className="mb-6" />

      {/* Two columns: From / To */}
      <div className="grid grid-cols-2 gap-12 mb-12">
        <div>
          <p className="text-xs uppercase tracking-widest mb-3" style={{ color: theme.textLight }}>From</p>
          <p className="font-medium">{company?.company_name}</p>
          <div className="text-sm mt-1 space-y-0.5" style={{ color: theme.textLight }}>
            {company?.address && <p>{company.address}</p>}
            {(company?.postal_code || company?.city) && <p>{company.postal_code} {company.city}</p>}
            {company?.email && <p>{company.email}</p>}
          </div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest mb-3" style={{ color: theme.textLight }}>{getLabel('billTo', 'Bill To')}</p>
          <p className="font-medium">{client?.companyName || client?.company_name}</p>
          <div className="text-sm mt-1 space-y-0.5" style={{ color: theme.textLight }}>
            <p>{client?.contactName || client?.contact_name}</p>
            <p className="whitespace-pre-line">{client?.address}</p>
            {(client?.postal_code || client?.city) && <p>{client?.postal_code} {client?.city}</p>}
            <p>{client?.email}</p>
          </div>
        </div>
      </div>

      {/* Dates inline */}
      <div className="flex gap-8 mb-10 text-sm">
        <div>
          <span style={{ color: theme.textLight }}>{getLabel('issueDate', t('invoices.issueDate'))}: </span>
          <span className="font-medium">{invoice.date || invoice.issueDate ? format(new Date(invoice.date || invoice.issueDate), 'MMM dd, yyyy') : '-'}</span>
        </div>
        <div>
          <span style={{ color: theme.textLight }}>{getLabel('dueDate', t('invoices.dueDate'))}: </span>
          <span className="font-medium">{invoice.due_date || invoice.dueDate ? format(new Date(invoice.due_date || invoice.dueDate), 'MMM dd, yyyy') : '-'}</span>
        </div>
        <div>
          <span className="px-2 py-0.5 rounded text-xs" style={{ backgroundColor: theme.secondary, color: theme.accent }}>{t(`status.${invoice.status}`)}</span>
        </div>
      </div>

      {/* Header Note */}
      <EnhancedHeaderNote invoice={invoice} style={{ color: theme.textLight, marginBottom: '1rem' }} />

      {/* Items */}
      <div className="mb-10">
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left py-3 text-xs uppercase tracking-widest" style={{ color: theme.textLight, borderBottom: `1px solid ${theme.border}` }}>{getLabel('description', t('invoices.description'))}</th>
              {showHsn && <th className="text-left py-3 text-xs uppercase tracking-widest" style={{ color: theme.textLight, borderBottom: `1px solid ${theme.border}` }}>HSN</th>}
              <th className="text-right py-3 text-xs uppercase tracking-widest" style={{ color: theme.textLight, borderBottom: `1px solid ${theme.border}` }}>{getLabel('quantity', 'Qty')}</th>
              <th className="text-right py-3 text-xs uppercase tracking-widest" style={{ color: theme.textLight, borderBottom: `1px solid ${theme.border}` }}>{getLabel('unitPrice', 'Rate')}</th>
              {hasItemDiscounts && <th className="text-right py-3 text-xs uppercase tracking-widest" style={{ color: theme.textLight, borderBottom: `1px solid ${theme.border}` }}>Disc.</th>}
              <th className="text-right py-3 text-xs uppercase tracking-widest" style={{ color: theme.textLight, borderBottom: `1px solid ${theme.border}` }}>{getLabel('amount', t('invoices.amount'))}</th>
            </tr>
          </thead>
          <tbody>
            {items?.map((item, index) => {
              const lineTotal = Number(item.quantity) * Number(item.unit_price || item.unitPrice || 0);
              const itemDiscount = calculateItemDiscount(item);
              const netAmount = lineTotal - itemDiscount;
              return (
                <tr key={index} style={{ borderBottom: `1px solid ${theme.border}` }}>
                  <td className="py-4">{item.description}</td>
                  {showHsn && <td className="py-4 text-xs" style={{ color: theme.textLight }}>{item.hsn_code || ''}</td>}
                  <td className="text-right py-4">{Number(item.quantity).toFixed(2)}</td>
                  <td className="text-right py-4">{formatCurrency(Number(item.unit_price || item.unitPrice || 0), currency)}</td>
                  {hasItemDiscounts && (
                    <td className="text-right py-4 text-sm" style={{ color: theme.accent }}>
                      {itemDiscount > 0 ? `-${formatCurrency(itemDiscount, currency)}` : ''}
                    </td>
                  )}
                  <td className="text-right py-4 font-medium">{formatCurrency(netAmount, currency)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end mb-10">
        <div className="w-64 space-y-3">
          <div className="flex justify-between text-sm"><span style={{ color: theme.textLight }}>{getLabel('totalHT', 'Subtotal')}</span><span>{formatCurrency(Number(invoice.total_ht || invoice.subtotal || 0), currency)}</span></div>
          {hasGlobalDiscount && (
            <div className="flex justify-between text-sm" style={{ color: theme.accent }}><span>Discount</span><span>-{formatCurrency(Number(invoice.discount_amount), currency)}</span></div>
          )}
          <div className="flex justify-between text-sm"><span style={{ color: theme.textLight }}>Tax ({Number(invoice.tax_rate || invoice.taxRate || 0)}%)</span><span>{formatCurrency(Number(invoice.total_ttc || invoice.total || 0) - Number(invoice.total_ht || invoice.subtotal || 0) - Number(invoice.shipping_fee || 0) - Number(invoice.adjustment || 0), currency)}</span></div>
          <EnhancedShippingTotalRow invoice={invoice} currency={currency} theme={theme} style={{ fontSize: '0.875rem' }} />
          <EnhancedAdjustmentTotalRow invoice={invoice} currency={currency} theme={theme} style={{ fontSize: '0.875rem' }} />
          <div className="flex justify-between text-2xl font-light pt-3" style={{ borderTop: `1px solid ${theme.text}` }}>
            <span>{getLabel('totalTTC', 'Total')}</span>
            <span>{formatCurrency(Number(invoice.total_ttc || invoice.total || 0), currency)}</span>
          </div>
          {hasPayments && (
            <>
              <div className="flex justify-between text-sm text-green-600"><span>Paid</span><span>-{formatCurrency(Number(invoice.amount_paid), currency)}</span></div>
              <div className="flex justify-between font-medium pt-2" style={{ borderTop: `1px solid ${theme.border}` }}>
                <span>Balance</span>
                <span style={{ color: Number(invoice.balance_due) > 0 ? '#dc2626' : '#16a34a' }}>{formatCurrency(Number(invoice.balance_due || 0), currency)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Notes */}
      {invoice.notes && (
        <div className="mb-8 text-sm" style={{ color: theme.textLight }}>
          <p className="whitespace-pre-line">{invoice.notes}</p>
        </div>
      )}

      {/* Terms & Conditions */}
      <EnhancedTerms invoice={invoice} theme={theme} label={getLabel('terms', 'Terms & Conditions')} className="mb-6" />

      {/* Footer Note */}
      <EnhancedFooterNote invoice={invoice} theme={theme} className="mb-6" />

      {/* Bank Details */}
      {settings?.show_bank_details && company && (company.iban || company.bank_name) && (
        <div className="mb-8 text-xs" style={{ color: theme.textLight }}>
          {company.bank_name && <span>Banque: {company.bank_name} </span>}
          {company.iban && <span>| IBAN: {company.iban} </span>}
          {company.swift && <span>| BIC: {company.swift}</span>}
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-xs pt-6" style={{ borderTop: `1px solid ${theme.border}`, color: theme.textLight }}>
        <p>{settings?.footer_text || company?.company_name || t('app.name')}</p>
      </div>
    </div>
  );
};

export default MinimalTemplate;
