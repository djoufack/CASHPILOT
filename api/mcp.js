// Vercel Serverless Function – MCP proxy
// Forwards requests to Supabase Edge Function with the required Authorization header.
// This fixes the "Missing authorization header" error when ChatGPT (or any external
// MCP client) calls https://cashpilot.tech/mcp without the Supabase anon key.

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rfzvrezrcigzmldgvntz.supabase.co';
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  if (!SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: missing SUPABASE_ANON_KEY' });
  }

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id, x-api-key, authorization, apikey');
    res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id');
    return res.status(204).end();
  }

  // Build target URL, preserving query params (api_key, etc.)
  const incoming = new URL(req.url, `https://${req.headers.host}`);
  const target = new URL(`${SUPABASE_URL}/functions/v1/mcp`);
  incoming.searchParams.forEach((v, k) => target.searchParams.set(k, v));

  // Forward headers, inject Authorization for Supabase gateway
  const forwardHeaders = {
    'Content-Type': req.headers['content-type'] || 'application/json',
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'apikey': SUPABASE_ANON_KEY,
  };

  // Pass through relevant client headers
  if (req.headers['x-api-key']) forwardHeaders['x-api-key'] = req.headers['x-api-key'];
  if (req.headers['mcp-session-id']) forwardHeaders['mcp-session-id'] = req.headers['mcp-session-id'];

  try {
    const fetchOpts = {
      method: req.method,
      headers: forwardHeaders,
    };

    // Forward body for POST requests
    if (req.method === 'POST') {
      fetchOpts.body = JSON.stringify(req.body);
    }

    const upstream = await fetch(target.toString(), fetchOpts);

    // Forward response headers
    res.setHeader('Access-Control-Allow-Origin', '*');
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
