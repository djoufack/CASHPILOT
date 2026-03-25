import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const STRIPE_API_BASE = 'https://api.stripe.com/v1';
const CANONICAL_SUBSCRIPTION_STATUSES = new Set([
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'incomplete',
  'incomplete_expired',
  'paused',
  'none',
]);

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return String(value).trim();
}

function optionalEnv(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value && String(value).trim()) {
      return String(value).trim();
    }
  }

  return null;
}

function parseArgs(argv = process.argv.slice(2)) {
  const flags = new Set(argv.map((entry) => String(entry).trim()));
  const apply = flags.has('--apply');
  const dryRun = flags.has('--dry-run') || !apply;
  return { apply, dryRun };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeStripeStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (!normalized) {
    return 'none';
  }

  return CANONICAL_SUBSCRIPTION_STATUSES.has(normalized) ? normalized : 'none';
}

function toIsoDate(value) {
  if (value == null) {
    return null;
  }

  const parsed = typeof value === 'number' ? value * 1000 : Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  const date = new Date(parsed);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function safeIso(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function buildPlanLookup(plans) {
  const byPriceId = new Map();
  const duplicates = [];

  for (const plan of plans) {
    for (const priceId of [plan.stripe_price_id, plan.stripe_price_id_yearly]) {
      const normalizedPriceId = String(priceId || '').trim();
      if (!normalizedPriceId) {
        continue;
      }

      if (byPriceId.has(normalizedPriceId)) {
        duplicates.push({
          price_id: normalizedPriceId,
          plan_id: plan.id,
          existing_plan_id: byPriceId.get(normalizedPriceId).id,
        });
        continue;
      }

      byPriceId.set(normalizedPriceId, {
        id: plan.id,
        slug: plan.slug,
        name: plan.name,
        credits_per_month: Number(plan.credits_per_month || 0),
        stripe_price_id: plan.stripe_price_id || null,
        stripe_price_id_yearly: plan.stripe_price_id_yearly || null,
      });
    }
  }

  return { byPriceId, duplicates };
}

function headersForStripe(secretKey) {
  return {
    Authorization: `Bearer ${secretKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
}

function encodeQuery(params = {}) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === '') {
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry != null && entry !== '') {
          searchParams.append(key, String(entry));
        }
      }
      continue;
    }

    searchParams.set(key, String(value));
  }

  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

async function stripeRequest(secretKey, path, { method = 'GET', query = {}, body = null, retry = 2 } = {}) {
  const url = `${STRIPE_API_BASE}${path}${encodeQuery(query)}`;
  let attempt = 0;

  while (true) {
    const response = await fetch(url, {
      method,
      headers: headersForStripe(secretKey),
      body: body ? new URLSearchParams(body) : undefined,
    });

    const responseText = await response.text();
    let payload = null;
    if (responseText) {
      try {
        payload = JSON.parse(responseText);
      } catch {
        payload = { raw: responseText };
      }
    }

    if (response.ok) {
      return payload;
    }

    const status = response.status;
    const retryAfter = Number.parseInt(response.headers.get('retry-after') || '0', 10);
    const retriable = status === 429 || status >= 500;

    if (retriable && attempt < retry) {
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : 500 * (attempt + 1);
      await sleep(waitMs);
      attempt += 1;
      continue;
    }

    const error = new Error(`Stripe ${method} ${path} failed (${status})`);
    error.status = status;
    error.payload = payload;
    throw error;
  }
}

async function fetchStripeObject(secretKey, path) {
  try {
    return await stripeRequest(secretKey, path);
  } catch (error) {
    if (error?.status === 404) {
      return null;
    }

    throw error;
  }
}

async function fetchStripeCustomer(secretKey, customerId) {
  if (!customerId) {
    return null;
  }

  return fetchStripeObject(secretKey, `/customers/${encodeURIComponent(customerId)}`);
}

async function fetchStripePrice(secretKey, priceId) {
  if (!priceId) {
    return null;
  }

  return fetchStripeObject(secretKey, `/prices/${encodeURIComponent(priceId)}`);
}

async function fetchStripeSubscription(secretKey, subscriptionId) {
  if (!subscriptionId) {
    return null;
  }

  return fetchStripeObject(secretKey, `/subscriptions/${encodeURIComponent(subscriptionId)}`);
}

async function listStripeCustomerSubscriptions(secretKey, customerId) {
  if (!customerId) {
    return [];
  }

  const response = await stripeRequest(secretKey, '/subscriptions', {
    query: {
      customer: customerId,
      status: 'all',
      limit: 10,
      expand: ['data.items.data.price'],
    },
  });

  return Array.isArray(response?.data) ? response.data : [];
}

function pickRecoveredSubscription(subscriptions) {
  if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
    return null;
  }

  const priority = new Map([
    ['active', 0],
    ['trialing', 1],
    ['past_due', 2],
    ['paused', 3],
    ['unpaid', 4],
    ['incomplete', 5],
    ['incomplete_expired', 6],
    ['canceled', 7],
  ]);

  const filtered = subscriptions
    .map((subscription) => ({
      subscription,
      score: priority.has(String(subscription?.status || '').toLowerCase())
        ? priority.get(String(subscription?.status || '').toLowerCase())
        : Number.POSITIVE_INFINITY,
    }))
    .filter(({ score }) => Number.isFinite(score));

  if (filtered.length === 0) {
    return null;
  }

  filtered.sort((left, right) => left.score - right.score);
  return filtered[0].subscription;
}

function extractPrimaryPriceId(subscription) {
  const priceId =
    subscription?.items?.data?.[0]?.price?.id ||
    subscription?.items?.data?.[0]?.plan?.id ||
    null;

  return priceId ? String(priceId).trim() : null;
}

function buildCanonicalSubscriptionState(row, subscription, customer, price, plan) {
  const resolvedSubscriptionId = subscription?.id || row.stripe_subscription_id || null;
  const resolvedCustomerId = customer?.id || subscription?.customer || row.stripe_customer_id || null;
  const priceId = price?.id || extractPrimaryPriceId(subscription);
  const status = subscription ? normalizeStripeStatus(subscription.status) : 'none';
  const hasActiveSubscription = Boolean(subscription) && status !== 'none';

  return {
    user_id: row.user_id,
    stripe_customer_id: resolvedCustomerId,
    stripe_subscription_id: hasActiveSubscription ? resolvedSubscriptionId : null,
    subscription_status: hasActiveSubscription ? status : 'none',
    subscription_plan_id: hasActiveSubscription && plan ? plan.id : null,
    subscription_credits: hasActiveSubscription && plan ? plan.credits_per_month : 0,
    current_period_end: hasActiveSubscription ? toIsoDate(subscription.current_period_end) : null,
    stripe_price_id: priceId || null,
  };
}

function buildPatch(row, nextState) {
  const patch = {
    stripe_customer_id: nextState.stripe_customer_id,
    stripe_subscription_id: nextState.stripe_subscription_id,
    subscription_status: nextState.subscription_status,
    subscription_plan_id: nextState.subscription_plan_id,
    subscription_credits: nextState.subscription_credits,
    current_period_end: nextState.current_period_end,
    updated_at: new Date().toISOString(),
  };

  const currentPeriodEnd = safeIso(row.current_period_end);
  const fieldsToCompare = {
    stripe_customer_id: row.stripe_customer_id || null,
    stripe_subscription_id: row.stripe_subscription_id || null,
    subscription_status: row.subscription_status || 'none',
    subscription_plan_id: row.subscription_plan_id || null,
    subscription_credits: Number(row.subscription_credits || 0),
    current_period_end: currentPeriodEnd,
  };

  const normalizedNext = {
    stripe_customer_id: patch.stripe_customer_id || null,
    stripe_subscription_id: patch.stripe_subscription_id || null,
    subscription_status: patch.subscription_status || 'none',
    subscription_plan_id: patch.subscription_plan_id || null,
    subscription_credits: Number(patch.subscription_credits || 0),
    current_period_end: patch.current_period_end || null,
  };

  const changed = Object.keys(fieldsToCompare).some((key) => {
    const left = fieldsToCompare[key];
    const right = normalizedNext[key];
    return String(left ?? '') !== String(right ?? '');
  });

  return { patch, changed };
}

async function syncSingleRow({ supabase, stripeSecretKey, row, planLookup, apply, nowIso }) {
  const reportEntry = {
    user_id: row.user_id,
    stripe_customer_id: row.stripe_customer_id || null,
    stripe_subscription_id: row.stripe_subscription_id || null,
    subscription_status_before: row.subscription_status || 'none',
    subscription_plan_id_before: row.subscription_plan_id || null,
    subscription_credits_before: Number(row.subscription_credits || 0),
    current_period_end_before: row.current_period_end || null,
    issues: [],
  };

  const customer = row.stripe_customer_id
    ? await fetchStripeCustomer(stripeSecretKey, row.stripe_customer_id)
    : null;

  let subscription = row.stripe_subscription_id
    ? await fetchStripeSubscription(stripeSecretKey, row.stripe_subscription_id)
    : null;

  if (!subscription && row.stripe_customer_id) {
    const customerSubscriptions = await listStripeCustomerSubscriptions(stripeSecretKey, row.stripe_customer_id);
    subscription = pickRecoveredSubscription(customerSubscriptions);
    if (subscription) {
      reportEntry.issues.push('Recovered subscription from customer subscription list');
    }
  }

  if (row.stripe_customer_id && !customer) {
    reportEntry.issues.push('Orphan Stripe customer id');
  }

  if (row.stripe_subscription_id && !subscription) {
    reportEntry.issues.push('Orphan Stripe subscription id');
  }

  const currentPriceId = extractPrimaryPriceId(subscription);
  const price = currentPriceId ? await fetchStripePrice(stripeSecretKey, currentPriceId) : null;

  if (currentPriceId && !price) {
    reportEntry.issues.push('Orphan Stripe price id');
  }

  const mappedPlan = currentPriceId ? planLookup.byPriceId.get(currentPriceId) || null : null;
  if (currentPriceId && !mappedPlan) {
    reportEntry.issues.push(`Unmapped Stripe price id: ${currentPriceId}`);
  }

  const nextState = buildCanonicalSubscriptionState(row, subscription, customer, price, mappedPlan);
  const { patch, changed } = buildPatch(row, nextState);

  if (currentPriceId && !mappedPlan) {
    reportEntry.issues.push('subscription_plan_id set to null because no plan mapping exists');
  }

  if (nextState.subscription_status === 'none' && row.subscription_status && row.subscription_status !== 'none') {
    reportEntry.issues.push('No active Stripe subscription; canonical status collapsed to none');
  }

  reportEntry.stripe_customer_id_after = patch.stripe_customer_id || null;
  reportEntry.stripe_subscription_id_after = patch.stripe_subscription_id || null;
  reportEntry.subscription_status_after = patch.subscription_status;
  reportEntry.subscription_plan_id_after = patch.subscription_plan_id || null;
  reportEntry.subscription_credits_after = patch.subscription_credits;
  reportEntry.current_period_end_after = patch.current_period_end || null;

  if (!changed) {
    return {
      type: 'skipped',
      entry: {
        ...reportEntry,
        reason: 'Already canonical',
      },
    };
  }

  if (!apply) {
    return {
      type: 'updated',
      entry: {
        ...reportEntry,
        dry_run: true,
        patch,
      },
    };
  }

  const { error } = await supabase
    .from('user_credits')
    .update(patch)
    .eq('user_id', row.user_id);

  if (error) {
    throw error;
  }

  return {
    type: 'updated',
    entry: {
      ...reportEntry,
      dry_run: false,
      patch,
      applied_at: nowIso,
    },
  };
}

async function run() {
  const { apply, dryRun } = parseArgs();
  const stripeSecretKey = requireEnv('STRIPE_SECRET_KEY');
  const supabaseUrl = optionalEnv('VITE_SUPABASE_URL', 'SUPABASE_URL');
  if (!supabaseUrl) {
    throw new Error('Missing environment variable: VITE_SUPABASE_URL');
  }
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const [plansResponse, creditsResponse] = await Promise.all([
    supabase
      .from('subscription_plans')
      .select('id, name, slug, credits_per_month, stripe_price_id, stripe_price_id_yearly, is_active')
      .order('sort_order', { ascending: true }),
    supabase
      .from('user_credits')
      .select(
        'user_id, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_plan_id, subscription_credits, current_period_end'
      )
      .or('stripe_customer_id.not.is.null,stripe_subscription_id.not.is.null'),
  ]);

  if (plansResponse.error) {
    throw plansResponse.error;
  }
  if (creditsResponse.error) {
    throw creditsResponse.error;
  }

  const plans = plansResponse.data || [];
  const rows = creditsResponse.data || [];
  const planLookup = buildPlanLookup(plans);

  if (planLookup.duplicates.length > 0) {
    throw new Error(
      `Duplicate Stripe price mappings detected: ${JSON.stringify(planLookup.duplicates, null, 2)}`
    );
  }

  const updated = [];
  const skipped = [];
  const errors = [];
  const orphanRecords = [];
  const nowIso = new Date().toISOString();

  for (const row of rows) {
    try {
      const result = await syncSingleRow({
        supabase,
        stripeSecretKey,
        row,
        planLookup,
        apply,
        nowIso,
      });

      if (result.type === 'updated') {
        updated.push(result.entry);
      } else {
        skipped.push(result.entry);
      }

      if (result.entry.issues.length > 0) {
        orphanRecords.push(result.entry);
      }
    } catch (error) {
      errors.push({
        user_id: row.user_id,
        stripe_customer_id: row.stripe_customer_id || null,
        stripe_subscription_id: row.stripe_subscription_id || null,
        error: error?.message || String(error),
        status: error?.status || null,
        payload: error?.payload || null,
      });
    }
  }

  const report = {
    mode: apply ? 'apply' : 'dry-run',
    dryRun,
    apply,
    scanned: rows.length,
    plan_count: plans.length,
    updated_count: updated.length,
    skipped_count: skipped.length,
    errors_count: errors.length,
    orphan_records_count: orphanRecords.length,
    updated,
    skipped,
    errors,
    orphan_records: orphanRecords,
  };

  console.log(JSON.stringify(report, null, 2));

  if (errors.length > 0) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error('[backfill-stripe-billing-state] fatal:', error?.message || error);
    process.exitCode = 1;
  });
}

export {
  buildCanonicalSubscriptionState,
  buildPlanLookup,
  buildPatch,
  normalizeStripeStatus,
  parseArgs,
  pickRecoveredSubscription,
  toIsoDate,
};
