import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const mcpGuidePath = path.resolve(process.cwd(), 'docs/guide/user guide mcp cashpilot.md');

describe('MCP guide authentication contract', () => {
  const guide = fs.readFileSync(mcpGuidePath, 'utf8');

  it('does not document query-string api keys', () => {
    expect(guide).not.toContain('?api_key=');
  });

  it('documents header-based authentication', () => {
    expect(guide).toMatch(/X-API-Key/i);
  });
});
