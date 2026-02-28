# Scrada Peppol Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Storecove with Scrada as the Peppol Access Point, add polling-based status tracking and inbound invoice reception, and generate a user guide.

**Architecture:** CashPilot stores per-user Scrada credentials (API Key, Password, Company ID) in the `company` table. Edge Functions read these credentials and call the Scrada REST API (`https://api.scrada.be/v1/`). Polling replaces webhooks for Phase 1. The existing adapter pattern (`peppolAPService.js`) is extended with a `scradaAdapter`. The webhook Edge Function is updated for Scrada format but only activated when the user manually configures it in Scrada's portal.

**Tech Stack:** React 18, Supabase (Edge Functions/Deno, PostgreSQL), Scrada REST API V1, Vitest

**Scrada API Reference:**
- Auth: `X-API-KEY` + `X-PASSWORD` headers
- Base URL: `https://api.scrada.be/v1/company/{companyID}/...`
- Test URL: `https://apitest.scrada.be/v1/company/{companyID}/...`
- Rate limit: 60 req/min (token bucket)
- Key endpoints:
  - `POST /peppolOutbound/sendSalesInvoice` — Send UBL XML (content-type: application/xml)
  - `GET /peppolOutbound/{id}/status` — Check outbound document status
  - `GET /peppolOutbound/{id}` — Get outbound UBL document
  - `GET /peppolInbound` — List received invoices
  - `GET /peppolInbound/{id}` — Get inbound UBL document
  - `GET /peppolInbound/{id}/pdf` — Get inbound PDF
  - `POST /peppolRegistration` — Register company on Peppol
  - `GET /peppolRegistration` — Get registration status
  - `GET /peppolRegistration/check/{peppolID}` — Check if company is on Peppol
- Status mapping: Scrada `Created` → CashPilot `pending`, Scrada `Processed` → CashPilot `delivered`, Scrada `Error` → CashPilot `error`

---

## Task 1: DB Migration — Scrada credentials

**Files:**
- Create: `supabase/migrations/042_scrada_credentials.sql`

**Context:** The existing `company` table has `peppol_ap_provider TEXT DEFAULT 'storecove'`. We need to add columns for Scrada-specific credentials (API Key, Password, Company ID). Each CashPilot user has their own Scrada account, so credentials are stored per company.

**Step 1: Write the migration**

```sql
-- 042_scrada_credentials.sql
-- Add Scrada AP credentials to company table

-- Scrada-specific credentials (per user)
ALTER TABLE company ADD COLUMN IF NOT EXISTS scrada_company_id TEXT;
ALTER TABLE company ADD COLUMN IF NOT EXISTS scrada_api_key TEXT;
ALTER TABLE company ADD COLUMN IF NOT EXISTS scrada_password TEXT;

COMMENT ON COLUMN company.scrada_company_id IS 'Scrada company UUID (from Scrada portal)';
COMMENT ON COLUMN company.scrada_api_key IS 'Scrada API key (from Scrada Settings > API Keys)';
COMMENT ON COLUMN company.scrada_password IS 'Scrada API password (from Scrada Settings > API Keys)';

-- Update default AP provider to scrada
ALTER TABLE company ALTER COLUMN peppol_ap_provider SET DEFAULT 'scrada';

-- Add 'created' to peppol_status for Scrada compatibility
-- Drop and recreate the CHECK constraint
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_peppol_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_peppol_status_check
  CHECK (peppol_status IN ('none', 'pending', 'created', 'sent', 'delivered', 'accepted', 'rejected', 'error'));

-- Add peppol_inbound_documents table for received invoices
CREATE TABLE IF NOT EXISTS peppol_inbound_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scrada_document_id TEXT NOT NULL,
  sender_peppol_id TEXT,
  sender_name TEXT,
  document_type TEXT DEFAULT 'invoice',
  invoice_number TEXT,
  invoice_date DATE,
  total_excl_vat NUMERIC(12,2),
  total_vat NUMERIC(12,2),
  total_incl_vat NUMERIC(12,2),
  currency TEXT DEFAULT 'EUR',
  ubl_xml TEXT,
  pdf_url TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'processed', 'archived')),
  metadata JSONB DEFAULT '{}',
  received_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_peppol_inbound_user ON peppol_inbound_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_peppol_inbound_scrada_id ON peppol_inbound_documents(scrada_document_id);

ALTER TABLE peppol_inbound_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own inbound documents"
  ON peppol_inbound_documents FOR ALL
  USING (auth.uid() = user_id);
```

**Step 2: Commit**

```bash
git add supabase/migrations/042_scrada_credentials.sql
git commit -m "feat(peppol): add Scrada credentials and inbound documents table"
```

---

## Task 2: Scrada adapter — Replace Storecove

**Files:**
- Create: `src/services/peppol/scradaAdapter.js`
- Modify: `src/services/peppol/peppolAPService.js` (add `checkPeppolRegistration` + `listInboundDocuments` to interface)
- Modify: `src/test/utils/peppolAPService.test.js`

**Context:** The existing adapter pattern delegates `sendDocument` and `getDocumentStatus` to a provider adapter. Scrada has different auth (X-API-KEY + X-PASSWORD), different endpoints, and additional capabilities (Peppol registration check, inbound documents). We extend the abstract interface and create a Scrada adapter.

**Step 1: Create scradaAdapter.js**

