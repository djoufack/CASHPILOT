import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const sourceDir = resolve('docs/guide');
const distDir = resolve('dist');
const targetDir = resolve('dist/guide');

if (!existsSync(sourceDir)) {
  console.warn(`[vercel-copy-guide] Source not found: ${sourceDir}. Skipping copy.`);
  process.exit(0);
}

mkdirSync(distDir, { recursive: true });
cpSync(sourceDir, targetDir, { recursive: true, force: true });
console.log(`[vercel-copy-guide] Copied ${sourceDir} -> ${targetDir}`);
