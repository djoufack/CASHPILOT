import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { createHash, randomUUID } from 'node:crypto';

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
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

function buildClient(url, key) {
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function isoDate(offsetDays = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function isoMonthStart() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

function assert(condition, message, details = null) {
  if (condition) return;
  const error = new Error(message);
  if (details != null) {
    error.details = details;
  }
  throw error;
}

function shortId() {
  return randomUUID().split('-')[0];
}

function makeKeyHash(rawKey) {
  return createHash('sha256').update(rawKey, 'utf8').digest('hex');
}

async function getUserByEmail(serviceClient, email) {
  let page = 1;
  while (page <= 20) {
    const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = (data?.users || []).find((u) => String(u.email || '').toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (!data?.users?.length) break;
    page += 1;
  }
  return null;
}

function toolTextFromRpcBody(rpcBody) {
  const chunks = rpcBody?.result?.content || [];
  if (!Array.isArray(chunks)) return '';
  return chunks
    .map((entry) => (entry?.type === 'text' ? String(entry.text || '') : ''))
    .join('\n')
    .trim();
}

function parseJsonMaybe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function callMcp({ supabaseUrl, anonKey, serviceRoleKey, rawApiKey, toolName, args }) {
  const response = await fetch(`${supabaseUrl}/functions/v1/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${serviceRoleKey}`, 
      'x-api-key': rawApiKey,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args || {},
      },
    }),
  });

  const rpcBody = await response.json();
  const text = toolTextFromRpcBody(rpcBody);
  const payload = parseJsonMaybe(text);
  const rpcError = Boolean(rpcBody?.result?.isError);

  return {
    ok: response.ok && !rpcError,
    status: response.status,
    rpcBody,
    text,
    payload,
  };
}

