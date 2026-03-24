import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

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
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function assert(condition, message, details = null) {
  if (condition) return;
  const error = new Error(message);
  if (details != null) {
    error.details = details;
  }
  throw error;
}

async function getActiveCompany(authClient, userId) {
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

  const activeCompanyId = prefsRes.data?.active_company_id || null;
  return (
    companies.find((company) => company.id === activeCompanyId) ||
    companies.find((company) => /portfolio/i.test(String(company.company_name || ''))) ||
    companies[0]
  );
}

async function readCount(authClient, table) {
  const { count, error } = await authClient.from(table).select('id', { count: 'exact', head: true });
  if (error) {
    return { ok: false, error: { code: error.code || null, message: error.message || String(error) } };
  }
  return { ok: true, count: Number(count || 0) };
}

async function runCrudForAccount({ supabaseUrl, anonKey, account, runId }) {
  const summary = {
    key: account.key,
    email: account.email,
    passed: false,
    failures: [],
    hrCounts: {},
    company: null,
    crud: {
      clients: { created: false, read: false, updated: false, deleted: false },
      invoices: { created: false, read: false, updated: false, deleted: false },
      invoice_items: { created: false, read: false, updated: false, deleted: false },
    },
  };

  const cleanup = {
    clientId: null,
    invoiceId: null,
    invoiceItemId: null,
  };

  const authClient = buildClient(supabaseUrl, anonKey);

  try {
    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
      email: account.email,
      password: account.password,
    });
    if (authError) throw authError;

    const userId = authData?.user?.id || null;
    assert(userId, `Sign-in succeeded but user id is missing for ${account.email}`);

    const company = await getActiveCompany(authClient, userId);
    summary.company = {
      id: company.id,
      name: company.company_name,
      country: company.country,
      currency: company.currency,
    };

    for (const table of [
      'team_members',
      'hr_employees',
      'hr_departments',
      'hr_leave_requests',
      'hr_training_catalog',
      'material_assets',
    ]) {
      summary.hrCounts[table] = await readCount(authClient, table);
    }

    const suffix = `${account.key.toLowerCase()}-${runId}`;
    const createdClientName = `Smoke CRUD ${account.key} ${runId}`;
    const createdClientEmail = `smoke.crud.${suffix}@cashpilot.test`;

    const { data: createdClient, error: createdClientError } = await authClient
      .from('clients')
      .insert({
        user_id: userId,
        company_id: company.id,
        company_name: createdClientName,
        email: createdClientEmail,
        country: company.country || 'FR',
        city: 'Brussels',
      })
      .select('id, user_id, company_id, company_name, city')
      .single();
    if (createdClientError) throw createdClientError;
    cleanup.clientId = createdClient.id;
    summary.crud.clients.created = true;

    const { data: readClient, error: readClientError } = await authClient
      .from('clients')
      .select('id, user_id, company_id, company_name, city')
      .eq('id', createdClient.id)
      .single();
    if (readClientError) throw readClientError;
    assert(readClient.user_id === userId, 'Client user_id mismatch', { expected: userId, got: readClient.user_id });
    assert(readClient.company_id === company.id, 'Client company_id mismatch', { expected: company.id, got: readClient.company_id });
    summary.crud.clients.read = true;

    const updatedCity = 'Antwerp';
    const { data: updatedClient, error: updatedClientError } = await authClient
      .from('clients')
      .update({ city: updatedCity })
      .eq('id', createdClient.id)
      .select('id, city')
      .single();
    if (updatedClientError) throw updatedClientError;
    assert(updatedClient.city === updatedCity, 'Client city update failed', updatedClient);
    summary.crud.clients.updated = true;

    const invoiceNumber = `SMK-CRUD-${account.key}-${runId.toUpperCase()}`;
    const totalHt = 120;
    const totalTtc = Number((totalHt * (1 + Number(account.vatRate) / 100)).toFixed(2));
    const { data: createdInvoice, error: createdInvoiceError } = await authClient
      .from('invoices')
      .insert({
        user_id: userId,
        company_id: company.id,
        client_id: createdClient.id,
        invoice_number: invoiceNumber,
        date: isoDate(0),
        due_date: isoDate(20),
        status: 'draft',
        total_ht: totalHt,
        tax_rate: account.vatRate,
        total_ttc: totalTtc,
        balance_due: totalTtc,
        payment_status: 'unpaid',
        notes: `Smoke CRUD invoice ${runId}`,
      })
      .select('id, invoice_number, status, payment_status, total_ttc')
      .single();
    if (createdInvoiceError) throw createdInvoiceError;
    cleanup.invoiceId = createdInvoice.id;
    summary.crud.invoices.created = true;

    const { data: readInvoice, error: readInvoiceError } = await authClient
      .from('invoices')
      .select('id, invoice_number, status, payment_status, notes')
      .eq('id', createdInvoice.id)
      .single();
    if (readInvoiceError) throw readInvoiceError;
    assert(readInvoice.invoice_number === invoiceNumber, 'Invoice number mismatch after read', readInvoice);
    summary.crud.invoices.read = true;

    const updatedInvoiceNotes = `Smoke CRUD invoice updated ${runId}`;
    const { data: updatedInvoice, error: updatedInvoiceError } = await authClient
      .from('invoices')
      .update({ notes: updatedInvoiceNotes })
      .eq('id', createdInvoice.id)
      .select('id, notes')
      .single();
    if (updatedInvoiceError) throw updatedInvoiceError;
    assert(updatedInvoice.notes === updatedInvoiceNotes, 'Invoice notes update failed', updatedInvoice);
    summary.crud.invoices.updated = true;

    const { data: createdItem, error: createdItemError } = await authClient
      .from('invoice_items')
      .insert({
        invoice_id: createdInvoice.id,
        description: `Smoke CRUD item ${account.key}`,
        quantity: 1,
        unit_price: totalHt,
        total: totalHt,
      })
      .select('id, invoice_id, quantity, unit_price, total')
      .single();
    if (createdItemError) throw createdItemError;
    cleanup.invoiceItemId = createdItem.id;
    summary.crud.invoice_items.created = true;

    const { data: readItem, error: readItemError } = await authClient
      .from('invoice_items')
      .select('id, invoice_id, quantity, unit_price, total')
      .eq('id', createdItem.id)
      .single();
    if (readItemError) throw readItemError;
    assert(readItem.invoice_id === createdInvoice.id, 'Invoice item invoice_id mismatch', readItem);
    summary.crud.invoice_items.read = true;

    const { data: updatedItem, error: updatedItemError } = await authClient
      .from('invoice_items')
      .update({
        quantity: 2,
        total: Number((Number(createdItem.unit_price) * 2).toFixed(2)),
      })
      .eq('id', createdItem.id)
      .select('id, quantity, unit_price, total')
      .single();
    if (updatedItemError) throw updatedItemError;
    assert(Number(updatedItem.quantity) === 2, 'Invoice item quantity update failed', updatedItem);
    summary.crud.invoice_items.updated = true;

    const { error: deleteItemError } = await authClient
      .from('invoice_items')
      .delete()
      .eq('id', createdItem.id);
    if (deleteItemError) throw deleteItemError;
    cleanup.invoiceItemId = null;
    const { data: deletedItemCheck, error: deletedItemCheckError } = await authClient
      .from('invoice_items')
      .select('id')
      .eq('id', createdItem.id)
      .maybeSingle();
    if (deletedItemCheckError) throw deletedItemCheckError;
    assert(!deletedItemCheck, 'Invoice item still present after delete', deletedItemCheck);
    summary.crud.invoice_items.deleted = true;

    const { error: deleteInvoiceError } = await authClient
      .from('invoices')
      .delete()
      .eq('id', createdInvoice.id);
    if (deleteInvoiceError) throw deleteInvoiceError;
    cleanup.invoiceId = null;
    const { data: deletedInvoiceCheck, error: deletedInvoiceCheckError } = await authClient
      .from('invoices')
      .select('id')
      .eq('id', createdInvoice.id)
      .maybeSingle();
    if (deletedInvoiceCheckError) throw deletedInvoiceCheckError;
    assert(!deletedInvoiceCheck, 'Invoice still present after delete', deletedInvoiceCheck);
    summary.crud.invoices.deleted = true;

    const { error: deleteClientError } = await authClient
      .from('clients')
      .delete()
      .eq('id', createdClient.id);
    if (deleteClientError) throw deleteClientError;
    cleanup.clientId = null;
    const { data: deletedClientCheck, error: deletedClientCheckError } = await authClient
      .from('clients')
      .select('id')
      .eq('id', createdClient.id)
      .maybeSingle();
    if (deletedClientCheckError) throw deletedClientCheckError;
    assert(!deletedClientCheck, 'Client still present after delete', deletedClientCheck);
    summary.crud.clients.deleted = true;

    summary.passed = true;
  } catch (error) {
    summary.passed = false;
    summary.failures.push({
      message: error?.message || String(error),
      details: error?.details || null,
    });
  } finally {
    try {
      if (cleanup.invoiceItemId) {
        await authClient.from('invoice_items').delete().eq('id', cleanup.invoiceItemId);
      }
      if (cleanup.invoiceId) {
        await authClient.from('invoices').delete().eq('id', cleanup.invoiceId);
      }
      if (cleanup.clientId) {
        await authClient.from('clients').delete().eq('id', cleanup.clientId);
      }
    } catch (cleanupError) {
      summary.failures.push({
        message: `cleanup_failed: ${cleanupError?.message || String(cleanupError)}`,
        details: null,
      });
      summary.passed = false;
    }

    await authClient.auth.signOut();
  }

  return summary;
}

async function main() {
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const anonKey = requireEnv('SUPABASE_ANON_KEY');

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

  const runId = `${Date.now().toString(36)}${randomUUID().slice(0, 8).replace(/-/g, '')}`;
  const results = [];

  for (const account of accounts) {
    const result = await runCrudForAccount({ supabaseUrl, anonKey, account, runId });
    results.push(result);
  }

  const failed = results.filter((result) => !result.passed);
  const summary = {
    generatedAt: new Date().toISOString(),
    runId,
    totals: {
      totalAccounts: results.length,
      passedAccounts: results.length - failed.length,
      failedAccounts: failed.length,
    },
    results,
    failedKeys: failed.map((result) => result.key),
  };

  const outputDir = path.resolve('artifacts', 'demo-user-crud');
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2));

  console.log(JSON.stringify(summary, null, 2));
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[smoke-demo-user-crud] fatal:', error?.message || error);
  process.exitCode = 1;
});
