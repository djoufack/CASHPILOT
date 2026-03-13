import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
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

function assertCondition(condition, message, details = {}) {
  if (condition) return;
  const error = new Error(message);
  error.details = details;
  throw error;
}

function buildRunId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function isoDate(offsetDays = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function isUnknownColumnError(error) {
  const message = String(error?.message || '');
  return /could not find the ['"][^'"]+['"] column/i.test(message);
}

function getUnknownColumnName(error) {
  const message = String(error?.message || '');
  const match = message.match(/could not find the ['"]([^'"]+)['"] column/i);
  return match?.[1] || null;
}

async function insertSingleWithSchemaFallback(client, table, payload, selectColumns = '*') {
  let attemptPayload = { ...payload };

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data, error } = await client
      .from(table)
      .insert([attemptPayload])
      .select(selectColumns)
      .single();

    if (!error) return data;

    const unknownColumn = getUnknownColumnName(error);
    if (isUnknownColumnError(error) && unknownColumn && Object.prototype.hasOwnProperty.call(attemptPayload, unknownColumn)) {
      const { [unknownColumn]: _ignored, ...nextPayload } = attemptPayload;
      attemptPayload = nextPayload;
      continue;
    }

    throw error;
  }

  throw new Error(`Unable to insert row into ${table}: schema fallback exhausted.`);
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

function extractOperation(details) {
  if (!details) return null;
  if (typeof details === 'string') {
    try {
      const parsed = JSON.parse(details);
      return parsed?.operation || null;
    } catch {
      return null;
    }
  }
  return details.operation || null;
}

