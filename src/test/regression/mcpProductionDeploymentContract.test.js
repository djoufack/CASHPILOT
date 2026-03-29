import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const vercelConfigPath = path.resolve(process.cwd(), 'vercel.json');
const vercelIgnorePath = path.resolve(process.cwd(), '.vercelignore');

describe('MCP production deployment contract', () => {
  const vercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'));
  const vercelIgnore = fs.readFileSync(vercelIgnorePath, 'utf8');

  it('keeps /mcp routed to the serverless proxy', () => {
    const mcpRewrite = vercelConfig.rewrites.find((entry) => entry.source === '/mcp');
    expect(mcpRewrite).toBeDefined();
    expect(mcpRewrite.destination).toBe('/api/mcp');
  });

  it('does not exclude the MCP API handler from Vercel deployment', () => {
    expect(vercelIgnore).not.toMatch(/^\/api\/\s*$/m);
    expect(vercelIgnore).toMatch(/^!\/api\/mcp\.js\s*$/m);
  });
});
