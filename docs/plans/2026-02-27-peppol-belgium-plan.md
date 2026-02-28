# Peppol BIS Billing 3.0 — Belgian Invoices Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable CashPilot to generate, validate, and transmit Peppol BIS Billing 3.0 compliant Belgian invoices (B2B + B2G) via a SaaS Access Point.

**Architecture:** CashPilot generates UBL 2.1 XML, validates it against EN16931 rules, and transmits via Storecove (or any AP SaaS) API. The AP handles SBDH, signature, and Peppol routing. Status updates flow back via webhook.

**Tech Stack:** React 18 + Vite, Supabase (DB + Edge Functions + Vault), UBL 2.1 XML string templates, Storecove REST API, Vitest for tests.

**Design doc:** `docs/plans/2026-02-27-peppol-belgium-design.md`

---

## Task 1: Supabase Migration — Peppol columns

**Files:**
- Create: `supabase/migrations/041_peppol_support.sql`

**Step 1: Write the migration SQL**

```sql
-- 041_peppol_support.sql
-- Add Peppol e-invoicing support columns

-- === clients table ===
ALTER TABLE clients ADD COLUMN IF NOT EXISTS peppol_endpoint_id TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS peppol_scheme_id TEXT DEFAULT '0208';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS electronic_invoicing_enabled BOOLEAN DEFAULT false;

COMMENT ON COLUMN clients.peppol_endpoint_id IS 'Peppol participant ID (e.g. BCE/KBO number for Belgium)';
COMMENT ON COLUMN clients.peppol_scheme_id IS 'Peppol identifier scheme (0208=BE BCE/KBO, 0009=FR SIRET, 0088=EAN)';

-- === invoices table ===
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS peppol_status TEXT DEFAULT 'none'
  CHECK (peppol_status IN ('none', 'pending', 'sent', 'delivered', 'accepted', 'rejected', 'error'));
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS peppol_sent_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS peppol_document_id TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS peppol_error_message TEXT;

COMMENT ON COLUMN invoices.peppol_status IS 'Peppol transmission status';

-- === company table ===
ALTER TABLE company ADD COLUMN IF NOT EXISTS peppol_endpoint_id TEXT;
ALTER TABLE company ADD COLUMN IF NOT EXISTS peppol_scheme_id TEXT DEFAULT '0208';
ALTER TABLE company ADD COLUMN IF NOT EXISTS peppol_ap_provider TEXT DEFAULT 'storecove';

COMMENT ON COLUMN company.peppol_endpoint_id IS 'Company Peppol participant ID';

-- === peppol_transmission_log table ===
CREATE TABLE IF NOT EXISTS peppol_transmission_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'delivered', 'accepted', 'rejected', 'error')),
  ap_provider TEXT,
  ap_document_id TEXT,
  sender_endpoint TEXT,
  receiver_endpoint TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_peppol_log_invoice ON peppol_transmission_log(invoice_id);
CREATE INDEX IF NOT EXISTS idx_peppol_log_user ON peppol_transmission_log(user_id);

ALTER TABLE peppol_transmission_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own peppol logs"
  ON peppol_transmission_log FOR ALL
  USING (auth.uid() = user_id);
```

**Step 2: Apply the migration**

Run: `npx supabase db push` (or apply via Supabase dashboard)
Expected: Migration applies without errors.

**Step 3: Commit**

```bash
git add supabase/migrations/041_peppol_support.sql
git commit -m "feat(peppol): add Peppol columns to clients, invoices, company + transmission log table"
```

---

## Task 2: UBL 2.1 Validation Service — `validateForPeppolBE`

**Files:**
- Create: `src/services/peppolValidation.js`
- Create: `src/test/utils/peppolValidation.test.js`

**Step 1: Write the failing tests**

Create `src/test/utils/peppolValidation.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { validateForPeppolBE } from '@/services/peppolValidation';

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
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/utils/peppolValidation.test.js`
Expected: FAIL — module `@/services/peppolValidation` not found.

**Step 3: Write the validation service**

Create `src/services/peppolValidation.js`:

```javascript
/**
 * Peppol BIS Billing 3.0 — EN16931 Validation for Belgian invoices
 * Validates invoice data before UBL generation or Peppol transmission.
 */

const VALID_CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'BGN', 'HRK', 'ISK', 'JPY', 'CAD', 'AUD'];

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

  // BR-01: Invoice number is mandatory
  if (!invoice.invoice_number) {
    errors.push({ rule: 'BR-01', message: 'Invoice number is required' });
  }

  // BR-02: Invoice issue date is mandatory
  if (!invoice.invoice_date) {
    errors.push({ rule: 'BR-02', message: 'Invoice issue date is required' });
  }

  // BR-05: Currency code must be valid ISO 4217
  const currency = invoice.currency || 'EUR';
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
  if (!invoice.reference && !invoice.order_reference) {
    errors.push({ rule: 'PEPPOL-EN16931-R003', message: 'Buyer reference or order reference is required' });
  }

  // BR-12: Sum of line totals must equal total_ht
  if (items && items.length > 0 && invoice.total_ht !== undefined) {
    const lineSum = items.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const lineSumRounded = Number(lineSum.toFixed(2));
    const totalHT = Number(Number(invoice.total_ht).toFixed(2));
    if (Math.abs(lineSumRounded - totalHT) > 0.01) {
      errors.push({ rule: 'BR-12', message: `Sum of line totals (${lineSumRounded}) does not match total_ht (${totalHT})` });
    }
  }

  // BR-15: total_ttc must equal total_ht + total_vat
  if (invoice.total_ht !== undefined && invoice.total_vat !== undefined && invoice.total_ttc !== undefined) {
    const expected = Number((Number(invoice.total_ht) + Number(invoice.total_vat)).toFixed(2));
    const actual = Number(Number(invoice.total_ttc).toFixed(2));
    if (Math.abs(expected - actual) > 0.01) {
      errors.push({ rule: 'BR-15', message: `total_ttc (${actual}) does not match total_ht + total_vat (${expected})` });
    }
  }

  return { isValid: errors.length === 0, errors };
};
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/utils/peppolValidation.test.js`
Expected: All 12 tests PASS.

