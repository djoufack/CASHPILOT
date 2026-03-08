import http from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer } from './server.js';

const PORT = parseInt(process.env.MCP_HTTP_PORT || '3100', 10);

// ── Rate limiting (in-memory) ────────────────────────────────
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const LOGIN_LIMIT = 5;       // max login attempts per minute per IP
const GENERAL_LIMIT = 60;    // max requests per minute per IP
const WINDOW_MS = 60_000;    // 1-minute sliding window

function checkRateLimit(ip: string, isLogin: boolean): boolean {
  const now = Date.now();
  const key = isLogin ? `login:${ip}` : ip;
  const limit = isLogin ? LOGIN_LIMIT : GENERAL_LIMIT;
  const entry = rateLimits.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

// Cleanup stale entries every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimits) {
    if (now > entry.resetAt) rateLimits.delete(key);
  }
}, 300_000).unref();

// ── Per-session state ────────────────────────────────────────
// StreamableHTTPServerTransport is stateful (one per session).
// We keep a map keyed by session ID so multiple clients can connect.
const sessions = new Map<string, StreamableHTTPServerTransport>();

// ── CORS headers applied to every response ───────────────────
function setCors(res: http.ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', process.env.APP_ORIGIN || 'https://cashpilot.tech');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id');
  res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id');
}

// ── Collect the full request body as a string ────────────────
function collectBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

// ── HTTP server ──────────────────────────────────────────────
const httpServer = http.createServer(async (req, res) => {
  setCors(res);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || req.socket.remoteAddress
    || 'unknown';

  // ── Rate limiting (applied before body parsing) ────────
  if (!checkRateLimit(clientIp, false)) {
    res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '60' });
    res.end(JSON.stringify({ error: 'Too many requests. Try again later.' }));
    return;
  }

  // ── Health check ─────────────────────────────────────────
  if (url.pathname === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      server: 'cashpilot-mcp',
      version: '1.0.0'
    }));
    return;
  }

  // ── MCP endpoint ─────────────────────────────────────────
  if (url.pathname === '/mcp') {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    // POST /mcp  -- main JSON-RPC request (initialize or tool call)
    if (req.method === 'POST') {
      const body = await collectBody(req);
      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }

      // ── Login-specific rate limiting ──────────────────────
      const isLoginCall = Array.isArray(parsed)
        ? parsed.some((r: any) => r.method === 'tools/call' && r.params?.name === 'login')
        : (parsed as any)?.method === 'tools/call' && (parsed as any)?.params?.name === 'login';
      if (isLoginCall && !checkRateLimit(clientIp, true)) {
        res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '60' });
        res.end(JSON.stringify({ error: 'Too many login attempts. Try again later.' }));
        return;
      }

      // If we already have a session, reuse its transport
      let transport = sessionId ? sessions.get(sessionId) : undefined;

      if (!transport) {
        // New session -- create transport + MCP server for it
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => crypto.randomUUID(),
          onsessioninitialized: (id) => {
            sessions.set(id, transport!);
          }
        });

        // Clean up when session closes
        transport.onclose = () => {
          const sid = transport!.sessionId;
          if (sid) sessions.delete(sid);
        };

        const server = createServer();
        await server.connect(transport);
      }

      await transport.handleRequest(req, res, parsed);
      return;
    }

    // GET /mcp  -- SSE stream for server-to-client notifications
    if (req.method === 'GET') {
      if (!sessionId || !sessions.has(sessionId)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid or missing mcp-session-id header' }));
        return;
      }

      const transport = sessions.get(sessionId)!;
      await transport.handleRequest(req, res);
      return;
    }

    // DELETE /mcp  -- session termination
    if (req.method === 'DELETE') {
      if (!sessionId || !sessions.has(sessionId)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid or missing mcp-session-id header' }));
        return;
      }

      const transport = sessions.get(sessionId)!;
      await transport.handleRequest(req, res);
      sessions.delete(sessionId);
      return;
    }
  }

  // ── Fallback for unknown routes ──────────────────────────
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// ── Start listening ──────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`CashPilot MCP HTTP server listening on http://localhost:${PORT}`);
  console.log(`  POST   /mcp     - MCP JSON-RPC endpoint`);
  console.log(`  GET    /mcp     - SSE notifications (requires mcp-session-id)`);
  console.log(`  DELETE /mcp     - terminate session`);
  console.log(`  GET    /health  - health check`);
});
