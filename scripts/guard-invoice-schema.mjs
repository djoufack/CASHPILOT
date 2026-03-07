import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TARGET_DIRS = ['src', 'supabase/functions'];
const FILE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);
const BANNED_COLUMNS = ['invoice_date', 'total_vat', 'tva_rate', 'total_tva'];
const QUERY_PATTERN = /from\(['"]invoices['"]\)[\s\S]{0,700}/gi;

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
      continue;
    }
    if (!FILE_EXTENSIONS.has(path.extname(entry.name))) continue;
    files.push(fullPath);
  }

  return files;
}

function lineFromIndex(text, index) {
  return text.slice(0, index).split('\n').length;
}

async function main() {
  const violations = [];

  for (const targetDir of TARGET_DIRS) {
    const absDir = path.join(ROOT, targetDir);
    const files = await walk(absDir);

    for (const filePath of files) {
      const source = await fs.readFile(filePath, 'utf8');
      const matches = source.matchAll(QUERY_PATTERN);
      for (const match of matches) {
        const snippet = match[0];
        const stringMatch = snippet.match(/['"`]([^'"`\n]*\b(invoice_date|total_vat|tva_rate|total_tva)\b[^'"`\n]*)['"`]/i);
        const objectKeyMatch = snippet.match(/\b(invoice_date|total_vat|tva_rate|total_tva)\s*:/i);
        const found = (stringMatch?.[2] || objectKeyMatch?.[1] || '').toLowerCase();
        if (!found) continue;

        violations.push({
          filePath,
          line: lineFromIndex(source, match.index ?? 0),
          column: found,
        });
      }
    }
  }

  if (violations.length > 0) {
    console.error('Invoice schema guard failed. Found deprecated invoice columns in invoices queries:');
    for (const violation of violations) {
      const relativePath = path.relative(ROOT, violation.filePath);
      console.error(`- ${relativePath}:${violation.line} (${violation.column})`);
    }
    process.exit(1);
  }

  console.log('Invoice schema guard passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