**Step 5: Commit**

```bash
git add src/services/peppolValidation.js src/test/utils/peppolValidation.test.js
git commit -m "feat(peppol): add EN16931 + Peppol BIS 3.0 validation service with tests"
```

---

## Task 3: UBL 2.1 XML Generation Service — `exportUBL.js`

**Files:**
- Create: `src/services/exportUBL.js`
- Create: `src/test/utils/exportUBL.test.js`

**Context:** The existing `src/services/exportFacturX.js` generates CII XML using string templates. Follow the same pattern for UBL 2.1. Key differences: UBL uses namespaces `cac`/`cbc`, dates are ISO 8601 (YYYY-MM-DD not YYYYMMDD), and line items are mandatory.

**Step 1: Write the failing tests**

Create `src/test/utils/exportUBL.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { generateUBLInvoice, generateUBLCreditNote, exportUBL, validateUBLXml } from '@/services/exportUBL';

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
    // Should have two TaxSubtotal elements
    const taxSubtotalCount = (xml.match(/<cac:TaxSubtotal>/g) || []).length;
    expect(taxSubtotalCount).toBe(2);
    // Should have two InvoiceLine elements
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
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/utils/exportUBL.test.js`
Expected: FAIL — module `@/services/exportUBL` not found.

**Step 3: Write the UBL generation service**

Create `src/services/exportUBL.js`:

```javascript
/**
 * Peppol BIS Billing 3.0 — UBL 2.1 Export Service
 * Generates XML conforming to OASIS UBL 2.1 with Peppol CIUS.
 *
 * Reference: https://docs.peppol.eu/poacc/billing/3.0/
 * Counterpart to exportFacturX.js (which generates CII format).
 */

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
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
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
  const currency = invoice.currency || 'EUR';
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
  const currency = invoice.currency || 'EUR';
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
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/utils/exportUBL.test.js`
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add src/services/exportUBL.js src/test/utils/exportUBL.test.js
git commit -m "feat(peppol): add UBL 2.1 invoice/credit note generation service with tests"
```

---

## Task 4: MCP Tool — `export_ubl`

**Files:**
- Modify: `mcp-server/src/tools/exports.ts` — add the `export_ubl` tool alongside the existing `export_facturx` tool

**Step 1: Read the existing exports.ts to understand patterns**

File: `mcp-server/src/tools/exports.ts`
Look at how `export_facturx` is defined and follow the same pattern.

**Step 2: Add the `export_ubl` tool**

Add a new tool entry after the `export_facturx` tool. It should:
- Accept parameters: `invoice_id` (required), `type` (optional, 'invoice' or 'credit_note', default 'invoice')
- Fetch the invoice, items, company, and client from Supabase
- Call the UBL generation logic (server-side equivalent of `exportUBL.js`)
- Return the XML string

The MCP server runs in Node.js — import or replicate the UBL generation logic from `src/services/exportUBL.js`. Since the MCP server is TypeScript and uses a different module system, create `mcp-server/src/utils/ublGenerator.ts` with the same logic.

**Step 3: Commit**

```bash
git add mcp-server/src/tools/exports.ts mcp-server/src/utils/ublGenerator.ts
git commit -m "feat(peppol): add export_ubl MCP tool for UBL 2.1 generation"
```

---

## Task 5: AP Service Abstraction + Storecove Adapter

**Files:**
- Create: `src/services/peppol/peppolAPService.js`
- Create: `src/services/peppol/storecoveAdapter.js`
- Create: `src/test/utils/peppolAPService.test.js`

**Step 1: Write failing tests**

Create `src/test/utils/peppolAPService.test.js`:

```javascript
import { describe, it, expect, vi } from 'vitest';
import { createAPService } from '@/services/peppol/peppolAPService';
import { createStorecoveAdapter } from '@/services/peppol/storecoveAdapter';

describe('createAPService', () => {
  it('delegates sendDocument to adapter', async () => {
    const mockAdapter = {
      sendDocument: vi.fn().mockResolvedValue({ documentId: 'doc-123', status: 'sent' }),
      getDocumentStatus: vi.fn(),
    };
    const service = createAPService(mockAdapter);
    const result = await service.sendDocument('<xml/>', '0208:111', '0208:222', 'invoice');
    expect(mockAdapter.sendDocument).toHaveBeenCalledWith('<xml/>', '0208:111', '0208:222', 'invoice');
    expect(result.documentId).toBe('doc-123');
  });

  it('delegates getDocumentStatus to adapter', async () => {
    const mockAdapter = {
      sendDocument: vi.fn(),
      getDocumentStatus: vi.fn().mockResolvedValue({ status: 'delivered' }),
    };
    const service = createAPService(mockAdapter);
    const result = await service.getDocumentStatus('doc-123');
    expect(result.status).toBe('delivered');
  });
});

