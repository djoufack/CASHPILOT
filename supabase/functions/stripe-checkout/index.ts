// Supabase Edge Function: stripe-checkout
// Creates a Stripe Checkout session for credit purchases

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';

const PRODUCTION_ORIGIN = 'https://cashpilot.tech';
const LOCAL_ORIGINS = new Set(['http://localhost:3000', 'http://localhost:5173']);

const isAllowedOrigin = (origin: string | null | undefined) => {
  if (!origin) return false;
  if (origin === PRODUCTION_ORIGIN || origin === 'https://www.cashpilot.tech') return true;
  if (LOCAL_ORIGINS.has(origin)) return true;

  try {
    const parsed = new URL(origin);
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('.vercel.app');
  } catch {
    return false;
  }
};

const resolveOrigin = (originHeader: string | null) =>
  isAllowedOrigin(originHeader) ? originHeader! : PRODUCTION_ORIGIN;

const buildCorsHeaders = (origin: string) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  ...SECURITY_HEADERS,
});

serve(async (req) => {
  const origin = resolveOrigin(req.headers.get('origin'));
  const corsHeaders = buildCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      error: 'Credit pack checkout is disabled. Stripe-only subscriptions are now the supported billing flow.',
      code: 'credit_checkout_disabled',
    }),
    {
      status: 410,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
});
