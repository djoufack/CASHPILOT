import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();

const FORBIDDEN_PATTERNS = [
  {
    label: 'Hardcoded Pilotage demo password',
    regex: /Pilotage(?:FR|BE|OHADA)#20\d{2}!/i,
  },
  {
    label: 'Hardcoded default password fallback',
    regex: /defaultPassword\s*:\s*['"`][^'"`\r\n]+['"`]/i,
  },
  {
    label: 'Demo credential pair leaked in clear text',
    regex: /pilotage\.(?:fr|be|ohada)\.demo@cashpilot\.cloud\s*\/\s*(?!\[(?:SECRET|secret)_DEMO_NON_VERSIONNE\])[^\s\r\n]+/i,
  },
  {
    label: 'Hardcoded Supabase anon key assignment',
    regex: /\b(?:SUPABASE_ANON_KEY|anonKey)\s*[:=]\s*['"`]eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+['"`]/i,
  },
  {
    label: 'Supabase anon JWT exposed in docs',
    regex: /\bAnon\s+Key\s*:\s*eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/i,
  },
  {
    label: 'Supabase realtime URL leaks anon JWT',
    regex: /apikey=eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/i,
  },
];

const IGNORED_PATH_PREFIXES = [
  'node_modules/',
  '.git/',
  'dist/',
  'build/',
  'coverage/',
  'artifacts/',
  '.vercel/',
];

const IGNORED_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.ico',
  '.pdf',
  '.zip',
  '.gz',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.mp4',
  '.mov',
]);

function listTrackedFiles() {
  const output = execFileSync('git', ['ls-files'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function isIgnored(relativePath) {
  const posixPath = relativePath.split(path.sep).join('/');
  if (IGNORED_PATH_PREFIXES.some((prefix) => posixPath.startsWith(prefix))) {
    return true;
  }
  const extension = path.extname(posixPath).toLowerCase();
  return IGNORED_EXTENSIONS.has(extension);
}

function lineFromIndex(content, index) {
  return content.slice(0, index).split('\n').length;
}

async function main() {
  const files = listTrackedFiles().filter((relativePath) => !isIgnored(relativePath));
  const violations = [];

  for (const relativePath of files) {
    const absolutePath = path.join(ROOT, relativePath);
    const content = await fs.readFile(absolutePath, 'utf8').catch(() => null);
    if (content == null) continue;

    for (const { label, regex } of FORBIDDEN_PATTERNS) {
      const match = regex.exec(content);
      if (!match) continue;

      violations.push({
        path: relativePath.split(path.sep).join('/'),
        line: lineFromIndex(content, match.index ?? 0),
        label,
      });
    }
  }

  if (violations.length > 0) {
    console.error('Demo secrets guard failed. Violations found:');
    for (const violation of violations) {
      console.error(`- ${violation.path}:${violation.line} ${violation.label}`);
    }
    process.exit(1);
  }

  console.log('Demo secrets guard passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