describe('createStorecoveAdapter', () => {
  it('constructs with apiKey and baseUrl', () => {
    const adapter = createStorecoveAdapter({ apiKey: 'test-key' });
    expect(adapter.sendDocument).toBeTypeOf('function');
    expect(adapter.getDocumentStatus).toBeTypeOf('function');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/utils/peppolAPService.test.js`
Expected: FAIL — modules not found.

**Step 3: Write the AP service abstraction**

Create `src/services/peppol/peppolAPService.js`:

```javascript
/**
 * Abstract Peppol Access Point service.
 * Delegates to a provider-specific adapter (Storecove, Basware, etc.).
 */
export const createAPService = (adapter) => ({
  sendDocument: (ublXml, senderEndpoint, receiverEndpoint, documentType) =>
    adapter.sendDocument(ublXml, senderEndpoint, receiverEndpoint, documentType),

  getDocumentStatus: (documentId) =>
    adapter.getDocumentStatus(documentId),
});
```

Create `src/services/peppol/storecoveAdapter.js`:

```javascript
/**
 * Storecove Access Point adapter.
 * API docs: https://www.storecove.com/docs/
 *
 * This adapter is called from the Edge Function (server-side),
 * not from the browser. The API key must never be exposed to the client.
 */
const DEFAULT_BASE_URL = 'https://api.storecove.com/api/v2';

export const createStorecoveAdapter = ({ apiKey, baseUrl = DEFAULT_BASE_URL } = {}) => {
  const headers = () => ({
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  });

  return {
    async sendDocument(ublXml, senderEndpoint, receiverEndpoint, documentType = 'invoice') {
      const response = await fetch(`${baseUrl}/document_submissions`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          document: {
            document_type: documentType === 'credit_note' ? 'creditnote' : 'invoice',
            rawDocument: btoa(ublXml),
            rawDocumentMimeType: 'application/xml',
          },
          routing: {
            eIdentifiers: [
              { scheme: senderEndpoint.split(':')[0], id: senderEndpoint.split(':').slice(1).join(':') },
            ],
            receiverIdentifiers: [
              { scheme: receiverEndpoint.split(':')[0], id: receiverEndpoint.split(':').slice(1).join(':') },
            ],
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Storecove API error ${response.status}: ${errorBody}`);
      }

      const data = await response.json();
      return { documentId: data.guid, status: 'sent' };
    },

    async getDocumentStatus(documentId) {
      const response = await fetch(`${baseUrl}/document_submissions/${documentId}`, {
        method: 'GET',
        headers: headers(),
      });

      if (!response.ok) {
        throw new Error(`Storecove API error ${response.status}`);
      }

      const data = await response.json();
      return { status: data.status, details: data };
    },
  };
};
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/utils/peppolAPService.test.js`
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add src/services/peppol/peppolAPService.js src/services/peppol/storecoveAdapter.js src/test/utils/peppolAPService.test.js
git commit -m "feat(peppol): add AP service abstraction + Storecove adapter"
```

---

## Task 6: Edge Function — `peppol-send`

**Files:**
- Create: `supabase/functions/peppol-send/index.ts`

**Context:** Follow the pattern of `supabase/functions/extract-invoice/index.ts` for auth, error handling, and Supabase client setup. The Storecove API key is stored as a Supabase secret `PEPPOL_AP_API_KEY`.

**Step 1: Create the Edge Function**

Create `supabase/functions/peppol-send/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { invoice_id } = await req.json();
    if (!invoice_id) {
      return new Response(JSON.stringify({ error: 'invoice_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load invoice + items
    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .select('*, items:invoice_items(*)')
      .eq('id', invoice_id)
      .single();
    if (invError || !invoice) {
      return new Response(JSON.stringify({ error: 'Invoice not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load client (buyer)
    const { data: buyer } = await supabase
      .from('clients')
      .select('*')
      .eq('id', invoice.client_id)
      .single();
    if (!buyer) {
      return new Response(JSON.stringify({ error: 'Client not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check buyer has Peppol endpoint
    if (!buyer.peppol_endpoint_id) {
      return new Response(JSON.stringify({ error: 'Client has no Peppol endpoint ID configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load company (seller)
    const { data: seller } = await supabase
      .from('company')
      .select('*')
      .eq('user_id', user.id)
      .single();
    if (!seller) {
      return new Response(JSON.stringify({ error: 'Company profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!seller.peppol_endpoint_id) {
      return new Response(JSON.stringify({ error: 'Company has no Peppol endpoint ID configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate UBL XML (inline — same logic as exportUBL.js)
    const ublXml = generateUBLInvoice(invoice, seller, buyer, invoice.items || []);

    // Update status to pending
    await supabase
      .from('invoices')
      .update({ peppol_status: 'pending' })
      .eq('id', invoice_id);

    // Send via Storecove
    const apApiKey = Deno.env.get('PEPPOL_AP_API_KEY');
    const apBaseUrl = Deno.env.get('PEPPOL_AP_URL') || 'https://api.storecove.com/api/v2';

    const senderEndpoint = `${seller.peppol_scheme_id || '0208'}:${seller.peppol_endpoint_id}`;
    const receiverEndpoint = `${buyer.peppol_scheme_id || '0208'}:${buyer.peppol_endpoint_id}`;

    const apResponse = await fetch(`${apBaseUrl}/document_submissions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        document: {
          document_type: 'invoice',
          rawDocument: btoa(ublXml),
          rawDocumentMimeType: 'application/xml',
        },
        routing: {
          eIdentifiers: [{ scheme: seller.peppol_scheme_id || '0208', id: seller.peppol_endpoint_id }],
          receiverIdentifiers: [{ scheme: buyer.peppol_scheme_id || '0208', id: buyer.peppol_endpoint_id }],
        },
      }),
    });

    if (!apResponse.ok) {
      const errText = await apResponse.text();
      // Log error
      await supabase.from('peppol_transmission_log').insert({
        user_id: user.id,
        invoice_id,
        direction: 'outbound',
        status: 'error',
        ap_provider: 'storecove',
        sender_endpoint: senderEndpoint,
        receiver_endpoint: receiverEndpoint,
        error_message: errText,
      });
      await supabase
        .from('invoices')
        .update({ peppol_status: 'error', peppol_error_message: errText })
        .eq('id', invoice_id);

      return new Response(JSON.stringify({ error: 'Access Point rejected the document', details: errText }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apData = await apResponse.json();

    // Log success
    await supabase.from('peppol_transmission_log').insert({
      user_id: user.id,
      invoice_id,
      direction: 'outbound',
      status: 'sent',
      ap_provider: 'storecove',
      ap_document_id: apData.guid,
      sender_endpoint: senderEndpoint,
      receiver_endpoint: receiverEndpoint,
    });

    await supabase
      .from('invoices')
      .update({
        peppol_status: 'sent',
        peppol_sent_at: new Date().toISOString(),
        peppol_document_id: apData.guid,
      })
      .eq('id', invoice_id);

    return new Response(JSON.stringify({
      success: true,
      documentId: apData.guid,
      status: 'sent',
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// --- UBL generation (inline to avoid import issues in Deno Edge Functions) ---
// This is a server-side copy of the core UBL logic from src/services/exportUBL.js

function escapeXml(str: string | null | undefined): string {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function formatDate(date: string | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

function fmt(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '0.00';
  return Number(amount).toFixed(2);
}

function generateUBLInvoice(invoice: any, seller: any, buyer: any, items: any[]): string {
  const currency = invoice.currency || 'EUR';
  const buyerRef = invoice.reference || invoice.invoice_number;

  // Tax breakdown
  const groups: Record<number, { rate: number; taxableAmount: number }> = {};
  for (const item of items) {
    const rate = Number(item.tax_rate || 0);
    if (!groups[rate]) groups[rate] = { rate, taxableAmount: 0 };
    groups[rate].taxableAmount += Number(item.total || 0);
  }
  const breakdown = Object.values(groups).map(g => ({
    rate: g.rate,
    taxableAmount: Number(g.taxableAmount.toFixed(2)),
    taxAmount: Number((g.taxableAmount * g.rate / 100).toFixed(2)),
    categoryId: g.rate === 0 ? 'Z' : 'S',
  }));

  const partyBlock = (party: any, tag: string) => {
    const name = party.company_name || party.name || '';
    const scheme = party.peppol_scheme_id || '0208';
    const eid = party.peppol_endpoint_id || '';
    return `<cac:${tag}><cac:Party>
      <cbc:EndpointID schemeID="${escapeXml(scheme)}">${escapeXml(eid)}</cbc:EndpointID>
      <cac:PartyName><cbc:Name>${escapeXml(name)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${escapeXml(party.address || '')}</cbc:StreetName>
        <cbc:CityName>${escapeXml(party.city || '')}</cbc:CityName>
        <cbc:PostalZone>${escapeXml(party.postal_code || '')}</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>${escapeXml(party.country || 'BE')}</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      ${party.vat_number ? `<cac:PartyTaxScheme><cbc:CompanyID>${escapeXml(party.vat_number)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>` : ''}
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(name)}</cbc:RegistrationName>
        ${eid ? `<cbc:CompanyID schemeID="${escapeXml(scheme)}">${escapeXml(eid)}</cbc:CompanyID>` : ''}
      </cac:PartyLegalEntity>
    </cac:Party></cac:${tag}>`;
  };

  const subtotals = breakdown.map(b =>
    `<cac:TaxSubtotal><cbc:TaxableAmount currencyID="${currency}">${fmt(b.taxableAmount)}</cbc:TaxableAmount><cbc:TaxAmount currencyID="${currency}">${fmt(b.taxAmount)}</cbc:TaxAmount><cac:TaxCategory><cbc:ID>${b.categoryId}</cbc:ID><cbc:Percent>${fmt(b.rate)}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal>`
  ).join('');

  const lines = items.map((item, i) => {
    const rate = Number(item.tax_rate || 0);
    return `<cac:InvoiceLine><cbc:ID>${i + 1}</cbc:ID><cbc:InvoicedQuantity unitCode="C62">${Number(item.quantity || 0)}</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="${currency}">${fmt(item.total)}</cbc:LineExtensionAmount><cac:Item><cbc:Name>${escapeXml(item.description || '')}</cbc:Name><cac:ClassifiedTaxCategory><cbc:ID>${rate === 0 ? 'Z' : 'S'}</cbc:ID><cbc:Percent>${fmt(rate)}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory></cac:Item><cac:Price><cbc:PriceAmount currencyID="${currency}">${fmt(item.unit_price)}</cbc:PriceAmount></cac:Price></cac:InvoiceLine>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>${escapeXml(invoice.invoice_number)}</cbc:ID>
  <cbc:IssueDate>${formatDate(invoice.invoice_date)}</cbc:IssueDate>
  ${invoice.due_date ? `<cbc:DueDate>${formatDate(invoice.due_date)}</cbc:DueDate>` : ''}
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${escapeXml(currency)}</cbc:DocumentCurrencyCode>
  <cbc:BuyerReference>${escapeXml(buyerRef)}</cbc:BuyerReference>
  ${partyBlock(seller, 'AccountingSupplierParty')}
  ${partyBlock(buyer, 'AccountingCustomerParty')}
  ${seller.iban ? `<cac:PaymentMeans><cbc:PaymentMeansCode>30</cbc:PaymentMeansCode><cac:PayeeFinancialAccount><cbc:ID>${escapeXml(seller.iban)}</cbc:ID></cac:PayeeFinancialAccount></cac:PaymentMeans>` : ''}
  <cac:TaxTotal><cbc:TaxAmount currencyID="${currency}">${fmt(invoice.total_vat || 0)}</cbc:TaxAmount>${subtotals}</cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${currency}">${fmt(invoice.total_ht)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${currency}">${fmt(invoice.total_ht)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${currency}">${fmt(invoice.total_ttc)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${currency}">${fmt(invoice.total_ttc)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${lines}
</Invoice>`;
}
```

**Step 2: Commit**

```bash
git add supabase/functions/peppol-send/index.ts
git commit -m "feat(peppol): add peppol-send Edge Function for AP transmission"
```

---

## Task 7: Edge Function — `peppol-webhook`

**Files:**
- Create: `supabase/functions/peppol-webhook/index.ts`

**Step 1: Create the webhook handler**

Create `supabase/functions/peppol-webhook/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const { guid, status, document_type, raw_document } = body;

    if (!guid) {
      return new Response(JSON.stringify({ error: 'Missing guid' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Map Storecove statuses to our statuses
    const statusMap: Record<string, string> = {
      sent: 'sent',
      delivered: 'delivered',
      accepted: 'accepted',
      rejected: 'rejected',
      error: 'error',
    };
    const mappedStatus = statusMap[status] || status;

    // Find invoice by peppol_document_id
    const { data: invoice } = await supabaseAdmin
      .from('invoices')
      .select('id, user_id')
      .eq('peppol_document_id', guid)
      .single();

    if (invoice) {
      // Status update for outbound invoice
      await supabaseAdmin
        .from('invoices')
        .update({
          peppol_status: mappedStatus,
          peppol_error_message: status === 'rejected' || status === 'error' ? (body.error_message || null) : null,
        })
        .eq('id', invoice.id);

      await supabaseAdmin.from('peppol_transmission_log').insert({
        user_id: invoice.user_id,
        invoice_id: invoice.id,
        direction: 'outbound',
        status: mappedStatus,
        ap_provider: 'storecove',
        ap_document_id: guid,
        error_message: body.error_message || null,
        metadata: body,
      });
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

**Step 2: Commit**

```bash
git add supabase/functions/peppol-webhook/index.ts
git commit -m "feat(peppol): add peppol-webhook Edge Function for status callbacks"
```

---

## Task 8: i18n — Peppol translation keys

**Files:**
- Modify: `src/i18n/locales/fr.json`
- Modify: `src/i18n/locales/en.json`

**Step 1: Add Peppol keys to fr.json**

Add a `"peppol"` top-level key:

```json
"peppol": {
  "sendViaPeppol": "Envoyer via Peppol",
  "exportUBL": "Exporter UBL Peppol",
  "peppolStatus": "Statut Peppol",
  "endpointId": "N° entreprise (BCE/KBO)",
  "schemeId": "Schéma d'identification",
  "transmissionLog": "Historique des transmissions",
  "enableForClient": "Activer la facturation Peppol",
  "settings": "Paramètres Peppol",
  "apProvider": "Fournisseur Access Point",
  "apApiKey": "Clé API Access Point",
  "companyEndpoint": "Identifiant Peppol de l'entreprise",
  "noEndpoint": "Aucun identifiant Peppol configuré",
  "clientNoEndpoint": "Ce client n'a pas d'identifiant Peppol",
  "sending": "Envoi en cours...",
  "sentSuccess": "Facture envoyée via Peppol",
  "sendError": "Erreur lors de l'envoi Peppol",
  "validationFailed": "La facture ne respecte pas les règles Peppol",
  "status": {
    "none": "Non envoyé",
    "pending": "En attente",
    "sent": "Envoyé",
    "delivered": "Livré",
    "accepted": "Accepté",
    "rejected": "Rejeté",
    "error": "Erreur"
  }
}
```

**Step 2: Add Peppol keys to en.json**

```json
"peppol": {
  "sendViaPeppol": "Send via Peppol",
  "exportUBL": "Export UBL Peppol",
  "peppolStatus": "Peppol Status",
  "endpointId": "Enterprise number (BCE/KBO)",
  "schemeId": "Identification scheme",
  "transmissionLog": "Transmission history",
  "enableForClient": "Enable Peppol invoicing",
  "settings": "Peppol Settings",
  "apProvider": "Access Point provider",
  "apApiKey": "Access Point API key",
  "companyEndpoint": "Company Peppol identifier",
  "noEndpoint": "No Peppol identifier configured",
  "clientNoEndpoint": "This client has no Peppol identifier",
  "sending": "Sending...",
  "sentSuccess": "Invoice sent via Peppol",
  "sendError": "Peppol send error",
  "validationFailed": "Invoice does not comply with Peppol rules",
  "status": {
    "none": "Not sent",
    "pending": "Pending",
    "sent": "Sent",
    "delivered": "Delivered",
    "accepted": "Accepted",
    "rejected": "Rejected",
    "error": "Error"
  }
}
```

**Step 3: Commit**

```bash
git add src/i18n/locales/fr.json src/i18n/locales/en.json
git commit -m "feat(peppol): add FR + EN translation keys for Peppol invoicing"
```

---

## Task 9: UI — `PeppolStatusBadge` component

**Files:**
- Create: `src/components/peppol/PeppolStatusBadge.jsx`

**Step 1: Create the badge component**

File: `src/components/peppol/PeppolStatusBadge.jsx`

```jsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Send, Check, AlertTriangle, Clock, XCircle, Truck } from 'lucide-react';

const STATUS_CONFIG = {
  none:      { color: 'bg-gray-500/20 text-gray-400',    icon: null },
  pending:   { color: 'bg-yellow-500/20 text-yellow-400', icon: Clock },
  sent:      { color: 'bg-blue-500/20 text-blue-400',     icon: Send },
  delivered: { color: 'bg-green-500/20 text-green-400',   icon: Truck },
  accepted:  { color: 'bg-emerald-500/20 text-emerald-400', icon: Check },
  rejected:  { color: 'bg-red-500/20 text-red-400',       icon: XCircle },
  error:     { color: 'bg-red-500/20 text-red-400',       icon: AlertTriangle },
};

const PeppolStatusBadge = ({ status, errorMessage }) => {
  const { t } = useTranslation();

  if (!status || status === 'none') return null;

  const config = STATUS_CONFIG[status] || STATUS_CONFIG.none;
  const Icon = config.icon;

  return (
    <Badge
      className={`${config.color} border-0 gap-1`}
      title={errorMessage || ''}
    >
      {Icon && <Icon className="w-3 h-3" />}
      {t(`peppol.status.${status}`)}
    </Badge>
  );
};

export default PeppolStatusBadge;
```

**Step 2: Commit**

```bash
git add src/components/peppol/PeppolStatusBadge.jsx
git commit -m "feat(peppol): add PeppolStatusBadge component"
```

---

## Task 10: UI — `usePeppolSend` hook

**Files:**
- Create: `src/hooks/usePeppolSend.js`

**Step 1: Create the hook**

```javascript
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';
import { useCompany } from '@/hooks/useCompany';
import { validateForPeppolBE } from '@/services/peppolValidation';

export const usePeppolSend = () => {
  const [sending, setSending] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();
  const { company } = useCompany();

  const sendViaPeppol = async (invoice, client, items) => {
    if (!supabase) throw new Error('Supabase not configured');

    // Pre-validate
    const validation = validateForPeppolBE(invoice, company, client, items);
    if (!validation.isValid) {
      const messages = validation.errors.map(e => `[${e.rule}] ${e.message}`).join('\n');
      toast({
        title: t('peppol.validationFailed'),
        description: messages,
        variant: 'destructive',
      });
      return { success: false, errors: validation.errors };
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('peppol-send', {
        body: { invoice_id: invoice.id },
      });

      if (error) throw error;

      toast({
        title: t('peppol.sentSuccess'),
        description: `Document ID: ${data.documentId}`,
      });

      return { success: true, documentId: data.documentId };
    } catch (err) {
      toast({
        title: t('peppol.sendError'),
        description: err.message,
        variant: 'destructive',
      });
      return { success: false, error: err.message };
    } finally {
      setSending(false);
    }
  };

  return { sendViaPeppol, sending };
};
```

**Step 2: Commit**

```bash
git add src/hooks/usePeppolSend.js
git commit -m "feat(peppol): add usePeppolSend hook for Peppol transmission"
```

---

## Task 11: UI — Add Peppol buttons to InvoicePreview

**Files:**
- Modify: `src/components/InvoicePreview.jsx`

**Context:** Currently this file has a single "Export PDF" button. We add two new buttons: "Export UBL" (download XML) and "Send via Peppol" (transmit).

**Step 1: Add imports**

At the top of `InvoicePreview.jsx`, add:

```javascript
import { exportUBL } from '@/services/exportUBL';
import { validateForPeppolBE } from '@/services/peppolValidation';
import { usePeppolSend } from '@/hooks/usePeppolSend';
import PeppolStatusBadge from '@/components/peppol/PeppolStatusBadge';
import { FileCode, Send } from 'lucide-react';
```

**Step 2: Add handlers inside the component**

After `const { guardedAction, modalProps } = useCreditsGuard();`, add:

```javascript
const { sendViaPeppol, sending } = usePeppolSend();

const handleExportUBL = async () => {
  try {
    const { blob, filename } = await exportUBL(invoice, company, client, items);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Success', description: t('peppol.exportUBL') });
  } catch (error) {
    toast({ title: 'Error', description: error.message, variant: 'destructive' });
  }
};

const handleSendPeppol = async () => {
  await sendViaPeppol(invoice, client, items);
};
```

**Step 3: Add buttons to the JSX**

In the `<div className="flex justify-end">` section, after the PDF button, add:

```jsx
<motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
  <Button onClick={handleExportUBL} variant="outline" className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10">
    <FileCode className="w-4 h-4 mr-2" />
    {t('peppol.exportUBL')}
  </Button>
</motion.div>

{client?.peppol_endpoint_id && company?.peppol_endpoint_id && (
  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
    <Button
      onClick={handleSendPeppol}
      disabled={sending || invoice.peppol_status === 'sent' || invoice.peppol_status === 'delivered'}
      className="bg-emerald-600 hover:bg-emerald-700"
    >
      <Send className="w-4 h-4 mr-2" />
      {sending ? t('peppol.sending') : t('peppol.sendViaPeppol')}
    </Button>
  </motion.div>
)}

{invoice.peppol_status && invoice.peppol_status !== 'none' && (
  <PeppolStatusBadge status={invoice.peppol_status} errorMessage={invoice.peppol_error_message} />
)}
```

Change the flex div to `<div className="flex justify-end gap-2 flex-wrap">` to handle multiple buttons.

**Step 4: Commit**

```bash
git add src/components/InvoicePreview.jsx
git commit -m "feat(peppol): add UBL export + Peppol send buttons to InvoicePreview"
```

---

## Task 12: UI — Peppol fields in ClientManager

**Files:**
- Modify: `src/components/ClientManager.jsx`

**Step 1: Add Peppol fields to emptyFormData**

In the `emptyFormData` object (around line 59), add:

```javascript
peppol_endpoint_id: '',
peppol_scheme_id: '0208',
electronic_invoicing_enabled: false,
```

**Step 2: Add form fields in the edit/create dialog**

After the "Bank" section fields, add a "Peppol" section:

```jsx
{/* Peppol / E-Invoicing */}
<div className="space-y-3 pt-4 border-t border-white/10">
  <h4 className="text-sm font-medium text-white/60">{t('peppol.settings')}</h4>
  <div className="grid grid-cols-2 gap-3">
    <div>
      <label className="text-xs text-white/40">{t('peppol.endpointId')}</label>
      <Input
        value={formData.peppol_endpoint_id}
        onChange={(e) => setFormData({ ...formData, peppol_endpoint_id: e.target.value })}
        placeholder="0123456789"
        className="bg-white/5 border-white/10"
      />
    </div>
    <div>
      <label className="text-xs text-white/40">{t('peppol.schemeId')}</label>
      <select
        value={formData.peppol_scheme_id}
        onChange={(e) => setFormData({ ...formData, peppol_scheme_id: e.target.value })}
        className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm"
      >
        <option value="0208">0208 - BE (BCE/KBO)</option>
        <option value="0009">0009 - FR (SIRET)</option>
        <option value="0088">0088 - EAN/GLN</option>
        <option value="0190">0190 - NL (KVK)</option>
        <option value="9925">9925 - BE (TVA)</option>
      </select>
    </div>
  </div>
  <div className="flex items-center gap-2">
    <input
      type="checkbox"
      checked={formData.electronic_invoicing_enabled}
      onChange={(e) => setFormData({ ...formData, electronic_invoicing_enabled: e.target.checked })}
      className="rounded"
    />
    <label className="text-sm text-white/60">{t('peppol.enableForClient')}</label>
  </div>
</div>
```

**Step 3: Commit**

```bash
git add src/components/ClientManager.jsx
git commit -m "feat(peppol): add Peppol endpoint fields to client form"
```

---

## Task 13: UI — Peppol settings tab in SettingsPage

**Files:**
- Create: `src/components/settings/PeppolSettings.jsx`
- Modify: `src/pages/SettingsPage.jsx`

**Step 1: Create PeppolSettings component**

Create `src/components/settings/PeppolSettings.jsx`:

```jsx
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useCompany } from '@/hooks/useCompany';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Globe, Save } from 'lucide-react';

const PeppolSettings = () => {
  const { t } = useTranslation();
  const { company, saveCompany, loading } = useCompany();
  const { toast } = useToast();
  const [form, setForm] = useState({
    peppol_endpoint_id: '',
    peppol_scheme_id: '0208',
    peppol_ap_provider: 'storecove',
  });

  useEffect(() => {
    if (company) {
      setForm({
        peppol_endpoint_id: company.peppol_endpoint_id || '',
        peppol_scheme_id: company.peppol_scheme_id || '0208',
        peppol_ap_provider: company.peppol_ap_provider || 'storecove',
      });
    }
  }, [company]);

  const handleSave = async () => {
    const success = await saveCompany({ ...company, ...form });
    if (success) {
      toast({ title: 'Success', description: t('messages.success.settingsSaved') });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Globe className="w-5 h-5 text-emerald-400" />
        <h3 className="text-lg font-semibold text-white">{t('peppol.settings')}</h3>
      </div>

      <div className="space-y-4 bg-white/5 rounded-lg p-4 border border-white/10">
        <div>
          <label className="text-sm text-white/60">{t('peppol.companyEndpoint')}</label>
          <Input
            value={form.peppol_endpoint_id}
            onChange={(e) => setForm({ ...form, peppol_endpoint_id: e.target.value })}
            placeholder="0123456789"
            className="bg-white/5 border-white/10 mt-1"
          />
          <p className="text-xs text-white/40 mt-1">
            Belgium: BCE/KBO enterprise number (10 digits)
          </p>
        </div>

        <div>
          <label className="text-sm text-white/60">{t('peppol.schemeId')}</label>
          <select
            value={form.peppol_scheme_id}
            onChange={(e) => setForm({ ...form, peppol_scheme_id: e.target.value })}
            className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm mt-1"
          >
            <option value="0208">0208 - BE (BCE/KBO)</option>
            <option value="0009">0009 - FR (SIRET)</option>
            <option value="0088">0088 - EAN/GLN</option>
          </select>
        </div>

        <div>
          <label className="text-sm text-white/60">{t('peppol.apProvider')}</label>
          <select
            value={form.peppol_ap_provider}
            onChange={(e) => setForm({ ...form, peppol_ap_provider: e.target.value })}
            className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm mt-1"
          >
            <option value="storecove">Storecove</option>
            <option value="unifiedpost">Unifiedpost</option>
            <option value="basware">Basware</option>
          </select>
        </div>

        <Button onClick={handleSave} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700">
          <Save className="w-4 h-4 mr-2" />
          {t('common.save')}
        </Button>
      </div>
    </div>
  );
};

export default PeppolSettings;
```

**Step 2: Add the tab to SettingsPage.jsx**

In `src/pages/SettingsPage.jsx`:

1. Add import: `import PeppolSettings from '@/components/settings/PeppolSettings';`
2. Add import: `import { Globe } from 'lucide-react';`
3. Add a new tab trigger + content for "peppol" after the "invoices" tab (follow the existing pattern)
4. Add `peppol: 'peppol'` to the TAB_MAP

**Step 3: Commit**

```bash
git add src/components/settings/PeppolSettings.jsx src/pages/SettingsPage.jsx
git commit -m "feat(peppol): add Peppol settings tab to SettingsPage"
```

---

## Task 14: Update `useCompany` hook — propagate Peppol fields

**Files:**
- Modify: `src/hooks/useCompany.js`

**Step 1: Add Peppol fields to the saveCompany field whitelist**

In `src/hooks/useCompany.js`, find the explicit field whitelist in `saveCompany` (around line 67). Add these three fields to the whitelist object:

```javascript
peppol_endpoint_id: companyData.peppol_endpoint_id || null,
peppol_scheme_id: companyData.peppol_scheme_id || '0208',
peppol_ap_provider: companyData.peppol_ap_provider || 'storecove',
```

**Step 2: Commit**

```bash
git add src/hooks/useCompany.js
git commit -m "feat(peppol): propagate Peppol fields in useCompany hook"
```

---

## Task 15: Run all tests + manual smoke test

**Step 1: Run all Vitest tests**

Run: `npx vitest run`
Expected: All tests pass, including the new Peppol validation and UBL tests.

**Step 2: Manual smoke test checklist**

- [ ] Start dev server (`npm run dev`)
- [ ] Go to Settings → Peppol tab → Configure endpoint + scheme
- [ ] Edit a client → See Peppol fields → Enter BCE number
- [ ] Open an invoice preview → See "Export UBL Peppol" button
- [ ] Click "Export UBL Peppol" → Downloads `.xml` file
- [ ] Open the XML → Verify correct namespaces, CustomizationID, ProfileID
- [ ] If Peppol endpoint configured on both sides → "Send via Peppol" button visible
- [ ] Peppol status badge appears on sent invoices

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix(peppol): address smoke test issues"
```

---

## Task 16: Supabase secrets configuration

**Not code — manual setup required.**

Configure these secrets in your Supabase project dashboard (Settings → Secrets):

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `PEPPOL_AP_API_KEY` | (from Storecove account) | Storecove API key |
| `PEPPOL_AP_URL` | `https://api.storecove.com/api/v2` | AP base URL (use sandbox for testing) |

For Storecove sandbox testing, use `https://api-sandbox.storecove.com/api/v2`.

Register the webhook URL in Storecove dashboard:
`https://<project-ref>.supabase.co/functions/v1/peppol-webhook`

---

## Summary

| Task | Component | Files | Est. |
|------|-----------|-------|------|
| 1 | DB Migration | `supabase/migrations/041_peppol_support.sql` | 5min |
| 2 | Validation service | `peppolValidation.js` + tests | 15min |
| 3 | UBL generation | `exportUBL.js` + tests | 20min |
| 4 | MCP tool | `exports.ts` + `ublGenerator.ts` | 15min |
| 5 | AP service | `peppolAPService.js` + `storecoveAdapter.js` + tests | 15min |
| 6 | Edge Function send | `peppol-send/index.ts` | 15min |
| 7 | Edge Function webhook | `peppol-webhook/index.ts` | 10min |
| 8 | i18n | `fr.json` + `en.json` | 5min |
| 9 | Status badge | `PeppolStatusBadge.jsx` | 5min |
| 10 | Send hook | `usePeppolSend.js` | 5min |
| 11 | InvoicePreview buttons | `InvoicePreview.jsx` | 10min |
| 12 | Client form fields | `ClientManager.jsx` | 10min |
| 13 | Settings tab | `PeppolSettings.jsx` + `SettingsPage.jsx` | 10min |
| 14 | useCompany fields | `useCompany.js` | 5min |
| 15 | Test + smoke test | All | 15min |
| 16 | Supabase secrets | Dashboard | 5min |
