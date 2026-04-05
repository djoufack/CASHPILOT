import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const serverFile = path.join(repoRoot, 'mcp-server', 'src', 'server.ts');
const toolsDir = path.join(repoRoot, 'mcp-server', 'src', 'tools');

const outputArg = process.argv.find((entry) => entry.startsWith('--out='));
const outputPath = outputArg ? path.resolve(repoRoot, outputArg.slice('--out='.length)) : null;

const GENERATED_FILES = new Set(['generated_crud.ts', 'generated_crud_hr.ts', 'generated_crud_projects.ts']);

const CATEGORY_BY_FILE = {
  '__auth__': 'auth',
  'clients.ts': 'clients',
  'invoices.ts': 'invoices',
  'payments.ts': 'payments',
  'documents.ts': 'documents',
  'supplier-invoices.ts': 'suppliers',
  'accounting.ts': 'accounting',
  'bank-reconciliation.ts': 'bank',
  'analytics.ts': 'analytics',
  'reporting.ts': 'reporting',
  'exports.ts': 'exports',
  'financial-instruments.ts': 'instruments',
  'company-finance.ts': 'company_finance',
  'crm.ts': 'crm',
  'cfo.ts': 'cfo',
  'mobile_money.ts': 'mobile_money',
  'syscohada.ts': 'syscohada',
};

const CRUD_CATEGORY_BY_FILE = {
  'generated_crud.ts': 'crud_core',
  'generated_crud_hr.ts': 'crud_hr',
  'generated_crud_projects.ts': 'crud_projects',
};

function stripDeadFalseBlocks(source) {
  let out = '';
  let i = 0;
  const marker = 'if (false) {';

  while (i < source.length) {
    const idx = source.indexOf(marker, i);
    if (idx === -1) {
      out += source.slice(i);
      break;
    }

    out += source.slice(i, idx);
    let j = idx + marker.length;
    let depth = 1;

    while (j < source.length && depth > 0) {
      const ch = source[j];
      if (ch === '{') depth += 1;
      if (ch === '}') depth -= 1;
      j += 1;
    }

    i = j;
  }

  return out;
}

function skipSpaces(source, index) {
  let i = index;
  while (i < source.length && /\s/.test(source[i])) i += 1;
  return i;
}

function parseStringLiteral(source, index) {
  const quote = source[index];
  if (!quote || !['"', "'", '`'].includes(quote)) return null;

  let i = index + 1;
  let raw = '';

  while (i < source.length) {
    const ch = source[i];
    if (ch === '\\') {
      if (i + 1 < source.length) {
        raw += source.slice(i, i + 2);
        i += 2;
        continue;
      }
      raw += ch;
      i += 1;
      continue;
    }

    if (ch === quote) {
      return {
        value: raw
          .replaceAll('\\n', ' ')
          .replaceAll('\\r', ' ')
          .replaceAll('\\t', ' ')
          .replaceAll('\\"', '"')
          .replaceAll("\\'", "'")
          .replaceAll('\\`', '`')
          .replaceAll('\\\\', '\\')
          .trim(),
        end: i + 1,
      };
    }

    raw += ch;
    i += 1;
  }

  return null;
}

function extractToolsFromSource(sourceText) {
  const source = stripDeadFalseBlocks(sourceText);
  const out = [];
  const marker = 'server.tool(';
  let i = 0;

  while (i < source.length) {
    const idx = source.indexOf(marker, i);
    if (idx === -1) break;

    let p = skipSpaces(source, idx + marker.length);
    const nameLit = parseStringLiteral(source, p);
    if (!nameLit) {
      i = idx + marker.length;
      continue;
    }

    p = skipSpaces(source, nameLit.end);
    if (source[p] !== ',') {
      i = nameLit.end;
      continue;
    }

    p = skipSpaces(source, p + 1);
    const descLit = parseStringLiteral(source, p);
    out.push({
      tool_name: nameLit.value,
      description: descLit ? descLit.value : '',
    });

    i = descLit ? descLit.end : p;
  }

  return out;
}

function readTools(filePath) {
  return extractToolsFromSource(fs.readFileSync(filePath, 'utf8'));
}

