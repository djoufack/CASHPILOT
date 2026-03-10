import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SCAN_DIRS = ['src', path.join('supabase', 'functions'), 'scripts'];
const FILE_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.ts', '.tsx']);
const WINDOW_SIZE = 8;
const QUERY_PATTERNS = [
  /\.(?:eq|neq|gt|gte|lt|lte|order)\(\s*['"`]date['"`]/,
  /select\(\s*['"`][\s\S]*\bdate\b[\s\S]*['"`]/,
];

async function collectFiles(dirPath, files = []) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(fullPath, files);
      continue;
    }

    if (FILE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

async function main() {
  const files = [];
  for (const relativeDir of SCAN_DIRS) {
    const fullDir = path.join(ROOT, relativeDir);
    await collectFiles(fullDir, files);
  }

  const violations = [];

  for (const filePath of files) {
    const source = await fs.readFile(filePath, 'utf8');
    const lines = source.split(/\r?\n/);

    for (let index = 0; index < lines.length; index += 1) {
      if (!/from\(['"`]expenses['"`]\)/.test(lines[index])) {
        continue;
      }

      const windowText = lines.slice(index, Math.min(lines.length, index + WINDOW_SIZE)).join('\n');
      const matchedPattern = QUERY_PATTERNS.find((pattern) => pattern.test(windowText));
      if (!matchedPattern) {
        continue;
      }

      violations.push({
        file: path.relative(ROOT, filePath),
        line: index + 1,
        excerpt: lines[index].trim(),
      });
    }
  }

  if (violations.length > 0) {
    console.error('Expense date guard failed. Use expense_date for expenses queries.');
    for (const violation of violations) {
      console.error(`- ${violation.file}:${violation.line} -> ${violation.excerpt}`);
    }
    process.exit(1);
  }

  console.log(`Expense date guard passed (${files.length} files scanned).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});