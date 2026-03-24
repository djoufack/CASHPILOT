import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';
import { getAllowedOrigin } from '../_shared/cors.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const buildCorsHeaders = (req: Request) => ({
  'Access-Control-Allow-Origin': getAllowedOrigin(req),
  'Access-Control-Allow-Headers': 'authorization, x-api-key, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  ...SECURITY_HEADERS,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function jsonResponse(
  body: unknown,
  statusOrCors: number | Record<string, string> = 200,
  maybeStatus?: number
): Response {
  const hasCorsHeaders = typeof statusOrCors === 'object' && statusOrCors !== null;
  const corsHeaders = hasCorsHeaders ? (statusOrCors as Record<string, string>) : {};
  const status = hasCorsHeaders ? (maybeStatus ?? 200) : (statusOrCors as number);

  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function createServiceClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Server misconfigured');
  return createClient(url, key);
}

// ---------------------------------------------------------------------------
// Rate limiter — in-memory sliding window (per Deno isolate)
// ---------------------------------------------------------------------------
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function consumeRateLimit(apiKeyId: string, limit: number): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const windowMs = 60_000; // 1 minute window
  let bucket = rateBuckets.get(apiKeyId);

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    rateBuckets.set(apiKeyId, bucket);
  }

  bucket.count++;

  return {
    allowed: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
  };
}

function getRateLimitState(apiKeyId: string, limit: number): { remaining: number; resetAt: number } {
  const now = Date.now();
  const windowMs = 60_000;
  let bucket = rateBuckets.get(apiKeyId);

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    rateBuckets.set(apiKeyId, bucket);
  }

  return {
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
  };
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ---------------------------------------------------------------------------
// API key validation
// ---------------------------------------------------------------------------
interface ApiKeyRecord {
  id: string;
  user_id: string;
  company_id: string;
  scopes: string[];
  rate_limit: number;
  is_active: boolean;
  expires_at: string | null;
}

async function validateApiKey(supabase: ReturnType<typeof createClient>, rawKey: string): Promise<ApiKeyRecord> {
  const keyHash = await sha256Hex(rawKey);

  const { data, error } = await supabase
    .from('api_keys')
    .select('id, user_id, company_id, scopes, rate_limit, is_active, expires_at')
    .eq('key_hash', keyHash)
    .maybeSingle();

  if (error) {
    throw { status: 401, message: 'Invalid API key' };
  }

  let resolved = data as (ApiKeyRecord & { superseded_at?: string | null; grace_period_days?: number | null }) | null;

  if (!resolved) {
    const { data: supersededKey, error: supersededError } = await supabase
      .from('api_keys')
      .select('id, user_id, company_id, scopes, rate_limit, is_active, expires_at, superseded_at, grace_period_days')
      .eq('key_hash', keyHash)
      .not('superseded_at', 'is', null)
      .maybeSingle();

    if (supersededError || !supersededKey) {
      throw { status: 401, message: 'Invalid API key' };
    }

    const graceDays = supersededKey.grace_period_days ?? 7;
    const supersededAt = new Date(String(supersededKey.superseded_at));
    const graceEnd = new Date(supersededAt.getTime() + graceDays * 86_400_000);
    if (new Date() > graceEnd) {
      throw { status: 401, message: 'API key has been rotated and grace period expired' };
    }

    resolved = supersededKey;
  }

  if (!resolved.is_active) {
    throw { status: 403, message: 'API key is deactivated' };
  }

  if (resolved.expires_at && new Date(resolved.expires_at) < new Date()) {
    throw { status: 403, message: 'API key has expired' };
  }

  return resolved as ApiKeyRecord;
}

