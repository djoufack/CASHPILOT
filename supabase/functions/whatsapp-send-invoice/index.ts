// Supabase Edge Function: whatsapp-send-invoice
// Sends invoice details via WhatsApp Business API
// Includes a Mobile Money payment link
// Currently in simulation mode

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  ...SECURITY_HEADERS,
};

function generatePaymentToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let token = '';
  for (let i = 0; i < 24; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Authentication failed' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { invoice_id, phone_number, template, company_id, message_type = 'invoice' } = body;

    if (!invoice_id || !phone_number || !company_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields: invoice_id, phone_number, company_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch invoice with client info
    const { data: invoice, error: invoiceErr } = await supabase
      .from('invoices')
      .select(
        'id, invoice_number, total_ttc, due_date, status, currency, client:clients(id, company_name, contact_name)'
      )
      .eq('id', invoice_id)
      .eq('user_id', user.id)
      .single();

    if (invoiceErr || !invoice) {
      return new Response(JSON.stringify({ error: 'Invoice not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get available mobile money providers for this company
    const { data: providers } = await supabase
      .from('mobile_money_providers')
      .select('provider_name')
      .eq('user_id', user.id)
      .eq('company_id', company_id)
      .eq('is_active', true);

    const providerNames = (providers ?? []).map((p: { provider_name: string }) => p.provider_name);

    // Create a payment link
    const token = generatePaymentToken();
    const appOrigin = Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech';
    const paymentUrl = `${appOrigin}/pay/${token}`;

    await supabase.from('mobile_payment_links').insert({
      user_id: user.id,
      company_id,
      invoice_id,
      token,
      providers_available: providerNames,
      amount: invoice.total_ttc,
      currency: invoice.currency ?? 'XAF',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    });

    // Build WhatsApp message content
    const clientName = invoice.client?.company_name ?? invoice.client?.contact_name ?? 'Client';
    const content = buildMessageContent(message_type, {
      clientName,
      invoiceNumber: invoice.invoice_number,
      amount: invoice.total_ttc,
      currency: invoice.currency ?? 'XAF',
      dueDate: invoice.due_date,
      paymentUrl,
    });

    // Simulate WhatsApp send
    const externalId = `wa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Record the message
    const { data: message, error: msgErr } = await supabase
      .from('whatsapp_messages')
      .insert({
        user_id: user.id,
        company_id,
        invoice_id,
        client_id: invoice.client?.id ?? null,
        phone_number,
        message_type,
        template_name: template ?? null,
        content,
        status: 'sent', // simulation
        external_id: externalId,
        sent_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (msgErr) {
      return new Response(JSON.stringify({ error: 'Failed to record message', details: msgErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        message_id: message.id,
        status: 'sent',
        external_id: externalId,
        payment_link: paymentUrl,
        content,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal server error', details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

interface MessageData {
  clientName: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  dueDate: string;
  paymentUrl: string;
}

function buildMessageContent(type: string, data: MessageData): string {
  const formattedAmount = `${data.amount?.toLocaleString('fr-FR') ?? '0'} ${data.currency}`;

  switch (type) {
    case 'reminder':
      return [
        `Bonjour ${data.clientName},`,
        '',
        `Nous vous rappelons que la facture ${data.invoiceNumber} d'un montant de ${formattedAmount} est en attente de paiement.`,
        `Date d'echeance : ${data.dueDate}`,
        '',
        `Payez facilement par Mobile Money :`,
        data.paymentUrl,
        '',
        'Merci de votre confiance.',
      ].join('\n');

    case 'payment_confirmation':
      return [
        `Bonjour ${data.clientName},`,
        '',
        `Nous confirmons la reception de votre paiement de ${formattedAmount} pour la facture ${data.invoiceNumber}.`,
        '',
        'Merci !',
      ].join('\n');

    case 'invoice':
    default:
      return [
        `Bonjour ${data.clientName},`,
        '',
        `Veuillez trouver ci-dessous les details de votre facture :`,
        `- Numero : ${data.invoiceNumber}`,
        `- Montant : ${formattedAmount}`,
        `- Echeance : ${data.dueDate}`,
        '',
        `Payez facilement par Mobile Money :`,
        data.paymentUrl,
        '',
        'Merci de votre confiance.',
      ].join('\n');
  }
}
