// Vercel Serverless Function - Public MCP tools catalogue endpoint
// Serves active MCP tools from Supabase so /mcp-tools.html stays dynamic.

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  const SUPABASE_URL =
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://rfzvrezrcigzmldgvntz.supabase.co';
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  const APP_ORIGIN = process.env.APP_ORIGIN || 'https://cashpilot.tech';

  const apiKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server misconfigured: missing Supabase API key' });
  }

  res.setHeader('Access-Control-Allow-Origin', APP_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = new URL(`${SUPABASE_URL}/rest/v1/mcp_tools_registry`);
  url.searchParams.set(
    'select',
    'id,tool_name,display_name,category,source_module,description,is_active,is_generated,tags,metadata,updated_at,last_changed_at'
  );
  url.searchParams.set('is_active', 'eq.true');
  url.searchParams.set('order', 'category.asc,tool_name.asc');

  try {
    const upstream = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    });

    const body = await upstream.text();
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: 'Failed to fetch MCP tools from Supabase', detail: body });
    }

    const rows = JSON.parse(body);
    const data = Array.isArray(rows) ? rows : [];

    const categories = new Set(data.map((entry) => entry.category).filter(Boolean));
    const generatedCount = data.filter((entry) => entry.is_generated).length;
    const updatedAt = data
      .map((entry) => entry.updated_at || entry.last_changed_at)
      .filter(Boolean)
      .sort()
      .at(-1);

    return res.status(200).json({
      data,
      stats: {
        total: data.length,
        categories: categories.size,
        generated: generatedCount,
        manual: data.length - generatedCount,
      },
      updatedAt: updatedAt || null,
    });
  } catch (error) {
    return res
      .status(502)
      .json({ error: 'Upstream MCP tools source unavailable', detail: error?.message || String(error) });
  }
}
