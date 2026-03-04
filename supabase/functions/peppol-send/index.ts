import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { consumeCredits, createAuthClient, createServiceClient, HttpError, refundCredits, requireAuthenticatedUser } from '../_shared/billing.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PEPPOL_SEND_CREDITS = 4;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new HttpError(401, 'Missing authorization');

    const user = await requireAuthenticatedUser(req);
    const supabase = createAuthClient(authHeader);
    const serviceSupabase = createServiceClient();

    const { invoice_id } = await req.json();
    if (!invoice_id) throw new HttpError(400, 'invoice_id is required');

    // Load invoice + items
    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .select('*, items:invoice_items(*)')
      .eq('id', invoice_id)
      .eq('user_id', user.id)
      .single();
    if (invError || !invoice) throw new HttpError(404, 'Invoice not found');
    if (invoice.peppol_document_id && ['pending', 'sent', 'delivered', 'accepted'].includes(invoice.peppol_status)) {
      throw new HttpError(409, 'Invoice already sent via Peppol');
    }

    // Load client (buyer)
    const { data: buyer } = await supabase
      .from('clients')
      .select('*')
      .eq('id', invoice.client_id)
      .eq('user_id', user.id)
      .single();
    if (!buyer) throw new HttpError(404, 'Client not found');
    if (!buyer.peppol_endpoint_id) throw new HttpError(400, 'Client has no Peppol endpoint ID');

    // Load company (seller) with Scrada credentials
    let sellerQuery = supabase
      .from('company')
      .select('*')
      .eq('user_id', user.id);
    if (invoice.company_id) {
      sellerQuery = sellerQuery.eq('id', invoice.company_id);
    } else {
      sellerQuery = sellerQuery.order('created_at', { ascending: true }).limit(1);
    }
    const { data: seller } = await sellerQuery.single();
    if (!seller) throw new HttpError(404, 'Company profile not found');
    if (!seller.peppol_endpoint_id) throw new HttpError(400, 'Company has no Peppol endpoint ID');
    if (!seller.scrada_api_key || !seller.scrada_password || !seller.scrada_company_id) {
      throw new HttpError(400, 'Scrada credentials not configured. Go to Settings > Peppol.');
    }

    // Generate UBL
    const ublXml = generateUBLInvoice(invoice, seller, buyer, invoice.items || []);

    const senderEndpoint = `${seller.peppol_scheme_id || '0208'}:${seller.peppol_endpoint_id}`;
    const receiverEndpoint = `${buyer.peppol_scheme_id || '0208'}:${buyer.peppol_endpoint_id}`;
    const creditDescription = `Peppol send invoice ${invoice.invoice_number || invoice_id}`;
    const refundDescription = `Refund ${creditDescription}`;
    const creditDeduction = await consumeCredits(
      serviceSupabase,
      user.id,
      PEPPOL_SEND_CREDITS,
      creditDescription,
    );
    let refunded = false;

    try {
      // Set pending
      await supabase.from('invoices').update({ peppol_status: 'pending' }).eq('id', invoice_id);

      // Send to Scrada
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

      if (!scradaResponse.ok) {
        const errText = await scradaResponse.text();
        await refundCredits(serviceSupabase, user.id, creditDeduction, refundDescription);
        refunded = true;
        await supabase.from('peppol_transmission_log').insert({
          user_id: user.id, company_id: invoice.company_id || seller.id, invoice_id, direction: 'outbound', status: 'error',
          ap_provider: 'scrada', sender_endpoint: senderEndpoint,
          receiver_endpoint: receiverEndpoint, error_message: errText,
        });
        await supabase.from('invoices')
          .update({ peppol_status: 'error', peppol_error_message: errText })
          .eq('id', invoice_id);

        return new Response(JSON.stringify({ error: 'Scrada rejected the document', details: errText }), {
          status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const scradaData = await scradaResponse.json();
      const documentId = typeof scradaData === 'string' ? scradaData : (scradaData.id || scradaData.guid);

      // Log success
      await supabase.from('peppol_transmission_log').insert({
        user_id: user.id, company_id: invoice.company_id || seller.id, invoice_id, direction: 'outbound', status: 'sent',
        ap_provider: 'scrada', ap_document_id: documentId,
        sender_endpoint: senderEndpoint, receiver_endpoint: receiverEndpoint,
      });

      // Update invoice
      await supabase.from('invoices').update({
        peppol_status: 'pending', peppol_sent_at: new Date().toISOString(),
        peppol_document_id: documentId,
      }).eq('id', invoice_id);

      return new Response(JSON.stringify({ success: true, documentId, status: 'pending' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      if (!refunded) {
        await refundCredits(serviceSupabase, user.id, creditDeduction, refundDescription);
      }
      throw error;
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: error instanceof HttpError ? error.status : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// --- UBL generation (inline for Deno Edge Functions) ---

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
