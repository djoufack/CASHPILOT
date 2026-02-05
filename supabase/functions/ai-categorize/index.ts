import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CATEGORIES = [
  'Fournitures de bureau', 'Logiciels & SaaS', 'Déplacements', 'Restauration',
  'Marketing & Publicité', 'Loyer & Charges', 'Assurances', 'Honoraires',
  'Télécommunications', 'Formation', 'Matériel informatique', 'Frais bancaires',
  'Véhicule', 'Entretien & Réparations', 'Divers'
];

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) throw new Error('GEMINI_API_KEY not configured');

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { userId, expenses } = await req.json();

    if (!userId || !expenses?.length) {
      return new Response(JSON.stringify({ error: 'Missing userId or expenses' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

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

    return new Response(JSON.stringify({ success: true, categories }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
