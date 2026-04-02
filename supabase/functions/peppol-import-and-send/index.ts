import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import {
  consumeCredits,
  createAuthClient,
  HttpError,
  refundCredits,
  requireAuthenticatedUser,
  resolveCreditCost,
} from '../_shared/billing.ts';
import { getScopedCompany } from '../_shared/companyScope.ts';
import { resolveScradaCredentials } from '../_shared/scradaCredentials.ts';
import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  ...SECURITY_HEADERS,
};

type ParsedLine = {
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  taxRate: number;
};

type ParsedUbl = {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string | null;
  currency: string;
  totalHT: number;
  totalVAT: number;
  totalTTC: number;
  buyerName: string;
  buyerEndpointId: string;
  buyerSchemeId: string;
  buyerAddress: string | null;
  buyerCity: string | null;
  buyerPostalCode: string | null;
  buyerCountry: string | null;
  lines: ParsedLine[];
};

const toText = (value: unknown): string => String(value ?? '').trim();

const toNumber = (value: unknown, fallback = 0): number => {
  const numeric = Number(String(value ?? '').replace(',', '.'));
  if (!Number.isFinite(numeric)) return fallback;
  return Number(numeric);
};

const formatIsoDate = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};

const addDays = (isoDate: string, days: number): string => {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const normalizeXmlText = (value: string): string => {
  return value.replace(/\u0000/g, '').trim();
};

const extractFirst = (xml: string, tagName: string): string => {
  const escapedTag = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`<(?:[\\w-]+:)?${escapedTag}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${escapedTag}>`, 'i');
  const match = xml.match(regex);
  return toText(match?.[1] || '');
};

const extractFirstAttribute = (xml: string, tagName: string, attribute: string): string => {
  const escapedTag = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedAttr = attribute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`<(?:[\\w-]+:)?${escapedTag}\\b([^>]*)>`, 'i');
  const match = xml.match(regex);
  if (!match?.[1]) return '';
  const attrRegex = new RegExp(`${escapedAttr}\\s*=\\s*["']([^"']+)["']`, 'i');
  const attrMatch = match[1].match(attrRegex);
  return toText(attrMatch?.[1] || '');
};

const extractBlock = (xml: string, tagName: string): string => {
  const escapedTag = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`<(?:[\\w-]+:)?${escapedTag}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${escapedTag}>`, 'i');
  const match = xml.match(regex);
  return match?.[1] || '';
};

const extractBlocks = (xml: string, tagName: string): string[] => {
  const escapedTag = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`<(?:[\\w-]+:)?${escapedTag}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${escapedTag}>`, 'gi');
  const matches: string[] = [];
  let match: RegExpExecArray | null = regex.exec(xml);
  while (match) {
    matches.push(match[1] || '');
    match = regex.exec(xml);
  }
  return matches;
};

