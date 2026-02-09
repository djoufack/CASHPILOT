import http from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer } from './server.js';

const PORT = parseInt(process.env.MCP_HTTP_PORT || '3100', 10);

// ── Per-session state ────────────────────────────────────────
// StreamableHTTPServerTransport is stateful (one per session).
// We keep a map keyed by session ID so multiple clients can connect.
const sessions = new Map<string, StreamableHTTPServerTransport>();

// ── CORS headers applied to every response ───────────────────
function setCors(res: http.ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
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
