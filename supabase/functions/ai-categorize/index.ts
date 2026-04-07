import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import {
  consumeCredits,
  createServiceClient,
  HttpError,
  refundCredits,
  requireAuthenticatedUser,
  resolveCreditCost,
} from '../_shared/billing.ts';

import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  ...SECURITY_HEADERS,
};

const CATEGORIZE_OPERATION_CODE = 'AI_CATEGORIZE';

const CATEGORIES = [
  'Fournitures de bureau',
  'Logiciels & SaaS',
  'Déplacements',
  'Restauration',
  'Marketing & Publicité',
  'Loyer & Charges',
  'Assurances',
  'Honoraires',
  'Télécommunications',
  'Formation',
  'Matériel informatique',
  'Frais bancaires',
  'Véhicule',
  'Entretien & Réparations',
  'Divers',
];

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
    const { expenses } = await req.json();

    if (!expenses?.length) {
      return new Response(JSON.stringify({ error: 'Missing expenses' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const creditCost = await resolveCreditCost(supabase as any, CATEGORIZE_OPERATION_CODE);
    creditConsumption = await consumeCredits(supabase as any, resolvedUserId, creditCost, 'AI Categorize');

    const prompt = `Catégorise ces dépenses dans une des catégories suivantes: ${CATEGORIES.join(', ')}.

Dépenses:
${expenses.map((e: any, i: number) => `${i + 1}. "${e.description}" - ${e.amount}€`).join('\n')}

Retourne un JSON array avec pour chaque dépense: { "index": number, "category": "string", "confidence": number_0_to_1 }`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
    const res = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
      }),
    });

    if (!res.ok) throw new Error('Gemini API error');
    const result = await res.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    const categories = JSON.parse(text || '[]');

    return new Response(JSON.stringify({ success: true, categories }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (creditConsumption && resolvedUserId) {
      try {
        await refundCredits(supabase as any, resolvedUserId, creditConsumption, 'AI Categorize - error');
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
