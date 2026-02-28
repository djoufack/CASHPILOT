import { describe, it, expect } from 'vitest';
import { generateUBLInvoice, generateUBLCreditNote, exportUBL } from '@/services/exportUBL';

const seller = {
  company_name: 'Seller BVBA',
  vat_number: 'BE0123456789',
  peppol_endpoint_id: '0123456789',
  peppol_scheme_id: '0208',
  address: 'Rue de la Loi 1',
  city: 'Bruxelles',
  postal_code: '1000',
  country: 'BE',
  iban: 'BE68539007547034',
  bic: 'BBRUBEBB',
};

const buyer = {
  company_name: 'Buyer NV',
  name: 'Buyer NV',
  vat_number: 'BE9876543210',
  peppol_endpoint_id: '9876543210',
  peppol_scheme_id: '0208',
  address: 'Rue Haute 10',
  city: 'Anvers',
  postal_code: '2000',
  country: 'BE',
};

const invoice = {
  invoice_number: 'INV-2026-001',
  invoice_date: '2026-02-27',
  due_date: '2026-03-27',
  total_ht: 1000,
  total_vat: 210,
  total_ttc: 1210,
  currency: 'EUR',
  reference: 'PO-123',
};

const items = [
  { description: 'Consulting', quantity: 5, unit_price: 200, total: 1000, tax_rate: 21 },
];

describe('generateUBLInvoice', () => {
  it('generates valid XML with correct namespaces', () => {
    const xml = generateUBLInvoice(invoice, seller, buyer, items);
    expect(xml).toContain('xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"');
    expect(xml).toContain('xmlns:cac=');
    expect(xml).toContain('xmlns:cbc=');
  });

  it('contains correct Peppol CustomizationID and ProfileID', () => {
    const xml = generateUBLInvoice(invoice, seller, buyer, items);
    expect(xml).toContain('urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0');
    expect(xml).toContain('urn:fdc:peppol.eu:2017:poacc:billing:01:1.0');
  });

  it('contains invoice number and dates in ISO 8601', () => {
    const xml = generateUBLInvoice(invoice, seller, buyer, items);
    expect(xml).toContain('<cbc:ID>INV-2026-001</cbc:ID>');
    expect(xml).toContain('<cbc:IssueDate>2026-02-27</cbc:IssueDate>');
    expect(xml).toContain('<cbc:DueDate>2026-03-27</cbc:DueDate>');
  });

  it('contains InvoiceTypeCode 380', () => {
    const xml = generateUBLInvoice(invoice, seller, buyer, items);
    expect(xml).toContain('<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>');
  });

  it('contains BuyerReference', () => {
    const xml = generateUBLInvoice(invoice, seller, buyer, items);
    expect(xml).toContain('<cbc:BuyerReference>PO-123</cbc:BuyerReference>');
  });

  it('contains seller party with Belgian endpoint', () => {
    const xml = generateUBLInvoice(invoice, seller, buyer, items);
    expect(xml).toContain('<cbc:EndpointID schemeID="0208">0123456789</cbc:EndpointID>');
    expect(xml).toContain('<cbc:CompanyID>BE0123456789</cbc:CompanyID>');
  });

  it('contains buyer party with Belgian endpoint', () => {
    const xml = generateUBLInvoice(invoice, seller, buyer, items);
    expect(xml).toContain('<cbc:EndpointID schemeID="0208">9876543210</cbc:EndpointID>');
  });

  it('contains payment means with IBAN', () => {
    const xml = generateUBLInvoice(invoice, seller, buyer, items);
    expect(xml).toContain('<cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>');
    expect(xml).toContain('<cbc:ID>BE68539007547034</cbc:ID>');
  });

  it('contains tax total with correct amounts', () => {
    const xml = generateUBLInvoice(invoice, seller, buyer, items);
    expect(xml).toContain('<cbc:TaxAmount currencyID="EUR">210.00</cbc:TaxAmount>');
    expect(xml).toContain('<cbc:Percent>21.00</cbc:Percent>');
  });

  it('contains legal monetary total', () => {
    const xml = generateUBLInvoice(invoice, seller, buyer, items);
    expect(xml).toContain('<cbc:LineExtensionAmount currencyID="EUR">1000.00</cbc:LineExtensionAmount>');
    expect(xml).toContain('<cbc:PayableAmount currencyID="EUR">1210.00</cbc:PayableAmount>');
  });

  it('contains invoice lines with correct structure', () => {
    const xml = generateUBLInvoice(invoice, seller, buyer, items);
    expect(xml).toContain('<cac:InvoiceLine>');
    expect(xml).toContain('<cbc:InvoicedQuantity unitCode="C62">5</cbc:InvoicedQuantity>');
    expect(xml).toContain('<cbc:Name>Consulting</cbc:Name>');
    expect(xml).toContain('<cbc:PriceAmount currencyID="EUR">200.00</cbc:PriceAmount>');
  });

  it('handles multi-line invoices with mixed tax rates', () => {
    const multiItems = [
      { description: 'Service A', quantity: 2, unit_price: 300, total: 600, tax_rate: 21 },
      { description: 'Service B', quantity: 1, unit_price: 400, total: 400, tax_rate: 6 },
    ];
    const multiInvoice = { ...invoice, total_ht: 1000, total_vat: 150, total_ttc: 1150 };
    const xml = generateUBLInvoice(multiInvoice, seller, buyer, multiItems);
    const taxSubtotalCount = (xml.match(/<cac:TaxSubtotal>/g) || []).length;
    expect(taxSubtotalCount).toBe(2);
    const lineCount = (xml.match(/<cac:InvoiceLine>/g) || []).length;
    expect(lineCount).toBe(2);
  });

  it('escapes XML special characters', () => {
    const specialItems = [
      { description: 'Service <A> & "B"', quantity: 1, unit_price: 100, total: 100, tax_rate: 21 },
    ];
    const xml = generateUBLInvoice({ ...invoice, total_ht: 100, total_vat: 21, total_ttc: 121 }, seller, buyer, specialItems);
    expect(xml).toContain('Service &lt;A&gt; &amp; &quot;B&quot;');
    expect(xml).not.toContain('Service <A>');
  });
});

describe('generateUBLCreditNote', () => {
  it('uses CreditNote root element and type code 381', () => {
    const xml = generateUBLCreditNote(invoice, seller, buyer, items);
    expect(xml).toContain('<CreditNote xmlns="urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2"');
    expect(xml).toContain('<cbc:CreditNoteTypeCode>381</cbc:CreditNoteTypeCode>');
    expect(xml).toContain('<cac:CreditNoteLine>');
    expect(xml).toContain('<cbc:CreditedQuantity');
  });
});

describe('exportUBL', () => {
  it('returns blob and filename', async () => {
    const result = await exportUBL(invoice, seller, buyer, items);
    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.filename).toBe('peppol-INV-2026-001.xml');
    expect(result.xml).toBeTruthy();
  });
});
