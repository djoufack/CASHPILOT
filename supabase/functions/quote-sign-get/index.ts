import { createServiceClient } from '../_shared/billing.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = req.method === 'GET'
      ? { token: new URL(req.url).searchParams.get('token') }
      : await req.json();
    const token = String(payload?.token || '').trim();

    if (!token) {
      return jsonResponse({ error: 'token required' }, 400);
    }

    const supabase = createServiceClient();
    const { data: quote, error } = await supabase
      .from('quotes')
      .select('id, quote_number, total_ht, total_ttc, tax_rate, notes, signature_status, signature_token_expires_at, clients(company_name, contact_name, email)')
      .eq('signature_token', token)
      .eq('signature_status', 'pending')
      .gt('signature_token_expires_at', new Date().toISOString())
      .maybeSingle();

    if (error) throw error;
    if (!quote) {
      return jsonResponse({ error: 'Invalid or expired signature link' }, 404);
    }

    const totalHt = Number(quote.total_ht || 0);
    const totalTtc = Number(quote.total_ttc || 0);
    const taxAmount = Number((totalTtc - totalHt).toFixed(2));

    return jsonResponse({
      quote: {
        id: quote.id,
        quote_number: quote.quote_number,
        total_ht: quote.total_ht,
        total_ttc: quote.total_ttc,
        tax_rate: quote.tax_rate,
        tax_amount: taxAmount,
        notes: quote.notes,
        currency: 'EUR',
        clients: quote.clients,
      },
    });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
