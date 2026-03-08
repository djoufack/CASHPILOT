import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations');

const SECURITY_DEFINER_REGEX = /create\s+(or\s+replace\s+)?function[\s\S]*?\$\$[\s\S]*?\$\$\s*language[\s\S]*?;/gi;
const POLICY_MUTATION_REGEX = /create\s+policy[\s\S]*?for\s+(all|insert|update|delete)[\s\S]*?;/gi;
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
]);

function lineFromIndex(text, index) {
  return text.slice(0, index).split('\n').length;
}

function toPosixPath(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join('/');
}

async function main() {
  const entries = await fs.readdir(MIGRATIONS_DIR, { withFileTypes: true });
  const sqlFiles = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.sql'))
    .map((entry) => path.join(MIGRATIONS_DIR, entry.name))
    .sort();

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

    for (const match of source.matchAll(POLICY_MUTATION_REGEX)) {
      const block = match[0];
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
