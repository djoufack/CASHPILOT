import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Authenticate via API key
    const apiKey = req.headers.get('X-API-Key');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing X-API-Key header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Hash the key for lookup (simple hash for demo)
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const keyHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

    const { data: keyData, error: keyError } = await supabase
      .from('api_keys')
      .select('*')
      .eq('key_hash', keyHash)
      .eq('is_active', true)
      .single();

    if (keyError || !keyData) {
      return new Response(JSON.stringify({ error: 'Invalid API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Check expiration
    if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'API key expired' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Update last used
    await supabase.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', keyData.id);

    const userId = keyData.user_id;
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/api-v1\/?/, '').replace(/^functions\/v1\/api-v1\/?/, '');
    const method = req.method;

    // Route handling
    const segments = path.split('/').filter(Boolean);
    const resource = segments[0];
    const resourceId = segments[1];

    const ALLOWED_RESOURCES = ['invoices', 'clients', 'quotes', 'expenses', 'products', 'projects'];

    if (!resource || !ALLOWED_RESOURCES.includes(resource)) {
      return new Response(JSON.stringify({
        error: 'Not found',
        available_resources: ALLOWED_RESOURCES,
        usage: 'GET /api-v1/{resource} or GET /api-v1/{resource}/{id}',
      }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Check scopes
    const needsWrite = ['POST', 'PUT', 'PATCH'].includes(method);
    const needsDelete = method === 'DELETE';
    if (needsWrite && !keyData.scopes.includes('write')) {
      return new Response(JSON.stringify({ error: 'Insufficient scope: write required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (needsDelete && !keyData.scopes.includes('delete')) {
      return new Response(JSON.stringify({ error: 'Insufficient scope: delete required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Handle CRUD
    switch (method) {
      case 'GET': {
        if (resourceId) {
          const { data, error } = await supabase.from(resource).select('*').eq('user_id', userId).eq('id', resourceId).single();
          if (error) return new Response(JSON.stringify({ error: 'Not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          return new Response(JSON.stringify({ data }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
        const from = (page - 1) * limit;

        const { data, error, count } = await supabase
          .from(resource)
          .select('*', { count: 'exact' })
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .range(from, from + limit - 1);

        return new Response(JSON.stringify({ data, meta: { page, limit, total: count } }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'POST': {
        const body = await req.json();
        const { data, error } = await supabase.from(resource).insert({ ...body, user_id: userId }).select().single();
        if (error) return new Response(JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        return new Response(JSON.stringify({ data }),
          { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'PUT':
      case 'PATCH': {
        if (!resourceId) return new Response(JSON.stringify({ error: 'Resource ID required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        const body = await req.json();
        const { data, error } = await supabase.from(resource).update(body).eq('id', resourceId).eq('user_id', userId).select().single();
        if (error) return new Response(JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        return new Response(JSON.stringify({ data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'DELETE': {
        if (!resourceId) return new Response(JSON.stringify({ error: 'Resource ID required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        const { error } = await supabase.from(resource).delete().eq('id', resourceId).eq('user_id', userId);
        if (error) return new Response(JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        return new Response(JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      default:
        return new Response(JSON.stringify({ error: 'Method not allowed' }),
          { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
