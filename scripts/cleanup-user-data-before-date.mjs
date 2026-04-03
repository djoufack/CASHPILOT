import fs from 'node:fs/promises';
import https from 'node:https';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const SCHEMA_PATH = path.resolve(PROJECT_ROOT, 'mcp-server', 'scripts', 'schema.json');
const REPORTS_DIR = path.resolve(PROJECT_ROOT, 'artifacts', 'cleanup-reports');

const TARGET_EMAIL = process.env.CLEANUP_TARGET_EMAIL || 'djoufack@gmail.com';
const CUTOFF_DATE = process.env.CLEANUP_CUTOFF_DATE || '2026-03-20';
const CUTOFF_TIMESTAMP = process.env.CLEANUP_CUTOFF_TIMESTAMP || '2026-03-20T00:00:00+01:00';
const APPLY_MODE = process.argv.includes('--apply');
const DRY_RUN_MODE = !APPLY_MODE;
const EXTRA_SKIP_TABLES = new Set(
  String(process.env.CLEANUP_SKIP_TABLES || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
);

const TEMPORAL_PRIORITY = [
  { column: 'created_at', mode: 'timestamp' },
  { column: 'received_at', mode: 'timestamp' },
  { column: 'issued_at', mode: 'timestamp' },
  { column: 'sent_at', mode: 'timestamp' },
  { column: 'processed_at', mode: 'timestamp' },
  { column: 'payment_date', mode: 'date' },
  { column: 'expense_date', mode: 'date' },
  { column: 'transaction_date', mode: 'date' },
  { column: 'invoice_date', mode: 'date' },
  { column: 'issue_date', mode: 'date' },
  { column: 'due_date', mode: 'date' },
  { column: 'work_date', mode: 'date' },
  { column: 'start_date', mode: 'date' },
  { column: 'entry_date', mode: 'date' },
  { column: 'date', mode: 'date' },
];

const TABLE_EXCLUSIONS = new Set([
  'company',
  'deleted_data_snapshots',
  'credit_packages',
  'subscription_plans',
  'reference_countries',
  'reference_currencies',
  'reference_tax_jurisdictions',
  'reference_tax_jurisdiction_vat_rates',
  'reference_sector_benchmarks',
  'reference_sector_multiples',
  'reference_region_wacc',
  'reference_debt_statuses',
  'reference_debt_categories',
  'reference_debt_payment_methods',
  'reference_accounting_source_types',
  'reference_accounting_source_categories',
  'syscohada_chart_templates',
  'syscohada_fiscal_rules',
  'syscohada_report_templates',
]);

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return String(value).trim();
}

function parseSchemaDefinitions(schemaJson) {
  const definitions = schemaJson?.definitions || {};
  const tables = [];

  for (const [table, def] of Object.entries(definitions)) {
    const properties = def?.properties || {};
    const columns = Object.keys(properties);
    tables.push({ table, columns });
  }

  return tables;
}

