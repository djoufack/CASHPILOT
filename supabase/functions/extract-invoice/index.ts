// Supabase Edge Function: extract-invoice
// Extracts structured data from supplier invoices using Google Gemini API

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { consumeCredits, createServiceClient, HttpError, refundCredits, requireAuthenticatedUser } from '../_shared/billing.ts';
import { checkRateLimit, rateLimitResponse } from '../_shared/rateLimiter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
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

  const supabase = createServiceClient();
  let resolvedUserId = '';
  let creditConsumption = null;

  try {
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const authUser = await requireAuthenticatedUser(req);

    const { filePath, fileType, userId } = await req.json();
    resolvedUserId = authUser.id;

    // Ensure the authenticated user matches the requested userId
    if (userId && userId !== resolvedUserId) {
      return new Response(
        JSON.stringify({ error: 'User ID mismatch with authenticated user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting: 10 extractions per 15 minutes per user
    const rateLimit = checkRateLimit(resolvedUserId, {
      maxRequests: 10,
      windowMs: 15 * 60 * 1000,
      keyPrefix: 'extract-invoice',
    });

    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit, corsHeaders);
    }

    if (!filePath || !fileType) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: filePath, fileType' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate file type against allowed MIME types
    const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!ALLOWED_MIME_TYPES.includes(fileType)) {
      return new Response(
        JSON.stringify({ error: 'Unsupported file type' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate file path belongs to authenticated user (prevent IDOR)
    if (!filePath.startsWith(resolvedUserId + '/')) {
      return new Response(
        JSON.stringify({ error: 'Invalid file path' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    creditConsumption = await consumeCredits(supabase, resolvedUserId, CREDIT_COST, 'AI Invoice Extraction');

    // 3. Download file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('supplier-invoices')
      .download(filePath);

    if (downloadError || !fileData) {
      throw new HttpError(404, 'File not found in storage');
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
      // Log the full error server-side, but do not expose to client
      console.error('Gemini API error:', geminiResponse.status, await geminiResponse.text());
      throw new HttpError(502, 'Extraction service temporarily unavailable');
    }

    const geminiResult = await geminiResponse.json();

    // 6. Parse the extraction result
    let extractedData;
    try {
      const textContent = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textContent) throw new Error('No content in Gemini response');
      extractedData = JSON.parse(textContent);
    } catch (parseError) {
      throw new HttpError(422, 'extraction_failed');
    }

    // 7. Return extracted data
    return new Response(
      JSON.stringify({ success: true, data: extractedData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    if (creditConsumption && resolvedUserId) {
      try {
        await refundCredits(supabase, resolvedUserId, creditConsumption, 'AI Invoice Extraction - error');
      } catch {
        // Ignore refund failures in error handling.
      }
    }

    console.error('Extract invoice error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: error instanceof HttpError ? error.status : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
