/**
 * Peppol BIS Billing 3.0 — EN16931 Validation for Belgian invoices
 * Validates invoice data before UBL generation or Peppol transmission.
 */

import { resolveInvoiceCurrency } from '@/utils/invoiceCurrency';

const VALID_CURRENCIES = [
  'EUR',
  'USD',
  'GBP',
  'CHF',
  'SEK',
  'NOK',
  'DKK',
  'PLN',
  'CZK',
  'HUF',
  'RON',
  'BGN',
  'HRK',
  'ISK',
  'JPY',
  'CAD',
  'AUD',
];

/**
 * Validate invoice data against EN16931 + Peppol BIS 3.0 rules.
 * @param {Object} invoice - Invoice record
 * @param {Object} seller - Company/seller data
 * @param {Object} buyer - Client/buyer data
 * @param {Array} items - Invoice line items
 * @returns {{ isValid: boolean, errors: Array<{ rule: string, message: string }> }}
 */
export const validateForPeppolBE = (invoice, seller, buyer, items) => {
  const errors = [];
  const explicitInvoiceCurrency = typeof invoice.currency === 'string' ? invoice.currency.trim().toUpperCase() : '';

  // BR-01: Invoice number is mandatory
  if (!invoice.invoice_number) {
    errors.push({ rule: 'BR-01', message: 'Invoice number is required' });
  }

  // BR-02: Invoice issue date is mandatory
  const issueDate = invoice.invoice_date || invoice.date;
  if (!issueDate) {
    errors.push({ rule: 'BR-02', message: 'Invoice issue date is required' });
  }

  // BR-05: Currency code must be valid ISO 4217
  const currency = explicitInvoiceCurrency || resolveInvoiceCurrency(invoice, buyer, seller);
  if (currency.length !== 3 || !VALID_CURRENCIES.includes(currency)) {
    errors.push({ rule: 'BR-05', message: `Invalid currency code: ${currency}` });
  }

  // BR-06: Seller name is mandatory
  const sellerName = seller.company_name || seller.name;
  if (!sellerName) {
    errors.push({ rule: 'BR-06', message: 'Seller name is required' });
  }

  // BR-07: Buyer name is mandatory
  const buyerName = buyer.company_name || buyer.name;
  if (!buyerName) {
    errors.push({ rule: 'BR-07', message: 'Buyer name is required' });
  }

  // BR-CO-09: Seller VAT number required when VAT applicable
  if (!seller.vat_number) {
    errors.push({ rule: 'BR-CO-09', message: 'Seller VAT number is required' });
  }

  // BR-16: At least one invoice line
  if (!items || items.length === 0) {
    errors.push({ rule: 'BR-16', message: 'At least one invoice line item is required' });
  }

  // PEPPOL-EN16931-R001: Seller endpoint is mandatory
  if (!seller.peppol_endpoint_id) {
    errors.push({ rule: 'PEPPOL-EN16931-R001', message: 'Seller Peppol endpoint ID is required' });
  }

  // PEPPOL-EN16931-R002: Buyer endpoint is mandatory
  if (!buyer.peppol_endpoint_id) {
    errors.push({ rule: 'PEPPOL-EN16931-R002', message: 'Buyer Peppol endpoint ID is required' });
  }

  // PEPPOL-EN16931-R003: BuyerReference or OrderReference
  const buyerReference = [invoice.reference, invoice.order_reference]
    .map((value) => (typeof value === 'string' ? value.trim() : value))
    .find(Boolean);
  if (!buyerReference) {
    errors.push({ rule: 'PEPPOL-EN16931-R003', message: 'Buyer reference or order reference is required' });
  }

  // BR-12: Sum of line totals must equal total_ht
  if (items && items.length > 0 && invoice.total_ht !== undefined) {
    const lineSum = items.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const lineSumRounded = Number(lineSum.toFixed(2));
    const totalHT = Number(Number(invoice.total_ht).toFixed(2));
    if (Math.abs(lineSumRounded - totalHT) > 0.01) {
      errors.push({
        rule: 'BR-12',
        message: `Sum of line totals (${lineSumRounded}) does not match total_ht (${totalHT})`,
      });
    }
  }

  // BR-15: total_ttc must equal total_ht + total_vat
  if (invoice.total_ht !== undefined && invoice.total_vat !== undefined && invoice.total_ttc !== undefined) {
    const expected = Number((Number(invoice.total_ht) + Number(invoice.total_vat)).toFixed(2));
    const actual = Number(Number(invoice.total_ttc).toFixed(2));
    if (Math.abs(expected - actual) > 0.01) {
      errors.push({
        rule: 'BR-15',
        message: `total_ttc (${actual}) does not match total_ht + total_vat (${expected})`,
      });
    }
  }

  return { isValid: errors.length === 0, errors };
};

/**
 * Build a UI-friendly readiness report for the outbound Peppol queue.
 * @param {Object} params
 * @param {Object} params.invoice
 * @param {Object} params.seller
 * @param {Object} params.buyer
 * @param {Array} params.items
 * @returns {{ready: boolean, queueStatus: 'ready'|'to_fix', reasons: string[], reasonText: string, validation: {isValid: boolean, errors: Array<{rule: string, message: string}>}}}
 */
export const buildPeppolQueueAssessment = ({ invoice, seller, buyer, items }) => {
  const validation = validateForPeppolBE(invoice || {}, seller || {}, buyer || {}, Array.isArray(items) ? items : []);
  const reasons = validation.errors.map((entry) => `[${entry.rule}] ${entry.message}`);
  const ready = validation.isValid;
  return {
    ready,
    queueStatus: ready ? 'ready' : 'to_fix',
    reasons,
    reasonText: reasons.join('\n'),
    validation,
  };
};
