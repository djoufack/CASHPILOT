import { describe, it, expect } from 'vitest';
import { buildPeppolQueueAssessment, validateForPeppolBE } from '@/services/peppolValidation';

const validSeller = {
  company_name: 'Test Company BVBA',
  vat_number: 'BE0123456789',
  peppol_endpoint_id: '0123456789',
  peppol_scheme_id: '0208',
  address: 'Rue de la Loi 1',
  city: 'Bruxelles',
  postal_code: '1000',
  country: 'BE',
  iban: 'BE68539007547034',
};

const validBuyer = {
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

const validInvoice = {
  invoice_number: 'INV-2026-001',
  invoice_date: '2026-02-27',
  due_date: '2026-03-27',
  total_ht: 1000,
  total_vat: 210,
  total_ttc: 1210,
  currency: 'EUR',
  reference: 'PO-123',
};

const validItems = [
  { description: 'Service A', quantity: 2, unit_price: 400, total: 800, tax_rate: 21 },
  { description: 'Service B', quantity: 1, unit_price: 200, total: 200, tax_rate: 21 },
];

describe('validateForPeppolBE', () => {
  it('returns valid for complete data', () => {
    const result = validateForPeppolBE(validInvoice, validSeller, validBuyer, validItems);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('BR-01: requires invoice number', () => {
    const inv = { ...validInvoice, invoice_number: '' };
    const result = validateForPeppolBE(inv, validSeller, validBuyer, validItems);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({ rule: 'BR-01' }));
  });

  it('BR-02: requires invoice date', () => {
    const inv = { ...validInvoice, invoice_date: null };
    const result = validateForPeppolBE(inv, validSeller, validBuyer, validItems);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({ rule: 'BR-02' }));
  });

  it('BR-05: requires valid currency code', () => {
    const inv = { ...validInvoice, currency: 'INVALID' };
    const result = validateForPeppolBE(inv, validSeller, validBuyer, validItems);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({ rule: 'BR-05' }));
  });

  it('BR-05: accepts buyer preferred currency when invoice currency is absent', () => {
    const inv = { ...validInvoice, currency: undefined };
    const buyer = { ...validBuyer, preferred_currency: 'USD' };
    const result = validateForPeppolBE(inv, validSeller, buyer, validItems);
    expect(result.isValid).toBe(true);
  });

  it('BR-06: requires seller name', () => {
    const seller = { ...validSeller, company_name: '' };
    const result = validateForPeppolBE(validInvoice, seller, validBuyer, validItems);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({ rule: 'BR-06' }));
  });

  it('BR-07: requires buyer name', () => {
    const buyer = { ...validBuyer, company_name: '', name: '' };
    const result = validateForPeppolBE(validInvoice, validSeller, buyer, validItems);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({ rule: 'BR-07' }));
  });

  it('BR-CO-09: requires seller VAT number', () => {
    const seller = { ...validSeller, vat_number: '' };
    const result = validateForPeppolBE(validInvoice, seller, validBuyer, validItems);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({ rule: 'BR-CO-09' }));
  });

  it('BR-16: requires at least one line item', () => {
    const result = validateForPeppolBE(validInvoice, validSeller, validBuyer, []);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({ rule: 'BR-16' }));
  });

  it('PEPPOL-EN16931-R001: requires seller Peppol endpoint', () => {
    const seller = { ...validSeller, peppol_endpoint_id: '' };
    const result = validateForPeppolBE(validInvoice, seller, validBuyer, validItems);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({ rule: 'PEPPOL-EN16931-R001' }));
  });

  it('PEPPOL-EN16931-R002: requires buyer Peppol endpoint', () => {
    const buyer = { ...validBuyer, peppol_endpoint_id: '' };
    const result = validateForPeppolBE(validInvoice, validSeller, buyer, validItems);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({ rule: 'PEPPOL-EN16931-R002' }));
  });

  it('PEPPOL-EN16931-R003: requires buyer reference', () => {
    const inv = { ...validInvoice, reference: '' };
    const result = validateForPeppolBE(inv, validSeller, validBuyer, validItems);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({ rule: 'PEPPOL-EN16931-R003' }));
  });

  it('BR-12: line totals must match total_ht', () => {
    const inv = { ...validInvoice, total_ht: 9999 };
    const result = validateForPeppolBE(inv, validSeller, validBuyer, validItems);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({ rule: 'BR-12' }));
  });

  it('BR-15: total_ttc must equal total_ht + total_vat', () => {
    const inv = { ...validInvoice, total_ttc: 9999 };
    const result = validateForPeppolBE(inv, validSeller, validBuyer, validItems);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({ rule: 'BR-15' }));
  });
});

describe('buildPeppolQueueAssessment', () => {
  it('returns ready when payload is valid', () => {
    const result = buildPeppolQueueAssessment({
      invoice: validInvoice,
      seller: validSeller,
      buyer: validBuyer,
      items: validItems,
    });

    expect(result.ready).toBe(true);
    expect(result.queueStatus).toBe('ready');
    expect(result.reasons).toHaveLength(0);
  });

  it('returns to_fix with reasons when payload is invalid', () => {
    const invalidBuyer = { ...validBuyer, peppol_endpoint_id: '' };
    const invalidInvoice = { ...validInvoice, reference: '' };
    const result = buildPeppolQueueAssessment({
      invoice: invalidInvoice,
      seller: validSeller,
      buyer: invalidBuyer,
      items: validItems,
    });

    expect(result.ready).toBe(false);
    expect(result.queueStatus).toBe('to_fix');
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.reasonText).toContain('PEPPOL-EN16931-R002');
    expect(result.reasonText).toContain('PEPPOL-EN16931-R003');
  });
});