async function main() {
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  const adminClient = buildClient(supabaseUrl, serviceRoleKey);
  const serviceClient = buildClient(supabaseUrl, serviceRoleKey);

  const runId = buildRunId();
  const startedAt = new Date(Date.now() - (10 * 60 * 1000)).toISOString();
  const today = isoDate(0);
  const veryOldDate = '1900-01-01';

  let tempUserId = null;
  const cleanup = {
    companyId: null,
    clientId: null,
    recurringId: null,
    lineItemIds: [],
    generatedInvoiceId: null,
  };

  const summary = {
    runId,
    passed: false,
    checks: {
      rpcGeneratedInvoice: false,
      recurringTemplateProgressed: false,
      auditInvoiceInsert: false,
      auditInvoiceUpdate: false,
      auditLineItemInsert: false,
      auditLineItemUpdate: false,
      auditLineItemDelete: false,
      auditInvoiceItemInsert: false,
    },
    ids: {},
    cleanup: {
      rowsDeleted: false,
      userDeleted: false,
    },
  };

  let executionError = null;

  try {
    const email = `smoke.recurring.audit.${runId}@cashpilot.test`;
    const password = `CashPilot!${runId.slice(-10)}Zz`;

    const { data: createdUser, error: createUserError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `Smoke Recurring Audit ${runId}` },
    });
    if (createUserError) throw createUserError;
    tempUserId = createdUser.user.id;
    summary.ids.userId = tempUserId;

    const company = await insertSingleWithSchemaFallback(serviceClient, 'company', {
      user_id: tempUserId,
      company_name: `Smoke Recurring Audit ${runId}`,
      company_type: 'company',
      country: 'BE',
      currency: 'EUR',
      accounting_currency: 'EUR',
      city: 'Brussels',
      email,
    }, 'id');
    cleanup.companyId = company.id;
    summary.ids.companyId = company.id;

    const { error: prefsError } = await serviceClient
      .from('user_company_preferences')
      .upsert({
        user_id: tempUserId,
        active_company_id: company.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    if (prefsError) throw prefsError;

    const client = await insertSingleWithSchemaFallback(serviceClient, 'clients', {
      user_id: tempUserId,
      company_id: company.id,
      company_name: `Smoke Client ${runId}`,
      email: `smoke.recurring.client.${runId}@cashpilot.test`,
      country: 'BE',
      city: 'Brussels',
    }, 'id');
    cleanup.clientId = client.id;
    summary.ids.clientId = client.id;

    const recurring = await insertSingleWithSchemaFallback(serviceClient, 'recurring_invoices', {
      user_id: tempUserId,
      company_id: company.id,
      client_id: client.id,
      title: `Smoke Recurring ${runId}`,
      description: 'Integration test for generate_due_recurring_invoices',
      frequency: 'monthly',
      interval_count: 1,
      status: 'active',
      currency: 'EUR',
      total_ht: 100,
      tva_rate: 20,
      total_tva: 20,
      total_ttc: 120,
      start_date: veryOldDate,
      next_generation_date: veryOldDate,
      next_date: veryOldDate,
      day_of_month: 1,
    }, 'id, next_generation_date, invoices_generated, status');
    cleanup.recurringId = recurring.id;
    summary.ids.recurringId = recurring.id;

    const lineItemMain = await insertSingleWithSchemaFallback(serviceClient, 'recurring_invoice_line_items', {
      recurring_invoice_id: recurring.id,
      description: `Recurring Main Item ${runId}`,
      quantity: 1,
      unit_price: 100,
      total: 100,
      sort_order: 1,
    }, 'id');
    cleanup.lineItemIds.push(lineItemMain.id);

    const lineItemForCrud = await insertSingleWithSchemaFallback(serviceClient, 'recurring_invoice_line_items', {
      recurring_invoice_id: recurring.id,
      description: `Recurring CRUD Item ${runId}`,
      quantity: 1,
      unit_price: 10,
      total: 10,
      sort_order: 2,
    }, 'id');
    cleanup.lineItemIds.push(lineItemForCrud.id);

    const { error: lineUpdateError } = await serviceClient
      .from('recurring_invoice_line_items')
      .update({ total: 12, unit_price: 12 })
      .eq('id', lineItemForCrud.id);
    if (lineUpdateError) throw lineUpdateError;

    const { error: lineDeleteError } = await serviceClient
      .from('recurring_invoice_line_items')
      .delete()
      .eq('id', lineItemForCrud.id);
    if (lineDeleteError) throw lineDeleteError;
    cleanup.lineItemIds = cleanup.lineItemIds.filter((id) => id !== lineItemForCrud.id);

    const { data: rpcResult, error: rpcError } = await serviceClient.rpc('generate_due_recurring_invoices', {
      p_today: today,
      p_limit: 1,
    });
    if (rpcError) throw rpcError;

    const generatedRow = (rpcResult || []).find((row) => row.recurring_id === recurring.id);
    assertCondition(Boolean(generatedRow?.invoice_id), 'RPC did not generate an invoice for the due recurring template.', {
      recurringId: recurring.id,
      rpcResult,
    });
    summary.checks.rpcGeneratedInvoice = true;
    cleanup.generatedInvoiceId = generatedRow.invoice_id;
    summary.ids.generatedInvoiceId = generatedRow.invoice_id;

    const { data: recurringAfterRpc, error: recurringAfterRpcError } = await serviceClient
      .from('recurring_invoices')
      .select('id, next_generation_date, invoices_generated, last_generated_at, status')
      .eq('id', recurring.id)
      .single();
    if (recurringAfterRpcError) throw recurringAfterRpcError;

    summary.checks.recurringTemplateProgressed = Number(recurringAfterRpc.invoices_generated || 0) >= 1
      && Boolean(recurringAfterRpc.last_generated_at)
      && Boolean(recurringAfterRpc.next_generation_date)
      && recurringAfterRpc.status === 'active';
    assertCondition(summary.checks.recurringTemplateProgressed, 'Recurring template was not updated after generation.', {
      recurringAfterRpc,
    });

    const { error: invoiceUpdateError } = await serviceClient
      .from('invoices')
      .update({ notes: `Smoke update ${runId}` })
      .eq('id', generatedRow.invoice_id);
    if (invoiceUpdateError) throw invoiceUpdateError;

    const { data: generatedInvoiceItems, error: generatedInvoiceItemsError } = await serviceClient
      .from('invoice_items')
      .select('id')
      .eq('invoice_id', generatedRow.invoice_id);
    if (generatedInvoiceItemsError) throw generatedInvoiceItemsError;
    const generatedInvoiceItemIds = (generatedInvoiceItems || []).map((row) => row.id).filter(Boolean);

    const expectedSourceIds = [
      generatedRow.invoice_id,
      lineItemForCrud.id,
      ...generatedInvoiceItemIds,
    ];

    const { data: auditRows, error: auditRowsError } = await serviceClient
      .from('accounting_audit_log')
      .select('id, created_at, source_table, source_id, details')
      .eq('event_type', 'data_access')
      .in('source_id', expectedSourceIds)
      .gte('created_at', startedAt)
      .order('created_at', { ascending: true });
    if (auditRowsError) throw auditRowsError;

    const rows = auditRows || [];
    const hasAudit = (table, operation, sourceId = null) => rows.some((row) => (
      row.source_table === table
      && extractOperation(row.details) === operation
      && (sourceId ? row.source_id === sourceId : true)
    ));

    summary.checks.auditInvoiceInsert = hasAudit('invoices', 'insert', generatedRow.invoice_id);
    summary.checks.auditInvoiceUpdate = hasAudit('invoices', 'update', generatedRow.invoice_id);
    summary.checks.auditLineItemInsert = hasAudit('recurring_invoice_line_items', 'insert', lineItemForCrud.id);
    summary.checks.auditLineItemUpdate = hasAudit('recurring_invoice_line_items', 'update', lineItemForCrud.id);
    summary.checks.auditLineItemDelete = hasAudit('recurring_invoice_line_items', 'delete', lineItemForCrud.id);
    summary.checks.auditInvoiceItemInsert = generatedInvoiceItemIds.some((invoiceItemId) => hasAudit('invoice_items', 'insert', invoiceItemId));

    const failedChecks = Object.entries(summary.checks).filter(([, ok]) => !ok);
    assertCondition(failedChecks.length === 0, 'Financial CRUD audit checks failed.', {
      failedChecks: failedChecks.map(([name]) => name),
      auditRows: rows,
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
      if (cleanup.generatedInvoiceId) {
        await safeDeleteByEq(serviceClient, 'invoice_items', 'invoice_id', cleanup.generatedInvoiceId);
        await safeDeleteByIds(serviceClient, 'invoices', [cleanup.generatedInvoiceId]);
      }
      if (cleanup.lineItemIds.length) {
        await safeDeleteByIds(serviceClient, 'recurring_invoice_line_items', cleanup.lineItemIds);
      }
      if (cleanup.recurringId) {
        await safeDeleteByIds(serviceClient, 'recurring_invoices', [cleanup.recurringId]);
      }
      if (cleanup.clientId) {
        await safeDeleteByIds(serviceClient, 'clients', [cleanup.clientId]);
      }

      if (tempUserId) {
        await safeDeleteByEq(serviceClient, 'payment_reminder_logs', 'user_id', tempUserId);
        await safeDeleteByEq(serviceClient, 'accounting_entries', 'user_id', tempUserId);
        await safeDeleteByEq(serviceClient, 'accounting_audit_log', 'user_id', tempUserId);
        await safeDeleteByEq(serviceClient, 'user_company_preferences', 'user_id', tempUserId);
        await safeDeleteByEq(serviceClient, 'user_accounting_settings', 'user_id', tempUserId);
      }

      if (cleanup.companyId) {
        await safeDeleteByIds(serviceClient, 'company', [cleanup.companyId]);
      }

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