async function fetchLiveOpenApiSchema(supabaseUrl, serviceRoleKey) {
  const endpoint = new URL('/rest/v1/', supabaseUrl).toString();

  return new Promise((resolve, reject) => {
    const req = https.request(
      endpoint,
      {
        method: 'GET',
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          Accept: 'application/openapi+json',
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          if ((res.statusCode || 500) >= 400) {
            reject(new Error(`OpenAPI fetch failed (${res.statusCode}): ${body.slice(0, 300)}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(new Error(`OpenAPI parse failed: ${error?.message || String(error)}`));
          }
        });
      }
    );

    req.on('error', reject);
    req.end();
  });
}

function pickTemporalColumn(columns) {
  for (const temporal of TEMPORAL_PRIORITY) {
    if (columns.includes(temporal.column)) {
      return temporal;
    }
  }
  return null;
}

function buildCandidateTables(tableDefinitions) {
  const candidates = [];
  for (const entry of tableDefinitions) {
    const { table, columns } = entry;
    if (TABLE_EXCLUSIONS.has(table)) continue;
    if (EXTRA_SKIP_TABLES.has(table)) continue;
    if (!columns.includes('company_id')) continue;

    const temporal = pickTemporalColumn(columns);
    if (!temporal) continue;

    candidates.push({
      table,
      temporalColumn: temporal.column,
      temporalMode: temporal.mode,
      hasUserId: columns.includes('user_id'),
    });
  }
  return candidates;
}

async function resolveUserByEmail(supabase, targetEmail) {
  const emailNeedle = String(targetEmail || '').trim().toLowerCase();
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users || [];
    const found = users.find((user) => String(user?.email || '').trim().toLowerCase() === emailNeedle);
    if (found) return found;
    if (users.length < perPage) break;
    page += 1;
  }

  return null;
}

function buildTemporalFilter(query, temporalColumn, temporalMode) {
  if (temporalMode === 'date') {
    return query.lt(temporalColumn, CUTOFF_DATE);
  }
  return query.lt(temporalColumn, CUTOFF_TIMESTAMP);
}

async function countCandidatesForTable(supabase, scope, tablePlan) {
  let query = supabase
    .from(tablePlan.table)
    .select('id', { count: 'exact', head: true })
    .in('company_id', scope.companyIds);
  if (tablePlan.hasUserId) {
    query = query.eq('user_id', scope.userId);
  }
  query = buildTemporalFilter(query, tablePlan.temporalColumn, tablePlan.temporalMode);
  const { count, error } = await query;
  if (error) {
    return { count: 0, error: error.message };
  }
  return { count: count || 0, error: null };
}

async function deleteCandidatesForTable(supabase, scope, tablePlan) {
  let query = supabase
    .from(tablePlan.table)
    .delete({ count: 'exact' })
    .in('company_id', scope.companyIds);
  if (tablePlan.hasUserId) {
    query = query.eq('user_id', scope.userId);
  }
  query = buildTemporalFilter(query, tablePlan.temporalColumn, tablePlan.temporalMode);
  const { count, error } = await query;
  if (error) {
    return { deleted: 0, error: error.message };
  }
  return { deleted: count || 0, error: null };
}

async function fetchRowsForTable(supabase, scope, tablePlan) {
  const pageSize = 1000;
  let offset = 0;
  const rows = [];

  while (true) {
    let query = supabase
      .from(tablePlan.table)
      .select('*')
      .in('company_id', scope.companyIds)
      .range(offset, offset + pageSize - 1);
    if (tablePlan.hasUserId) {
      query = query.eq('user_id', scope.userId);
    }
    query = buildTemporalFilter(query, tablePlan.temporalColumn, tablePlan.temporalMode);

    const { data, error } = await query;
    if (error) {
      return { rows: [], error: error.message };
    }
    const page = data || [];
    rows.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }

  return { rows, error: null };
}

function isoStamp(now = new Date()) {
  const pad = (v) => String(v).padStart(2, '0');
  return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
}

async function ensureReportsDir() {
  await fs.mkdir(REPORTS_DIR, { recursive: true });
}

async function writeReportFile(report) {
  await ensureReportsDir();
  const filename = `cleanup-${report.mode}-${isoStamp()}.json`;
  const fullPath = path.join(REPORTS_DIR, filename);
  await fs.writeFile(fullPath, JSON.stringify(report, null, 2), 'utf8');
  return fullPath;
}

async function writeBackupFile(payload) {
  await ensureReportsDir();
  const filename = `cleanup-backup-${isoStamp()}.json`;
  const fullPath = path.join(REPORTS_DIR, filename);
  await fs.writeFile(fullPath, JSON.stringify(payload, null, 2), 'utf8');
  return fullPath;
}

async function main() {
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  let schemaJson = null;
  let schemaSource = 'live';
  try {
    schemaJson = await fetchLiveOpenApiSchema(supabaseUrl, serviceRoleKey);
  } catch {
    const schemaRaw = await fs.readFile(SCHEMA_PATH, 'utf8');
    schemaJson = JSON.parse(schemaRaw);
    schemaSource = 'local-fallback';
  }
  const tableDefinitions = parseSchemaDefinitions(schemaJson);
  const candidateTables = buildCandidateTables(tableDefinitions);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const user = await resolveUserByEmail(supabase, TARGET_EMAIL);
  if (!user?.id) {
    throw new Error(`User not found: ${TARGET_EMAIL}`);
  }

  const { data: companies, error: companyError } = await supabase
    .from('company')
    .select('id')
    .eq('user_id', user.id);
  if (companyError) throw companyError;

  const companyIds = (companies || []).map((c) => c.id).filter(Boolean);
  if (companyIds.length === 0) {
    throw new Error(`No company found for user ${TARGET_EMAIL}`);
  }

  const scope = { userId: user.id, companyIds };

  const precheck = [];
  for (const tablePlan of candidateTables) {
    const counted = await countCandidatesForTable(supabase, scope, tablePlan);
    precheck.push({ ...tablePlan, ...counted });
  }

  const impacted = precheck.filter((row) => row.count > 0);
  const totalCandidates = impacted.reduce((sum, row) => sum + row.count, 0);
  const scanErrors = precheck.filter((row) => row.error);

  if (DRY_RUN_MODE) {
    const report = {
      mode: 'dry-run',
      targetEmail: TARGET_EMAIL,
      cutoffDate: CUTOFF_DATE,
      cutoffTimestamp: CUTOFF_TIMESTAMP,
      userId: user.id,
      companyIds,
      scannedTables: candidateTables.length,
      schemaSource,
      impactedTables: impacted.length,
      totalCandidates,
      scanErrors,
      impacted,
    };
    const reportPath = await writeReportFile(report);
    console.log(JSON.stringify({ ok: true, mode: 'dry-run', reportPath, ...report }, null, 2));
    return;
  }

  const deletionResults = [];
  const backupSnapshot = [];
  for (const tablePlan of impacted) {
    const fetched = await fetchRowsForTable(supabase, scope, tablePlan);
    backupSnapshot.push({
      table: tablePlan.table,
      temporalColumn: tablePlan.temporalColumn,
      temporalMode: tablePlan.temporalMode,
      error: fetched.error,
      rowCount: fetched.rows.length,
      rows: fetched.rows,
    });
  }
  const backupPath = await writeBackupFile({
    generatedAt: new Date().toISOString(),
    targetEmail: TARGET_EMAIL,
    cutoffDate: CUTOFF_DATE,
    cutoffTimestamp: CUTOFF_TIMESTAMP,
    userId: user.id,
    companyIds,
    impactedTables: impacted.length,
    totalCandidates,
    snapshot: backupSnapshot,
  });

  const maxPasses = 6;
  let currentImpacted = impacted.map((row) => ({ ...row }));

  for (let pass = 1; pass <= maxPasses; pass += 1) {
    if (currentImpacted.length === 0) break;

    let passDeleted = 0;
    const passErrors = [];

    for (const tablePlan of currentImpacted) {
      const deleted = await deleteCandidatesForTable(supabase, scope, tablePlan);
      deletionResults.push({
        pass,
        table: tablePlan.table,
        temporalColumn: tablePlan.temporalColumn,
        temporalMode: tablePlan.temporalMode,
        deleted: deleted.deleted,
        error: deleted.error,
      });

      passDeleted += deleted.deleted;
      if (deleted.error) {
        passErrors.push({ table: tablePlan.table, error: deleted.error });
      }
    }

    const nextImpacted = [];
    for (const tablePlan of currentImpacted) {
      const counted = await countCandidatesForTable(supabase, scope, tablePlan);
      if (counted.count > 0 || counted.error) {
        nextImpacted.push({ ...tablePlan, ...counted });
      }
    }

    currentImpacted = nextImpacted;
    if (passDeleted === 0 && passErrors.length > 0) {
      break;
    }
  }

  const postcheck = [];
  for (const tablePlan of candidateTables) {
    const counted = await countCandidatesForTable(supabase, scope, tablePlan);
    postcheck.push({ ...tablePlan, ...counted });
  }

  const remaining = postcheck.filter((row) => row.count > 0);
  const totalDeleted = deletionResults.reduce((sum, row) => sum + (row.deleted || 0), 0);
  const deleteErrors = deletionResults.filter((row) => row.error);

  const report = {
    mode: 'apply',
    targetEmail: TARGET_EMAIL,
    cutoffDate: CUTOFF_DATE,
    cutoffTimestamp: CUTOFF_TIMESTAMP,
    userId: user.id,
    companyIds,
    scannedTables: candidateTables.length,
    schemaSource,
    precheckImpactedTables: impacted.length,
    precheckTotalCandidates: totalCandidates,
    backupPath,
    totalDeleted,
    deleteErrors,
    remainingTables: remaining.length,
    remainingRows: remaining.reduce((sum, row) => sum + row.count, 0),
    remaining,
    deletionResults,
  };

  const reportPath = await writeReportFile(report);
  console.log(JSON.stringify({ ok: true, mode: 'apply', reportPath, summary: report }, null, 2));
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error?.message || String(error),
      },
      null,
      2
    )
  );
  process.exit(1);
});