// ---------------------------------------------------------------------------
// Scope validation
// ---------------------------------------------------------------------------
function requireScope(scopes: string[], required: string): void {
  // 'admin' scope grants everything
  if (scopes.includes('admin')) return;
  // 'write' scope includes 'read'
  if (required === 'read' && scopes.includes('write')) return;
  if (!scopes.includes(required)) {
    throw { status: 403, message: `Insufficient scope. Required: ${required}` };
  }
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------
async function handleInvoices(
  supabase: ReturnType<typeof createClient>,
  apiKey: ApiKeyRecord,
  _method: string,
  _url: URL
): Promise<Response> {
  requireScope(apiKey.scopes, 'read');

  const { data, error } = await supabase
    .from('invoices')
    .select('id, invoice_number, status, total_ttc, total_ht, client_id, due_date, created_at')
    .eq('company_id', apiKey.company_id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return jsonResponse({ error: error.message }, 500);
  return jsonResponse({ data, count: data?.length ?? 0 });
}

async function handleClients(
  supabase: ReturnType<typeof createClient>,
  apiKey: ApiKeyRecord,
  _method: string,
  _url: URL
): Promise<Response> {
  requireScope(apiKey.scopes, 'read');

  const { data, error } = await supabase
    .from('clients')
    .select('id, company_name, email, phone, city, country, created_at')
    .eq('company_id', apiKey.company_id)
    .order('company_name')
    .limit(100);

  if (error) return jsonResponse({ error: error.message }, 500);
  return jsonResponse({ data, count: data?.length ?? 0 });
}

async function handleExpenses(
  supabase: ReturnType<typeof createClient>,
  apiKey: ApiKeyRecord,
  _method: string,
  _url: URL
): Promise<Response> {
  requireScope(apiKey.scopes, 'read');

  const { data, error } = await supabase
    .from('expenses')
    .select('id, description, amount, category, expense_date, created_at')
    .eq('company_id', apiKey.company_id)
    .order('expense_date', { ascending: false })
    .limit(50);

  if (error) return jsonResponse({ error: error.message }, 500);
  return jsonResponse({ data, count: data?.length ?? 0 });
}

async function handlePayments(
  supabase: ReturnType<typeof createClient>,
  apiKey: ApiKeyRecord,
  _method: string,
  _url: URL
): Promise<Response> {
  requireScope(apiKey.scopes, 'read');

  const { data, error } = await supabase
    .from('payments')
    .select('id, amount, payment_date, payment_method, invoice_id, created_at')
    .eq('company_id', apiKey.company_id)
    .order('payment_date', { ascending: false })
    .limit(50);

  if (error) return jsonResponse({ error: error.message }, 500);
  return jsonResponse({ data, count: data?.length ?? 0 });
}

async function handleProducts(
  supabase: ReturnType<typeof createClient>,
  apiKey: ApiKeyRecord,
  _method: string,
  _url: URL
): Promise<Response> {
  requireScope(apiKey.scopes, 'read');

  const { data, error } = await supabase
    .from('products')
    .select('id, name, reference, unit_price, tax_rate, stock_quantity, created_at')
    .eq('company_id', apiKey.company_id)
    .order('name')
    .limit(100);

  if (error) return jsonResponse({ error: error.message }, 500);
  return jsonResponse({ data, count: data?.length ?? 0 });
}

// ---------------------------------------------------------------------------
// Route map
// ---------------------------------------------------------------------------
type RouteHandler = (
  supabase: ReturnType<typeof createClient>,
  apiKey: ApiKeyRecord,
  method: string,
  url: URL
) => Promise<Response>;

const routes: Record<string, RouteHandler> = {
  '/invoices': handleInvoices,
  '/clients': handleClients,
  '/expenses': handleExpenses,
  '/payments': handlePayments,
  '/products': handleProducts,
};

// ---------------------------------------------------------------------------
// Log usage
// ---------------------------------------------------------------------------
async function logUsage(
  supabase: ReturnType<typeof createClient>,
  apiKeyId: string,
  endpoint: string,
  method: string,
  statusCode: number,
  responseTimeMs: number,
  ipAddress: string | null
): Promise<void> {
  try {
    await supabase.from('api_usage_logs').insert({
      api_key_id: apiKeyId,
      endpoint,
      method,
      status_code: statusCode,
      response_time_ms: responseTimeMs,
      ip_address: ipAddress,
    });

    // Update last_used_at on the API key
    await supabase.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', apiKeyId);
  } catch {
    // Non-critical — don't fail the request
  }
}

// ---------------------------------------------------------------------------
// Main serve handler
// ---------------------------------------------------------------------------
serve(async (req: Request) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  const url = new URL(req.url);
  const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || null;

  // Extract API key from header
  const rawKey =
    req.headers.get('x-api-key') ||
    req.headers
      .get('authorization')
      ?.replace(/^Bearer\s+/i, '')
      .trim() ||
    null;

  if (!rawKey) {
    return jsonResponse(
      { error: 'Missing API key. Provide via x-api-key header or Authorization: Bearer <key>' },
      corsHeaders,
      401
    );
  }

  const supabase = createServiceClient();
  let apiKeyRecord: ApiKeyRecord | null = null;

  try {
    // Validate key
    apiKeyRecord = await validateApiKey(supabase, rawKey);

    // Rate limit check
    const rateResult = consumeRateLimit(apiKeyRecord.id, apiKeyRecord.rate_limit);
    if (!rateResult.allowed) {
      const elapsed = Date.now() - startTime;
      await logUsage(supabase, apiKeyRecord.id, url.pathname, req.method, 429, elapsed, ipAddress);
      return jsonResponse(
        { error: 'Rate limit exceeded', retry_after_ms: rateResult.resetAt - Date.now() },
        corsHeaders,
        429
      );
    }

    // Parse path — strip the function prefix (/api-gateway)
    // Supabase edge functions receive the full path: /api-gateway/invoices
    const pathSegments = url.pathname.split('/').filter(Boolean);
    // Remove the function name prefix
    const apiPath = '/' + pathSegments.slice(1).join('/');

    // Root path — show available endpoints
    if (apiPath === '/' || apiPath === '') {
      const elapsed = Date.now() - startTime;
      await logUsage(supabase, apiKeyRecord.id, '/', req.method, 200, elapsed, ipAddress);
      return jsonResponse(
        {
          message: 'CashPilot Public API v1',
          endpoints: Object.keys(routes),
          scopes: apiKeyRecord.scopes,
          rate_limit: apiKeyRecord.rate_limit,
          rate_remaining: rateResult.remaining,
        },
        corsHeaders
      );
    }

    // Find handler
    const handler = routes[apiPath];
    if (!handler) {
      const elapsed = Date.now() - startTime;
      await logUsage(supabase, apiKeyRecord.id, apiPath, req.method, 404, elapsed, ipAddress);
      return jsonResponse({ error: `Unknown endpoint: ${apiPath}`, available: Object.keys(routes) }, corsHeaders, 404);
    }

    // Execute handler
    const response = await handler(supabase, apiKeyRecord, req.method, url);
    const elapsed = Date.now() - startTime;

    // Log usage asynchronously
    await logUsage(supabase, apiKeyRecord.id, apiPath, req.method, response.status, elapsed, ipAddress);

    // Add rate limit headers to response
    const rateInfo = getRateLimitState(apiKeyRecord.id, apiKeyRecord.rate_limit);
    response.headers.set('X-RateLimit-Limit', String(apiKeyRecord.rate_limit));
    response.headers.set('X-RateLimit-Remaining', String(rateInfo.remaining));
    response.headers.set('X-RateLimit-Reset', String(rateInfo.resetAt));
    response.headers.set('X-Response-Time', `${elapsed}ms`);

    return response;
  } catch (err: unknown) {
    const elapsed = Date.now() - startTime;
    const status = (err as { status?: number })?.status || 500;
    const message = (err as { message?: string })?.message || 'Internal server error';

    if (apiKeyRecord) {
      await logUsage(supabase, apiKeyRecord.id, url.pathname, req.method, status, elapsed, ipAddress);
    }

    return jsonResponse({ error: message }, corsHeaders, status);
  }
});