async function getTargetCompany(authClient, userId) {
  const [prefsRes, companiesRes] = await Promise.all([
    authClient
      .from('user_company_preferences')
      .select('active_company_id')
      .eq('user_id', userId)
      .maybeSingle(),
    authClient
      .from('company')
      .select('id, company_name, country, currency, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
  ]);

  if (prefsRes.error) throw prefsRes.error;
  if (companiesRes.error) throw companiesRes.error;

  const companies = companiesRes.data || [];
  assert(companies.length > 0, `No company found for user ${userId}`);

  const active = prefsRes.data?.active_company_id || null;
  return (
    companies.find((c) => c.id === active) ||
    companies.find((c) => /Portfolio/i.test(String(c.company_name || ''))) ||
    companies[0]
  );
}

async function runAccountFlow({
  supabaseUrl,
  anonKey,
  serviceRoleKey,
  serviceClient,
  account,
  runId,
}) {
  const summary = {
    key: account.key,
    email: account.email,
    passed: false,
    company: null,
    created: {},
    checks: {},
    failures: [],
  };

  const cleanup = {
    apiKeyId: null,
    bankConnectionId: null,
    bankTransactionId: null,
    paymentIds: [],
    invoiceItemIds: [],
    invoiceIds: [],
    clientId: null,
  };

  let authClient = null;
  let userId = null;
  let sessionToken = null;

  try {
    const signInClient = buildClient(supabaseUrl, anonKey);
    const { data: signInData, error: signInError } = await signInClient.auth.signInWithPassword({
      email: account.email,
      password: account.password,
    });
    if (signInError) throw signInError;

    authClient = signInClient;
    userId = signInData?.user?.id || null;
    sessionToken = signInData?.session?.access_token || null;
    assert(userId, 'Sign-in succeeded but user id is missing');
    assert(sessionToken, 'Sign-in succeeded but session token is missing');

    const company = await getTargetCompany(authClient, userId);
    summary.company = {
      id: company.id,
      name: company.company_name,
      country: company.country,
      currency: company.currency,
    };

    const smokeClientName = `Smoke Advanced ${account.key} ${runId}`;
    const { data: createdClient, error: clientError } = await authClient
      .from('clients')
      .insert({
        user_id: userId,
        company_id: company.id,
        company_name: smokeClientName,
        email: `smoke.advanced.${account.key.toLowerCase()}.${runId}@cashpilot.test`,
        country: company.country || 'FR',
        city: 'Brussels',
      })
      .select('id, company_name')
      .single();
    if (clientError) throw clientError;
    cleanup.clientId = createdClient.id;
    summary.created.clientId = createdClient.id;

    const invoiceNumberPaid = `ADV-${account.key}-PAY-${runId.toUpperCase()}`;
    const invoiceNumberRecon = `ADV-${account.key}-REC-${runId.toUpperCase()}`;
    const paidTotalHt = 100;
    const paidTotalTtc = Number((paidTotalHt * (1 + (Number(account.vatRate) / 100))).toFixed(2));
    const reconTotalHt = 200;
    const reconTotalTtc = Number((reconTotalHt * (1 + (Number(account.vatRate) / 100))).toFixed(2));

    const { data: invoicePaid, error: invoicePaidError } = await authClient
      .from('invoices')
      .insert({
        user_id: userId,
        company_id: company.id,
        client_id: createdClient.id,
        invoice_number: invoiceNumberPaid,
        date: isoDate(0),
        due_date: isoDate(15),
        status: 'sent',
        total_ht: paidTotalHt,
        tax_rate: account.vatRate,
        total_ttc: paidTotalTtc,
        balance_due: paidTotalTtc,
        payment_status: 'unpaid',
        notes: `Advanced smoke payment ${runId}`,
      })
      .select('id, invoice_number, payment_status, total_ttc, tax_rate')
      .single();
    if (invoicePaidError) throw invoicePaidError;
    cleanup.invoiceIds.push(invoicePaid.id);

    const { data: invoicePaidItem, error: invoicePaidItemError } = await authClient
      .from('invoice_items')
      .insert({
        invoice_id: invoicePaid.id,
        description: `Service advanced payment ${account.key}`,
        quantity: 1,
        unit_price: paidTotalHt,
        total: paidTotalHt,
      })
      .select('id')
      .single();
    if (invoicePaidItemError) throw invoicePaidItemError;
    cleanup.invoiceItemIds.push(invoicePaidItem.id);

    const { data: invoiceRecon, error: invoiceReconError } = await authClient
      .from('invoices')
      .insert({
        user_id: userId,
        company_id: company.id,
        client_id: createdClient.id,
        invoice_number: invoiceNumberRecon,
        date: isoDate(0),
        due_date: isoDate(20),
        status: 'sent',
        total_ht: reconTotalHt,
        tax_rate: account.vatRate,
        total_ttc: reconTotalTtc,
        balance_due: reconTotalTtc,
        payment_status: 'unpaid',
        notes: `Advanced smoke reconciliation ${runId}`,
      })
      .select('id, invoice_number, payment_status, total_ttc')
      .single();
    if (invoiceReconError) throw invoiceReconError;
    cleanup.invoiceIds.push(invoiceRecon.id);

    const { data: invoiceReconItem, error: invoiceReconItemError } = await authClient
      .from('invoice_items')
      .insert({
        invoice_id: invoiceRecon.id,
        description: `Service advanced reconciliation ${account.key}`,
        quantity: 1,
        unit_price: reconTotalHt,
        total: reconTotalHt,
      })
      .select('id')
      .single();
    if (invoiceReconItemError) throw invoiceReconItemError;
    cleanup.invoiceItemIds.push(invoiceReconItem.id);

    const rawApiKey = `cp_adv_${randomUUID().replace(/-/g, '')}`;
    const keyHash = makeKeyHash(rawApiKey);
    const keyPrefix = rawApiKey.slice(0, 8);

    const { data: apiKeyRow, error: apiKeyError } = await serviceClient
      .from('api_keys')
      .insert({
        user_id: userId,
        name: `advanced-demo-smoke-${account.key}`,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        scopes: ['read', 'write'],
        is_active: true,
      })
      .select('id')
      .single();
    if (apiKeyError) throw apiKeyError;
    cleanup.apiKeyId = apiKeyRow.id;

    const createPayment = await callMcp({
      supabaseUrl,
      anonKey,
      serviceRoleKey,
      rawApiKey,
      toolName: 'create_payment',
      args: { invoice_id: invoicePaid.id, amount: paidTotalTtc, payment_method: 'bank_transfer', payment_date: isoDate(0) },
    });
    assert(createPayment.ok, 'MCP create_payment failed', {
      status: createPayment.status,
      text: createPayment.text,
      body: createPayment.rpcBody,
    });
    const paymentPayload = createPayment.payload;
    assert(paymentPayload?.created === true, 'MCP create_payment did not confirm creation', paymentPayload);
    if (paymentPayload?.payment?.id) {
      cleanup.paymentIds.push(paymentPayload.payment.id);
    }

    const { data: paidInvoiceAfter, error: paidInvoiceAfterError } = await serviceClient
      .from('invoices')
      .select('id, payment_status, status, balance_due')
      .eq('id', invoicePaid.id)
      .single();
    if (paidInvoiceAfterError) throw paidInvoiceAfterError;
    assert(
      paidInvoiceAfter.payment_status === 'paid' || paidInvoiceAfter.status === 'paid',
      'Invoice should be paid after MCP create_payment',
      paidInvoiceAfter,
    );
    summary.checks.payment = {
      ok: true,
      invoiceId: invoicePaid.id,
      invoicePaymentStatus: paidInvoiceAfter.payment_status,
      invoiceStatus: paidInvoiceAfter.status,
    };

    const { data: bankConnection, error: bankConnectionError } = await serviceClient
      .from('bank_connections')
      .insert({
        user_id: userId,
        institution_id: `adv-${account.key.toLowerCase()}-${shortId()}`,
        institution_name: `Advanced Demo Bank ${account.key}`,
        account_name: `ADV-${account.key}-MAIN`,
        account_currency: company.currency || 'EUR',
        status: 'active',
      })
      .select('id')
      .single();
    if (bankConnectionError) throw bankConnectionError;
    cleanup.bankConnectionId = bankConnection.id;

    const { data: bankTx, error: bankTxError } = await serviceClient
      .from('bank_transactions')
      .insert({
        user_id: userId,
        bank_connection_id: bankConnection.id,
        amount: reconTotalTtc,
        date: isoDate(0),
        currency: company.currency || 'EUR',
        reference: invoiceNumberRecon,
        description: `Virement client ${invoiceNumberRecon}`,
        reconciliation_status: 'unreconciled',
      })
      .select('id, invoice_id, reconciliation_status')
      .single();
    if (bankTxError) throw bankTxError;
    cleanup.bankTransactionId = bankTx.id;

    const reconcileResp = await fetch(`${supabaseUrl}/functions/v1/auto-reconcile`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ threshold: 0.8 }),
    });
    const reconcileBodyText = await reconcileResp.text();
    const reconcileBody = parseJsonMaybe(reconcileBodyText) || { raw: reconcileBodyText };
    assert(reconcileResp.ok, `auto-reconcile failed with status ${reconcileResp.status}`, reconcileBody);
    assert(reconcileBody.success === true, 'auto-reconcile did not return success', reconcileBody);
    assert(Number(reconcileBody.matched || 0) >= 1, 'auto-reconcile did not match any transaction', reconcileBody);

    const { data: bankTxAfter, error: bankTxAfterError } = await serviceClient
      .from('bank_transactions')
      .select('id, invoice_id, reconciliation_status, match_confidence')
      .eq('id', bankTx.id)
      .single();
    if (bankTxAfterError) throw bankTxAfterError;
    assert(bankTxAfter.reconciliation_status === 'matched', 'Bank transaction should be matched after auto-reconcile', bankTxAfter);
    assert(bankTxAfter.invoice_id === invoiceRecon.id, 'Bank transaction should be linked to the reconciliation invoice', bankTxAfter);

    const { data: invoiceReconAfter, error: invoiceReconAfterError } = await serviceClient
      .from('invoices')
      .select('id, status, payment_status')
      .eq('id', invoiceRecon.id)
      .single();
    if (invoiceReconAfterError) throw invoiceReconAfterError;
    assert(invoiceReconAfter.status === 'paid', 'Reconciled invoice status should be paid', invoiceReconAfter);

    summary.checks.reconciliation = {
      ok: true,
      matched: Number(reconcileBody.matched || 0),
      transactionStatus: bankTxAfter.reconciliation_status,
      linkedInvoiceId: bankTxAfter.invoice_id,
      invoiceStatus: invoiceReconAfter.status,
      invoicePaymentStatus: invoiceReconAfter.payment_status,
    };

    const taxSummary = await callMcp({
      supabaseUrl,
      anonKey,
      serviceRoleKey,
      rawApiKey,
      toolName: 'get_tax_summary',
      args: { start_date: isoMonthStart(), end_date: isoDate(0) },
    });
    assert(taxSummary.ok, 'MCP get_tax_summary failed', { status: taxSummary.status, text: taxSummary.text });
    assert(typeof taxSummary.payload?.output_vat === 'number', 'MCP get_tax_summary missing numeric output_vat', taxSummary.payload);
    summary.checks.tax = {
      ok: true,
      period: taxSummary.payload?.period || null,
      outputVat: taxSummary.payload?.output_vat,
      vatPayable: taxSummary.payload?.vat_payable,
    };

    const fec = await callMcp({
      supabaseUrl,
      anonKey,
      serviceRoleKey,
      rawApiKey,
      toolName: 'export_fec',
      args: { start_date: isoMonthStart(), end_date: isoDate(0) },
    });
    assert(fec.ok, 'MCP export_fec failed', { status: fec.status, text: fec.text });
    assert(/JournalCode\|JournalLib\|EcritureNum/.test(fec.text), 'FEC export missing expected header', fec.text.slice(0, 500));

    const saft = await callMcp({
      supabaseUrl,
      anonKey,
      serviceRoleKey,
      rawApiKey,
      toolName: 'export_saft',
      args: { start_date: isoMonthStart(), end_date: isoDate(0) },
    });
    assert(saft.ok, 'MCP export_saft failed', { status: saft.status, text: saft.text });
    assert(saft.text.includes('<AuditFile'), 'SAF-T export missing <AuditFile root', saft.text.slice(0, 500));

    const facturx = await callMcp({
      supabaseUrl,
      anonKey,
      serviceRoleKey,
      rawApiKey,
      toolName: 'export_facturx',
      args: { invoice_id: invoicePaid.id, profile: 'BASIC' },
    });
    assert(facturx.ok, 'MCP export_facturx failed', { status: facturx.status, text: facturx.text });
    assert(facturx.text.includes('<rsm:CrossIndustryInvoice'), 'Factur-X export missing XML root', facturx.text.slice(0, 500));
    assert(facturx.text.includes(invoiceNumberPaid), 'Factur-X export missing target invoice number', facturx.text.slice(0, 800));

    const backup = await callMcp({
      supabaseUrl,
      anonKey,
      serviceRoleKey,
      rawApiKey,
      toolName: 'backup_all_data',
      args: {},
    });
    assert(backup.ok, 'MCP backup_all_data failed', { status: backup.status, text: backup.text });
    assert(backup.payload?.stats?.invoices >= 1, 'Backup export missing invoice stats', backup.payload);
    assert(backup.payload?.stats?.payments >= 1, 'Backup export missing payment stats', backup.payload);

    summary.checks.exports = {
      ok: true,
      fecHeaderPresent: true,
      saftRootPresent: true,
      facturxRootPresent: true,
      backupInvoices: backup.payload?.stats?.invoices ?? null,
      backupPayments: backup.payload?.stats?.payments ?? null,
    };

    summary.passed = true;
  } catch (error) {
    summary.passed = false;
    summary.failures.push({
      message: error?.message || String(error),
      details: error?.details || null,
    });
  } finally {
    try {
      if (cleanup.apiKeyId) {
        await serviceClient.from('api_keys').delete().eq('id', cleanup.apiKeyId);
      }
      if (cleanup.bankTransactionId) {
        await serviceClient.from('bank_transactions').delete().eq('id', cleanup.bankTransactionId);
      }
      if (cleanup.bankConnectionId) {
        await serviceClient.from('bank_connections').delete().eq('id', cleanup.bankConnectionId);
      }
      if (cleanup.paymentIds.length > 0) {
        await serviceClient.from('payments').delete().in('id', cleanup.paymentIds);
      }
      if (cleanup.invoiceItemIds.length > 0) {
        await serviceClient.from('invoice_items').delete().in('id', cleanup.invoiceItemIds);
      }
      if (cleanup.invoiceIds.length > 0) {
        await serviceClient.from('invoices').delete().in('id', cleanup.invoiceIds);
      }
      if (cleanup.clientId) {
        await serviceClient.from('clients').delete().eq('id', cleanup.clientId);
      }
    } catch (cleanupError) {
      summary.failures.push({
        message: `cleanup_failed: ${cleanupError?.message || String(cleanupError)}`,
        details: null,
      });
      summary.passed = false;
    }

    if (authClient) {
      await authClient.auth.signOut();
    }
  }

  return summary;
}

