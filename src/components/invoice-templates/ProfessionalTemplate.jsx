import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatCurrency, calculateItemDiscount } from '@/utils/calculations';
import { format } from 'date-fns';
import {
  EnhancedHeaderNote, EnhancedFooterNote, EnhancedTerms,
  EnhancedCustomFields, EnhancedShippingTotalRow, EnhancedAdjustmentTotalRow,
  hasHsnCodes
} from './TemplateEnhancedSections';

const ProfessionalTemplate = ({ invoice, client, items, company, theme, settings }) => {
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
      {/* Professional two-column header */}
      <div className="grid grid-cols-2 gap-8 mb-8 pb-6" style={{ borderBottom: `2px solid ${theme.primary}` }}>
        <div>
          <div className="flex items-center gap-3 mb-3">
            {settings?.show_logo && company?.logo_url && (
              <img src={company.logo_url} alt="Logo" className="h-14 w-auto object-contain" />
            )}
            <div>
              <h1 className="text-xl font-bold" style={{ color: theme.primary }}>{company?.company_name || t('app.name')}</h1>
              {company?.registration_number && <p className="text-xs" style={{ color: theme.textLight }}>SIRET: {company.registration_number}</p>}
            </div>
          </div>
          <div className="text-sm space-y-0.5" style={{ color: theme.textLight }}>
            {company?.address && <p>{company.address}</p>}
            {(company?.postal_code || company?.city) && <p>{company.postal_code} {company.city}{company?.country ? `, ${company.country}` : ''}</p>}
            {company?.phone && <p>Tel: {company.phone}</p>}
            {company?.email && <p>{company.email}</p>}
            {company?.tax_id && <p>TVA: {company.tax_id}</p>}
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-3xl font-bold mb-4" style={{ color: theme.primary }}>
            {getLabel('invoiceTitle', 'FACTURE')}
          </h2>
          <table className="ml-auto text-sm">
            <tbody>
              <tr>
                <td className="pr-4 py-1 text-right" style={{ color: theme.textLight }}>N°</td>
                <td className="font-semibold font-mono">{invoice.invoice_number || invoice.invoiceNumber}</td>
              </tr>
              {invoice.reference && (
                <tr>
                  <td className="pr-4 py-1 text-right" style={{ color: theme.textLight }}>Ref</td>
                  <td className="font-semibold">{invoice.reference}</td>
                </tr>
              )}
              <tr>
                <td className="pr-4 py-1 text-right" style={{ color: theme.textLight }}>{getLabel('issueDate', 'Date')}</td>
                <td className="font-semibold">{invoice.date || invoice.issueDate ? format(new Date(invoice.date || invoice.issueDate), 'dd/MM/yyyy') : '-'}</td>
              </tr>
              <tr>
                <td className="pr-4 py-1 text-right" style={{ color: theme.textLight }}>{getLabel('dueDate', 'Échéance')}</td>
                <td className="font-semibold">{invoice.due_date || invoice.dueDate ? format(new Date(invoice.due_date || invoice.dueDate), 'dd/MM/yyyy') : '-'}</td>
              </tr>
              <tr>
                <td className="pr-4 py-1 text-right" style={{ color: theme.textLight }}>Statut</td>
                <td>
                  <span className="px-2 py-0.5 rounded text-white text-xs" style={{ backgroundColor: theme.accent }}>{t(`status.${invoice.status}`)}</span>
                  {invoice.payment_status && invoice.payment_status !== 'unpaid' && (
                    <span className="px-2 py-0.5 rounded text-white text-xs ml-1" style={{ backgroundColor: theme.primary }}>{t(`payments.${invoice.payment_status}`)}</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Custom Fields */}
      <EnhancedCustomFields invoice={invoice} theme={theme} className="mb-4 p-3 rounded" />

      {/* Client section */}
      <div className="mb-8">
        <div className="inline-block p-4 rounded" style={{ backgroundColor: theme.secondary, minWidth: '280px' }}>
          <p className="text-xs font-bold uppercase mb-2" style={{ color: theme.accent }}>{getLabel('clientInfo', t('invoices.clientInfo'))}</p>
          <p className="font-bold text-lg">{client?.companyName || client?.company_name}</p>
          <p>{client?.contactName || client?.contact_name}</p>
          <div className="text-sm mt-1" style={{ color: theme.textLight }}>
            <p className="whitespace-pre-line">{client?.address}</p>
            {(client?.postal_code || client?.city) && <p>{client?.postal_code} {client?.city}{client?.country ? `, ${client.country}` : ''}</p>}
            {(client?.vatNumber || client?.vat_number) && <p>TVA: {client.vatNumber || client.vat_number}</p>}
            <p>{client?.email}</p>
          </div>
        </div>
      </div>

      {/* Header Note */}
      <EnhancedHeaderNote invoice={invoice} style={{ color: theme.text, marginBottom: '1rem' }} />

      {/* Items */}
      <div className="overflow-x-auto mb-8">
        <table className="w-full">
          <thead>
            <tr style={{ backgroundColor: theme.secondary }}>
              <th className="text-left py-3 px-4 text-xs font-semibold uppercase" style={{ color: theme.primary }}>{getLabel('description', t('invoices.description'))}</th>
              {showHsn && <th className="text-left py-3 px-4 text-xs font-semibold uppercase" style={{ color: theme.primary }}>HSN</th>}
              <th className="text-right py-3 px-4 text-xs font-semibold uppercase" style={{ color: theme.primary }}>{getLabel('quantity', t('invoices.quantity'))}</th>
              <th className="text-right py-3 px-4 text-xs font-semibold uppercase" style={{ color: theme.primary }}>{getLabel('unitPrice', 'P.U. HT')}</th>
              {hasItemDiscounts && <th className="text-right py-3 px-4 text-xs font-semibold uppercase" style={{ color: theme.primary }}>{t('discounts.discount')}</th>}
              <th className="text-right py-3 px-4 text-xs font-semibold uppercase" style={{ color: theme.primary }}>{getLabel('amount', 'Montant HT')}</th>
            </tr>
          </thead>
          <tbody>
            {items?.map((item, index) => {
              const lineTotal = Number(item.quantity) * Number(item.unit_price || item.unitPrice || 0);
              const itemDiscount = calculateItemDiscount(item);
              const netAmount = lineTotal - itemDiscount;
              return (
                <tr key={index} style={{ borderBottom: `1px solid ${theme.border}` }}>
                  <td className="py-3 px-4">{item.description}</td>
                  {showHsn && <td className="py-3 px-4 text-xs" style={{ color: theme.textLight }}>{item.hsn_code || ''}</td>}
                  <td className="text-right py-3 px-4">{Number(item.quantity).toFixed(2)}</td>
                  <td className="text-right py-3 px-4">{formatCurrency(Number(item.unit_price || item.unitPrice || 0), currency)}</td>
                  {hasItemDiscounts && (
                    <td className="text-right py-3 px-4" style={{ color: theme.accent }}>
                      {itemDiscount > 0 ? (
                        <>-{formatCurrency(itemDiscount, currency)} <span className="text-xs">({item.discount_type === 'percentage' ? `${item.discount_value}%` : 'fixe'})</span></>
                      ) : '-'}
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
        <div className="w-80">
          <table className="w-full text-sm">
            <tbody>
              <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                <td className="py-2" style={{ color: theme.textLight }}>{getLabel('totalHT', t('invoices.totalHT'))}</td>
                <td className="text-right py-2 font-semibold">{formatCurrency(Number(invoice.total_ht || invoice.subtotal || 0), currency)}</td>
              </tr>
              {hasGlobalDiscount && (
                <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                  <td className="py-2" style={{ color: theme.accent }}>{t('discounts.global')} ({invoice.discount_type === 'percentage' ? `${invoice.discount_value}%` : t('discounts.fixed')})</td>
                  <td className="text-right py-2" style={{ color: theme.accent }}>-{formatCurrency(Number(invoice.discount_amount), currency)}</td>
                </tr>
              )}
              <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                <td className="py-2" style={{ color: theme.textLight }}>{getLabel('taxAmount', 'TVA')} ({Number(invoice.tax_rate || invoice.taxRate || 0)}%)</td>
                <td className="text-right py-2">{formatCurrency(Number(invoice.total_ttc || invoice.total || 0) - Number(invoice.total_ht || invoice.subtotal || 0) - Number(invoice.shipping_fee || 0) - Number(invoice.adjustment || 0), currency)}</td>
              </tr>
              {Number(invoice.shipping_fee || 0) > 0 && (
                <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                  <td className="py-2" style={{ color: theme.textLight }}>Shipping</td>
                  <td className="text-right py-2">+{formatCurrency(Number(invoice.shipping_fee), currency)}</td>
                </tr>
              )}
              {Number(invoice.adjustment || 0) !== 0 && (
                <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                  <td className="py-2" style={{ color: theme.textLight }}>{invoice.adjustment_label || 'Adjustment'}</td>
                  <td className="text-right py-2">{Number(invoice.adjustment) > 0 ? '+' : ''}{formatCurrency(Number(invoice.adjustment), currency)}</td>
                </tr>
              )}
              <tr style={{ borderTop: `2px solid ${theme.primary}` }}>
                <td className="py-3 text-lg font-bold" style={{ color: theme.primary }}>{getLabel('totalTTC', t('invoices.totalTTC'))}</td>
                <td className="text-right py-3 text-lg font-bold" style={{ color: theme.primary }}>{formatCurrency(Number(invoice.total_ttc || invoice.total || 0), currency)}</td>
              </tr>
              {hasPayments && (
                <>
                  <tr>
                    <td className="py-1 text-green-600">{t('payments.amountPaid')}</td>
                    <td className="text-right py-1 text-green-600">-{formatCurrency(Number(invoice.amount_paid), currency)}</td>
                  </tr>
                  <tr style={{ borderTop: `1px solid ${theme.border}` }}>
                    <td className="py-2 font-bold">{t('payments.balanceDue')}</td>
                    <td className="text-right py-2 font-bold" style={{ color: Number(invoice.balance_due) > 0 ? '#dc2626' : '#16a34a' }}>{formatCurrency(Number(invoice.balance_due || 0), currency)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment terms / Notes */}
      {invoice.notes && (
        <div className="mb-6 pt-4" style={{ borderTop: `1px solid ${theme.border}` }}>
          <h3 className="text-xs font-bold uppercase mb-2" style={{ color: theme.primary }}>{getLabel('notes', t('timesheets.notes'))}</h3>
          <p className="text-sm whitespace-pre-line" style={{ color: theme.textLight }}>{invoice.notes}</p>
        </div>
      )}

      {/* Terms & Conditions */}
      <EnhancedTerms invoice={invoice} theme={theme} label={getLabel('terms', t('invoiceEnhanced.termsAndConditions'))} className="mb-6 pt-4" />

      {/* Footer Note */}
      <EnhancedFooterNote invoice={invoice} theme={theme} className="mb-6" />

      {/* Bank Details */}
      {settings?.show_bank_details && company && (company.iban || company.bank_name) && (
        <div className="mb-6 p-4 rounded" style={{ backgroundColor: theme.secondary }}>
          <h3 className="text-xs font-bold uppercase mb-2" style={{ color: theme.primary }}>{getLabel('bankDetails', 'Coordonnées bancaires')}</h3>
          <div className="text-sm grid grid-cols-3 gap-2" style={{ color: theme.textLight }}>
            {company.bank_name && <div><span className="text-xs">Banque</span><br /><span style={{ color: theme.text }}>{company.bank_name}</span></div>}
            {company.iban && <div><span className="text-xs">IBAN</span><br /><span className="font-mono text-xs" style={{ color: theme.text }}>{company.iban}</span></div>}
            {company.swift && <div><span className="text-xs">BIC/SWIFT</span><br /><span className="font-mono text-xs" style={{ color: theme.text }}>{company.swift}</span></div>}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-xs pt-4" style={{ borderTop: `2px solid ${theme.primary}`, color: theme.textLight }}>
        <p className="font-semibold" style={{ color: theme.primary }}>{settings?.footer_text || `${company?.company_name || t('app.name')}`}</p>
        {company?.registration_number && <p className="mt-1">SIRET: {company.registration_number} {company.tax_id ? `— TVA Intracommunautaire: ${company.tax_id}` : ''}</p>}
      </div>
    </div>
  );
};

export default ProfessionalTemplate;
