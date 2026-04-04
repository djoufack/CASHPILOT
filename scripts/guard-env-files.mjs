#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const args = new Set(process.argv.slice(2));
const stagedOnly = args.has('--staged');

const ALLOWED_ENV_FILES = new Set([
  '.env.example',
]);

function listFiles() {
  const gitArgs = stagedOnly
    ? ['diff', '--cached', '--name-only', '--diff-filter=ACMR']
    : ['ls-files'];
  const output = execFileSync('git', gitArgs, { encoding: 'utf8' });
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function isForbiddenEnvFile(filePath) {
  const normalized = filePath.split('\\').join('/');
  const base = path.basename(normalized);
  if (!base.startsWith('.env')) {
    return false;
  }
  return !ALLOWED_ENV_FILES.has(base);
}

function main() {
  const files = listFiles();
  const offenders = files.filter(isForbiddenEnvFile);

  if (offenders.length > 0) {
    console.error('Env guard failed: forbidden .env file(s) detected.');
    for (const file of offenders) {
      console.error(`- ${file}`);
    }
    console.error('Only .env.example is allowed in git.');
    process.exit(1);
  }

  console.log(`Env guard passed${stagedOnly ? ' (staged files)' : ''}.`);
}

main();
