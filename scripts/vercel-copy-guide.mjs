import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const sourceCandidates = [resolve('docs/guide'), resolve('public/guide')];
const sourceDir = sourceCandidates.find((candidate) => existsSync(candidate));
const distDir = resolve('dist');
const targetDir = resolve('dist/guide');

if (!sourceDir) {
  console.warn(
    `[vercel-copy-guide] Source not found: ${sourceCandidates.join(' or ')}. Skipping copy.`,
  );
  process.exit(0);
}

mkdirSync(distDir, { recursive: true });
cpSync(sourceDir, targetDir, { recursive: true, force: true });
console.log(`[vercel-copy-guide] Copied ${sourceDir} -> ${targetDir}`);
