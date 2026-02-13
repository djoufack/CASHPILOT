import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatCurrency, calculateItemDiscount } from '@/utils/calculations';
import { format } from 'date-fns';
import {
  EnhancedHeaderNote, EnhancedFooterNote, EnhancedTerms,
  EnhancedCustomFields, EnhancedShippingTotalRow, EnhancedAdjustmentTotalRow,
  hasHsnCodes
} from './TemplateEnhancedSections';

const ClassicTemplate = ({ invoice, client, items, company, theme, settings }) => {
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
    <div className="bg-white text-black p-6 md:p-8" style={{ fontFamily: settings?.font_family || 'Inter', color: theme.text }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start mb-8 gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            {settings?.show_logo && company?.logo_url && (
              <img src={company.logo_url} alt="Logo" loading="lazy" className="h-12 w-auto object-contain" />
            )}
            <h1 className="text-3xl font-bold" style={{ color: theme.primary }}>
              {company?.company_name || t('app.name')}
            </h1>
          </div>
          {company && (
            <div className="text-sm space-y-0.5" style={{ color: theme.textLight }}>
              {company.address && <p>{company.address}</p>}
              {(company.postal_code || company.city) && (
                <p>{company.postal_code} {company.city}{company.country ? `, ${company.country}` : ''}</p>
              )}
              {company.phone && <p>Tel: {company.phone}</p>}
              {company.email && <p>{company.email}</p>}
              {company.registration_number && <p>SIRET: {company.registration_number}</p>}
              {company.tax_id && <p>TVA: {company.tax_id}</p>}
            </div>
          )}
        </div>
        <div className="sm:text-right">
          <div className="text-2xl font-bold mb-2" style={{ color: theme.primary }}>
            {getLabel('invoiceTitle', t('invoices.invoiceNumber'))}: {invoice.invoice_number || invoice.invoiceNumber}
          </div>
          {invoice.reference && (
            <div className="text-sm mb-2" style={{ color: theme.textLight }}>
              Ref: <span className="font-medium" style={{ color: theme.text }}>{invoice.reference}</span>
            </div>
          )}
          <div className="flex gap-2 sm:justify-end">
            <span className="inline-block px-3 py-1 rounded text-white text-sm" style={{ backgroundColor: theme.accent }}>
              {t(`status.${invoice.status}`)}
            </span>
            {invoice.payment_status && invoice.payment_status !== 'unpaid' && (
              <span className="inline-block px-3 py-1 rounded text-white text-sm" style={{ backgroundColor: theme.primary }}>
                {t(`payments.${invoice.payment_status}`)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Custom Fields */}
      <EnhancedCustomFields invoice={invoice} theme={theme} className="mb-4" />

      {/* Client + Dates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-8">
        <div>
          <h3 className="font-semibold mb-2" style={{ color: theme.textLight }}>{getLabel('clientInfo', t('invoices.clientInfo'))}</h3>
          <div>
            <p className="font-bold">{client?.companyName || client?.company_name}</p>
            <p>{client?.contactName || client?.contact_name}</p>
            <p className="whitespace-pre-line">{client?.address}</p>
            {(client?.postal_code || client?.city) && (
              <p>{client?.postal_code} {client?.city}{client?.country ? `, ${client.country}` : ''}</p>
            )}
            {(client?.vatNumber || client?.vat_number) && <p>TVA: {client.vatNumber || client.vat_number}</p>}
            <p>{client?.email}</p>
          </div>
        </div>
        <div className="sm:text-right space-y-1">
          <div>
            <span style={{ color: theme.textLight }}>{getLabel('issueDate', t('invoices.issueDate'))}: </span>
            <span className="font-semibold">
              {invoice.date || invoice.issueDate ? format(new Date(invoice.date || invoice.issueDate), 'MMM dd, yyyy') : '-'}
            </span>
          </div>
          <div>
            <span style={{ color: theme.textLight }}>{getLabel('dueDate', t('invoices.dueDate'))}: </span>
            <span className="font-semibold">
              {invoice.due_date || invoice.dueDate ? format(new Date(invoice.due_date || invoice.dueDate), 'MMM dd, yyyy') : '-'}
            </span>
          </div>
        </div>
      </div>

      {/* Header Note */}
      <EnhancedHeaderNote invoice={invoice} style={{ color: theme.text, marginBottom: '1rem' }} />

      {/* Items */}
      <div className="overflow-x-auto mb-8">
        <table className="w-full min-w-[400px]">
          <thead>
            <tr style={{ borderBottom: `2px solid ${theme.border}` }}>
              <th className="text-left py-3" style={{ color: theme.textLight }}>{getLabel('description', t('invoices.description'))}</th>
              {showHsn && <th className="text-left py-3 text-xs" style={{ color: theme.textLight }}>HSN</th>}
              <th className="text-right py-3" style={{ color: theme.textLight }}>{getLabel('quantity', t('invoices.quantity'))}</th>
              <th className="text-right py-3" style={{ color: theme.textLight }}>{getLabel('unitPrice', t('invoices.unitPrice'))}</th>
              {hasItemDiscounts && <th className="text-right py-3" style={{ color: theme.textLight }}>{t('discounts.discount')}</th>}
              <th className="text-right py-3" style={{ color: theme.textLight }}>{getLabel('amount', t('invoices.amount'))}</th>
            </tr>
          </thead>
          <tbody>
            {items?.map((item, index) => {
              const lineTotal = Number(item.quantity) * Number(item.unit_price || item.unitPrice || 0);
              const itemDiscount = calculateItemDiscount(item);
              const netAmount = lineTotal - itemDiscount;
              return (
                <tr key={index} style={{ borderBottom: `1px solid ${theme.border}` }}>
                  <td className="py-3">{item.description}</td>
                  {showHsn && <td className="py-3 text-xs" style={{ color: theme.textLight }}>{item.hsn_code || ''}</td>}
                  <td className="text-right py-3">{Number(item.quantity).toFixed(2)}</td>
                  <td className="text-right py-3">{formatCurrency(Number(item.unit_price || item.unitPrice || 0), currency)}</td>
                  {hasItemDiscounts && (
                    <td className="text-right py-3" style={{ color: theme.accent }}>
                      {itemDiscount > 0 ? (
                        <>-{formatCurrency(itemDiscount, currency)} <span className="text-xs" style={{ color: theme.textLight }}>({item.discount_type === 'percentage' ? `${item.discount_value}%` : t('discounts.fixed')})</span></>
                      ) : '-'}
                    </td>
                  )}
                  <td className="text-right py-3">{formatCurrency(netAmount, currency)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end mb-8">
        <div className="w-72 space-y-2">
          <div className="flex justify-between"><span>{getLabel('totalHT', t('invoices.totalHT'))}:</span><span className="font-semibold">{formatCurrency(Number(invoice.total_ht || invoice.subtotal || 0), currency)}</span></div>
          {hasGlobalDiscount && (
            <div className="flex justify-between" style={{ color: theme.accent }}>
              <span>{t('discounts.global')} ({invoice.discount_type === 'percentage' ? `${invoice.discount_value}%` : t('discounts.fixed')}):</span>
              <span>-{formatCurrency(Number(invoice.discount_amount), currency)}</span>
            </div>
          )}
          <div className="flex justify-between"><span>{getLabel('taxAmount', t('invoices.taxAmount'))} ({Number(invoice.tax_rate || invoice.taxRate || 0)}%):</span><span>{formatCurrency(Number(invoice.total_ttc || invoice.total || 0) - Number(invoice.total_ht || invoice.subtotal || 0) - Number(invoice.shipping_fee || 0) - Number(invoice.adjustment || 0), currency)}</span></div>
          <EnhancedShippingTotalRow invoice={invoice} currency={currency} theme={theme} />
          <EnhancedAdjustmentTotalRow invoice={invoice} currency={currency} theme={theme} />
          <div className="flex justify-between text-xl font-bold pt-2" style={{ borderTop: `2px solid ${theme.border}` }}>
            <span>{getLabel('totalTTC', t('invoices.totalTTC'))}:</span>
            <span>{formatCurrency(Number(invoice.total_ttc || invoice.total || 0), currency)}</span>
          </div>
          {hasPayments && (
            <>
              <div className="flex justify-between text-green-600 pt-1"><span>{t('payments.amountPaid')}:</span><span>-{formatCurrency(Number(invoice.amount_paid), currency)}</span></div>
              <div className="flex justify-between text-lg font-bold pt-1" style={{ borderTop: `1px solid ${theme.border}` }}>
                <span>{t('payments.balanceDue')}:</span>
                <span style={{ color: Number(invoice.balance_due) > 0 ? '#dc2626' : '#16a34a' }}>{formatCurrency(Number(invoice.balance_due || 0), currency)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Notes */}
      {invoice.notes && (
        <div className="pt-4" style={{ borderTop: `1px solid ${theme.border}` }}>
          <h3 className="font-semibold mb-2" style={{ color: theme.textLight }}>{t('timesheets.notes')}</h3>
          <p className="whitespace-pre-line">{invoice.notes}</p>
        </div>
      )}

      {/* Terms & Conditions */}
      <EnhancedTerms invoice={invoice} theme={theme} label={getLabel('terms', t('invoiceEnhanced.termsAndConditions'))} className="mt-4 pt-4" />

      {/* Footer Note */}
      <EnhancedFooterNote invoice={invoice} theme={theme} className="mt-4" />

      {/* Bank Details */}
      {settings?.show_bank_details && company && (company.iban || company.bank_name) && (
        <div className="mt-6 pt-4" style={{ borderTop: `1px solid ${theme.border}` }}>
          <h3 className="font-semibold text-sm mb-2" style={{ color: theme.textLight }}>{getLabel('bankDetails', 'Coordonnées bancaires')}</h3>
          <div className="text-sm grid grid-cols-2 gap-x-4 gap-y-1" style={{ color: theme.textLight }}>
            {company.bank_name && <p>Banque: <span style={{ color: theme.text }}>{company.bank_name}</span></p>}
            {company.iban && <p>IBAN: <span className="font-mono text-xs" style={{ color: theme.text }}>{company.iban}</span></p>}
            {company.swift && <p>BIC: <span className="font-mono text-xs" style={{ color: theme.text }}>{company.swift}</span></p>}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-6 pt-4 text-center text-sm" style={{ borderTop: `1px solid ${theme.border}`, color: theme.textLight }}>
        <p>{settings?.footer_text || `${company?.company_name || t('app.name')} — Merci pour votre confiance !`}</p>
        {company?.registration_number && <p className="text-xs mt-1">SIRET: {company.registration_number} {company.tax_id ? `- TVA: ${company.tax_id}` : ''}</p>}
      </div>
    </div>
  );
};

export default ClassicTemplate;
