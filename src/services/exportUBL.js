/**
 * Peppol BIS Billing 3.0 — UBL 2.1 Export Service
 * Generates XML conforming to OASIS UBL 2.1 with Peppol CIUS.
 *
 * Reference: https://docs.peppol.eu/poacc/billing/3.0/
 * Counterpart to exportFacturX.js (which generates CII format).
 */

import { resolveInvoiceCurrency } from '@/utils/invoiceCurrency';

const PEPPOL_CUSTOMIZATION_ID = 'urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0';
const PEPPOL_PROFILE_ID = 'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0';

const escapeXml = (str) => {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
};

const formatAmount = (amount) => {
  if (amount === null || amount === undefined) return '0.00';
  return Number(amount).toFixed(2);
};

/**
 * Group items by tax rate and compute subtotals for TaxTotal section.
 */
const computeTaxBreakdown = (items) => {
  const groups = {};
  for (const item of items) {
    const rate = Number(item.tax_rate || 0);
    if (!groups[rate]) groups[rate] = { rate, taxableAmount: 0 };
    groups[rate].taxableAmount += Number(item.total || 0);
  }
  return Object.values(groups).map(g => ({
    rate: g.rate,
    taxableAmount: Number(g.taxableAmount.toFixed(2)),
    taxAmount: Number((g.taxableAmount * g.rate / 100).toFixed(2)),
    categoryId: g.rate === 0 ? 'Z' : 'S',
  }));
};

const generatePartyBlock = (party, tag) => {
  const name = party.company_name || party.name || '';
  const schemeId = party.peppol_scheme_id || '0208';
  const endpointId = party.peppol_endpoint_id || '';

  return `
    <cac:${tag}>
      <cac:Party>
        <cbc:EndpointID schemeID="${escapeXml(schemeId)}">${escapeXml(endpointId)}</cbc:EndpointID>
        <cac:PartyName>
          <cbc:Name>${escapeXml(name)}</cbc:Name>
        </cac:PartyName>
        <cac:PostalAddress>
          <cbc:StreetName>${escapeXml(party.address || '')}</cbc:StreetName>
          <cbc:CityName>${escapeXml(party.city || '')}</cbc:CityName>
          <cbc:PostalZone>${escapeXml(party.postal_code || '')}</cbc:PostalZone>
          <cac:Country>
            <cbc:IdentificationCode>${escapeXml(party.country || 'BE')}</cbc:IdentificationCode>
          </cac:Country>
        </cac:PostalAddress>${party.vat_number ? `
        <cac:PartyTaxScheme>
          <cbc:CompanyID>${escapeXml(party.vat_number)}</cbc:CompanyID>
          <cac:TaxScheme>
            <cbc:ID>VAT</cbc:ID>
          </cac:TaxScheme>
        </cac:PartyTaxScheme>` : ''}
        <cac:PartyLegalEntity>
          <cbc:RegistrationName>${escapeXml(name)}</cbc:RegistrationName>${endpointId ? `
          <cbc:CompanyID schemeID="${escapeXml(schemeId)}">${escapeXml(endpointId)}</cbc:CompanyID>` : ''}
        </cac:PartyLegalEntity>
      </cac:Party>
    </cac:${tag}>`;
};

const generatePaymentMeans = (seller) => {
  if (!seller.iban) return '';
  return `
    <cac:PaymentMeans>
      <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>
      <cac:PayeeFinancialAccount>
        <cbc:ID>${escapeXml(seller.iban)}</cbc:ID>${seller.bic ? `
        <cac:FinancialInstitutionBranch>
          <cbc:ID>${escapeXml(seller.bic)}</cbc:ID>
        </cac:FinancialInstitutionBranch>` : ''}
      </cac:PayeeFinancialAccount>
    </cac:PaymentMeans>`;
};

const generateTaxTotal = (invoice, items, currency) => {
  const breakdown = computeTaxBreakdown(items);
  const totalVat = formatAmount(invoice.total_vat || 0);

  const subtotals = breakdown.map(b => `
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="${currency}">${formatAmount(b.taxableAmount)}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="${currency}">${formatAmount(b.taxAmount)}</cbc:TaxAmount>
        <cac:TaxCategory>
          <cbc:ID>${b.categoryId}</cbc:ID>
          <cbc:Percent>${formatAmount(b.rate)}</cbc:Percent>
          <cac:TaxScheme>
            <cbc:ID>VAT</cbc:ID>
          </cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>`).join('');

  return `
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="${currency}">${totalVat}</cbc:TaxAmount>${subtotals}
    </cac:TaxTotal>`;
};

const generateLegalMonetaryTotal = (invoice, currency) => {
  return `
    <cac:LegalMonetaryTotal>
      <cbc:LineExtensionAmount currencyID="${currency}">${formatAmount(invoice.total_ht)}</cbc:LineExtensionAmount>
      <cbc:TaxExclusiveAmount currencyID="${currency}">${formatAmount(invoice.total_ht)}</cbc:TaxExclusiveAmount>
      <cbc:TaxInclusiveAmount currencyID="${currency}">${formatAmount(invoice.total_ttc)}</cbc:TaxInclusiveAmount>
      <cbc:PayableAmount currencyID="${currency}">${formatAmount(invoice.total_ttc)}</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>`;
};