function toDisplayName(toolName) {
  return String(toolName || '')
    .replaceAll('_', ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sqlText(value) {
  return `'${String(value ?? '').replaceAll("'", "''")}'`;
}

function sqlTextArray(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return 'ARRAY[]::text[]';
  }
  return `ARRAY[${values.map((value) => sqlText(value)).join(', ')}]::text[]`;
}

function buildRows() {
  const rows = [];
  const seen = new Set();

  for (const tool of readTools(serverFile)) {
    if (seen.has(tool.tool_name)) continue;
    seen.add(tool.tool_name);

    rows.push({
      tool_name: tool.tool_name,
      display_name: toDisplayName(tool.tool_name),
      category: CATEGORY_BY_FILE.__auth__,
      source_module: 'server.ts',
      description: tool.description,
      is_generated: true,
      tags: ['auth', 'system'],
    });
  }

  const toolFiles = fs
    .readdirSync(toolsDir)
    .filter((name) => name.endsWith('.ts'))
    .sort((a, b) => a.localeCompare(b));

  for (const fileName of toolFiles) {
    const tools = readTools(path.join(toolsDir, fileName));
    const isCrudFile = GENERATED_FILES.has(fileName);
    const category = isCrudFile ? CRUD_CATEGORY_BY_FILE[fileName] || 'crud' : CATEGORY_BY_FILE[fileName] || 'general';
    const fileTag = fileName.replace(/\.ts$/i, '').replaceAll('-', '_');

    for (const tool of tools) {
      if (seen.has(tool.tool_name)) continue;
      seen.add(tool.tool_name);

      rows.push({
        tool_name: tool.tool_name,
        display_name: toDisplayName(tool.tool_name),
        category,
        source_module: fileName,
        description: tool.description,
        is_generated: true,
        tags: Array.from(new Set([category, fileTag, isCrudFile ? 'crud' : 'business'])).filter(Boolean),
      });
    }
  }

  return rows.sort((a, b) => a.tool_name.localeCompare(b.tool_name));
}

function buildSql(rows) {
  if (rows.length === 0) {
    throw new Error('No MCP tools found while building seed SQL.');
  }

  const values = rows
    .map(
      (row) =>
        `  (${sqlText(row.tool_name)}, ${sqlText(row.display_name)}, ${sqlText(row.category)}, ${sqlText(
          row.source_module
        )}, ${sqlText(row.description)}, TRUE, ${row.is_generated ? 'TRUE' : 'FALSE'}, ${sqlTextArray(row.tags)}, '{}'::jsonb)`
    )
    .join(',\n');

  return `-- ADM-05: seed mcp_tools_registry from current MCP source code
-- Generated by scripts/generate-mcp-tools-seed-sql.mjs
-- Rows: ${rows.length}

WITH seed (
  tool_name,
  display_name,
  category,
  source_module,
  description,
  is_active,
  is_generated,
  tags,
  metadata
) AS (
VALUES
${values}
),
upserted AS (
  INSERT INTO public.mcp_tools_registry (
    tool_name,
    display_name,
    category,
    source_module,
    description,
    is_active,
    is_generated,
    tags,
    metadata,
    last_changed_at
  )
  SELECT
    s.tool_name,
    s.display_name,
    s.category,
    s.source_module,
    s.description,
    s.is_active,
    s.is_generated,
    s.tags,
    s.metadata,
    timezone('utc', now())
  FROM seed s
  ON CONFLICT (tool_name) DO UPDATE
  SET
    display_name = EXCLUDED.display_name,
    category = EXCLUDED.category,
    source_module = EXCLUDED.source_module,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    is_generated = EXCLUDED.is_generated,
    tags = EXCLUDED.tags,
    metadata = EXCLUDED.metadata,
    last_changed_at = timezone('utc', now()),
    updated_at = timezone('utc', now())
  RETURNING tool_name
)
UPDATE public.mcp_tools_registry t
SET
  is_active = FALSE,
  last_changed_at = timezone('utc', now()),
  updated_at = timezone('utc', now())
WHERE t.is_generated = TRUE
  AND NOT EXISTS (
    SELECT 1
    FROM seed s
    WHERE s.tool_name = t.tool_name
  );

NOTIFY pgrst, 'reload schema';
`;
}

const rows = buildRows();
const sql = buildSql(rows);

if (outputPath) {
  fs.writeFileSync(outputPath, sql, 'utf8');
  console.log(`Generated seed SQL in ${path.relative(repoRoot, outputPath)} (${rows.length} rows)`);
} else {
  process.stdout.write(sql);
}
