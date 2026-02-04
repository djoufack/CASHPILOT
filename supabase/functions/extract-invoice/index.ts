// Supabase Edge Function: extract-invoice
// Extracts structured data from supplier invoices using Google Gemini API

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXTRACTION_PROMPT = `You are an expert invoice data extraction system. Analyze this supplier invoice document and extract all structured data.

Return a JSON object with the following fields:
- invoice_number: The invoice number/reference (string)
- invoice_date: Date in YYYY-MM-DD format (string)
- due_date: Payment due date in YYYY-MM-DD format (string or null)
- supplier_name: Name of the supplier/vendor company (string)
- supplier_address: Full address of the supplier (string or null)
- supplier_vat_number: VAT/Tax ID of the supplier (string or null)
- total_ht: Total amount before tax (excluding VAT), as a number
- total_tva: Total VAT/tax amount, as a number
- total_ttc: Total amount including tax, as a number
- tva_rate: VAT rate as a percentage number (e.g., 21 for 21%)
- currency: Currency code (EUR, USD, GBP, etc.)
- line_items: Array of objects with {description, quantity, unit_price, total}
- payment_terms: Payment terms text (string or null)
- iban: Bank IBAN if present (string or null)
- bic: Bank BIC/SWIFT if present (string or null)
- confidence: Your confidence level from 0 to 1 for the overall extraction

If a field cannot be determined, set it to null. For amounts, always return numbers (not strings).`;

const CREDIT_COST = 3;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { filePath, fileType, userId } = await req.json();

    if (!filePath || !fileType || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: filePath, fileType, userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Check user credits
    const { data: creditsData, error: creditsError } = await supabase
      .from('user_credits')
      .select('balance')
      .eq('user_id', userId)
      .single();

    if (creditsError || !creditsData) {
      return new Response(
        JSON.stringify({ error: 'Could not verify credits' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (creditsData.balance < CREDIT_COST) {
      return new Response(
        JSON.stringify({ error: 'insufficient_credits', available: creditsData.balance, required: CREDIT_COST }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Deduct credits before calling Gemini
    const { error: deductError } = await supabase
      .from('user_credits')
      .update({ balance: creditsData.balance - CREDIT_COST })
      .eq('user_id', userId);

    if (deductError) {
      return new Response(
        JSON.stringify({ error: 'Failed to deduct credits' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await supabase.from('credit_transactions').insert([{
      user_id: userId,
      amount: -CREDIT_COST,
      type: 'usage',
      description: 'AI Invoice Extraction',
    }]);

    // 3. Download file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('supplier-invoices')
      .download(filePath);

    if (downloadError || !fileData) {
      // Refund credits on file download failure
      await supabase.from('user_credits').update({ balance: creditsData.balance }).eq('user_id', userId);
      await supabase.from('credit_transactions').insert([{
        user_id: userId, amount: CREDIT_COST, type: 'refund', description: 'AI Invoice Extraction - file not found',
      }]);
      return new Response(
        JSON.stringify({ error: 'File not found in storage' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Convert to base64
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64Data = btoa(binary);

    // 5. Call Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;

    const geminiBody = {
      contents: [{
        parts: [
          {
            inlineData: {
              mimeType: fileType,
              data: base64Data,
            },
          },
          {
            text: EXTRACTION_PROMPT,
          },
        ],
      }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    };

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });

    if (!geminiResponse.ok) {
      // Refund credits on Gemini API failure
      await supabase.from('user_credits').update({ balance: creditsData.balance }).eq('user_id', userId);
      await supabase.from('credit_transactions').insert([{
        user_id: userId, amount: CREDIT_COST, type: 'refund', description: 'AI Invoice Extraction - API error',
      }]);
      return new Response(
        JSON.stringify({ error: 'Gemini API error', details: await geminiResponse.text() }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geminiResult = await geminiResponse.json();

    // 6. Parse the extraction result
    let extractedData;
    try {
      const textContent = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textContent) throw new Error('No content in Gemini response');
      extractedData = JSON.parse(textContent);
    } catch (parseError) {
      // Refund credits on parse failure
      await supabase.from('user_credits').update({ balance: creditsData.balance }).eq('user_id', userId);
      await supabase.from('credit_transactions').insert([{
        user_id: userId, amount: CREDIT_COST, type: 'refund', description: 'AI Invoice Extraction - parse error',
      }]);
      return new Response(
        JSON.stringify({ error: 'extraction_failed', message: 'Could not parse extracted data' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. Return extracted data
    return new Response(
      JSON.stringify({ success: true, data: extractedData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Extract invoice error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
