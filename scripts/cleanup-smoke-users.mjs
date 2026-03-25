import { createClient } from '@supabase/supabase-js';

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return String(value).trim();
}

function optionalEnv(name, fallback = null) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    return fallback;
  }
  return String(value).trim();
}

function parseBooleanEnv(name, fallback = false) {
  const value = optionalEnv(name, null);
  if (value == null) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function parseListEnv(name, fallback = []) {
  const value = optionalEnv(name, null);
  if (!value) return fallback;
  return String(value)
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function parseNumberEnv(name, fallback = 0) {
  const value = optionalEnv(name, null);
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

const DEFAULT_SMOKE_EMAIL_PREFIXES = ['smoke.', 'smoke+'];
const DEFAULT_SMOKE_EMAIL_DOMAINS = ['cashpilot.test', 'cashpilot.dev'];
const DELETE_IGNORED_CODES = ['42P01', '42703', 'PGRST204', 'PGRST205', 'PGRST116'];

function describeError(error) {
  if (!error) return 'unknown_error';
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') return error;
  if (typeof error === 'object') {
    const message = String(error.message || '').trim();
    const code = String(error.code || '').trim();
    const status = String(error.status || '').trim();
    const parts = [code, status, message].filter(Boolean);
    if (parts.length > 0) {
      return parts.join(' ');
    }
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

function isSmokeEmail(email, prefixes, domains) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return false;

  const atIndex = normalized.lastIndexOf('@');
  if (atIndex <= 0 || atIndex === normalized.length - 1) return false;

  const localPart = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex + 1);

  const prefixMatched = prefixes.some((prefix) => localPart.startsWith(prefix));
  if (!prefixMatched) return false;

  return domains.some((allowedDomain) => domain === allowedDomain);
}

function userOlderThan(user, minAgeMinutes, now = Date.now()) {
  if (!minAgeMinutes || minAgeMinutes <= 0) return true;
  const createdAt = Date.parse(user?.created_at || '');
  if (!Number.isFinite(createdAt)) return false;
  const ageMs = now - createdAt;
  return ageMs >= minAgeMinutes * 60 * 1000;
}

async function safeDeleteByEq(supabase, table, column, value) {
  const { error } = await supabase
    .from(table)
    .delete()
    .eq(column, value);

  if (error && !DELETE_IGNORED_CODES.includes(error.code)) {
    throw error;
  }
}

async function deleteUserArtifacts(supabase, userId) {
  const tables = [
    'accounting_audit_log',
    'accounting_entries',
    'accounting_health',
    'payment_reconciliations',
    'bank_sync_history',
    'consent_logs',
    'data_export_requests',
    'credit_transactions',
    'user_credits',
    'user_subscriptions',
    'pending_subscriptions',
    'user_roles',
    'user_company_preferences',
    'user_accounting_settings',
    'profiles',
  ];

  for (const table of tables) {
    await safeDeleteByEq(supabase, table, 'user_id', userId);
  }

  await safeDeleteByEq(supabase, 'company', 'user_id', userId);
}

async function deleteAuthUser(supabase, userId) {
  const hardDelete = await supabase.auth.admin.deleteUser(userId);
  if (!hardDelete.error) {
    return {
      mode: 'hard',
      hardDeleteError: null,
    };
  }

  const softDelete = await supabase.auth.admin.deleteUser(userId, true);
  if (softDelete.error) {
    throw new Error(
      `hard_delete_failed=${describeError(hardDelete.error)}; soft_delete_failed=${describeError(softDelete.error)}`
    );
  }

  return {
    mode: 'soft',
    hardDeleteError: describeError(hardDelete.error),
  };
}

async function main() {
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const dryRun = parseBooleanEnv('SMOKE_CLEANUP_DRY_RUN', false);
  const minAgeMinutes = parseNumberEnv('SMOKE_CLEANUP_MIN_AGE_MINUTES', 0);
  const emailPrefixes = parseListEnv('SMOKE_CLEANUP_EMAIL_PREFIXES', DEFAULT_SMOKE_EMAIL_PREFIXES);
  const emailDomains = parseListEnv('SMOKE_CLEANUP_EMAIL_DOMAINS', DEFAULT_SMOKE_EMAIL_DOMAINS);
  const excludedEmails = new Set(parseListEnv('SMOKE_CLEANUP_EXCLUDE_EMAILS', []));
  const excludedUserIds = new Set(parseListEnv('SMOKE_CLEANUP_EXCLUDE_USER_IDS', []));
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const removed = [];
  const failed = [];
  const skippedExcluded = [];
  const skippedRecent = [];
  const deletionModes = {
    hard: 0,
    soft: 0,
  };
  let scannedCount = 0;
  let matchedCount = 0;
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw error;
    }

    const users = data?.users || [];
    scannedCount += users.length;
    const targets = users.filter((user) => {
      const email = String(user.email || '').toLowerCase();
      const userId = String(user.id || '').toLowerCase();
      if (!isSmokeEmail(email, emailPrefixes, emailDomains)) {
        return false;
      }

      matchedCount += 1;

      if (excludedEmails.has(email) || excludedUserIds.has(userId)) {
        skippedExcluded.push({
          id: user.id,
          email: user.email,
        });
        return false;
      }

      if (!userOlderThan(user, minAgeMinutes)) {
        skippedRecent.push({
          id: user.id,
          email: user.email,
          created_at: user.created_at || null,
        });
        return false;
      }

      return true;
    });

    for (const user of targets) {
      try {
        if (!dryRun) {
          await deleteUserArtifacts(supabase, user.id);
          const deletion = await deleteAuthUser(supabase, user.id);
          deletionModes[deletion.mode] += 1;
        }

        removed.push({
          id: user.id,
          email: user.email,
        });
      } catch (error) {
        failed.push({
          id: user.id,
          email: user.email,
          error: describeError(error),
        });
      }
    }

    if (users.length < perPage) {
      break;
    }

    page += 1;
  }

  console.log(JSON.stringify({
    dryRun,
    scannedCount,
    matchedCount,
    minAgeMinutes,
    emailPrefixes,
    emailDomains,
    deletionModes,
    skippedExcludedCount: skippedExcluded.length,
    skippedRecentCount: skippedRecent.length,
    removedCount: removed.length,
    failedCount: failed.length,
    skippedExcluded,
    skippedRecent,
    removed,
    failed,
  }, null, 2));

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
