import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const CREDIT_COSTS = {
  configuration: 2,
  send: 4,
  receive: 3,
};

const REAL_SCRADA_ENV_VARS = [
  'PEPPOL_TEST_SCRADA_COMPANY_ID',
  'PEPPOL_TEST_SCRADA_API_KEY',
  'PEPPOL_TEST_SCRADA_PASSWORD',
];

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return String(value).trim();
}

function optionalEnv(name) {
  const value = process.env[name];
  return value && String(value).trim() ? String(value).trim() : '';
}

function parseBool(value, fallback = false) {
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'yes', 'y', 'on'].includes(String(value).trim().toLowerCase());
}

function normalizeRpc(payload) {
  return Array.isArray(payload) ? payload[0] : payload;
}

function availableCredits(row) {
  return Number(row?.free_credits || 0)
    + Number(row?.subscription_credits || 0)
    + Number(row?.paid_credits || 0);
}

function snapshotCredits(row) {
  return {
    freeCredits: Number(row?.free_credits || 0),
    subscriptionCredits: Number(row?.subscription_credits || 0),
    paidCredits: Number(row?.paid_credits || 0),
    totalUsed: Number(row?.total_used || 0),
    availableCredits: availableCredits(row),
  };
}

function buildStep(status, details = {}) {
  return { status, ...details };
}

function buildEndpointDigits(seed) {
  const digits = String(seed || '').replace(/\D/g, '');
  return digits.slice(-10).padStart(10, '0');
}

function hasRealScradaEnv() {
  return REAL_SCRADA_ENV_VARS.every((name) => optionalEnv(name));
}

function assertNoPartialRealScradaEnv() {
  const defined = REAL_SCRADA_ENV_VARS.filter((name) => optionalEnv(name));
  if (defined.length > 0 && defined.length !== REAL_SCRADA_ENV_VARS.length) {
    throw new Error(
      `Provide all or none of ${REAL_SCRADA_ENV_VARS.join(', ')}.`,
    );
  }
}

function invalidJwtReason(response) {
  if (!response) return '';

  const message = String(
    response?.data?.message
    || response?.data?.error
    || response?.text
    || '',
  ).toLowerCase();

  return message.includes('invalid jwt') ? 'Edge Functions rejected the authenticated session token (Invalid JWT).' : '';
}

