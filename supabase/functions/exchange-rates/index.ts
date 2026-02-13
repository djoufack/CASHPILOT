import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// In-memory cache for exchange rates (per base currency)
const ratesCache: Record<string, { rates: Record<string, number>; date: string; fetchedAt: number }> = {};
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Supported currencies for filtering
const SUPPORTED_CURRENCIES = [
  'EUR', 'USD', 'GBP', 'CHF', 'CAD', 'MAD', 'XOF', 'XAF',
  'NOK', 'SEK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'BGN',
  'TRY', 'JPY', 'CNY', 'HKD', 'SGD', 'KRW', 'INR', 'AUD',
  'NZD', 'BRL', 'MXN', 'AED', 'SAR', 'ZAR', 'EGP', 'NGN',
  'KES', 'GHS', 'TND', 'DZD',
];

async function fetchRates(base: string): Promise<{ rates: Record<string, number>; date: string }> {
  const now = Date.now();
  const cached = ratesCache[base];

  if (cached && (now - cached.fetchedAt) < CACHE_TTL) {
    return { rates: cached.rates, date: cached.date };
  }

  // Try primary API: exchangerate-api.com (free tier)
  let data: { base: string; date: string; rates: Record<string, number> } | null = null;

  try {
    const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${base}`);
    if (response.ok) {
      data = await response.json();
    }
  } catch {
    // Primary API failed, try fallback
  }

  // Fallback: open.er-api.com
  if (!data) {
    try {
      const response = await fetch(`https://open.er-api.com/v6/latest/${base}`);
      if (response.ok) {
        const fallbackData = await response.json();
        data = { base: fallbackData.base_code, date: fallbackData.time_last_update_utc, rates: fallbackData.rates };
      }
    } catch {
      // Fallback also failed
    }
  }

  if (!data || !data.rates) {
    // Return cached data even if stale, or throw
    if (cached) {
      return { rates: cached.rates, date: cached.date };
    }
    throw new Error('Failed to fetch exchange rates from all providers');
  }

  // Cache the result
  ratesCache[base] = {
    rates: data.rates,
    date: data.date,
    fetchedAt: now,
  };

  return { rates: data.rates, date: data.date };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'rates';
    const base = url.searchParams.get('base') || 'EUR';

    if (action === 'convert') {
      // Convert endpoint: ?action=convert&amount=100&from=USD&to=EUR
      const amount = parseFloat(url.searchParams.get('amount') || '0');
      const from = url.searchParams.get('from') || 'EUR';
      const to = url.searchParams.get('to') || 'EUR';

      if (from === to) {
        return new Response(
          JSON.stringify({ success: true, from, to, amount, converted: amount, rate: 1 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch rates based on 'from' currency
      const { rates, date } = await fetchRates(from);
      const rate = rates[to];

      if (!rate) {
        return new Response(
          JSON.stringify({ error: `Unsupported currency pair: ${from} -> ${to}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const converted = Math.round(amount * rate * 100) / 100;

      return new Response(
        JSON.stringify({ success: true, from, to, amount, converted, rate, date }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default: return all rates for the base currency
    const { rates, date } = await fetchRates(base);

    // Filter to supported currencies only if requested
    const filterSupported = url.searchParams.get('supported') === 'true';
    const filteredRates = filterSupported
      ? Object.fromEntries(
          Object.entries(rates).filter(([code]) => SUPPORTED_CURRENCIES.includes(code))
        )
      : rates;

    return new Response(
      JSON.stringify({
        success: true,
        base,
        date,
        rates: filteredRates,
        cached: !!ratesCache[base] && (Date.now() - ratesCache[base].fetchedAt) < CACHE_TTL,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600',
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