const generateInvoiceLines = (items, currency, lineTag, qtyTag) => {
  return items.map((item, index) => {
    const rate = Number(item.tax_rate || 0);
    const categoryId = rate === 0 ? 'Z' : 'S';
    return `
    <cac:${lineTag}>
      <cbc:ID>${index + 1}</cbc:ID>
      <cbc:${qtyTag} unitCode="C62">${Number(item.quantity || 0)}</cbc:${qtyTag}>
      <cbc:LineExtensionAmount currencyID="${currency}">${formatAmount(item.total)}</cbc:LineExtensionAmount>
      <cac:Item>
        <cbc:Name>${escapeXml(item.description || '')}</cbc:Name>
        <cac:ClassifiedTaxCategory>
          <cbc:ID>${categoryId}</cbc:ID>
          <cbc:Percent>${formatAmount(rate)}</cbc:Percent>
          <cac:TaxScheme>
            <cbc:ID>VAT</cbc:ID>
          </cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="${currency}">${formatAmount(item.unit_price)}</cbc:PriceAmount>
      </cac:Price>
    </cac:${lineTag}>`;
  }).join('');
};

/**
 * Generate a complete UBL 2.1 Invoice XML string.
 */
export const generateUBLInvoice = (invoice, seller, buyer, items) => {
  const currency = resolveInvoiceCurrency(invoice, buyer, seller);
  const buyerRef = invoice.reference || invoice.invoice_number;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>${PEPPOL_CUSTOMIZATION_ID}</cbc:CustomizationID>
  <cbc:ProfileID>${PEPPOL_PROFILE_ID}</cbc:ProfileID>
  <cbc:ID>${escapeXml(invoice.invoice_number)}</cbc:ID>
  <cbc:IssueDate>${formatDate(invoice.invoice_date)}</cbc:IssueDate>${invoice.due_date ? `
  <cbc:DueDate>${formatDate(invoice.due_date)}</cbc:DueDate>` : ''}
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${escapeXml(currency)}</cbc:DocumentCurrencyCode>
  <cbc:BuyerReference>${escapeXml(buyerRef)}</cbc:BuyerReference>${generatePartyBlock(seller, 'AccountingSupplierParty')}${generatePartyBlock(buyer, 'AccountingCustomerParty')}${generatePaymentMeans(seller)}${generateTaxTotal(invoice, items, currency)}${generateLegalMonetaryTotal(invoice, currency)}${generateInvoiceLines(items, currency, 'InvoiceLine', 'InvoicedQuantity')}
</Invoice>`;
};

/**
 * Generate a complete UBL 2.1 CreditNote XML string.
 */
export const generateUBLCreditNote = (invoice, seller, buyer, items) => {
  const currency = resolveInvoiceCurrency(invoice, buyer, seller);
  const buyerRef = invoice.reference || invoice.invoice_number;

  return `<?xml version="1.0" encoding="UTF-8"?>
<CreditNote xmlns="urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2"
            xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
            xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>${PEPPOL_CUSTOMIZATION_ID}</cbc:CustomizationID>
  <cbc:ProfileID>${PEPPOL_PROFILE_ID}</cbc:ProfileID>
  <cbc:ID>${escapeXml(invoice.invoice_number)}</cbc:ID>
  <cbc:IssueDate>${formatDate(invoice.invoice_date)}</cbc:IssueDate>
  <cbc:CreditNoteTypeCode>381</cbc:CreditNoteTypeCode>
  <cbc:DocumentCurrencyCode>${escapeXml(currency)}</cbc:DocumentCurrencyCode>
  <cbc:BuyerReference>${escapeXml(buyerRef)}</cbc:BuyerReference>${generatePartyBlock(seller, 'AccountingSupplierParty')}${generatePartyBlock(buyer, 'AccountingCustomerParty')}${generatePaymentMeans(seller)}${generateTaxTotal(invoice, items, currency)}${generateLegalMonetaryTotal(invoice, currency)}${generateInvoiceLines(items, currency, 'CreditNoteLine', 'CreditedQuantity')}
</CreditNote>`;
};

/**
 * Export invoice as UBL XML blob.
 */
export const exportUBL = async (invoice, seller, buyer, items) => {
  if (!invoice || !invoice.invoice_number) {
    throw new Error('Invoice number is required');
  }
  const isCreditNote = invoice.is_credit_note || invoice.type === 'credit_note';
  const xml = isCreditNote
    ? generateUBLCreditNote(invoice, seller, buyer, items)
    : generateUBLInvoice(invoice, seller, buyer, items);

  const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });

  return {
    blob,
    filename: `peppol-${invoice.invoice_number}.xml`,
    xml,
  };
};

export default { generateUBLInvoice, generateUBLCreditNote, exportUBL };