async function loadCredits(serviceClient, userId) {
  const { data, error } = await serviceClient
    .from('user_credits')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function writeCredits(serviceClient, userId, values) {
  const { error } = await serviceClient
    .from('user_credits')
    .update({
      ...values,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) {
    throw error;
  }
}

async function restoreCredits(serviceClient, userId, originalCredits) {
  await writeCredits(serviceClient, userId, {
    free_credits: originalCredits.free_credits,
    subscription_credits: originalCredits.subscription_credits,
    paid_credits: originalCredits.paid_credits,
    total_used: originalCredits.total_used,
    subscription_plan_id: originalCredits.subscription_plan_id,
    subscription_status: originalCredits.subscription_status,
    current_period_end: originalCredits.current_period_end,
    free_credits_refreshed_at: originalCredits.free_credits_refreshed_at,
  });
}

async function ensureCreditsBuffer(serviceClient, userId, minimumAvailable) {
  const current = await loadCredits(serviceClient, userId);
  const missing = Math.max(0, minimumAvailable - availableCredits(current));

  if (missing <= 0) {
    return current;
  }

  await writeCredits(serviceClient, userId, {
    paid_credits: Number(current.paid_credits || 0) + missing,
  });

  return loadCredits(serviceClient, userId);
}

async function loadCompany(serviceClient, userId) {
  const { data, error } = await serviceClient
    .from('company')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function updateCompany(serviceClient, companyId, patch) {
  const { error } = await serviceClient
    .from('company')
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq('id', companyId);

  if (error) {
    throw error;
  }
}

async function restoreCompany(serviceClient, originalCompany) {
  await updateCompany(serviceClient, originalCompany.id, {
    company_name: originalCompany.company_name,
    peppol_endpoint_id: originalCompany.peppol_endpoint_id,
    peppol_scheme_id: originalCompany.peppol_scheme_id,
    scrada_company_id: originalCompany.scrada_company_id,
    scrada_api_key: originalCompany.scrada_api_key,
    scrada_password: originalCompany.scrada_password,
    peppol_config_signature: originalCompany.peppol_config_signature ?? null,
    peppol_config_validated_at: originalCompany.peppol_config_validated_at ?? null,
  });
}

async function loadAccessOverride(serviceClient, normalizedEmail) {
  const { data, error } = await serviceClient
    .from('account_access_overrides')
    .select('*')
    .eq('normalized_email', normalizedEmail)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function authenticate(authClient, email, password) {
  const { data, error } = await authClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  if (!data.session?.access_token || !data.user?.id) {
    throw new Error(`Authentication succeeded without an active session for ${email}.`);
  }

  return data;
}

async function invokeFunction(supabaseUrl, authKey, functionName, options = {}) {
  const { session, body, rawBody, headers = {}, method = 'POST' } = options;
  const requestHeaders = {
    apikey: authKey,
    'x-client-info': 'smoke-peppol-usage-policy',
    ...headers,
  };

  if (session?.access_token) {
    requestHeaders.Authorization = `Bearer ${session.access_token}`;
  }

  let payload;
  if (rawBody !== undefined) {
    payload = rawBody;
  } else if (body !== undefined) {
    requestHeaders['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method,
    headers: requestHeaders,
    body: payload,
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
    text,
  };
}

async function createInvoiceArtifacts(serviceClient, userId, runId, registry) {
  const buyerEndpoint = buildEndpointDigits(`${runId}11`);
  const invoiceNumber = `SMOKE-${runId.toUpperCase()}`;

  const { data: client, error: clientError } = await serviceClient
    .from('clients')
    .insert({
      user_id: userId,
      company_name: `Smoke Peppol Buyer ${runId}`,
      email: `smoke+${runId}@cashpilot.test`,
      country: 'BE',
      peppol_endpoint_id: buyerEndpoint,
      peppol_scheme_id: '0208',
      electronic_invoicing_enabled: true,
    })
    .select('*')
    .single();

  if (clientError) {
    throw clientError;
  }

  registry.clientIds.push(client.id);

  const { data: invoice, error: invoiceError } = await serviceClient
    .from('invoices')
    .insert({
      user_id: userId,
      client_id: client.id,
      invoice_number: invoiceNumber,
      date: new Date().toISOString().slice(0, 10),
      due_date: new Date().toISOString().slice(0, 10),
      reference: `REF-${runId.toUpperCase()}`,
      status: 'sent',
      peppol_status: 'none',
      total_ht: 100,
      total_ttc: 121,
      tax_rate: 21,
    })
    .select('*')
    .single();

  if (invoiceError) {
    throw invoiceError;
  }

  registry.invoiceIds.push(invoice.id);

  const { data: item, error: itemError } = await serviceClient
    .from('invoice_items')
    .insert({
      invoice_id: invoice.id,
      description: `Smoke item ${runId}`,
      quantity: 1,
      unit_price: 100,
      total: 100,
    })
    .select('*')
    .single();

  if (itemError) {
    throw itemError;
  }

  registry.invoiceItemIds.push(item.id);

  return { client, invoice, item };
}

async function cleanupArtifacts(serviceClient, registry) {
  for (const documentId of registry.webhookDocumentIds) {
    await serviceClient
      .from('peppol_inbound_documents')
      .delete()
      .eq('scrada_document_id', documentId);

    await serviceClient
      .from('peppol_transmission_log')
      .delete()
      .eq('ap_document_id', documentId);
  }

  for (const invoiceId of registry.invoiceIds) {
    await serviceClient
      .from('peppol_transmission_log')
      .delete()
      .eq('invoice_id', invoiceId);
  }

  if (registry.invoiceItemIds.length > 0) {
    await serviceClient
      .from('invoice_items')
      .delete()
      .in('id', registry.invoiceItemIds);
  }

  if (registry.invoiceIds.length > 0) {
    await serviceClient
      .from('invoices')
      .delete()
      .in('id', registry.invoiceIds);
  }

  if (registry.clientIds.length > 0) {
    await serviceClient
      .from('clients')
      .delete()
      .in('id', registry.clientIds);
  }
}

async function cleanupRunTransactions(serviceClient, userId, runId) {
  await serviceClient
    .from('credit_transactions')
    .delete()
    .eq('user_id', userId)
    .ilike('description', `%${runId}%`);
}

async function loadInboundDocument(serviceClient, userId, documentId) {
  const { data, error } = await serviceClient
    .from('peppol_inbound_documents')
    .select('*')
    .eq('user_id', userId)
    .eq('scrada_document_id', documentId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function loadInvoice(serviceClient, invoiceId) {
  const { data, error } = await serviceClient
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function applyFakePeppolCompanyConfig(serviceClient, company, runId) {
  const fakeCompanyId = crypto.randomUUID();
  await updateCompany(serviceClient, company.id, {
    peppol_endpoint_id: company.peppol_endpoint_id || buildEndpointDigits(`${runId}99`),
    peppol_scheme_id: company.peppol_scheme_id || '0208',
    scrada_company_id: fakeCompanyId,
    scrada_api_key: `fake-api-${runId}`,
    scrada_password: `fake-password-${runId}`,
  });

  return fakeCompanyId;
}

function resolveRealConfig(company, runId) {
  const endpointId = optionalEnv('PEPPOL_TEST_PEPPOL_ENDPOINT_ID')
    || company.peppol_endpoint_id
    || '';
  const schemeId = optionalEnv('PEPPOL_TEST_PEPPOL_SCHEME_ID')
    || company.peppol_scheme_id
    || '0208';

  if (!endpointId) {
    return null;
  }

  return {
    company_name: `${company.company_name || 'Smoke Peppol'} ${runId}`,
    peppol_endpoint_id: endpointId,
    peppol_scheme_id: schemeId,
    scrada_company_id: requireEnv('PEPPOL_TEST_SCRADA_COMPANY_ID'),
    scrada_api_key: requireEnv('PEPPOL_TEST_SCRADA_API_KEY'),
    scrada_password: requireEnv('PEPPOL_TEST_SCRADA_PASSWORD'),
    peppol_config_signature: null,
    peppol_config_validated_at: null,
  };
}

async function runEdgeAuthStep(context) {
  const response = await invokeFunction(context.supabaseUrl, context.authKey, 'peppol-account-info', {
    session: context.session,
  });

  if (response.ok) {
    return buildStep('passed');
  }

  const invalidJwt = invalidJwtReason(response);
  if (invalidJwt) {
    return buildStep('failed', {
      code: 'invalid_jwt',
      httpStatus: response.status,
      reason: invalidJwt,
      response: response.data || response.text,
    });
  }

  return buildStep('failed', {
    httpStatus: response.status,
    response: response.data || response.text,
  });
}

async function runConfigurationValidationStep(context) {
  if (context.edgeAuthBlocked) {
    return buildStep('skipped', {
      reason: context.edgeAuthBlocked,
    });
  }

  if (!context.realScradaEnabled) {
    return buildStep('skipped', {
      reason: `Missing ${REAL_SCRADA_ENV_VARS.join(', ')}`,
    });
  }

  const realConfig = resolveRealConfig(context.originalCompany, context.runId);
  if (!realConfig) {
    return buildStep('skipped', {
      reason: 'No Peppol endpoint is available for live Scrada validation.',
    });
  }

  await updateCompany(context.serviceClient, context.originalCompany.id, realConfig);

  const beforeCredits = await loadCredits(context.serviceClient, context.userId);
  const response = await invokeFunction(context.supabaseUrl, context.authKey, 'peppol-configure', {
    session: context.session,
  });
  const afterCredits = await loadCredits(context.serviceClient, context.userId);

  if (!response.ok || !response.data?.success) {
    return buildStep('failed', {
      httpStatus: response.status,
      response: response.data || response.text,
    });
  }

  const delta = snapshotCredits(beforeCredits).availableCredits - snapshotCredits(afterCredits).availableCredits;
  const expectedDelta = context.metered ? CREDIT_COSTS.configuration : 0;

  if (delta !== expectedDelta) {
    return buildStep('failed', {
      message: `Unexpected credit delta for configuration validation: expected ${expectedDelta}, received ${delta}.`,
      beforeCredits: snapshotCredits(beforeCredits),
      afterCredits: snapshotCredits(afterCredits),
      response: response.data,
    });
  }

  return buildStep('passed', {
    charged: Boolean(response.data?.charged),
    alreadyValidated: Boolean(response.data?.alreadyValidated),
    beforeCredits: snapshotCredits(beforeCredits),
    afterCredits: snapshotCredits(afterCredits),
  });
}

async function runSyncInboundStep(context) {
  if (context.edgeAuthBlocked) {
    return buildStep('skipped', {
      reason: context.edgeAuthBlocked,
    });
  }

  if (!context.realScradaEnabled) {
    return buildStep('skipped', {
      reason: `Missing ${REAL_SCRADA_ENV_VARS.join(', ')}`,
    });
  }

  const realConfig = resolveRealConfig(context.originalCompany, `${context.runId}-sync`);
  if (!realConfig) {
    return buildStep('skipped', {
      reason: 'No Peppol endpoint is available for live inbound sync.',
    });
  }

  await updateCompany(context.serviceClient, context.originalCompany.id, realConfig);

  const beforeCredits = await loadCredits(context.serviceClient, context.userId);

  const response = await invokeFunction(context.supabaseUrl, context.authKey, 'peppol-inbound', {
    session: context.session,
    body: { action: 'sync' },
  });
  const afterCredits = await loadCredits(context.serviceClient, context.userId);

  if (!response.ok) {
    return buildStep('failed', {
      httpStatus: response.status,
      response: response.data || response.text,
    });
  }

  const expectedDelta = context.metered
    ? Number(response.data?.requiredCredits || 0)
    : 0;
  const delta = snapshotCredits(beforeCredits).availableCredits - snapshotCredits(afterCredits).availableCredits;

  if (delta !== expectedDelta) {
    return buildStep('failed', {
      message: `Unexpected inbound sync credit delta: expected ${expectedDelta}, received ${delta}.`,
      beforeCredits: snapshotCredits(beforeCredits),
      afterCredits: snapshotCredits(afterCredits),
      response: response.data || response.text,
    });
  }

  return buildStep('passed', {
    totalFromScrada: Number(response.data?.totalFromScrada || 0),
    newDocuments: Number(response.data?.newDocuments || 0),
    requiredCredits: Number(response.data?.requiredCredits || 0),
    beforeCredits: snapshotCredits(beforeCredits),
    afterCredits: snapshotCredits(afterCredits),
  });
}

async function runSendFailureRefundStep(context) {
  if (context.edgeAuthBlocked) {
    return buildStep('skipped', {
      reason: context.edgeAuthBlocked,
    });
  }

  const companyIdForWebhook = await applyFakePeppolCompanyConfig(
    context.serviceClient,
    context.originalCompany,
    `${context.runId}-send`,
  );
  const artifacts = await createInvoiceArtifacts(
    context.serviceClient,
    context.userId,
    `${context.runId}-send`,
    context.registry,
  );

  const beforeCredits = await loadCredits(context.serviceClient, context.userId);
  const response = await invokeFunction(context.supabaseUrl, context.authKey, 'peppol-send', {
    session: context.session,
    body: { invoice_id: artifacts.invoice.id },
  });
  const afterCredits = await loadCredits(context.serviceClient, context.userId);
  const invoiceAfter = await loadInvoice(context.serviceClient, artifacts.invoice.id);

  if (response.ok) {
    return buildStep('failed', {
      message: 'peppol-send unexpectedly succeeded with fake Scrada credentials.',
      httpStatus: response.status,
      response: response.data || response.text,
      companyIdForWebhook,
    });
  }

  const delta = snapshotCredits(beforeCredits).availableCredits - snapshotCredits(afterCredits).availableCredits;
  if (delta !== 0) {
    return buildStep('failed', {
      message: `Refund path changed the credit balance by ${delta} instead of 0.`,
      beforeCredits: snapshotCredits(beforeCredits),
      afterCredits: snapshotCredits(afterCredits),
      httpStatus: response.status,
      response: response.data || response.text,
      invoiceStatus: invoiceAfter?.peppol_status || null,
    });
  }

  return buildStep('passed', {
    httpStatus: response.status,
    response: response.data || response.text,
    invoiceStatus: invoiceAfter?.peppol_status || null,
    beforeCredits: snapshotCredits(beforeCredits),
    afterCredits: snapshotCredits(afterCredits),
  });
}

async function runReceiveWebhookStep(context) {
  if (context.edgeAuthBlocked) {
    return buildStep('skipped', {
      reason: context.edgeAuthBlocked,
    });
  }

  const scradaCompanyId = await applyFakePeppolCompanyConfig(
    context.serviceClient,
    context.originalCompany,
    `${context.runId}-webhook`,
  );
  const documentId = `smoke-webhook-${context.runId}`;
  context.registry.webhookDocumentIds.push(documentId);

  const beforeCredits = await loadCredits(context.serviceClient, context.userId);
  const response = await invokeFunction(context.supabaseUrl, context.authKey, 'peppol-webhook', {
    method: 'POST',
    session: context.session,
    headers: {
      'Content-Type': 'application/xml',
      'x-scrada-topic': 'peppolInboundDocument/new',
      'x-scrada-company-id': scradaCompanyId,
      'x-scrada-event-id': `event-${context.runId}`,
      'x-scrada-document-id': documentId,
      'x-scrada-peppol-sender-id': '0208:0123456789',
    },
    rawBody: `<?xml version="1.0" encoding="UTF-8"?><Invoice><cbc:ID>${documentId}</cbc:ID></Invoice>`,
  });
  const afterCredits = await loadCredits(context.serviceClient, context.userId);
  const inboundDocument = await loadInboundDocument(context.serviceClient, context.userId, documentId);

  if (!response.ok || !inboundDocument) {
    return buildStep('failed', {
      httpStatus: response.status,
      response: response.data || response.text,
      insertedDocument: Boolean(inboundDocument),
    });
  }

  const delta = snapshotCredits(beforeCredits).availableCredits - snapshotCredits(afterCredits).availableCredits;
  const expectedDelta = context.metered ? CREDIT_COSTS.receive : 0;
  if (delta !== expectedDelta) {
    return buildStep('failed', {
      message: `Unexpected receive credit delta: expected ${expectedDelta}, received ${delta}.`,
      beforeCredits: snapshotCredits(beforeCredits),
      afterCredits: snapshotCredits(afterCredits),
      response: response.data || response.text,
    });
  }

  return buildStep('passed', {
    httpStatus: response.status,
    response: response.data || response.text,
    beforeCredits: snapshotCredits(beforeCredits),
    afterCredits: snapshotCredits(afterCredits),
  });
}

async function runSendInsufficientCreditsStep(context, baselineCredits) {
  if (context.edgeAuthBlocked) {
    return buildStep('skipped', {
      reason: context.edgeAuthBlocked,
    });
  }

  if (!context.metered) {
    return buildStep('skipped', {
      reason: 'Account has full-access override or active trial.',
    });
  }

  await applyFakePeppolCompanyConfig(
    context.serviceClient,
    context.originalCompany,
    `${context.runId}-send-zero`,
  );
  const artifacts = await createInvoiceArtifacts(
    context.serviceClient,
    context.userId,
    `${context.runId}-send-zero`,
    context.registry,
  );

  await writeCredits(context.serviceClient, context.userId, {
    free_credits: 0,
    subscription_credits: 0,
    paid_credits: 0,
  });

  const response = await invokeFunction(context.supabaseUrl, context.authKey, 'peppol-send', {
    session: context.session,
    body: { invoice_id: artifacts.invoice.id },
  });
  const afterCredits = await loadCredits(context.serviceClient, context.userId);
  await writeCredits(context.serviceClient, context.userId, {
    free_credits: baselineCredits.free_credits,
    subscription_credits: baselineCredits.subscription_credits,
    paid_credits: baselineCredits.paid_credits,
    total_used: baselineCredits.total_used,
  });

  const insufficient =
    response.status === 402
    || response.data?.error === 'insufficient_credits'
    || response.data?.insufficientCredits === true;

  if (!insufficient) {
    return buildStep('failed', {
      httpStatus: response.status,
      response: response.data || response.text,
      afterCredits: snapshotCredits(afterCredits),
    });
  }

  return buildStep('passed', {
    httpStatus: response.status,
    response: response.data || response.text,
    afterCredits: snapshotCredits(afterCredits),
  });
}

async function runReceiveInsufficientCreditsStep(context, baselineCredits) {
  if (context.edgeAuthBlocked) {
    return buildStep('skipped', {
      reason: context.edgeAuthBlocked,
    });
  }

  if (!context.metered) {
    return buildStep('skipped', {
      reason: 'Account has full-access override or active trial.',
    });
  }

  const scradaCompanyId = await applyFakePeppolCompanyConfig(
    context.serviceClient,
    context.originalCompany,
    `${context.runId}-webhook-zero`,
  );
  const documentId = `smoke-webhook-zero-${context.runId}`;
  context.registry.webhookDocumentIds.push(documentId);

  await writeCredits(context.serviceClient, context.userId, {
    free_credits: 0,
    subscription_credits: 0,
    paid_credits: 0,
  });

  const response = await invokeFunction(context.supabaseUrl, context.authKey, 'peppol-webhook', {
    method: 'POST',
    session: context.session,
    headers: {
      'Content-Type': 'application/xml',
      'x-scrada-topic': 'peppolInboundDocument/new',
      'x-scrada-company-id': scradaCompanyId,
      'x-scrada-event-id': `event-zero-${context.runId}`,
      'x-scrada-document-id': documentId,
      'x-scrada-peppol-sender-id': '0208:0123456789',
    },
    rawBody: `<?xml version="1.0" encoding="UTF-8"?><Invoice><cbc:ID>${documentId}</cbc:ID></Invoice>`,
  });
  const inboundDocument = await loadInboundDocument(context.serviceClient, context.userId, documentId);
  const afterCredits = await loadCredits(context.serviceClient, context.userId);
  await writeCredits(context.serviceClient, context.userId, {
    free_credits: baselineCredits.free_credits,
    subscription_credits: baselineCredits.subscription_credits,
    paid_credits: baselineCredits.paid_credits,
    total_used: baselineCredits.total_used,
  });

  const insufficient =
    response.status === 402
    || response.data?.error === 'insufficient_credits'
    || response.data?.insufficientCredits === true;

  if (!insufficient || inboundDocument) {
    return buildStep('failed', {
      httpStatus: response.status,
      response: response.data || response.text,
      insertedDocument: Boolean(inboundDocument),
      afterCredits: snapshotCredits(afterCredits),
    });
  }

  return buildStep('passed', {
    httpStatus: response.status,
    response: response.data || response.text,
    afterCredits: snapshotCredits(afterCredits),
  });
}

async function main() {
  assertNoPartialRealScradaEnv();

  const supabaseUrl = requireEnv('SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const authKey = optionalEnv('SUPABASE_ANON_KEY') || serviceRoleKey;
  const email = requireEnv('PEPPOL_TEST_EMAIL');
  const password = requireEnv('PEPPOL_TEST_PASSWORD');
  const allowSkips = parseBool(optionalEnv('PEPPOL_TEST_ALLOW_SKIPS'), true);
  const realScradaEnabled = hasRealScradaEnv();
  const runId = crypto.randomBytes(6).toString('hex');
  const registry = {
    invoiceIds: [],
    invoiceItemIds: [],
    clientIds: [],
    webhookDocumentIds: [],
  };

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const authClient = createClient(supabaseUrl, authKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let authData = null;
  let originalCompany = null;
  let originalCredits = null;
  let report = null;

  try {
    authData = await authenticate(authClient, email, password);

    const session = authData.session;
    const userId = authData.user.id;
    originalCompany = await loadCompany(serviceClient, userId);
    originalCredits = await loadCredits(serviceClient, userId);
    const overrideRecord = await loadAccessOverride(
      serviceClient,
      String(authData.user.email || '').trim().toLowerCase(),
    );
    const userCreatedAt = authData.user.created_at
      ? new Date(authData.user.created_at)
      : null;
    const trialEndsAt = userCreatedAt
      ? new Date(userCreatedAt.getTime() + (3 * 24 * 60 * 60 * 1000))
      : null;
    const trialActive = Boolean(trialEndsAt && trialEndsAt.getTime() > Date.now());
    const fullAccessOverride = Boolean(overrideRecord);
    const metered = !fullAccessOverride && !trialActive;

    if (metered) {
      await ensureCreditsBuffer(
        serviceClient,
        userId,
        CREDIT_COSTS.configuration + CREDIT_COSTS.send + CREDIT_COSTS.receive + 3,
      );
    }

    const context = {
      authKey,
      edgeAuthBlocked: null,
      supabaseUrl,
      serviceClient,
      session,
      userId,
      originalCompany,
      originalCredits,
      registry,
      runId,
      metered,
      realScradaEnabled,
    };

    report = {
      projectUrl: supabaseUrl,
      email,
      userId,
      runId,
      allowSkips,
      realScradaEnabled,
      billingMode: metered ? 'metered' : 'override_or_trial',
      entitlements: {
        planSlug: null,
        planName: null,
        trialActive,
        trialEndsAt: trialEndsAt ? trialEndsAt.toISOString() : null,
        fullAccessOverride,
        accessMode: overrideRecord?.access_mode || null,
        accessLabel: overrideRecord?.access_label || null,
      },
      steps: {},
    };

    report.steps.authentication = buildStep('passed', {
      companyId: originalCompany.id,
      companyName: originalCompany.company_name || null,
      peppolEndpointId: originalCompany.peppol_endpoint_id || null,
      initialCredits: snapshotCredits(originalCredits),
    });

    report.steps.edgeAuth = await runEdgeAuthStep(context);
    if (report.steps.edgeAuth.status === 'failed' && report.steps.edgeAuth.code === 'invalid_jwt') {
      context.edgeAuthBlocked = report.steps.edgeAuth.reason;
    }

    report.steps.configurationValidation = await runConfigurationValidationStep(context);
    report.steps.syncInbound = await runSyncInboundStep(context);
    report.steps.sendFailureRefund = await runSendFailureRefundStep(context);
    report.steps.receiveWebhook = await runReceiveWebhookStep(context);

    const workingCredits = await loadCredits(serviceClient, userId);
    report.steps.sendInsufficientCredits = await runSendInsufficientCreditsStep(context, workingCredits);
    report.steps.receiveInsufficientCredits = await runReceiveInsufficientCreditsStep(context, workingCredits);

    const stepResults = Object.values(report.steps);
    const failedSteps = Object.entries(report.steps)
      .filter(([, step]) => step.status === 'failed')
      .map(([name]) => name);
    const skippedSteps = Object.entries(report.steps)
      .filter(([, step]) => step.status === 'skipped')
      .map(([name]) => name);

    report.passed = failedSteps.length === 0 && (allowSkips || skippedSteps.length === 0);
    report.failedSteps = failedSteps;
    report.skippedSteps = skippedSteps;
    report.summary = {
      passed: stepResults.filter((step) => step.status === 'passed').length,
      failed: failedSteps.length,
      skipped: skippedSteps.length,
    };

    console.log(JSON.stringify(report, null, 2));

    if (!report.passed) {
      process.exitCode = 1;
    }
  } finally {
    const cleanupErrors = [];

    if (authData?.user?.id && originalCredits) {
      try {
        await restoreCredits(serviceClient, authData.user.id, originalCredits);
        await cleanupRunTransactions(serviceClient, authData.user.id, runId);
      } catch (error) {
        cleanupErrors.push(`credits: ${error.message}`);
      }
    }

    if (originalCompany) {
      try {
        await restoreCompany(serviceClient, originalCompany);
      } catch (error) {
        cleanupErrors.push(`company: ${error.message}`);
      }
    }

    try {
      await cleanupArtifacts(serviceClient, registry);
    } catch (error) {
      cleanupErrors.push(`artifacts: ${error.message}`);
    }

    if (authData) {
      try {
        await authClient.auth.signOut();
      } catch (error) {
        cleanupErrors.push(`signOut: ${error.message}`);
      }
    }

    if (cleanupErrors.length > 0) {
      console.error(JSON.stringify({ cleanupErrors }, null, 2));
      process.exitCode = 1;
    }
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    passed: false,
    error: error.message,
  }, null, 2));
  process.exit(1);
});
