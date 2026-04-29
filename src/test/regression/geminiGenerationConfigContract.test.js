import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const functionsDir = path.resolve(process.cwd(), 'supabase/functions');

function listIndexFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listIndexFiles(fullPath);
    return entry.isFile() && entry.name === 'index.ts' ? [fullPath] : [];
  });
}

describe('Gemini generation config contract', () => {
  it('does not send topK overrides to Gemini 2.5 models', () => {
    const offenders = listIndexFiles(functionsDir)
      .map((filePath) => ({
        filePath,
        source: fs.readFileSync(filePath, 'utf8'),
      }))
      .filter(({ source }) => /generationConfig\s*:\s*\{[\s\S]*?\btopK\s*:/m.test(source))
      .map(({ filePath }) => path.relative(process.cwd(), filePath));

    expect(offenders).toEqual([]);
  });
});
