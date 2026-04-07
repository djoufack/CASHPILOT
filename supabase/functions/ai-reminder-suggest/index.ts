import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import {
  consumeCredits,
  createServiceClient,
  HttpError,
  refundCredits,
  requireAuthenticatedUser,
  resolveCreditCost,
} from '../_shared/billing.ts';

import { checkRateLimit, rateLimitResponse } from '../_shared/rateLimiter.ts';
import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  ...SECURITY_HEADERS,
};

const REMINDER_OPERATION_CODE = 'AI_REMINDER_SUGGEST';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createServiceClient();
  let resolvedUserId = '';
  let creditConsumption = null;

  try {
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) throw new Error('GEMINI_API_KEY not configured');

    const authUser = await requireAuthenticatedUser(req);
    resolvedUserId = authUser.id;

    const rateLimit = checkRateLimit(resolvedUserId, { maxRequests: 10, windowMs: 60_000, keyPrefix: 'ai-reminder' });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit, corsHeaders);

    const { data: unpaidInvoices } = await supabase
      .from('invoices')
      .select('id, invoice_number, total_ttc, due_date, status, client:clients(company_name, email)')
      .eq('user_id', resolvedUserId)
      .in('status', ['sent', 'overdue'])
      .order('due_date', { ascending: true });

    if (!unpaidInvoices?.length) {
      return new Response(JSON.stringify({ success: true, suggestions: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const creditCost = await resolveCreditCost(supabase as any, REMINDER_OPERATION_CODE);
    creditConsumption = await consumeCredits(supabase as any, resolvedUserId, creditCost, 'AI Reminder Suggest');

    const prompt = `Pour chaque facture impayée, suggère une stratégie de relance adaptée:

${unpaidInvoices.map((i) => `- ${i.invoice_number}: ${i.total_ttc}€, échéance ${i.due_date}, client: ${(i.client as any)?.company_name || (i.client as any)?.email || 'Client'}`).join('\n')}

Retourne un JSON array: [{ "invoice_id": "string", "urgency": "low|medium|high", "suggested_action": "string", "message_tone": "friendly|firm|urgent", "suggested_message": "string" }]`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
    const res = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
      }),
    });

    if (!res.ok) throw new Error('Gemini API error');
    const suggestions = JSON.parse((await res.json()).candidates?.[0]?.content?.parts?.[0]?.text || '[]');

    return new Response(JSON.stringify({ success: true, suggestions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (creditConsumption && resolvedUserId) {
      try {
        await refundCredits(supabase as any, resolvedUserId, creditConsumption, 'AI Reminder Suggest - error');
      } catch {
        // Ignore refund failures in error handling.
      }
    }

    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
