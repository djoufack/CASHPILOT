import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const functionsDir = path.resolve(process.cwd(), 'supabase/functions');

function listIndexFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listIndexFiles(fullPath);
    return entry.isFile() && entry.name === 'index.ts' ? [fullPath] : [];
  });
}

describe('Gemini Edge Function model contract', () => {
  it('does not use the deprecated Gemini 2.0 Flash model directly', () => {
    const offenders = listIndexFiles(functionsDir)
      .map((filePath) => ({
        filePath,
        source: fs.readFileSync(filePath, 'utf8'),
      }))
      .filter(({ source }) => source.includes('gemini-2.0-flash'))
      .map(({ filePath }) => path.relative(process.cwd(), filePath));

    expect(offenders).toEqual([]);
  });
});