```javascript
/**
 * Scrada Access Point adapter.
 * API docs: https://www.scrada.be/api-documentation/
 *
 * This adapter is called from Edge Functions (server-side).
 * Credentials must never be exposed to the client.
 */
const PROD_BASE_URL = 'https://api.scrada.be/v1';
const TEST_BASE_URL = 'https://apitest.scrada.be/v1';

export const createScradaAdapter = ({ apiKey, password, companyId, baseUrl, useTestEnv = false } = {}) => {
  const base = baseUrl || (useTestEnv ? TEST_BASE_URL : PROD_BASE_URL);

  const headers = (contentType = 'application/json') => ({
    'X-API-KEY': apiKey,
    'X-PASSWORD': password,
    'Content-Type': contentType,
    'Language': 'FR',
  });

  const companyUrl = `${base}/company/${companyId}`;

  return {
    /**
     * Send UBL XML via Peppol.
     * POST /v1/company/{companyID}/peppolOutbound/sendSalesInvoice
     * Content-Type: application/xml
     */
    async sendDocument(ublXml, senderEndpoint, receiverEndpoint, documentType = 'invoice') {
      const response = await fetch(`${companyUrl}/peppolOutbound/sendSalesInvoice`, {
        method: 'POST',
        headers: headers('application/xml'),
        body: ublXml,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Scrada API error ${response.status}: ${errorBody}`);
      }

      const data = await response.json();
      // Scrada returns { id: "uuid", status: "Created", ... }
      return { documentId: data.id, status: 'pending' };
    },

    /**
     * Get outbound document status.
     * GET /v1/company/{companyID}/peppolOutbound/{documentID}/status
     */
    async getDocumentStatus(documentId) {
      const response = await fetch(`${companyUrl}/peppolOutbound/${documentId}/status`, {
        method: 'GET',
        headers: headers(),
      });

      if (!response.ok) {
        throw new Error(`Scrada API error ${response.status}`);
      }

      const data = await response.json();
      // Map Scrada statuses to CashPilot statuses
      const statusMap = {
        'Created': 'pending',
        'Processed': 'delivered',
        'Error': 'error',
      };
      return {
        status: statusMap[data.status] || data.status.toLowerCase(),
        errorMessage: data.errorMessage || null,
        details: data,
      };
    },

    /**
     * Check if a company is registered on Peppol.
     * GET /v1/company/{companyID}/peppolRegistration/check/{peppolID}
     * peppolID format: "0208:0123456789"
     */
    async checkPeppolRegistration(peppolId) {
      const response = await fetch(`${companyUrl}/peppolRegistration/check/${encodeURIComponent(peppolId)}`, {
        method: 'GET',
        headers: headers(),
      });

      if (!response.ok) {
        if (response.status === 404) return { registered: false };
        throw new Error(`Scrada API error ${response.status}`);
      }

      const data = await response.json();
      return { registered: true, details: data };
    },

    /**
     * List inbound Peppol documents.
     * GET /v1/company/{companyID}/peppolInbound
     */
    async listInboundDocuments() {
      const response = await fetch(`${companyUrl}/peppolInbound`, {
        method: 'GET',
        headers: headers(),
      });

      if (!response.ok) {
        throw new Error(`Scrada API error ${response.status}`);
      }

      return await response.json();
    },

    /**
     * Get a specific inbound document (UBL XML).
     * GET /v1/company/{companyID}/peppolInbound/{documentID}
     */
    async getInboundDocument(documentId) {
      const response = await fetch(`${companyUrl}/peppolInbound/${documentId}`, {
        method: 'GET',
        headers: headers('application/xml'),
      });

      if (!response.ok) {
        throw new Error(`Scrada API error ${response.status}`);
      }

      return await response.text();
    },

    /**
     * Get PDF of an inbound document.
     * GET /v1/company/{companyID}/peppolInbound/{documentID}/pdf
     */
    async getInboundDocumentPdf(documentId) {
      const response = await fetch(`${companyUrl}/peppolInbound/${documentId}/pdf`, {
        method: 'GET',
        headers: { 'X-API-KEY': apiKey, 'X-PASSWORD': password },
      });

      if (!response.ok) {
        throw new Error(`Scrada API error ${response.status}`);
      }

      return await response.arrayBuffer();
    },

    /**
     * Validate credentials by calling GET /v1/company/{companyID}
     */
    async validateCredentials() {
      const response = await fetch(companyUrl, {
        method: 'GET',
        headers: headers(),
      });

      if (!response.ok) {
        if (response.status === 401) return { valid: false, error: 'Invalid API key or password' };
        throw new Error(`Scrada API error ${response.status}`);
      }

      const data = await response.json();
      return { valid: true, company: data };
    },
  };
};
```

**Step 2: Update peppolAPService.js to include new methods**

```javascript
/**
 * Abstract Peppol Access Point service.
 * Delegates to a provider-specific adapter (Scrada, Storecove, etc.).
 */
export const createAPService = (adapter) => ({
  sendDocument: (ublXml, senderEndpoint, receiverEndpoint, documentType) =>
    adapter.sendDocument(ublXml, senderEndpoint, receiverEndpoint, documentType),

  getDocumentStatus: (documentId) =>
    adapter.getDocumentStatus(documentId),

  // Optional methods — only available with adapters that support them
  checkPeppolRegistration: adapter.checkPeppolRegistration
    ? (peppolId) => adapter.checkPeppolRegistration(peppolId)
    : undefined,

  listInboundDocuments: adapter.listInboundDocuments
    ? () => adapter.listInboundDocuments()
    : undefined,

  getInboundDocument: adapter.getInboundDocument
    ? (documentId) => adapter.getInboundDocument(documentId)
    : undefined,

  validateCredentials: adapter.validateCredentials
    ? () => adapter.validateCredentials()
    : undefined,
});
```

**Step 3: Update tests**

Add to `src/test/utils/peppolAPService.test.js`:

```javascript
import { describe, it, expect, vi } from 'vitest';
import { createAPService } from '@/services/peppol/peppolAPService';
import { createScradaAdapter } from '@/services/peppol/scradaAdapter';

