import { constants as fsConstants } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const ALLOWED_SUBSCRIPTION_STATUSES = new Set([
  'none',
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'incomplete',
  'incomplete_expired',
  'paused',
]);

function optionalEnv(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value && String(value).trim()) {
      return String(value).trim();
    }
  }
  return null;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return String(value).trim();
}

async function fileExists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readTextIfExists(filePath) {
  if (!(await fileExists(filePath))) {
    return null;
  }
  return readFile(filePath, 'utf8');
}

function pushIssue(bucket, label, message, details = null) {
  bucket.push({
    label,
    message,
    details,
  });
}

function printIssue(prefix, item) {
  if (item.details) {
    console.log(`${prefix} ${item.label}: ${item.message} (${item.details})`);
  } else {
    console.log(`${prefix} ${item.label}: ${item.message}`);
  }
}

function normalizeStatus(value) {
  const status = String(value || 'none').trim().toLowerCase();
  if (!status) return 'none';
  return status;
}

function summarizeCounts(records, keyFn) {
  const counts = new Map();
  for (const record of records) {
    const key = keyFn(record);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

async function main() {
  const blockers = [];
  const warnings = [];
  const passes = [];

  console.log('Stripe-only readiness check');
  console.log(`Project root: ${projectRoot}`);

  const requiredEnvNames = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];

  const supabaseUrl = optionalEnv('SUPABASE_URL', 'VITE_SUPABASE_URL');
  if (!supabaseUrl) {
    pushIssue(blockers, 'ENV', 'Missing environment variable', 'SUPABASE_URL or VITE_SUPABASE_URL');
  }

  for (const name of requiredEnvNames) {
    try {
      requireEnv(name);
    } catch (error) {
      pushIssue(blockers, 'ENV', error.message);
    }
  }

  if (blockers.length === 0) {
    pushIssue(passes, 'ENV', 'Required Stripe and Supabase environment variables are present');
  }

  const stripeWebhookPath = path.join(projectRoot, 'supabase', 'functions', 'stripe-webhook', 'index.ts');
  const stripeSubscriptionCheckoutPath = path.join(projectRoot, 'supabase', 'functions', 'stripe-subscription-checkout', 'index.ts');
  const stripeCheckoutPath = path.join(projectRoot, 'supabase', 'functions', 'stripe-checkout', 'index.ts');

  if (await fileExists(stripeWebhookPath)) {
    pushIssue(passes, 'FUNCTION', 'stripe-webhook endpoint exists');
  } else {
    pushIssue(blockers, 'FUNCTION', 'Missing endpoint file', 'supabase/functions/stripe-webhook/index.ts');
  }

  if (await fileExists(stripeSubscriptionCheckoutPath)) {
    pushIssue(passes, 'FUNCTION', 'stripe-subscription-checkout endpoint exists');
  } else {
    pushIssue(blockers, 'FUNCTION', 'Missing endpoint file', 'supabase/functions/stripe-subscription-checkout/index.ts');
  }

  const stripeCheckoutSource = await readTextIfExists(stripeCheckoutPath);
  if (stripeCheckoutSource === null) {
    pushIssue(blockers, 'FUNCTION', 'Missing endpoint file', 'supabase/functions/stripe-checkout/index.ts');
  } else {
    const hasExplicit410 = /status\s*:\s*410/.test(stripeCheckoutSource) || /HttpError\s*\(\s*410\s*,/i.test(stripeCheckoutSource);
    const hasClearDisableMessage = /(disabled|disabled for|stripe-only|stripe only|credit purchases are disabled|one-time credit purchases are disabled)/i.test(stripeCheckoutSource);

    if (hasExplicit410 && hasClearDisableMessage) {
      pushIssue(passes, 'FUNCTION', 'stripe-checkout is explicitly disabled with a 410 response');
    } else {
      pushIssue(
        blockers,
        'FUNCTION',
        'stripe-checkout is not explicitly disabled',
        'Expected a 410 response and a clear disable message in the code',
      );
    }
  }

  if (!supabaseUrl) {
    pushIssue(blockers, 'DB', 'Skipped DB checks because Supabase URL is missing');
  } else {
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!supabaseServiceRoleKey) {
      pushIssue(blockers, 'DB', 'Skipped DB checks because SUPABASE_SERVICE_ROLE_KEY is missing');
    } else {
      const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });

      const { data: creditsRows, error: creditsError } = await supabase
        .from('user_credits')
        .select('user_id, subscription_status, subscription_plan_id, stripe_customer_id, stripe_subscription_id, current_period_end');

      if (creditsError) {
        pushIssue(blockers, 'DB', 'Unable to read user_credits', creditsError.message);
      } else {
        const rows = creditsRows || [];
        const statusCounts = summarizeCounts(rows, (row) => normalizeStatus(row.subscription_status));
        const invalidStatuses = rows.filter((row) => {
          const status = normalizeStatus(row.subscription_status);
          return !ALLOWED_SUBSCRIPTION_STATUSES.has(status);
        });
        const legacyStatuses = rows.filter((row) => {
          const status = normalizeStatus(row.subscription_status);
          return status === 'inactive' || status === 'free';
        });
        const rowsWithSubscriptionButNoPlan = rows.filter((row) => {
          const status = normalizeStatus(row.subscription_status);
          return ['active', 'trialing', 'past_due', 'unpaid'].includes(status) && !row.subscription_plan_id;
        });

        const { data: plansRows, error: plansError } = await supabase
          .from('subscription_plans')
          .select('id, slug, name, stripe_price_id, is_active');

        if (plansError) {
          pushIssue(blockers, 'DB', 'Unable to read subscription_plans', plansError.message);
        } else {
          const plans = plansRows || [];
          const planById = new Map(plans.map((plan) => [plan.id, plan]));
          const activePlansMissingStripePrice = plans.filter((plan) => plan.is_active && !plan.stripe_price_id);
          const activePlansWithStripePrice = plans.filter((plan) => plan.is_active && plan.stripe_price_id);
          const orphanSubscriptionPlanIds = rows
            .map((row) => row.subscription_plan_id)
            .filter(Boolean)
            .filter((planId) => !planById.has(planId));

          if (activePlansWithStripePrice.length > 0) {
            pushIssue(
              passes,
              'DB',
              `${activePlansWithStripePrice.length} active plan(s) have a Stripe price ID`,
            );
          } else {
            pushIssue(blockers, 'DB', 'No active subscription plan has a Stripe price ID');
          }

          if (activePlansMissingStripePrice.length > 0) {
            pushIssue(
              blockers,
              'DB',
              'Some active subscription plans are missing stripe_price_id',
              activePlansMissingStripePrice.map((plan) => `${plan.slug || plan.id}`).join(', '),
            );
          } else if (plans.length > 0) {
            pushIssue(passes, 'DB', 'All active subscription plans expose stripe_price_id');
          }

          if (rows.length === 0) {
            pushIssue(warnings, 'DB', 'user_credits returned no rows');
          } else {
            pushIssue(passes, 'DB', `Loaded ${rows.length} user_credits row(s)`);
          }

          if (legacyStatuses.length > 0) {
            pushIssue(
              blockers,
              'DB',
              'Legacy subscription statuses are still present',
              `${legacyStatuses.length} row(s) use inactive/free`,
            );
          }

          if (invalidStatuses.length > 0) {
            const uniqueInvalidStatuses = [...new Set(invalidStatuses.map((row) => normalizeStatus(row.subscription_status)))];
            pushIssue(
              blockers,
              'DB',
              'Unexpected subscription statuses are present',
              uniqueInvalidStatuses.join(', '),
            );
          }

          if (rowsWithSubscriptionButNoPlan.length > 0) {
            pushIssue(
              blockers,
              'DB',
              'Some active subscription rows have no subscription_plan_id',
              `${rowsWithSubscriptionButNoPlan.length} row(s)`,
            );
          }

          if (orphanSubscriptionPlanIds.length > 0) {
            const uniqueOrphans = [...new Set(orphanSubscriptionPlanIds)];
            pushIssue(
              blockers,
              'DB',
              'Some user_credits rows reference missing subscription plans',
              uniqueOrphans.join(', '),
            );
          }

          pushIssue(passes, 'DB', `Subscription status distribution: ${JSON.stringify(statusCounts)}`);
        }
      }
    }
  }

  console.log('');
  console.log('Results');
  for (const item of passes) {
    printIssue('[PASS]', item);
  }
  for (const item of warnings) {
    printIssue('[WARN]', item);
  }
  for (const item of blockers) {
    printIssue('[BLOCKER]', item);
  }

  console.log('');
  console.log(`Summary: ${passes.length} pass(es), ${warnings.length} warning(s), ${blockers.length} blocker(s)`);

  if (blockers.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[verify-stripe-only-readiness] fatal:', error?.message || error);
  process.exit(1);
});