const parseUblInvoice = (xmlInput: string): ParsedUbl => {
  const xml = normalizeXmlText(xmlInput);
  if (!xml) throw new HttpError(400, 'UBL XML is empty');
  if (!xml.includes('<Invoice')) throw new HttpError(400, 'Provided XML is not a UBL Invoice');

  const invoiceNumber =
    toText(xml.match(/<(?:[\w-]+:)?Invoice\b[^>]*>[\s\S]*?<(?:[\w-]+:)?ID\b[^>]*>([^<]+)<\/(?:[\w-]+:)?ID>/i)?.[1]) ||
    `EXT-${Date.now()}`;
  const issueDate = formatIsoDate(extractFirst(xml, 'IssueDate')) || new Date().toISOString().slice(0, 10);
  const dueDate = formatIsoDate(extractFirst(xml, 'DueDate'));
  const currency =
    toText(extractFirst(xml, 'DocumentCurrencyCode')).toUpperCase() ||
    toText(extractFirstAttribute(xml, 'TaxInclusiveAmount', 'currencyID')).toUpperCase() ||
    'EUR';

  const legalTotalBlock = extractBlock(xml, 'LegalMonetaryTotal');
  const totalHT = toNumber(extractFirst(legalTotalBlock || xml, 'TaxExclusiveAmount'));
  const totalTTC =
    toNumber(extractFirst(legalTotalBlock || xml, 'PayableAmount')) ||
    toNumber(extractFirst(legalTotalBlock || xml, 'TaxInclusiveAmount'));

  const taxTotalBlock = extractBlock(xml, 'TaxTotal');
  const totalVAT = toNumber(extractFirst(taxTotalBlock || xml, 'TaxAmount'), Math.max(0, totalTTC - totalHT));

  const customerPartyBlock = extractBlock(xml, 'AccountingCustomerParty');
  if (!customerPartyBlock) throw new HttpError(400, 'Buyer party (AccountingCustomerParty) not found');
  const buyerEndpointId = toText(extractFirst(customerPartyBlock, 'EndpointID'));
  if (!buyerEndpointId) throw new HttpError(400, 'Buyer EndpointID missing in UBL');
  const buyerSchemeId = toText(extractFirstAttribute(customerPartyBlock, 'EndpointID', 'schemeID')) || '0208';

  const buyerName = toText(extractFirst(customerPartyBlock, 'Name')) || `Client ${buyerEndpointId}`;
  const buyerAddress = toText(extractFirst(customerPartyBlock, 'StreetName')) || null;
  const buyerCity = toText(extractFirst(customerPartyBlock, 'CityName')) || null;
  const buyerPostalCode = toText(extractFirst(customerPartyBlock, 'PostalZone')) || null;
  const buyerCountry = toText(extractFirst(customerPartyBlock, 'IdentificationCode')) || null;

  const lineBlocks = extractBlocks(xml, 'InvoiceLine');
  const lines: ParsedLine[] = lineBlocks.map((lineBlock, index) => {
    const description = toText(extractFirst(lineBlock, 'Name')) || `Ligne ${index + 1}`;
    const quantity = Math.max(0, toNumber(extractFirst(lineBlock, 'InvoicedQuantity'), 1)) || 1;
    const lineTotal = toNumber(extractFirst(lineBlock, 'LineExtensionAmount'), 0);
    const unitPriceRaw = toNumber(extractFirst(lineBlock, 'PriceAmount'), 0);
    const unitPrice = unitPriceRaw > 0 ? unitPriceRaw : quantity > 0 ? lineTotal / quantity : 0;
    const taxRate = Math.max(0, toNumber(extractFirst(lineBlock, 'Percent'), 0));
    return {
      description,
      quantity: Number(quantity.toFixed(4)),
      unitPrice: Number(unitPrice.toFixed(6)),
      lineTotal: Number((lineTotal || quantity * unitPrice).toFixed(2)),
      taxRate: Number(taxRate.toFixed(4)),
    };
  });

  return {
    invoiceNumber,
    issueDate,
    dueDate,
    currency,
    totalHT: Number(totalHT.toFixed(2)),
    totalVAT: Number(totalVAT.toFixed(2)),
    totalTTC: Number((totalTTC || totalHT + totalVAT).toFixed(2)),
    buyerName,
    buyerEndpointId,
    buyerSchemeId,
    buyerAddress,
    buyerCity,
    buyerPostalCode,
    buyerCountry,
    lines,
  };
};

