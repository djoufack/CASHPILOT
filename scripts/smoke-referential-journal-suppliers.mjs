import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function buildClient(url, key) {
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function buildRunId() {
  return new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
}

function assertCondition(condition, message, details = {}) {
  if (condition) return;
  const error = new Error(message);
  error.details = details;
  throw error;
}

async function safeDeleteByEq(client, table, column, value) {
  const { error } = await client.from(table).delete().eq(column, value);
  if (error && !['PGRST116', 'PGRST204', '42P01'].includes(error.code)) {
    throw error;
  }
}

async function safeDeleteByIds(client, table, ids) {
  if (!ids?.length) return;
  const { error } = await client.from(table).delete().in('id', ids);
  if (error && !['PGRST116', 'PGRST204', '42P01'].includes(error.code)) {
    throw error;
  }
}

async function waitForEntries(client, sourceType, sourceId, expectedMin, timeoutMs = 8000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const { data, error } = await client
      .from('accounting_entries')
      .select('id, account_code, debit, credit, company_id')
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    if ((data || []).length >= expectedMin) {
      return data || [];
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  const { data: lastData, error: lastError } = await client
    .from('accounting_entries')
    .select('id, account_code, debit, credit, company_id')
    .eq('source_type', sourceType)
    .eq('source_id', sourceId)
    .order('created_at', { ascending: true });
  if (lastError) throw lastError;
  return lastData || [];
}

async function expectForeignKeyViolation(client, table, payload) {
  const { error } = await client.from(table).insert([payload]);
  assertCondition(Boolean(error), `Expected FK error on ${table}, insert unexpectedly succeeded.`, { payload });

  const code = error?.code || '';
  const message = String(error?.message || '').toLowerCase();
  assertCondition(
    code === '23503' || message.includes('foreign key'),
    `Expected foreign key violation on ${table}.`,
    { code, message: error?.message, details: error?.details },
  );
}

async function main() {
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const runId = buildRunId();
  const today = new Date().toISOString().slice(0, 10);
  const dueDate = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10);

  const adminClient = buildClient(supabaseUrl, serviceRoleKey);
  const serviceClient = buildClient(supabaseUrl, serviceRoleKey);

  let tempUserId = null;
  const cleanup = {
    companyId: null,
    supplierId: null,
    supplierProductId: null,
    supplierServiceId: null,
    supplierInvoiceId: null,
  };

  const summary = {
    runId,
    passed: false,
    checks: {
      fkSupplierProducts: false,
      fkSupplierServices: false,
      fkSupplierInvoices: false,
      supplierInvoiceJournalCreated: false,
      supplierInvoicePaymentJournalCreated: false,
      companyScopeRespected: false,
      realTimeLatencyOk: false,
    },
    details: {},
    cleanup: {
      rowsDeleted: false,
      userDeleted: false,
    },
  };

  let executionError = null;

  try {
    const email = `smoke.ri.journal.${runId}@cashpilot.test`;
    const password = `CashPilot!${runId}Zz`;

    const { data: createdUser, error: createUserError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `Smoke RI Journal ${runId}` },
    });
    if (createUserError) throw createUserError;

    tempUserId = createdUser.user.id;
    summary.details.user = { id: tempUserId, email };

    const { data: company, error: companyError } = await serviceClient
      .from('company')
      .insert([{
        user_id: tempUserId,
        company_name: `Smoke RI Journal ${runId}`,
        company_type: 'company',
        country: 'BE',
        currency: 'EUR',
        accounting_currency: 'EUR',
        city: 'Brussels',
      }])
      .select('id')
      .single();
    if (companyError) throw companyError;
    cleanup.companyId = company.id;

    const { error: prefsError } = await serviceClient
      .from('user_company_preferences')
      .upsert({
        user_id: tempUserId,
        active_company_id: company.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    if (prefsError) throw prefsError;

    const { error: settingsError } = await serviceClient
      .from('user_accounting_settings')
      .upsert({
        user_id: tempUserId,
        country: 'BE',
        is_initialized: true,
        auto_journal_enabled: true,
      }, { onConflict: 'user_id' });
    if (settingsError) throw settingsError;

    const { data: supplier, error: supplierError } = await serviceClient
      .from('suppliers')
      .insert([{
        user_id: tempUserId,
        company_id: company.id,
        company_name: `Smoke Supplier ${runId}`,
        supplier_type: 'both',
        status: 'active',
        currency: 'EUR',
      }])
      .select('id')
      .single();
    if (supplierError) throw supplierError;
    cleanup.supplierId = supplier.id;

    const missingSupplierId = randomUUID();

    await expectForeignKeyViolation(serviceClient, 'supplier_products', {
      supplier_id: missingSupplierId,
      product_name: `Invalid FK Product ${runId}`,
      unit_price: 10,
    });
    summary.checks.fkSupplierProducts = true;

    await expectForeignKeyViolation(serviceClient, 'supplier_services', {
      supplier_id: missingSupplierId,
      service_name: `Invalid FK Service ${runId}`,
      pricing_type: 'hourly',
      hourly_rate: 100,
    });
    summary.checks.fkSupplierServices = true;

    await expectForeignKeyViolation(serviceClient, 'supplier_invoices', {
      company_id: company.id,
      supplier_id: missingSupplierId,
      invoice_number: `FK-SINV-${runId}`,
      invoice_date: today,
      due_date: dueDate,
      total_ht: 100,
      total_ttc: 121,
      vat_amount: 21,
      vat_rate: 21,
      total_amount: 121,
      currency: 'EUR',
      payment_status: 'pending',
      status: 'received',
    });
    summary.checks.fkSupplierInvoices = true;

    const { data: supplierProduct, error: supplierProductError } = await serviceClient
      .from('supplier_products')
      .insert([{
        supplier_id: supplier.id,
        product_name: `Smoke Product ${runId}`,
        sku: `SMK-RI-${runId}`,
        unit: 'piece',
        unit_price: 42,
        stock_quantity: 0,
        min_stock_level: 0,
        reorder_quantity: 0,
      }])
      .select('id')
      .single();
    if (supplierProductError) throw supplierProductError;
    cleanup.supplierProductId = supplierProduct.id;

    const { data: supplierService, error: supplierServiceError } = await serviceClient
      .from('supplier_services')
      .insert([{
        supplier_id: supplier.id,
        service_name: `Smoke Service ${runId}`,
        pricing_type: 'hourly',
        hourly_rate: 126.5,
        availability: 'available',
      }])
      .select('id')
      .single();
    if (supplierServiceError) throw supplierServiceError;
    cleanup.supplierServiceId = supplierService.id;

    const invoiceNumber = `SINV-SMOKE-${runId}`;
    const insertStartedAt = Date.now();
    const { data: invoice, error: invoiceError } = await serviceClient
      .from('supplier_invoices')
      .insert([{
        company_id: company.id,
        supplier_id: supplier.id,
        invoice_number: invoiceNumber,
        invoice_date: today,
        due_date: dueDate,
        status: 'received',
        payment_status: 'pending',
        total_amount: 121,
        total_ht: 100,
        total_ttc: 121,
        vat_amount: 21,
        vat_rate: 21,
        currency: 'EUR',
        supplier_name_extracted: `Smoke Supplier ${runId}`,
      }])
      .select('id, company_id, status, payment_status')
      .single();
    if (invoiceError) throw invoiceError;
    cleanup.supplierInvoiceId = invoice.id;

    const invoiceEntries = await waitForEntries(serviceClient, 'supplier_invoice', invoice.id, 2, 10000);
    summary.details.supplierInvoiceEntries = invoiceEntries;

    summary.checks.supplierInvoiceJournalCreated = invoiceEntries.length >= 2
      && invoiceEntries.some((entry) => Number(entry.debit) > 0)
      && invoiceEntries.some((entry) => Number(entry.credit) > 0);
    assertCondition(summary.checks.supplierInvoiceJournalCreated, 'Expected supplier invoice accounting entries after insert.', {
      invoiceEntries,
    });

    const insertLatencyMs = Date.now() - insertStartedAt;
    summary.details.insertToJournalLatencyMs = insertLatencyMs;
    summary.checks.realTimeLatencyOk = insertLatencyMs <= 10000;

    const { error: markPaidError } = await serviceClient
      .from('supplier_invoices')
      .update({
        payment_status: 'paid',
      })
      .eq('id', invoice.id);
    if (markPaidError) throw markPaidError;

    const paymentEntries = await waitForEntries(serviceClient, 'supplier_invoice_payment', invoice.id, 2, 10000);
    summary.details.supplierInvoicePaymentEntries = paymentEntries;

    summary.checks.supplierInvoicePaymentJournalCreated = paymentEntries.length >= 2
      && paymentEntries.some((entry) => Number(entry.debit) > 0)
      && paymentEntries.some((entry) => Number(entry.credit) > 0);
    assertCondition(summary.checks.supplierInvoicePaymentJournalCreated, 'Expected supplier invoice payment accounting entries after payment_status=paid.', {
      paymentEntries,
    });

    const allEntries = [...invoiceEntries, ...paymentEntries];
    summary.checks.companyScopeRespected = allEntries.every((entry) => entry.company_id === company.id);
    assertCondition(summary.checks.companyScopeRespected, 'Expected all generated accounting entries to keep company scope.', {
      expectedCompanyId: company.id,
      allEntries,
    });

    summary.passed = true;
  } catch (error) {
    executionError = error;
    summary.error = {
      message: error.message,
      details: error.details || null,
    };
  } finally {
    try {
      if (cleanup.supplierInvoiceId) {
        await safeDeleteByEq(serviceClient, 'accounting_entries', 'source_id', cleanup.supplierInvoiceId);
      }
      if (tempUserId) {
        await safeDeleteByEq(serviceClient, 'accounting_entries', 'user_id', tempUserId);
        await safeDeleteByEq(serviceClient, 'user_company_preferences', 'user_id', tempUserId);
        await safeDeleteByEq(serviceClient, 'user_accounting_settings', 'user_id', tempUserId);
      }

      if (cleanup.supplierInvoiceId) await safeDeleteByIds(serviceClient, 'supplier_invoices', [cleanup.supplierInvoiceId]);
      if (cleanup.supplierServiceId) await safeDeleteByIds(serviceClient, 'supplier_services', [cleanup.supplierServiceId]);
      if (cleanup.supplierProductId) await safeDeleteByIds(serviceClient, 'supplier_products', [cleanup.supplierProductId]);
      if (cleanup.supplierId) await safeDeleteByIds(serviceClient, 'suppliers', [cleanup.supplierId]);
      if (cleanup.companyId) await safeDeleteByIds(serviceClient, 'company', [cleanup.companyId]);

      summary.cleanup.rowsDeleted = true;
    } catch (cleanupError) {
      summary.cleanup.error = cleanupError.message;
    }

    if (tempUserId) {
      try {
        const { error } = await adminClient.auth.admin.deleteUser(tempUserId);
        if (error) throw error;
        summary.cleanup.userDeleted = true;
      } catch (deleteError) {
        summary.cleanup.deleteUserError = deleteError.message;
      }
    }
  }

  console.log(JSON.stringify(summary, null, 2));

  if (executionError) {
    throw executionError;
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    message: error.message,
    details: error.details || null,
  }, null, 2));
  process.exitCode = 1;
});
