import { describe, expect, it } from 'vitest';
import { generateFacturXXml, validateFacturXXmlStructure } from '@/services/exportFacturX';

const baseInvoice = {
  invoice_number: 'FAC-2026-001',
  invoice_date: '2026-03-06',
  due_date: '2026-03-31',
  total_ht: 100,
  total_vat: 20,
  total_ttc: 120,
  vat_rate: 20
};

const baseSeller = {
  company_name: 'CashPilot Demo',
  address: 'Rue de la Demo 1',
  postal_code: '1000',
  city: 'Bruxelles',
  country: 'BE',
  vat_number: 'BE0123456789'
};

const baseBuyer = {
  name: 'Client Test',
  address: 'Avenue Client 5',
  postal_code: '75001',
  city: 'Paris',
  country: 'FR'
};

describe('exportFacturX service', () => {
  it('validates generated Factur-X XML structure', () => {
    const xml = generateFacturXXml(baseInvoice, baseSeller, baseBuyer, 'EN16931');
    const validation = validateFacturXXmlStructure(xml);
    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('rejects malformed payloads', () => {
    const validation = validateFacturXXmlStructure('<invalid');
    expect(validation.isValid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });
});