const resolveUniqueInvoiceNumber = async (
  supabase: ReturnType<typeof createAuthClient>,
  requestedNumber: string
): Promise<string> => {
  const base = toText(requestedNumber) || `EXT-${Date.now()}`;
  let candidate = base;
  let index = 1;

  while (index < 1000) {
    const { data, error } = await supabase.from('invoices').select('id').eq('invoice_number', candidate).maybeSingle();
    if (error) throw error;
    if (!data) return candidate;
    candidate = `${base}-${index}`;
    index += 1;
  }

  return `${base}-${Date.now()}`;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new HttpError(401, 'Missing authorization');

    const user = await requireAuthenticatedUser(req);
    const supabase = createAuthClient(authHeader);

    const body = await req.json().catch(() => ({}));
    const ublXml = toText(body.ubl_xml);
    const sourceOrigin = toText(body.source_origin) || 'external';
    const sourceLabel = toText(body.source_label) || 'external-ubl';
    const requestedCompanyId = body.company_id || null;

    if (!ublXml) throw new HttpError(400, 'ubl_xml is required');

    const parsed = parseUblInvoice(ublXml);
    const { company, companyId } = await getScopedCompany(
      supabase,
      user.id,
      'id, peppol_endpoint_id, peppol_scheme_id, scrada_company_id, scrada_api_key, scrada_password, scrada_api_key_encrypted, scrada_password_encrypted',
      requestedCompanyId
    );

    const { apiKey, password } = await resolveScradaCredentials(company);
    if (!apiKey || !password || !company?.scrada_company_id) {
      throw new HttpError(400, 'Scrada credentials not configured');
    }
    if (!company?.peppol_endpoint_id) {
      throw new HttpError(400, 'Company Peppol endpoint not configured');
    }

    // 1) Upsert buyer client by Peppol endpoint
    let { data: client, error: clientLookupError } = await supabase
      .from('clients')
      .select('id, company_name, peppol_endpoint_id, peppol_scheme_id')
      .eq('user_id', user.id)
      .eq('company_id', companyId)
      .eq('peppol_endpoint_id', parsed.buyerEndpointId)
      .maybeSingle();

    if (clientLookupError) throw clientLookupError;

    if (!client) {
      const { data: createdClient, error: createClientError } = await supabase
        .from('clients')
        .insert({
          user_id: user.id,
          company_id: companyId,
          company_name: parsed.buyerName,
          contact_name: parsed.buyerName,
          address: parsed.buyerAddress,
          city: parsed.buyerCity,
          postal_code: parsed.buyerPostalCode,
          country: parsed.buyerCountry,
          peppol_endpoint_id: parsed.buyerEndpointId,
          peppol_scheme_id: parsed.buyerSchemeId,
          electronic_invoicing_enabled: true,
        })
        .select('id, company_name, peppol_endpoint_id, peppol_scheme_id')
        .single();

      if (createClientError) throw createClientError;
      client = createdClient;
    }

    const issueDate = parsed.issueDate;
    const dueDate = parsed.dueDate || addDays(issueDate, 30);
    const totalHT = parsed.totalHT > 0 ? parsed.totalHT : Math.max(0, parsed.totalTTC - parsed.totalVAT);
    const totalTTC = parsed.totalTTC > 0 ? parsed.totalTTC : totalHT + parsed.totalVAT;
    const taxRate = totalHT > 0 ? Number(((parsed.totalVAT / totalHT) * 100).toFixed(2)) : 0;
    const invoiceNumber = await resolveUniqueInvoiceNumber(supabase, parsed.invoiceNumber);

    // 2) Create local invoice (registration + accounting chain)
    const { data: createdInvoice, error: createInvoiceError } = await supabase
      .from('invoices')
      .insert({
        user_id: user.id,
        company_id: companyId,
        client_id: client.id,
        invoice_number: invoiceNumber,
        date: issueDate,
        due_date: dueDate,
        status: 'draft',
        payment_status: 'unpaid',
        total_ht: totalHT,
        tax_rate: taxRate,
        total_ttc: totalTTC,
        amount_paid: 0,
        balance_due: totalTTC,
        currency: parsed.currency,
        notes: `Import UBL externe (${sourceOrigin}: ${sourceLabel})`,
        peppol_status: 'none',
      })
      .select('id, invoice_number')
      .single();

    if (createInvoiceError || !createdInvoice) {
      throw createInvoiceError || new HttpError(500, 'Failed to create invoice');
    }

    const lines =
      parsed.lines.length > 0
        ? parsed.lines
        : [
            {
              description: 'Ligne importee depuis UBL externe',
              quantity: 1,
              unitPrice: totalHT,
              lineTotal: totalHT,
              taxRate,
            },
          ];

    const { error: createItemsError } = await supabase.from('invoice_items').insert(
      lines.map((line) => ({
        invoice_id: createdInvoice.id,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unitPrice,
        total: line.lineTotal,
        item_type: 'manual',
      }))
    );
    if (createItemsError) throw createItemsError;

    // Move local invoice to sent state before Peppol send to preserve accounting triggers.
    const { error: markSentError } = await supabase
      .from('invoices')
      .update({ status: 'sent' })
      .eq('id', createdInvoice.id)
      .eq('user_id', user.id);
    if (markSentError) throw markSentError;

    // 3) Peppol network send via Scrada
    const senderEndpoint = `${company.peppol_scheme_id || '0208'}:${company.peppol_endpoint_id}`;
    const receiverEndpoint = `${parsed.buyerSchemeId || '0208'}:${parsed.buyerEndpointId}`;
    const peppolSendCredits = await resolveCreditCost(supabase, 'PEPPOL_SEND_INVOICE');
    const creditDescription = `Peppol send external invoice ${createdInvoice.invoice_number}`;
    const refundDescription = `Refund ${creditDescription}`;

    const creditDeduction = await consumeCredits(supabase, user.id, peppolSendCredits, creditDescription);
    let refunded = false;

    try {
      await supabase.from('invoices').update({ peppol_status: 'pending' }).eq('id', createdInvoice.id);

      const scradaBaseUrl = Deno.env.get('SCRADA_API_URL') || 'https://api.scrada.be/v1';
      const scradaUrl = `${scradaBaseUrl}/company/${company.scrada_company_id}/peppolOutbound/sendSalesInvoice`;

      const scradaResponse = await fetch(scradaUrl, {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
          'X-PASSWORD': password,
          'Content-Type': 'application/xml',
          Language: 'FR',
        },
        body: ublXml,
      });

      if (!scradaResponse.ok) {
        const errText = await scradaResponse.text();
        await refundCredits(supabase, user.id, creditDeduction, refundDescription);
        refunded = true;

        await supabase.from('peppol_transmission_log').insert({
          user_id: user.id,
          company_id: companyId,
          invoice_id: createdInvoice.id,
          direction: 'outbound',
          status: 'error',
          ap_provider: 'scrada',
          sender_endpoint: senderEndpoint,
          receiver_endpoint: receiverEndpoint,
          error_message: errText,
          metadata: {
            source_origin: sourceOrigin,
            source_label: sourceLabel,
            imported_external: true,
          },
        });

        await supabase
          .from('invoices')
          .update({ peppol_status: 'error', peppol_error_message: errText })
          .eq('id', createdInvoice.id);

        return new Response(
          JSON.stringify({
            error: 'Scrada rejected the document',
            details: errText,
            invoice_id: createdInvoice.id,
            invoice_number: createdInvoice.invoice_number,
          }),
          {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const scradaData = await scradaResponse.json().catch(() => null);
      const documentId =
        typeof scradaData === 'string'
          ? scradaData
          : toText(scradaData?.id) || toText(scradaData?.guid) || toText(scradaData?.documentId);

      await supabase.from('peppol_transmission_log').insert({
        user_id: user.id,
        company_id: companyId,
        invoice_id: createdInvoice.id,
        direction: 'outbound',
        status: 'sent',
        ap_provider: 'scrada',
        ap_document_id: documentId || null,
        sender_endpoint: senderEndpoint,
        receiver_endpoint: receiverEndpoint,
        metadata: {
          source_origin: sourceOrigin,
          source_label: sourceLabel,
          imported_external: true,
        },
      });

      await supabase
        .from('invoices')
        .update({
          peppol_status: 'pending',
          peppol_sent_at: new Date().toISOString(),
          peppol_document_id: documentId || null,
          peppol_error_message: null,
        })
        .eq('id', createdInvoice.id);

      return new Response(
        JSON.stringify({
          success: true,
          invoice_id: createdInvoice.id,
          invoice_number: createdInvoice.invoice_number,
          documentId,
          status: 'pending',
          receiver: receiverEndpoint,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } catch (error) {
      if (!refunded) {
        await refundCredits(supabase, user.id, creditDeduction, refundDescription);
      }
      throw error;
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: error instanceof HttpError ? error.status : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
