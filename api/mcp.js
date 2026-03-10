// Vercel Serverless Function – MCP proxy
// Forwards requests to Supabase Edge Function with the required Authorization header.
// This endpoint enforces header-only API key authentication (no query secret transport).

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://rfzvrezrcigzmldgvntz.supabase.co';
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const APP_ORIGIN = process.env.APP_ORIGIN || 'https://cashpilot.tech';

  if (!SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: missing SUPABASE_ANON_KEY' });
  }

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', APP_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id, x-api-key, authorization');
    res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id');
    return res.status(204).end();
  }

  const incoming = new URL(req.url, `https://${req.headers.host}`);

  if (incoming.searchParams.has('api_key')) {
    return res.status(400).json({
      error: 'Query parameter api_key is forbidden. Use X-API-Key header only.',
    });
  }

  if (!req.headers['x-api-key']) {
    return res.status(401).json({ error: 'Missing X-API-Key header.' });
  }

  // Build target URL and preserve only non-secret query params.
  const target = new URL(`${SUPABASE_URL}/functions/v1/mcp`);
  if (incoming.searchParams.has('tools')) {
    target.searchParams.set('tools', incoming.searchParams.get('tools'));
  }

  // Forward headers, inject Authorization for Supabase gateway.
  const forwardHeaders = {
    'Content-Type': req.headers['content-type'] || 'application/json',
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    apikey: SUPABASE_ANON_KEY,
    'x-api-key': req.headers['x-api-key'],
  };

  // Pass through session header for MCP long-running sessions.
  if (req.headers['mcp-session-id']) {
    forwardHeaders['mcp-session-id'] = req.headers['mcp-session-id'];
  }

  try {
    const fetchOpts = {
      method: req.method,
      headers: forwardHeaders,
    };

    // Forward body for POST requests.
    if (req.method === 'POST') {
      fetchOpts.body = JSON.stringify(req.body);
    }

    const upstream = await fetch(target.toString(), fetchOpts);

    // Forward response headers.
    res.setHeader('Access-Control-Allow-Origin', APP_ORIGIN);
    res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id');
    const sessionId = upstream.headers.get('mcp-session-id');
    if (sessionId) res.setHeader('mcp-session-id', sessionId);

    const body = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    return res.send(body);
  } catch (err) {
    return res.status(502).json({ error: 'Upstream MCP server unreachable', detail: err.message });
  }
}
