import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { promises as fs } from 'node:fs';

const ROOT = process.cwd();
const HOOK_DIR = path.posix.join('src', 'hooks');
const HOOK_GLOB = 'use*.js';

const SAFE_TABLE_ALLOWLIST = new Map([
  ['accounting_tax_rates', 'default tax rate lookup is user-level accounting preference data'],
  ['accounting_account_taxonomy', 'global accounting taxonomy reference data'],
  ['audit_log', 'admin audit trail is organization-wide by design'],
  ['backup_logs', 'backup history is user-level settings data'],
  ['backup_settings', 'backup preferences are user-level settings data'],
  ['beta_features', 'feature rollout flags are global/user preference data'],
  ['beta_feedback', 'beta feedback is user-level experimentation data'],
  ['beta_program', 'beta enrollment is user-level experimentation data'],
  ['billing_settings', 'billing settings are account-level, not company-level'],
  ['biometric_settings', 'biometric/passkey preferences are user-level'],
  ['biometric_credentials', 'biometric credentials are user-level auth data'],
  ['company', 'root company ownership table (filtered by user_id)'],
  ['company_esign_settings', 'company-level signing settings (explicit company_id)'],
  ['company_security_settings', 'company-level security settings (explicit company_id)'],
  ['clients', 'admin client directory is intentionally cross-company and user-owned'],
  ['credit_packages', 'catalog data for the billing layer'],
  ['credit_transactions', 'credit ledger is user-level'],
  ['consent_logs', 'GDPR consent logs are user-level records'],
  ['feature_flags', 'feature-flag config is global/user-level'],
  ['logos', 'company logo assets are account-level media records'],
  ['invoice_settings', 'invoice template preferences are account/company settings'],
  ['notification_settings', 'notification preferences are user-level'],
  ['notifications', 'notification inbox is user-level'],
  ['payment_methods', 'payment methods are user-level billing data'],
  ['payment_instrument_bank_accounts', 'payment instrument detail rows are scoped by instrument ownership'],
  ['payment_instrument_cards', 'payment instrument detail rows are scoped by instrument ownership'],
  ['payment_instrument_cash_accounts', 'payment instrument detail rows are scoped by instrument ownership'],
  ['reference_debt_payment_methods', 'reference data for payment methods'],
  ['payment_terms', 'payment terms are user/company settings'],
  ['billing_info', 'billing profile is user-level account billing data'],
  ['profiles', 'profile directory is user-level'],
  ['push_tokens', 'push notification tokens are user-level'],
  ['referrals', 'referral state is user-level'],
  ['role_permissions', 'admin role permission matrix'],
  ['subscription_plans', 'subscription catalog is global'],
  ['user_accounting_settings', 'accounting toggle settings are user-level'],
  ['user_company_preferences', 'active company preference is user-level'],
  ['user_credits', 'credit balance is user-level'],
  ['user_roles', 'admin role mapping is user-level'],
  ['credit_costs', 'credit cost catalog is global reference data'],
  ['supplier-invoices', 'legacy supplier invoice view is user-level accounting data'],
  ['supplier_invoice_files', 'invoice file attachments are user-level documents'],
  ['supplier_product_categories', 'seeded supplier category records are user-level'],
  ['supplier_products', 'seeded supplier product records are user-level'],
  ['supplier_services', 'seeded supplier service records are user-level'],
  ['suppliers', 'seeded supplier directory is user-level'],
  ['webhook_deliveries', 'webhook logs are endpoint-scoped user data'],
  ['webhook_endpoints', 'webhook endpoints are user-level'],
]);

const SAFE_TABLE_PREFIXES = [
  'admin_',
  'backup_',
  'beta_',
  'notification_',
  'onboarding_',
  'reference_',
  'payment_instrument_',
  'push_',
  'user_',
  'webhook_',
];

const COMPANY_SCOPE_MARKERS = [
  /useCompanyScope\b/,
  /withCompanyScope\b/,
  /\bcompany_id\b/,
  /\.eq\(\s*['"]company_id['"]\s*,/,
  /\.upsert\(\s*{[\s\S]*?\bcompany_id\b/,
];

const SUPABASE_USAGE_MARKERS = [/supabase\.(from|rpc|functions\.invoke)\(/, /\.from\(\s*['"`]/];

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function listHookFiles() {
  const rg = spawnSync('rg', ['--files', HOOK_DIR, '-g', HOOK_GLOB], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (rg.status === 0) {
    return rg.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((relativePath) => toPosix(relativePath));
  }

  const git = execFileSync('git', ['ls-files', `${HOOK_DIR}/${HOOK_GLOB}`], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return git
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((relativePath) => toPosix(relativePath));
}

function getLineNumber(content, index) {
  return content.slice(0, index).split('\n').length;
}

function extractTableRefs(content) {
  const refs = [];
  const regex = /\.from\(\s*(['"`])([^'"`]+)\1\s*\)/g;

  for (const match of content.matchAll(regex)) {
    const table = match[2];
    refs.push({
      table,
      line: getLineNumber(content, match.index || 0),
    });
  }

  return refs;
}

function hasScopeMarkers(content) {
  return COMPANY_SCOPE_MARKERS.some((regex) => regex.test(content));
}

function isSafeTable(table) {
  if (SAFE_TABLE_ALLOWLIST.has(table)) {
    return true;
  }

  return SAFE_TABLE_PREFIXES.some((prefix) => table.startsWith(prefix));
}

function shouldIgnoreFile(content) {
  if (!SUPABASE_USAGE_MARKERS.some((regex) => regex.test(content))) {
    return true;
  }

  if (/supabase\.auth\./.test(content) && !/\.from\(\s*['"`]/.test(content) && !/\.rpc\(\s*['"`]/.test(content)) {
    return true;
  }

  return false;
}

async function main() {
  const files = listHookFiles();
  const violations = [];
  const inspected = [];

  for (const relativePath of files) {
    const absolutePath = path.resolve(ROOT, relativePath);
    const content = await fs.readFile(absolutePath, 'utf8');

    if (shouldIgnoreFile(content)) {
      continue;
    }

    const tables = extractTableRefs(content);
    if (tables.length === 0) {
      continue;
    }

    const hasExplicitScope = hasScopeMarkers(content);
    const suspiciousTables = tables.filter(({ table }) => !isSafeTable(table));

    inspected.push({
      path: relativePath,
      tables: tables.length,
      suspicious: suspiciousTables.length,
      scoped: hasExplicitScope,
    });

    if (suspiciousTables.length === 0) {
      continue;
    }

    if (hasExplicitScope) {
      continue;
    }

    for (const ref of suspiciousTables) {
      violations.push({
        path: relativePath,
        line: ref.line,
        table: ref.table,
      });
    }
  }

  if (violations.length > 0) {
    console.error('ENF-2 hook company scope guard failed.');
    console.error('Potentially unscoped Supabase table access detected:');
    for (const violation of violations) {
      console.error(
        `- ${violation.path}:${violation.line} table="${violation.table}" ` +
          'Add useCompanyScope()/company_id filtering or document the exception in docs/HOOK_COMPANY_SCOPE_GUARD.md.'
      );
    }
    process.exit(1);
  }

  const totalSuspicious = inspected.reduce((sum, entry) => sum + entry.suspicious, 0);
  console.log(
    `ENF-2 hook company scope guard passed. Hooks scanned: ${files.length}; hooks with Supabase tables: ${inspected.length}; suspicious tables: ${totalSuspicious}.`
  );
}

main().catch((error) => {
  console.error('ENF-2 hook company scope guard crashed.');
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
