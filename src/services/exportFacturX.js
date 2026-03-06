/**
 * Factur-X (ZUGFeRD 2.1) Export Service
 * Generates XML conforming to EN16931 / Factur-X standard
 * Profiles: MINIMUM, BASIC, EN16931
 */

import { resolveInvoiceCurrency } from '@/utils/invoiceCurrency';

const FACTURX_PROFILES = {
  MINIMUM: 'urn:factur-x.eu:1p0:minimum',
  BASIC: 'urn:factur-x.eu:1p0:basic',
  EN16931: 'urn:cen.eu:en16931:2017'
};

const DOCUMENT_TYPES = {
  INVOICE: '380',
  CREDIT_NOTE: '381',
  DEBIT_NOTE: '383',
  CORRECTED_INVOICE: '384',
  PREPAYMENT_INVOICE: '386',
  SELF_BILLED_INVOICE: '389'
};

/**
 * Escape XML special characters
 */
const escapeXml = (str) => {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

const REQUIRED_FACTURX_TAGS = [
  'rsm:CrossIndustryInvoice',
  'rsm:ExchangedDocumentContext',
  'rsm:ExchangedDocument',
  'rsm:SupplyChainTradeTransaction',
  'ram:ApplicableHeaderTradeAgreement',
  'ram:ApplicableHeaderTradeSettlement'
];

export const validateFacturXXmlStructure = (xml) => {
  const errors = [];
  if (!xml || typeof xml !== 'string') {
    return { isValid: false, errors: ['Empty XML payload'] };
  }

  if (!xml.includes('xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"')) {
    errors.push('Missing CII rsm namespace declaration');
  }

  for (const tag of REQUIRED_FACTURX_TAGS) {
    if (!xml.includes(`<${tag}`)) {
      errors.push(`Missing required tag: ${tag}`);
    }
  }

  // Browser runtime validation for malformed XML.
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const parseError = doc.getElementsByTagName('parsererror');
    if (parseError && parseError.length > 0) {
      errors.push('Malformed XML document');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Format date to Factur-X format (YYYYMMDD)
 */
const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

/**
 * Format amount to 2 decimal places
 */
const formatAmount = (amount) => {
  if (amount === null || amount === undefined) return '0.00';
  return Number(amount).toFixed(2);
};

/**
 * Generate CII XML header
 */
const generateHeader = (invoice, profile) => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice
  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">`;
};

/**
 * Generate ExchangedDocumentContext
 */
const generateDocumentContext = (profile) => {
  return `
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>${FACTURX_PROFILES[profile] || FACTURX_PROFILES.BASIC}</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>`;
};

/**
 * Generate ExchangedDocument
 */
const generateExchangedDocument = (invoice) => {
  const typeCode = invoice.is_credit_note ? DOCUMENT_TYPES.CREDIT_NOTE : DOCUMENT_TYPES.INVOICE;

  return `
  <rsm:ExchangedDocument>
    <ram:ID>${escapeXml(invoice.invoice_number)}</ram:ID>
    <ram:TypeCode>${typeCode}</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${formatDate(invoice.invoice_date)}</udt:DateTimeString>
    </ram:IssueDateTime>
    ${invoice.notes ? `<ram:IncludedNote>
      <ram:Content>${escapeXml(invoice.notes)}</ram:Content>
    </ram:IncludedNote>` : ''}
  </rsm:ExchangedDocument>`;
};

/**
 * Generate SupplyChainTradeTransaction - Header
 */
const generateTradeHeader = (invoice, seller, buyer) => {
  return `
  <rsm:SupplyChainTradeTransaction>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${escapeXml(seller.company_name || seller.name)}</ram:Name>
        ${seller.siret ? `<ram:ID schemeID="0009">${escapeXml(seller.siret)}</ram:ID>` : ''}
        <ram:PostalTradeAddress>
          <ram:LineOne>${escapeXml(seller.address || '')}</ram:LineOne>
          <ram:PostcodeCode>${escapeXml(seller.postal_code || '')}</ram:PostcodeCode>
          <ram:CityName>${escapeXml(seller.city || '')}</ram:CityName>
          <ram:CountryID>${escapeXml(seller.country || 'FR')}</ram:CountryID>
        </ram:PostalTradeAddress>
        ${seller.vat_number ? `<ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${escapeXml(seller.vat_number)}</ram:ID>
        </ram:SpecifiedTaxRegistration>` : ''}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${escapeXml(buyer.name)}</ram:Name>
        ${buyer.siret ? `<ram:ID schemeID="0009">${escapeXml(buyer.siret)}</ram:ID>` : ''}
        <ram:PostalTradeAddress>
          <ram:LineOne>${escapeXml(buyer.address || '')}</ram:LineOne>
          <ram:PostcodeCode>${escapeXml(buyer.postal_code || '')}</ram:PostcodeCode>
          <ram:CityName>${escapeXml(buyer.city || '')}</ram:CityName>
          <ram:CountryID>${escapeXml(buyer.country || 'FR')}</ram:CountryID>
        </ram:PostalTradeAddress>
        ${buyer.vat_number ? `<ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${escapeXml(buyer.vat_number)}</ram:ID>
        </ram:SpecifiedTaxRegistration>` : ''}
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>`;
};

/**
 * Derive EN16931 tax category code from a VAT rate.
 * S = standard (rate > 0), Z = zero-rated (rate === 0),
 * E = exempt, AE = reverse charge (caller can override via item.tax_category).
 */
const deriveTaxCategoryCode = (rate, explicitCategory) => {
  if (explicitCategory && ['S', 'Z', 'E', 'AE'].includes(explicitCategory)) {
    return explicitCategory;
  }
  return Number(rate) === 0 ? 'Z' : 'S';
};

/**
 * Generate IncludedSupplyChainTradeLineItem elements from invoice items.
 * @param {Array} items - Invoice line items
 * @returns {string} XML fragment with all line items
 */
const generateLineItems = (items) => {
  if (!items || items.length === 0) return '';

  return items.map((item, index) => {
    const lineId = index + 1;
    const quantity = item.quantity || 1;
    const unitPrice = item.unit_price ?? item.price ?? 0;
    const lineTotal = item.total ?? (quantity * unitPrice);
    const vatRate = item.vat_rate ?? item.tax_rate ?? 20;
    const categoryCode = deriveTaxCategoryCode(vatRate, item.tax_category);
    const unitCode = item.unit_code || 'C62';

    return `
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${lineId}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${escapeXml(item.description || item.name || '')}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${formatAmount(unitPrice)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="${escapeXml(unitCode)}">${formatAmount(quantity)}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>${categoryCode}</ram:CategoryCode>
          <ram:RateApplicablePercent>${formatAmount(vatRate)}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${formatAmount(lineTotal)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`;
  }).join('');
};

/**
 * Group invoice items by VAT rate and produce ApplicableTradeTax blocks.
 * Falls back to single-rate from invoice header when no items are provided.
 * @param {Object} invoice - Invoice data
 * @param {Array} items - Invoice line items (optional)
 * @returns {string} XML fragment with one or more ApplicableTradeTax blocks
 */
const generateTaxBreakdown = (invoice, items) => {
  if (!items || items.length === 0) {
    // Fallback: single tax block from invoice header
    const rate = invoice.vat_rate ?? 20;
    const categoryCode = deriveTaxCategoryCode(rate);
    return `
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${formatAmount(invoice.total_vat || 0)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${formatAmount(invoice.total_ht || 0)}</ram:BasisAmount>
        <ram:CategoryCode>${categoryCode}</ram:CategoryCode>
        <ram:RateApplicablePercent>${formatAmount(rate)}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>`;
  }

  // Group items by rate + category
  const taxGroups = {};
  for (const item of items) {
    const rate = item.vat_rate ?? item.tax_rate ?? 20;
    const categoryCode = deriveTaxCategoryCode(rate, item.tax_category);
    const key = `${categoryCode}_${rate}`;
    if (!taxGroups[key]) {
      taxGroups[key] = { rate, categoryCode, basisAmount: 0, taxAmount: 0 };
    }
    const quantity = item.quantity || 1;
    const unitPrice = item.unit_price ?? item.price ?? 0;
    const lineTotal = item.total ?? (quantity * unitPrice);
    taxGroups[key].basisAmount += lineTotal;
    taxGroups[key].taxAmount += lineTotal * (Number(rate) / 100);
  }

  return Object.values(taxGroups).map(group => `
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${formatAmount(group.taxAmount)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${formatAmount(group.basisAmount)}</ram:BasisAmount>
        <ram:CategoryCode>${group.categoryCode}</ram:CategoryCode>
        <ram:RateApplicablePercent>${formatAmount(group.rate)}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>`).join('');
};

/**
 * Generate Trade Delivery
 */
const generateTradeDelivery = (invoice) => {
  return `
    <ram:ApplicableHeaderTradeDelivery>
      <ram:ActualDeliverySupplyChainEvent>
        <ram:OccurrenceDateTime>
          <udt:DateTimeString format="102">${formatDate(invoice.delivery_date || invoice.invoice_date)}</udt:DateTimeString>
        </ram:OccurrenceDateTime>
      </ram:ActualDeliverySupplyChainEvent>
    </ram:ApplicableHeaderTradeDelivery>`;
};

/**
 * Generate Trade Settlement
 */
const generateTradeSettlement = (invoice, seller, currency, items) => {
  const dueDate = invoice.due_date || invoice.invoice_date;

  return `
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${currency}</ram:InvoiceCurrencyCode>
      ${seller.iban ? `<ram:SpecifiedTradeSettlementPaymentMeans>
        <ram:TypeCode>58</ram:TypeCode>
        <ram:PayeePartyCreditorFinancialAccount>
          <ram:IBANID>${escapeXml(seller.iban)}</ram:IBANID>
        </ram:PayeePartyCreditorFinancialAccount>
        ${seller.bic ? `<ram:PayeeSpecifiedCreditorFinancialInstitution>
          <ram:BICID>${escapeXml(seller.bic)}</ram:BICID>
        </ram:PayeeSpecifiedCreditorFinancialInstitution>` : ''}
      </ram:SpecifiedTradeSettlementPaymentMeans>` : ''}${generateTaxBreakdown(invoice, items)}
      <ram:SpecifiedTradePaymentTerms>
        <ram:DueDateDateTime>
          <udt:DateTimeString format="102">${formatDate(dueDate)}</udt:DateTimeString>
        </ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${formatAmount(invoice.total_ht || 0)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${formatAmount(invoice.total_ht || 0)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="${currency}">${formatAmount(invoice.total_vat || 0)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${formatAmount(invoice.total_ttc || 0)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${formatAmount(invoice.total_ttc || 0)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
};

/**
 * Generate complete Factur-X XML
 * @param {Object} invoice - Invoice data
 * @param {Object} seller - Seller/company info
 * @param {Object} buyer - Buyer/client info
 * @param {string} profile - Factur-X profile (MINIMUM, BASIC, EN16931)
 * @returns {string} Complete XML string
 */
export const generateFacturXXml = (invoice, seller, buyer, profile = 'BASIC', items = []) => {
  const currency = resolveInvoiceCurrency(invoice, buyer, seller);
  const xml = [
    generateHeader(invoice, profile),
    generateDocumentContext(profile),
    generateExchangedDocument(invoice),
    generateTradeHeader(invoice, seller, buyer),
    generateLineItems(items),
    generateTradeDelivery(invoice),
    generateTradeSettlement(invoice, seller, currency, items)
  ].join('');

  return xml;
};

/**
 * Export invoice as Factur-X XML blob
 * @param {Object} invoice - Invoice data
 * @param {Object} seller - Seller info
 * @param {Object} buyer - Buyer info
 * @param {string} profile - Profile level
 * @returns {Object} { blob, filename, profile }
 */
export const exportFacturX = async (invoice, seller, buyer, profile = 'BASIC', items = []) => {
  if (!invoice || !invoice.invoice_number) {
    throw new Error('Invoice number is required');
  }

  const xml = generateFacturXXml(invoice, seller, buyer, profile, items);
  const xmlValidation = validateFacturXXmlStructure(xml);
  if (!xmlValidation.isValid) {
    throw new Error(`Invalid Factur-X XML: ${xmlValidation.errors.join(', ')}`);
  }

  const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });

  return {
    blob,
    filename: `factur-x-${invoice.invoice_number}.xml`,
    profile,
    xml
  };
};

/**
 * Validate invoice for Factur-X export
 */
export const validateForFacturX = (invoice, seller, buyer) => {
  const errors = [];

  if (!invoice.invoice_number) errors.push('Invoice number required');
  if (!invoice.invoice_date) errors.push('Invoice date required');
  if (!seller.company_name && !seller.name) errors.push('Seller name required');
  if (!buyer.name) errors.push('Buyer name required');
  if (invoice.total_ttc === undefined) errors.push('Total TTC required');

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Embed Factur-X XML inside a PDF as an attachment (EN16931 compliant).
 * Requires pdf-lib. Takes raw PDF bytes from pdfExportRuntime.saveElementAsPdfBytes().
 * @param {ArrayBuffer} pdfBytes - Raw PDF bytes
 * @param {Object} invoice - Invoice data
 * @param {Object} seller - Seller/company info
 * @param {Object} buyer - Buyer/client info
 * @param {string} profile - Factur-X profile
 * @returns {Object} { blob, filename, profile, xml }
 */
export const exportFacturXPdf = async (pdfBytes, invoice, seller, buyer, profile = 'EN16931', items = []) => {
  const { PDFDocument, AFRelationship } = await import('pdf-lib');

  const xml = generateFacturXXml(invoice, seller, buyer, profile, items);
  const xmlValidation = validateFacturXXmlStructure(xml);
  if (!xmlValidation.isValid) {
    throw new Error(`Invalid Factur-X XML: ${xmlValidation.errors.join(', ')}`);
  }

  const pdfDoc = await PDFDocument.load(pdfBytes);

  await pdfDoc.attach(
    new TextEncoder().encode(xml),
    'factur-x.xml',
    {
      mimeType: 'text/xml',
      description: `Factur-X ${profile} invoice data`,
      afRelationship: AFRelationship.Alternative,
    }
  );

  pdfDoc.setTitle(`Invoice ${invoice.invoice_number || ''}`);
  pdfDoc.setSubject('Factur-X Invoice');
  pdfDoc.setProducer('CashPilot');

  const modifiedPdfBytes = await pdfDoc.save();
  return {
    blob: new Blob([modifiedPdfBytes], { type: 'application/pdf' }),
    filename: `factur-x-${invoice.invoice_number || 'invoice'}.pdf`,
    profile,
    xml,
  };
};

export default {
  generateFacturXXml,
  exportFacturX,
  exportFacturXPdf,
  validateForFacturX,
  validateFacturXXmlStructure,
  deriveTaxCategoryCode,
  FACTURX_PROFILES,
  DOCUMENT_TYPES
};