async function main() {
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const anonKey = requireEnv('SUPABASE_ANON_KEY');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  const accounts = [
    {
      key: 'FR',
      email: optionalEnv('PILOTAGE_FR_EMAIL', 'pilotage.fr.demo@cashpilot.cloud'),
      password: requireEnv('PILOTAGE_FR_PASSWORD'),
      vatRate: Number(optionalEnv('PILOTAGE_FR_VAT_RATE', '20')),
    },
    {
      key: 'BE',
      email: optionalEnv('PILOTAGE_BE_EMAIL', 'pilotage.be.demo@cashpilot.cloud'),
      password: requireEnv('PILOTAGE_BE_PASSWORD'),
      vatRate: Number(optionalEnv('PILOTAGE_BE_VAT_RATE', '21')),
    },
    {
      key: 'OHADA',
      email: optionalEnv('PILOTAGE_OHADA_EMAIL', 'pilotage.ohada.demo@cashpilot.cloud'),
      password: requireEnv('PILOTAGE_OHADA_PASSWORD'),
      vatRate: Number(optionalEnv('PILOTAGE_OHADA_VAT_RATE', '19.25')),
    },
  ];

  const runId = `${Date.now().toString(36)}${shortId()}`;
  const serviceClient = buildClient(supabaseUrl, serviceRoleKey);

  for (const account of accounts) {
    const user = await getUserByEmail(serviceClient, account.email);
    assert(user, `Demo account not found: ${account.email}`);
  }

  const results = [];
  for (const account of accounts) {
    const entry = await runAccountFlow({
      supabaseUrl,
      anonKey,
      serviceRoleKey,
      serviceClient,
      account,
      runId,
    });
    results.push(entry);
  }

  const failed = results.filter((r) => !r.passed);
  const summary = {
    generatedAt: new Date().toISOString(),
    runId,
    totals: {
      totalAccounts: results.length,
      passedAccounts: results.length - failed.length,
      failedAccounts: failed.length,
    },
    results,
    failedKeys: failed.map((r) => r.key),
  };

  const outputDir = path.resolve('artifacts', 'advanced-demo-smoke');
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2));

  console.log(JSON.stringify(summary, null, 2));
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[smoke-advanced-demo-business-flow] fatal:', error?.message || error);
  process.exitCode = 1;
});