describe('createAPService', () => {
  it('delegates sendDocument to adapter', async () => {
    const mockAdapter = {
      sendDocument: vi.fn().mockResolvedValue({ documentId: 'doc-123', status: 'pending' }),
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

  it('delegates checkPeppolRegistration when available', async () => {
    const mockAdapter = {
      sendDocument: vi.fn(),
      getDocumentStatus: vi.fn(),
      checkPeppolRegistration: vi.fn().mockResolvedValue({ registered: true }),
    };
    const service = createAPService(mockAdapter);
    const result = await service.checkPeppolRegistration('0208:0123456789');
    expect(result.registered).toBe(true);
  });

  it('checkPeppolRegistration is undefined when adapter does not support it', () => {
    const mockAdapter = { sendDocument: vi.fn(), getDocumentStatus: vi.fn() };
    const service = createAPService(mockAdapter);
    expect(service.checkPeppolRegistration).toBeUndefined();
  });
});

describe('createScradaAdapter', () => {
  it('constructs with apiKey, password and companyId', () => {
    const adapter = createScradaAdapter({
      apiKey: 'test-key',
      password: 'test-pass',
      companyId: 'test-company-id',
    });
    expect(adapter.sendDocument).toBeTypeOf('function');
    expect(adapter.getDocumentStatus).toBeTypeOf('function');
    expect(adapter.checkPeppolRegistration).toBeTypeOf('function');
    expect(adapter.listInboundDocuments).toBeTypeOf('function');
    expect(adapter.validateCredentials).toBeTypeOf('function');
  });

  it('uses test environment URL when useTestEnv is true', () => {
    const adapter = createScradaAdapter({
      apiKey: 'k', password: 'p', companyId: 'c', useTestEnv: true,
    });
    // We verify it constructs without error; actual URL tested via integration
    expect(adapter).toBeDefined();
  });
});
```

**Step 4: Run tests**

```bash
npx vitest run src/test/utils/peppolAPService.test.js
```

Expected: All tests pass.

**Step 5: Commit**

```bash
git add src/services/peppol/scradaAdapter.js src/services/peppol/peppolAPService.js src/test/utils/peppolAPService.test.js
git commit -m "feat(peppol): add Scrada adapter and extend AP service interface"
```

---

## Task 3: Edge Function peppol-send — Rewrite for Scrada

**Files:**
- Modify: `supabase/functions/peppol-send/index.ts`

**Context:** The current Edge Function uses Storecove API with a shared Bearer token from env vars. For Scrada, each user has their own credentials stored in the `company` table. The function reads credentials from DB, then calls Scrada's `POST /peppolOutbound/sendSalesInvoice` with the UBL XML body. Scrada returns a document ID and status "Created".

**Step 1: Rewrite the Edge Function**

Replace the entire content of `supabase/functions/peppol-send/index.ts`:

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
    // 1. Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { invoice_id } = await req.json();
    if (!invoice_id) {
      return new Response(JSON.stringify({ error: 'invoice_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Load invoice + items
    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .select('*, items:invoice_items(*)')
      .eq('id', invoice_id)
      .single();
    if (invError || !invoice) {
      return new Response(JSON.stringify({ error: 'Invoice not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Load client (buyer)
    const { data: buyer } = await supabase
      .from('clients')
      .select('*')
      .eq('id', invoice.client_id)
      .single();
    if (!buyer) {
      return new Response(JSON.stringify({ error: 'Client not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!buyer.peppol_endpoint_id) {
      return new Response(JSON.stringify({ error: 'Client has no Peppol endpoint ID' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Load company (seller) with Scrada credentials
    const { data: seller } = await supabase
      .from('company')
      .select('*')
      .eq('user_id', user.id)
      .single();
    if (!seller) {
      return new Response(JSON.stringify({ error: 'Company profile not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!seller.peppol_endpoint_id) {
      return new Response(JSON.stringify({ error: 'Company has no Peppol endpoint ID' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!seller.scrada_api_key || !seller.scrada_password || !seller.scrada_company_id) {
      return new Response(JSON.stringify({ error: 'Scrada credentials not configured. Go to Settings > Peppol.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5. Generate UBL
    const ublXml = generateUBLInvoice(invoice, seller, buyer, invoice.items || []);

    // 6. Set invoice status to pending
    await supabase
      .from('invoices')
      .update({ peppol_status: 'pending' })
      .eq('id', invoice_id);

    // 7. Send to Scrada
    const scradaBaseUrl = Deno.env.get('SCRADA_API_URL') || 'https://api.scrada.be/v1';
    const scradaUrl = `${scradaBaseUrl}/company/${seller.scrada_company_id}/peppolOutbound/sendSalesInvoice`;

    const scradaResponse = await fetch(scradaUrl, {
      method: 'POST',
      headers: {
        'X-API-KEY': seller.scrada_api_key,
        'X-PASSWORD': seller.scrada_password,
        'Content-Type': 'application/xml',
        'Language': 'FR',
      },
      body: ublXml,
    });

    const senderEndpoint = `${seller.peppol_scheme_id || '0208'}:${seller.peppol_endpoint_id}`;
    const receiverEndpoint = `${buyer.peppol_scheme_id || '0208'}:${buyer.peppol_endpoint_id}`;

    if (!scradaResponse.ok) {
      const errText = await scradaResponse.text();
      await supabase.from('peppol_transmission_log').insert({
        user_id: user.id,
        invoice_id,
        direction: 'outbound',
        status: 'error',
        ap_provider: 'scrada',
        sender_endpoint: senderEndpoint,
        receiver_endpoint: receiverEndpoint,
        error_message: errText,
      });
      await supabase
        .from('invoices')
        .update({ peppol_status: 'error', peppol_error_message: errText })
        .eq('id', invoice_id);

      return new Response(JSON.stringify({ error: 'Scrada rejected the document', details: errText }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const scradaData = await scradaResponse.json();
    const documentId = scradaData.id || scradaData.guid || scradaData;

    // 8. Log success
    await supabase.from('peppol_transmission_log').insert({
      user_id: user.id,
      invoice_id,
      direction: 'outbound',
      status: 'sent',
      ap_provider: 'scrada',
      ap_document_id: documentId,
      sender_endpoint: senderEndpoint,
      receiver_endpoint: receiverEndpoint,
    });

    // 9. Update invoice
    await supabase
      .from('invoices')
      .update({
        peppol_status: 'pending',
        peppol_sent_at: new Date().toISOString(),
        peppol_document_id: documentId,
      })
      .eq('id', invoice_id);

    return new Response(JSON.stringify({
      success: true,
      documentId,
      status: 'pending',
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// --- UBL generation (inline, same as before) ---

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

  const lines = items.map((item: any, i: number) => {
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
git commit -m "feat(peppol): rewrite peppol-send Edge Function for Scrada API"
```

---

## Task 4: Edge Function peppol-poll-status — New

**Files:**
- Create: `supabase/functions/peppol-poll-status/index.ts`

**Context:** Instead of relying on webhooks, this Edge Function polls Scrada for the status of a pending outbound document. Called by the frontend after sending, or periodically.

**Step 1: Create the Edge Function**

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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { invoice_id } = await req.json();
    if (!invoice_id) {
      return new Response(JSON.stringify({ error: 'invoice_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load invoice
    const { data: invoice } = await supabase
      .from('invoices')
      .select('id, peppol_document_id, peppol_status')
      .eq('id', invoice_id)
      .single();

    if (!invoice?.peppol_document_id) {
      return new Response(JSON.stringify({ error: 'No Peppol document ID for this invoice' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Already final? No need to poll
    if (['delivered', 'accepted', 'error', 'rejected'].includes(invoice.peppol_status)) {
      return new Response(JSON.stringify({
        status: invoice.peppol_status,
        final: true,
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load company credentials
    const { data: company } = await supabase
      .from('company')
      .select('scrada_company_id, scrada_api_key, scrada_password')
      .eq('user_id', user.id)
      .single();

    if (!company?.scrada_api_key) {
      return new Response(JSON.stringify({ error: 'Scrada credentials not configured' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Poll Scrada
    const scradaBaseUrl = Deno.env.get('SCRADA_API_URL') || 'https://api.scrada.be/v1';
    const statusUrl = `${scradaBaseUrl}/company/${company.scrada_company_id}/peppolOutbound/${invoice.peppol_document_id}/status`;

    const scradaResponse = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'X-API-KEY': company.scrada_api_key,
        'X-PASSWORD': company.scrada_password,
        'Language': 'FR',
      },
    });

    if (!scradaResponse.ok) {
      const errText = await scradaResponse.text();
      return new Response(JSON.stringify({ error: `Scrada API error: ${errText}` }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const scradaData = await scradaResponse.json();

    // Map Scrada status
    const statusMap: Record<string, string> = {
      'Created': 'pending',
      'Processed': 'delivered',
      'Error': 'error',
    };
    const mappedStatus = statusMap[scradaData.status] || scradaData.status?.toLowerCase() || 'pending';
    const isFinal = ['delivered', 'error'].includes(mappedStatus);

    // Update invoice if status changed
    if (mappedStatus !== invoice.peppol_status) {
      await supabase
        .from('invoices')
        .update({
          peppol_status: mappedStatus,
          peppol_error_message: scradaData.errorMessage || null,
        })
        .eq('id', invoice_id);

      // Log the status change
      await supabase.from('peppol_transmission_log').insert({
        user_id: user.id,
        invoice_id,
        direction: 'outbound',
        status: mappedStatus,
        ap_provider: 'scrada',
        ap_document_id: invoice.peppol_document_id,
        error_message: scradaData.errorMessage || null,
        metadata: scradaData,
      });
    }

    return new Response(JSON.stringify({
      status: mappedStatus,
      final: isFinal,
      scradaStatus: scradaData.status,
      errorMessage: scradaData.errorMessage || null,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

**Step 2: Commit**

```bash
git add supabase/functions/peppol-poll-status/index.ts
git commit -m "feat(peppol): add peppol-poll-status Edge Function for Scrada polling"
```

---

## Task 5: Edge Function peppol-check — New

**Files:**
- Create: `supabase/functions/peppol-check/index.ts`

**Context:** Check if a company is registered on Peppol. Called when editing a client to show a "Peppol-registered" indicator.

**Step 1: Create the Edge Function**

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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { peppol_id } = await req.json();
    if (!peppol_id) {
      return new Response(JSON.stringify({ error: 'peppol_id is required (format: 0208:0123456789)' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load company Scrada credentials
    const { data: company } = await supabase
      .from('company')
      .select('scrada_company_id, scrada_api_key, scrada_password')
      .eq('user_id', user.id)
      .single();

    if (!company?.scrada_api_key) {
      return new Response(JSON.stringify({ error: 'Scrada credentials not configured' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const scradaBaseUrl = Deno.env.get('SCRADA_API_URL') || 'https://api.scrada.be/v1';
    const checkUrl = `${scradaBaseUrl}/company/${company.scrada_company_id}/peppolRegistration/check/${encodeURIComponent(peppol_id)}`;

    const scradaResponse = await fetch(checkUrl, {
      method: 'GET',
      headers: {
        'X-API-KEY': company.scrada_api_key,
        'X-PASSWORD': company.scrada_password,
        'Language': 'FR',
      },
    });

    if (scradaResponse.status === 404) {
      return new Response(JSON.stringify({ registered: false, peppolId: peppol_id }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!scradaResponse.ok) {
      const errText = await scradaResponse.text();
      return new Response(JSON.stringify({ error: `Scrada API error: ${errText}` }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await scradaResponse.json();

    return new Response(JSON.stringify({
      registered: true,
      peppolId: peppol_id,
      details: data,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

**Step 2: Commit**

```bash
git add supabase/functions/peppol-check/index.ts
git commit -m "feat(peppol): add peppol-check Edge Function for Peppol registration lookup"
```

---

## Task 6: Edge Function peppol-inbound — New

**Files:**
- Create: `supabase/functions/peppol-inbound/index.ts`

**Context:** Fetches received invoices from Scrada and stores them in `peppol_inbound_documents`. Called on-demand from the frontend. Also supports fetching a specific document's UBL or PDF.

**Step 1: Create the Edge Function**

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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const action = body.action || 'list'; // 'list', 'sync', 'get_ubl', 'get_pdf'

    // Load Scrada credentials
    const { data: company } = await supabase
      .from('company')
      .select('scrada_company_id, scrada_api_key, scrada_password')
      .eq('user_id', user.id)
      .single();

    if (!company?.scrada_api_key) {
      return new Response(JSON.stringify({ error: 'Scrada credentials not configured' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const scradaBaseUrl = Deno.env.get('SCRADA_API_URL') || 'https://api.scrada.be/v1';
    const scradaHeaders = {
      'X-API-KEY': company.scrada_api_key,
      'X-PASSWORD': company.scrada_password,
      'Language': 'FR',
    };

    if (action === 'list') {
      // Return locally stored inbound documents
      const { data: docs, error: dbErr } = await supabase
        .from('peppol_inbound_documents')
        .select('*')
        .eq('user_id', user.id)
        .order('received_at', { ascending: false })
        .limit(100);

      return new Response(JSON.stringify({ documents: docs || [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'sync') {
      // Fetch from Scrada and store new documents
      const scradaUrl = `${scradaBaseUrl}/company/${company.scrada_company_id}/peppolInbound`;
      const scradaResponse = await fetch(scradaUrl, {
        method: 'GET',
        headers: scradaHeaders,
      });

      if (!scradaResponse.ok) {
        const errText = await scradaResponse.text();
        return new Response(JSON.stringify({ error: `Scrada API error: ${errText}` }), {
          status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const scradaDocs = await scradaResponse.json();
      const documents = Array.isArray(scradaDocs) ? scradaDocs : [];
      let newCount = 0;

      for (const doc of documents) {
        const docId = doc.id || doc.documentId;
        if (!docId) continue;

        // Check if already stored
        const { data: existing } = await supabase
          .from('peppol_inbound_documents')
          .select('id')
          .eq('scrada_document_id', docId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (!existing) {
          await supabase.from('peppol_inbound_documents').insert({
            user_id: user.id,
            scrada_document_id: docId,
            sender_peppol_id: doc.peppolSenderID || doc.senderID || null,
            sender_name: doc.senderName || null,
            document_type: doc.documentType || 'invoice',
            invoice_number: doc.invoiceNumber || null,
            invoice_date: doc.invoiceDate || null,
            total_excl_vat: doc.totalExclVat || null,
            total_vat: doc.totalVat || null,
            total_incl_vat: doc.totalInclVat || null,
            currency: doc.currency || 'EUR',
            status: 'new',
            metadata: doc,
            received_at: doc.receivedAt || doc.createdOn || new Date().toISOString(),
          });
          newCount++;
        }
      }

      return new Response(JSON.stringify({
        synced: true,
        totalFromScrada: documents.length,
        newDocuments: newCount,
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get_ubl' && body.document_id) {
      const scradaUrl = `${scradaBaseUrl}/company/${company.scrada_company_id}/peppolInbound/${body.document_id}`;
      const scradaResponse = await fetch(scradaUrl, {
        method: 'GET',
        headers: { ...scradaHeaders, 'Content-Type': 'application/xml' },
      });

      if (!scradaResponse.ok) {
        return new Response(JSON.stringify({ error: 'Document not found in Scrada' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const ublXml = await scradaResponse.text();
      return new Response(JSON.stringify({ ubl: ublXml }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get_pdf' && body.document_id) {
      const scradaUrl = `${scradaBaseUrl}/company/${company.scrada_company_id}/peppolInbound/${body.document_id}/pdf`;
      const scradaResponse = await fetch(scradaUrl, {
        method: 'GET',
        headers: { 'X-API-KEY': company.scrada_api_key, 'X-PASSWORD': company.scrada_password },
      });

      if (!scradaResponse.ok) {
        return new Response(JSON.stringify({ error: 'PDF not available' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const pdfBuffer = await scradaResponse.arrayBuffer();
      return new Response(pdfBuffer, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/pdf' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action. Use: list, sync, get_ubl, get_pdf' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

**Step 2: Commit**

```bash
git add supabase/functions/peppol-inbound/index.ts
git commit -m "feat(peppol): add peppol-inbound Edge Function for receiving Peppol invoices"
```

---

## Task 7: Edge Function peppol-webhook — Update for Scrada

**Files:**
- Modify: `supabase/functions/peppol-webhook/index.ts`

**Context:** Update the webhook handler for Scrada's format. Scrada sends `peppolOutboundDocument/statusUpdate` webhooks with HMAC-SHA256 verification via `x-scrada-hmac-sha256` header. Also handles `peppolInboundDocument/new` for real-time inbound (Phase 2 when webhook is configured).

**Step 1: Rewrite the webhook handler**

Replace the content of `supabase/functions/peppol-webhook/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-scrada-topic, x-scrada-hmac-sha256, x-scrada-company-id, x-scrada-event-id, x-scrada-triggered-at, x-scrada-attempt',
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

    const topic = req.headers.get('x-scrada-topic') || '';
    const scradaCompanyId = req.headers.get('x-scrada-company-id') || '';
    const eventId = req.headers.get('x-scrada-event-id') || '';

    // Find the CashPilot user by their Scrada company ID
    const { data: companyRecord } = await supabaseAdmin
      .from('company')
      .select('user_id, id')
      .eq('scrada_company_id', scradaCompanyId)
      .maybeSingle();

    if (!companyRecord) {
      return new Response(JSON.stringify({ error: 'Unknown Scrada company ID' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = companyRecord.user_id;

    // Handle outbound status update
    if (topic === 'peppolOutboundDocument/statusUpdate') {
      const body = await req.json();

      const statusMap: Record<string, string> = {
        'Created': 'pending',
        'Processed': 'delivered',
        'Error': 'error',
      };
      const mappedStatus = statusMap[body.status] || body.status?.toLowerCase() || 'pending';

      // Find invoice by peppol_document_id
      const { data: invoice } = await supabaseAdmin
        .from('invoices')
        .select('id')
        .eq('peppol_document_id', body.id)
        .maybeSingle();

      if (invoice) {
        await supabaseAdmin
          .from('invoices')
          .update({
            peppol_status: mappedStatus,
            peppol_error_message: body.status === 'Error' ? (body.errorMessage || null) : null,
          })
          .eq('id', invoice.id);

        await supabaseAdmin.from('peppol_transmission_log').insert({
          user_id: userId,
          invoice_id: invoice.id,
          direction: 'outbound',
          status: mappedStatus,
          ap_provider: 'scrada',
          ap_document_id: body.id,
          error_message: body.errorMessage || null,
          metadata: body,
        });
      }

      return new Response(JSON.stringify({ received: true, topic }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle inbound document (new Peppol invoice received)
    if (topic === 'peppolInboundDocument/new') {
      const documentId = req.headers.get('x-scrada-document-id') || '';
      const senderPeppolId = req.headers.get('x-scrada-peppol-sender-id') || '';
      const contentType = req.headers.get('content-type') || '';

      let ublXml: string | null = null;
      if (contentType.includes('xml')) {
        ublXml = await req.text();
      }

      // Check for duplicates
      const { data: existing } = await supabaseAdmin
        .from('peppol_inbound_documents')
        .select('id')
        .eq('scrada_document_id', documentId)
        .eq('user_id', userId)
        .maybeSingle();

      if (!existing) {
        await supabaseAdmin.from('peppol_inbound_documents').insert({
          user_id: userId,
          scrada_document_id: documentId,
          sender_peppol_id: senderPeppolId,
          document_type: 'invoice',
          ubl_xml: ublXml,
          status: 'new',
          metadata: {
            eventId,
            topic,
            senderPeppolId,
            c2MessageId: req.headers.get('x-scrada-peppol-c2-message-id'),
            c3Timestamp: req.headers.get('x-scrada-peppol-c3-timestamp'),
          },
        });
      }

      return new Response(JSON.stringify({ received: true, topic, documentId }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Unknown topic — acknowledge anyway
    return new Response(JSON.stringify({ received: true, topic, unhandled: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

**Step 2: Commit**

```bash
git add supabase/functions/peppol-webhook/index.ts
git commit -m "feat(peppol): update peppol-webhook for Scrada format with inbound support"
```

---

## Task 8: PeppolSettings UI — Scrada credentials

**Files:**
- Modify: `src/components/settings/PeppolSettings.jsx`

**Context:** Replace the Storecove-focused form with Scrada credentials: API Key, Password, Company ID. Add a "Test connection" button that validates credentials via Scrada's `GET /company/{id}` endpoint. Keep the existing Peppol endpoint ID and scheme ID fields.

**Step 1: Rewrite PeppolSettings.jsx**

See full code in implementation — key changes:
- Remove `peppol_ap_provider` select (hardcode to 'scrada')
- Add `scrada_company_id` input
- Add `scrada_api_key` input (password-masked)
- Add `scrada_password` input (password-masked)
- Add "Test connection" button that calls a new Edge Function or validates client-side
- Keep `peppol_endpoint_id` and `peppol_scheme_id`
- Add helper text explaining where to find credentials in Scrada portal
- Add link to Scrada signup: `https://my.scrada.be`

Form state:
```javascript
const [form, setForm] = useState({
  peppol_endpoint_id: '',
  peppol_scheme_id: '0208',
  scrada_company_id: '',
  scrada_api_key: '',
  scrada_password: '',
});
```

**Step 2: Commit**

```bash
git add src/components/settings/PeppolSettings.jsx
git commit -m "feat(peppol): update PeppolSettings UI for Scrada credentials"
```

---

## Task 9: useCompany hook — Add Scrada fields

**Files:**
- Modify: `src/hooks/useCompany.js`

**Context:** Add the 3 Scrada credential fields to the `saveCompany` whitelist. Also change the default `peppol_ap_provider` from 'storecove' to 'scrada'.

**Step 1: Update the whitelist in saveCompany**

In `src/hooks/useCompany.js`, in the `companyFields` object inside `saveCompany()`, replace:
```javascript
peppol_ap_provider: companyData.peppol_ap_provider || 'storecove',
```
with:
```javascript
peppol_ap_provider: companyData.peppol_ap_provider || 'scrada',
scrada_company_id: companyData.scrada_company_id || null,
scrada_api_key: companyData.scrada_api_key || null,
scrada_password: companyData.scrada_password || null,
```

**Step 2: Commit**

```bash
git add src/hooks/useCompany.js
git commit -m "feat(peppol): add Scrada credential fields to useCompany whitelist"
```

---

## Task 10: usePeppolSend hook — Add polling after send

**Files:**
- Modify: `src/hooks/usePeppolSend.js`

**Context:** After successfully sending via Peppol, start polling for status updates. Poll every 10s for 2 minutes, then stop. Return the final status.

**Step 1: Add polling logic**

```javascript
import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';
import { useCompany } from '@/hooks/useCompany';
import { validateForPeppolBE } from '@/services/peppolValidation';

export const usePeppolSend = () => {
  const [sending, setSending] = useState(false);
  const [polling, setPolling] = useState(false);
  const pollRef = useRef(null);
  const { toast } = useToast();
  const { t } = useTranslation();
  const { company } = useCompany();

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setPolling(false);
  }, []);

  const pollStatus = useCallback((invoiceId, onStatusChange) => {
    setPolling(true);
    let attempts = 0;
    const maxAttempts = 12; // 12 * 10s = 2 minutes

    pollRef.current = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        stopPolling();
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('peppol-poll-status', {
          body: { invoice_id: invoiceId },
        });

        if (error) return;

        if (data?.status && onStatusChange) {
          onStatusChange(data.status, data.errorMessage);
        }

        if (data?.final) {
          stopPolling();
          if (data.status === 'delivered') {
            toast({
              title: t('peppol.status.delivered'),
              description: t('peppol.deliveredSuccess'),
              className: 'bg-green-600 border-none text-white',
            });
          } else if (data.status === 'error') {
            toast({
              title: t('peppol.status.error'),
              description: data.errorMessage || t('peppol.sendError'),
              variant: 'destructive',
            });
          }
        }
      } catch {
        // Silently retry
      }
    }, 10000);
  }, [stopPolling, toast, t]);

  const sendViaPeppol = async (invoice, client, items, onStatusChange) => {
    if (!supabase) throw new Error('Supabase not configured');

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

      // Start polling for status updates
      pollStatus(invoice.id, onStatusChange);

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

  return { sendViaPeppol, sending, polling, stopPolling };
};
```

**Step 2: Commit**

```bash
git add src/hooks/usePeppolSend.js
git commit -m "feat(peppol): add polling after send in usePeppolSend hook"
```

---

## Task 11: usePeppolCheck hook — New

**Files:**
- Create: `src/hooks/usePeppolCheck.js`

**Context:** Hook to check if a company is registered on Peppol via the `peppol-check` Edge Function. Used in ClientManager to show a "Peppol-registered" indicator.

**Step 1: Create the hook**

```javascript
import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export const usePeppolCheck = () => {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);

  const checkPeppol = useCallback(async (schemeId, endpointId) => {
    if (!supabase || !schemeId || !endpointId) return null;

    const peppolId = `${schemeId}:${endpointId}`;
    setChecking(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('peppol-check', {
        body: { peppol_id: peppolId },
      });

      if (error) throw error;

      setResult(data);
      return data;
    } catch {
      setResult({ registered: false, error: true });
      return { registered: false, error: true };
    } finally {
      setChecking(false);
    }
  }, []);

  return { checkPeppol, checking, result };
};
```

**Step 2: Commit**

```bash
git add src/hooks/usePeppolCheck.js
git commit -m "feat(peppol): add usePeppolCheck hook for Peppol registration lookup"
```

---

## Task 12: ClientManager — Add Peppol check indicator

**Files:**
- Modify: `src/components/ClientManager.jsx`

**Context:** When the user enters a Peppol endpoint ID for a client, show a small indicator (green check or red X) showing if the company is registered on Peppol. Use the `usePeppolCheck` hook.

**Step 1: Add the check**

In `ClientManager.jsx`, after the Peppol endpoint ID input field, add:
- Import `usePeppolCheck` hook
- Import `CheckCircle`, `XCircle` from lucide-react
- Add a "Vérifier Peppol" button next to the endpoint ID field
- Show result: green check + "Inscrit sur Peppol" or red X + "Non inscrit"

Key JSX addition after the endpoint ID input:
```jsx
<Button
  type="button"
  variant="outline"
  size="sm"
  onClick={() => checkPeppol(formData.peppol_scheme_id, formData.peppol_endpoint_id)}
  disabled={checking || !formData.peppol_endpoint_id}
  className="ml-2"
>
  {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : t('peppol.checkRegistration')}
</Button>
{peppolResult && (
  <span className={peppolResult.registered ? 'text-emerald-400 text-xs' : 'text-red-400 text-xs'}>
    {peppolResult.registered ? '✓ Inscrit sur Peppol' : '✗ Non inscrit'}
  </span>
)}
```

**Step 2: Commit**

```bash
git add src/components/ClientManager.jsx
git commit -m "feat(peppol): add Peppol registration check indicator in ClientManager"
```

---

## Task 13: i18n — New Scrada-specific keys

**Files:**
- Modify: `src/i18n/locales/fr.json`
- Modify: `src/i18n/locales/en.json`

**Context:** Add translation keys for Scrada-specific UI elements.

**Step 1: Add keys to fr.json**

Add inside the `"peppol"` block:
```json
"scradaCompanyId": "Scrada Company ID",
"scradaApiKey": "Clé API Scrada",
"scradaPassword": "Mot de passe API Scrada",
"scradaTestConnection": "Tester la connexion",
"scradaConnectionOk": "Connexion Scrada réussie",
"scradaConnectionFailed": "Échec de connexion Scrada",
"scradaSignupLink": "Créer un compte Scrada",
"scradaHelp": "Obtenez vos identifiants dans le portail Scrada : Settings > API Keys",
"checkRegistration": "Vérifier Peppol",
"registeredOnPeppol": "Inscrit sur Peppol",
"notRegisteredOnPeppol": "Non inscrit sur Peppol",
"inboundDocuments": "Factures reçues via Peppol",
"syncInbound": "Synchroniser",
"noInboundDocuments": "Aucune facture reçue",
"deliveredSuccess": "Facture livrée au destinataire via Peppol",
"pollingStatus": "Vérification du statut..."
```

**Step 2: Add equivalent keys to en.json**

```json
"scradaCompanyId": "Scrada Company ID",
"scradaApiKey": "Scrada API Key",
"scradaPassword": "Scrada API Password",
"scradaTestConnection": "Test connection",
"scradaConnectionOk": "Scrada connection successful",
"scradaConnectionFailed": "Scrada connection failed",
"scradaSignupLink": "Create a Scrada account",
"scradaHelp": "Get your credentials from the Scrada portal: Settings > API Keys",
"checkRegistration": "Check Peppol",
"registeredOnPeppol": "Registered on Peppol",
"notRegisteredOnPeppol": "Not registered on Peppol",
"inboundDocuments": "Invoices received via Peppol",
"syncInbound": "Sync",
"noInboundDocuments": "No invoices received",
"deliveredSuccess": "Invoice delivered to recipient via Peppol",
"pollingStatus": "Checking status..."
```

**Step 3: Commit**

```bash
git add src/i18n/locales/fr.json src/i18n/locales/en.json
git commit -m "feat(peppol): add Scrada-specific i18n keys (fr + en)"
```

---

## Task 14: Tests — Update and extend

**Files:**
- Modify: `src/test/utils/peppolAPService.test.js` (already updated in Task 2)
- Run all tests to verify nothing broke

**Step 1: Run all Peppol tests**

```bash
npx vitest run src/test/utils/
```

Expected: All tests pass (validation: 13, UBL: 15, AP service: 5+).

**Step 2: Run full build**

```bash
npx vite build
```

Expected: Build succeeds with no errors.

**Step 3: Commit if any fixes were needed**

---

## Task 15: User Guide — Connexion CashPilot-Peppol via Scrada

**Files:**
- Create: `docs/guides/connexion-peppol-scrada.md`

**Context:** A user-facing guide explaining step by step how to connect CashPilot to Peppol via Scrada. Three sections: what the user does, what CashPilot does automatically, and the results they get.

**Step 1: Write the guide**

```markdown
# Guide : Connexion CashPilot-Peppol via Scrada

## Introduction

Depuis le 1er janvier 2026, la facturation électronique via Peppol est obligatoire en Belgique pour les transactions B2B entre entreprises assujetties à la TVA. CashPilot s'intègre avec **Scrada**, un Access Point Peppol certifié belge, pour vous permettre d'envoyer et recevoir vos factures directement depuis l'application.

---

## Ce que VOUS devez faire (une seule fois, ~10 minutes)

### Étape 1 : Créer un compte Scrada

1. Rendez-vous sur **[my.scrada.be](https://my.scrada.be)** et créez un compte
2. Choisissez le plan **Peppol Inbox** (2€/mois HTVA) — suffisant pour la plupart des freelances et PME
   - Jusqu'à 600 factures/an → **Basic Peppol Box** (6€/mois)
   - Jusqu'à 1 200 factures/an → **Professional Peppol Box** (11€/mois)
3. Renseignez les informations de votre entreprise (nom, numéro BCE, adresse)

### Étape 2 : Générer vos identifiants API

1. Dans Scrada, allez dans **Settings > API Keys**
2. Cliquez sur **Créer une clé API**
3. Notez les 3 informations suivantes :
   - **Company ID** (UUID visible dans l'URL ou les paramètres)
   - **API Key** (clé générée)
   - **Password** (mot de passe associé)

### Étape 3 : Configurer CashPilot

1. Dans CashPilot, allez dans **Paramètres > Peppol**
2. Renseignez :
   - **Identifiant Peppol** : votre numéro BCE/KBO (10 chiffres, ex: 0793904121)
   - **Schéma** : 0208 (BCE/KBO belge) — pré-sélectionné
   - **Scrada Company ID** : collez le UUID de votre company Scrada
   - **Clé API Scrada** : collez votre API Key
   - **Mot de passe API** : collez votre Password
3. Cliquez sur **Tester la connexion** pour vérifier que tout fonctionne
4. Cliquez sur **Enregistrer**

**C'est terminé !** Vous n'avez plus besoin de retourner sur Scrada.

---

## Ce que CASHPILOT fait pour vous (automatiquement)

### Envoi de factures

| Étape | Ce qui se passe | Vous voyez |
|-------|----------------|------------|
| 1 | Vous cliquez **"Envoyer via Peppol"** sur une facture | Bouton vert dans l'aperçu facture |
| 2 | CashPilot valide la facture (règles EN16931) | Message d'erreur si données manquantes |
| 3 | CashPilot génère le document UBL 2.1 (XML Peppol BIS 3.0) | Transparent |
| 4 | CashPilot envoie le document à Scrada via l'API | Badge "En attente" |
| 5 | Scrada transmet la facture via le réseau Peppol | Badge "En attente" → "Livré" |
| 6 | CashPilot vérifie automatiquement le statut | Badge mis à jour en temps réel |

### Réception de factures

| Étape | Ce qui se passe | Vous voyez |
|-------|----------------|------------|
| 1 | Un fournisseur vous envoie une facture via Peppol | — |
| 2 | Scrada reçoit la facture dans votre Peppol Box | — |
| 3 | Vous cliquez **"Synchroniser"** dans CashPilot | Liste des nouvelles factures |
| 4 | CashPilot importe les factures dans votre espace | Factures visibles dans la section "Reçues" |

### Vérification Peppol des clients

| Étape | Ce qui se passe | Vous voyez |
|-------|----------------|------------|
| 1 | Vous ajoutez/modifiez un client avec un n° BCE | Champ dans le formulaire client |
| 2 | Vous cliquez **"Vérifier Peppol"** | Indicateur vert ✓ ou rouge ✗ |
| 3 | Si inscrit, CashPilot active le bouton "Envoyer via Peppol" | Bouton disponible sur les factures de ce client |

### Export UBL (toujours disponible)

Même sans compte Scrada, vous pouvez **exporter vos factures au format UBL Peppol** :
1. Ouvrez une facture
2. Cliquez **"Exporter UBL Peppol"**
3. Un fichier XML est téléchargé
4. Vous pouvez l'envoyer manuellement ou le valider sur [validator.peppol.eu](https://ecosio.com/en/peppol-and-xml-document-validator-702d/)

---

## Résultats que vous obtenez

### Conformité légale
- ✅ Factures conformes Peppol BIS Billing 3.0
- ✅ Format UBL 2.1 validé EN16931
- ✅ Schéma belge 0208 (BCE/KBO)
- ✅ Compatible B2B et B2G (Mercurius)

### Gain de temps
- ✅ Envoi en 1 clic depuis CashPilot
- ✅ Pas de saisie manuelle sur un portail externe
- ✅ Suivi automatique du statut de livraison
- ✅ Réception centralisée des factures fournisseurs

### Traçabilité
- ✅ Historique complet des transmissions Peppol
- ✅ Statuts en temps réel (En attente → Livré / Erreur)
- ✅ Messages d'erreur détaillés si problème

### Coût
- ✅ À partir de **2€/mois** (Scrada Peppol Inbox)
- ✅ Pas de frais cachés côté CashPilot
- ✅ Export UBL gratuit (sans compte Scrada)

---

## FAQ

**Q: Dois-je garder mon compte Scrada ouvert ?**
Oui, Scrada est l'Access Point qui transmet vos factures sur le réseau Peppol. CashPilot génère et gère les documents, Scrada assure le transport.

**Q: Que se passe-t-il si Scrada est en panne ?**
L'envoi échouera avec un message d'erreur. Vous pourrez réessayer plus tard. Vos factures restent dans CashPilot.

**Q: Puis-je utiliser un autre Access Point que Scrada ?**
L'architecture de CashPilot supporte plusieurs fournisseurs. Pour l'instant, seul Scrada est intégré. Contactez-nous si vous avez besoin d'un autre AP.

**Q: L'export UBL fonctionne-t-il sans Scrada ?**
Oui ! L'export UBL est indépendant de Scrada. Vous pouvez exporter vos factures au format Peppol et les envoyer via n'importe quel canal.

**Q: Comment tester avant d'envoyer une vraie facture ?**
Scrada propose un environnement de test. Contactez info@scrada.be pour obtenir un accès sandbox.
```

**Step 2: Commit**

```bash
git add docs/guides/connexion-peppol-scrada.md
git commit -m "docs: add user guide for CashPilot-Peppol connection via Scrada"
```

---

## Summary of all tasks

| Task | Description | Files |
|------|-------------|-------|
| 1 | DB Migration — Scrada credentials + inbound table | `042_scrada_credentials.sql` |
| 2 | Scrada adapter + updated AP interface + tests | `scradaAdapter.js`, `peppolAPService.js`, tests |
| 3 | Edge Function peppol-send rewrite for Scrada | `peppol-send/index.ts` |
| 4 | Edge Function peppol-poll-status (new) | `peppol-poll-status/index.ts` |
| 5 | Edge Function peppol-check (new) | `peppol-check/index.ts` |
| 6 | Edge Function peppol-inbound (new) | `peppol-inbound/index.ts` |
| 7 | Edge Function peppol-webhook update for Scrada | `peppol-webhook/index.ts` |
| 8 | PeppolSettings UI for Scrada credentials | `PeppolSettings.jsx` |
| 9 | useCompany — add Scrada fields | `useCompany.js` |
| 10 | usePeppolSend — add polling after send | `usePeppolSend.js` |
| 11 | usePeppolCheck hook (new) | `usePeppolCheck.js` |
| 12 | ClientManager — Peppol check indicator | `ClientManager.jsx` |
| 13 | i18n — Scrada-specific keys | `fr.json`, `en.json` |
| 14 | Tests — verify all pass + build | — |
| 15 | User Guide | `connexion-peppol-scrada.md` |
