import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const MIGRATION_DIRS = [
  path.join(ROOT, 'supabase', 'migrations'),
  path.join(ROOT, 'supabase', 'migrations_numbered_legacy'),
  path.join(ROOT, 'migrations'),
];

const SECURITY_DEFINER_REGEX = /create\s+(or\s+replace\s+)?function[\s\S]*?\$\$[\s\S]*?\$\$\s*language[\s\S]*?;/gi;
// Match one CREATE POLICY statement at a time (up to the first semicolon),
// then inspect whether it targets mutation operations.
const POLICY_STATEMENT_REGEX = /create\s+policy\b[^;]*;/gi;
const BASELINE_ALLOWLIST = new Set([
  'supabase/migrations/20260212002024_unified_billing_foundation.sql:SECURITY DEFINER function without SET search_path',
  'supabase/migrations/20260226150558_cashpilot_auto_accounting_engine_v2.sql:Mutation policy with always-true predicate',
  'supabase/migrations/20260226192816_add_handle_new_user_profile_trigger_and_backfill.sql:SECURITY DEFINER function without SET search_path',
  'supabase/migrations/20260226232114_accounting_guard.sql:Mutation policy with always-true predicate',
  'supabase/migrations/20260302010000_pending_subscriptions.sql:Mutation policy with always-true predicate',
  'supabase/migrations/20260302120000_subscription_entitlements_and_credit_engine.sql:Mutation policy with always-true predicate',
  // Sprint 1-3 accounting SQL migrations (already deployed, remediated by 20260308175000)
  'supabase/migrations/20260308130000_accounting_sql_foundation.sql:SECURITY DEFINER function without SET search_path',
  'supabase/migrations/20260308130000_accounting_sql_foundation.sql:Mutation policy with always-true predicate',
  'supabase/migrations/20260308140000_fix_classify_account_security_definer.sql:SECURITY DEFINER function without SET search_path',
  'supabase/migrations/20260308150000_sprint2_financial_analysis.sql:SECURITY DEFINER function without SET search_path',
  'supabase/migrations/20260308160000_sprint3_pilotage_valuation_tax.sql:SECURITY DEFINER function without SET search_path',
  // Legacy/root migrations currently archived but still scanned by guard.
  'migrations/016_monetization_enhancements.sql:SECURITY DEFINER function without SET search_path',
  'migrations/034_unified_billing_foundation.sql:SECURITY DEFINER function without SET search_path',
  'supabase/migrations_numbered_legacy/040_accounting_guard.sql:Mutation policy with always-true predicate',
]);

function lineFromIndex(text, index) {
  return text.slice(0, index).split('\n').length;
}

function toPosixPath(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join('/');
}

async function collectSqlFiles(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      return collectSqlFiles(entryPath);
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.sql')) {
      return [entryPath];
    }
    return [];
  }));
  return nested.flat();
}

async function main() {
  const sqlFilesPerDir = await Promise.all(
    MIGRATION_DIRS.map(async (dirPath) => {
      try {
        await fs.access(dirPath);
      } catch {
        return [];
      }
      return collectSqlFiles(dirPath);
    }),
  );
  const sqlFiles = sqlFilesPerDir.flat().sort();

  const violations = [];

  for (const filePath of sqlFiles) {
    const source = await fs.readFile(filePath, 'utf8');

    for (const match of source.matchAll(SECURITY_DEFINER_REGEX)) {
      const block = match[0];
      if (!/security\s+definer/i.test(block)) continue;
      if (/set\s+search_path/i.test(block)) continue;

      violations.push({
        filePath,
        line: lineFromIndex(source, match.index ?? 0),
        type: 'SECURITY DEFINER function without SET search_path',
      });
    }

    for (const match of source.matchAll(POLICY_STATEMENT_REGEX)) {
      const block = match[0];
      if (!/\bfor\s+(all|insert|update|delete)\b/i.test(block)) continue;
      const hasAlwaysTrueUsing = /using\s*\(\s*true\s*\)/i.test(block);
      const hasAlwaysTrueWithCheck = /with\s+check\s*\(\s*true\s*\)/i.test(block);
      if (!hasAlwaysTrueUsing && !hasAlwaysTrueWithCheck) continue;

      violations.push({
        filePath,
        line: lineFromIndex(source, match.index ?? 0),
        type: 'Mutation policy with always-true predicate',
      });
    }
  }

  const filteredViolations = violations.filter((violation) => {
    const relativePath = toPosixPath(violation.filePath);
    const key = `${relativePath}:${violation.type}`;
    return !BASELINE_ALLOWLIST.has(key);
  });

  if (filteredViolations.length > 0) {
    console.error('Migration guard failed. Violations found:');
    for (const violation of filteredViolations) {
      const relativePath = toPosixPath(violation.filePath);
      console.error(`- ${relativePath}:${violation.line} ${violation.type}`);
    }
    process.exit(1);
  }

  console.log('Migration guard passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
